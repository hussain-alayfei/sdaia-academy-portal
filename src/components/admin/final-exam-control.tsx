'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'

import {
  getFinalExamBoard,
  grantFinalExamAccess,
  resetStudentAttempt,
  revokeFinalExamAccess,
  startPracticeAttempt,
} from '@/app/actions/final-exam'
import { resetAttempts } from '@/app/actions/questions'
import {
  setAssessmentResultsReleased,
  toggleAssessmentLocked,
  unlockFrozenAttempt,
} from '@/app/actions/admin'
import { AlertIcon, ClockIcon } from '@/components/icons'
import { Alert, Button, cx } from '@/components/ui'

type Board = Awaited<ReturnType<typeof getFinalExamBoard>>

const STATUS_LABEL: Record<Board['rows'][number]['status'], string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  warnings: 'Warnings',
  frozen: 'Frozen',
  submitted: 'Submitted',
}

export function FinalExamControl({
  courseId,
  assessmentId,
  initial,
  enrolledOptions,
}: {
  courseId: string
  assessmentId: string
  initial: Board
  enrolledOptions: Array<{ id: string; label: string }>
}) {
  const [board, setBoard] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const next = await getFinalExamBoard({ courseId, assessmentId })
        setBoard(next)
      } catch {
        // Keep the last good snapshot; the next tick will try again.
      }
    })
  }, [assessmentId, courseId])

  useEffect(() => {
    const id = window.setInterval(refresh, 5000)
    return () => window.clearInterval(id)
  }, [refresh])

  const counts = useMemo(() => {
    const tally = {
      not_started: 0,
      in_progress: 0,
      warnings: 0,
      frozen: 0,
      submitted: 0,
    }
    for (const row of board.rows) tally[row.status] += 1
    return tally
  }, [board.rows])

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return board.rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (!q) return true
      return (
        row.fullName.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q)
      )
    })
  }, [board.rows, filter, statusFilter])

  const a = board.assessment
  const warningLimit = a.integrity_warning_limit ?? 3

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-semibold text-navy-900">{a.title}</h2>
            <p className="mt-1 text-[13px] text-ink-soft">
              {a.duration_minutes} minutes · {a.required_question_count} questions
              · {warningLimit} warnings then freeze
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill ok={a.is_published}>
                {a.is_published ? 'Published' : 'Draft'}
              </Pill>
              <Pill ok={!a.is_locked}>{a.is_locked ? 'Locked' : 'Unlocked'}</Pill>
              <Pill ok={!a.results_released}>
                {a.results_released ? 'Results released' : 'Results hidden'}
              </Pill>
            </div>
          </div>

          <form action={startPracticeAttempt}>
            <input type="hidden" name="course_id" value={courseId} />
            <input type="hidden" name="assessment_id" value={assessmentId} />
            <Button type="submit">Sit as student (dry run)</Button>
          </form>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          <form action={toggleAssessmentLocked}>
            <input type="hidden" name="course_id" value={courseId} />
            <input type="hidden" name="assessment_id" value={assessmentId} />
            <input
              type="hidden"
              name="return_to"
              value={`/admin/courses/${courseId}/final-exam`}
            />
            <input
              type="hidden"
              name="next"
              value={a.is_locked ? 'false' : 'true'}
            />
            <Button type="submit" variant={a.is_locked ? 'primary' : 'secondary'}>
              {a.is_locked ? 'Unlock paper for class' : 'Lock paper'}
            </Button>
          </form>

          <form action={setAssessmentResultsReleased}>
            <input type="hidden" name="course_id" value={courseId} />
            <input type="hidden" name="assessment_id" value={assessmentId} />
            <input
              type="hidden"
              name="return_to"
              value={`/admin/courses/${courseId}/final-exam`}
            />
            <input
              type="hidden"
              name="released"
              value={a.results_released ? 'false' : 'true'}
            />
            <Button type="submit" variant="secondary">
              {a.results_released ? 'Hide marks' : 'Release marks'}
            </Button>
          </form>

          <form
            action={resetAttempts}
            onSubmit={(event) => {
              if (
                !window.confirm(
                  'Delete ALL student attempts and scores for this final exam?'
                )
              ) {
                event.preventDefault()
              }
            }}
          >
            <input type="hidden" name="course_id" value={courseId} />
            <input type="hidden" name="assessment_id" value={assessmentId} />
            <input
              type="hidden"
              name="return_to"
              value={`/admin/courses/${courseId}/final-exam`}
            />
            <Button type="submit" variant="ghost">
              Reset all attempts
            </Button>
          </form>

          <button
            type="button"
            onClick={refresh}
            className="ms-auto text-[13px] font-medium text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-navy-900"
          >
            Refresh now
            {pending ? '…' : ''}
          </button>
        </div>
      </section>

      <section className="rounded-md border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
          <h3 className="text-[15px] font-semibold text-navy-900">Live board</h3>
          <p className="text-[12px] text-ink-faint">
            Updated {new Date(board.fetchedAt).toLocaleTimeString()} · every 5s
          </p>
          <div className="ms-auto flex flex-wrap gap-3 text-[12px] tabular-nums text-ink-soft">
            <span>{counts.not_started} waiting</span>
            <span>{counts.in_progress + counts.warnings} live</span>
            <span className="text-danger-600">{counts.frozen} frozen</span>
            <span>{counts.submitted} done</span>
          </div>
        </div>

        {counts.frozen > 0 ? (
          <Alert tone="danger" className="m-4" title="Students need unlock">
            {counts.frozen} attempt{counts.frozen === 1 ? '' : 's'} frozen at the
            warning limit. Unlock from the row below — the clock pauses while they
            wait.
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3 sm:px-5">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search name or email"
            className="min-w-[12rem] flex-1 rounded-sm border border-line-strong bg-canvas px-3 py-1.5 text-[14px]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-sm border border-line-strong bg-canvas px-3 py-1.5 text-[14px]"
          >
            <option value="all">All statuses</option>
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="warnings">Warnings</option>
            <option value="frozen">Frozen</option>
            <option value="submitted">Submitted</option>
          </select>
        </div>

        <ul className="divide-y divide-line">
          {visible.map((row) => (
            <li
              key={row.studentId}
              className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-navy-900">
                  {row.fullName}
                </p>
                <p className="truncate text-[12px] text-ink-faint">{row.email}</p>
              </div>

              <StatusBadge
                status={row.status}
                warnings={row.warningCount}
                limit={warningLimit}
              />

              {row.status === 'submitted' && row.correctCount != null ? (
                <span className="text-[13px] tabular-nums text-ink-soft">
                  {row.correctCount}/{row.questionCount ?? '—'}
                </span>
              ) : null}

              <div className="flex flex-wrap gap-1.5">
                {row.status === 'frozen' && row.attemptId ? (
                  <form
                    action={unlockFrozenAttempt}
                    className="flex items-center gap-1"
                  >
                    <input type="hidden" name="course_id" value={courseId} />
                    <input type="hidden" name="assessment_id" value={assessmentId} />
                    <input type="hidden" name="attempt_id" value={row.attemptId} />
                    <input
                      type="hidden"
                      name="return_to"
                      value={`/admin/courses/${courseId}/final-exam`}
                    />
                    <input
                      type="number"
                      name="extra_minutes"
                      defaultValue={0}
                      min={0}
                      max={60}
                      className="w-14 rounded-sm border border-line-strong px-1.5 py-1 text-[12px]"
                      title="Extra minutes"
                    />
                    <Button type="submit" size="sm">
                      Unfreeze
                    </Button>
                  </form>
                ) : null}

                {row.status === 'not_started' ? (
                  <form action={grantFinalExamAccess}>
                    <input type="hidden" name="course_id" value={courseId} />
                    <input type="hidden" name="assessment_id" value={assessmentId} />
                    <input type="hidden" name="student_id" value={row.studentId} />
                    <Button type="submit" size="sm" variant="secondary">
                      Allow to start
                    </Button>
                  </form>
                ) : null}

                {row.attemptId ? (
                  <form
                    action={resetStudentAttempt}
                    onSubmit={(event) => {
                      if (
                        !window.confirm(
                          `Reset ${row.fullName}'s attempt? This cannot be undone.`
                        )
                      ) {
                        event.preventDefault()
                      }
                    }}
                  >
                    <input type="hidden" name="course_id" value={courseId} />
                    <input type="hidden" name="assessment_id" value={assessmentId} />
                    <input type="hidden" name="attempt_id" value={row.attemptId} />
                    <input type="hidden" name="student_id" value={row.studentId} />
                    <Button type="submit" size="sm" variant="ghost">
                      Reset
                    </Button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
          {visible.length === 0 ? (
            <li className="px-4 py-8 text-center text-[14px] text-ink-faint">
              No students match this filter.
            </li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-md border border-line bg-surface p-4 sm:p-5">
        <h3 className="text-[15px] font-semibold text-navy-900">Allowlist</h3>
        <p className="mt-1 text-[13px] text-ink-soft">
          Let specific students start while the class paper stays locked. Optional
          open/close times set a window.
        </p>

        <form
          action={grantFinalExamAccess}
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
        >
          <input type="hidden" name="course_id" value={courseId} />
          <input type="hidden" name="assessment_id" value={assessmentId} />
          <label className="block text-[12px] font-medium text-ink-soft">
            Student
            <select
              name="student_id"
              required
              className="mt-1 w-full rounded-sm border border-line-strong bg-canvas px-3 py-2 text-[14px]"
              defaultValue=""
            >
              <option value="" disabled>
                Choose…
              </option>
              {enrolledOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-medium text-ink-soft">
            Opens (optional)
            <input
              type="datetime-local"
              name="opens_at"
              className="mt-1 w-full rounded-sm border border-line-strong bg-canvas px-3 py-2 text-[14px]"
            />
          </label>
          <label className="block text-[12px] font-medium text-ink-soft">
            Closes (optional)
            <input
              type="datetime-local"
              name="closes_at"
              className="mt-1 w-full rounded-sm border border-line-strong bg-canvas px-3 py-2 text-[14px]"
            />
          </label>
          <Button type="submit">Grant access</Button>
        </form>

        {board.grants.length > 0 ? (
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {board.grants.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-navy-900">
                    {g.fullName}
                  </p>
                  <p className="text-[12px] text-ink-faint">
                    Opens {new Date(g.opensAt).toLocaleString()}
                    {g.closesAt
                      ? ` · closes ${new Date(g.closesAt).toLocaleString()}`
                      : ' · no end'}
                  </p>
                </div>
                <form action={revokeFinalExamAccess}>
                  <input type="hidden" name="course_id" value={courseId} />
                  <input type="hidden" name="assessment_id" value={assessmentId} />
                  <input type="hidden" name="grant_id" value={g.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Revoke
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[13px] text-ink-faint">No grants yet.</p>
        )}
      </section>

      <p className="text-[12px] text-ink-faint">
        Dry run uses the real exam runner (fullscreen, warnings, timer). On submit
        or exit the practice attempt is deleted — nothing appears on the score
        matrix.
      </p>
    </div>
  )
}

function Pill({
  ok,
  children,
}: {
  ok: boolean
  children: React.ReactNode
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-xs border px-2 py-1 text-[12px] font-semibold',
        ok
          ? 'border-teal-300 bg-teal-50 text-teal-800'
          : 'border-amber-300 bg-amber-50 text-amber-800'
      )}
    >
      {children}
    </span>
  )
}

function StatusBadge({
  status,
  warnings,
  limit,
}: {
  status: Board['rows'][number]['status']
  warnings: number
  limit: number
}) {
  const tone =
    status === 'frozen'
      ? 'border-danger-500/40 bg-danger-50 text-danger-600'
      : status === 'warnings'
        ? 'border-amber-300 bg-amber-50 text-amber-800'
        : status === 'submitted'
          ? 'border-teal-300 bg-teal-50 text-teal-800'
          : status === 'in_progress'
            ? 'border-navy-300 bg-navy-50 text-navy-800'
            : 'border-line bg-canvas text-ink-soft'

  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-xs border px-2 py-1 text-[12px] font-semibold',
        tone
      )}
    >
      {status === 'frozen' ? <AlertIcon width={12} height={12} /> : null}
      {status === 'in_progress' || status === 'warnings' ? (
        <ClockIcon width={12} height={12} />
      ) : null}
      {STATUS_LABEL[status]}
      {warnings > 0 ? ` · ${warnings}/${limit}` : ''}
    </span>
  )
}
