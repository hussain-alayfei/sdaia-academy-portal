import Link from 'next/link'
import { notFound } from 'next/navigation'

import { removeStudent } from '@/app/actions/admin'
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  TrashIcon,
  UsersIcon,
} from '@/components/icons'
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  PanelHeader,
  cx,
} from '@/components/ui'
import { canManageCourse, getCourseById } from '@/lib/dal'
import { ASSESSMENT_LABELS, formatDate } from '@/lib/format'
import { getAssessments, getCourseDays, getRoster } from '@/lib/queries'
import { ATTEMPT_STATUS_LABELS, getCourseAttempts } from '@/lib/quiz'
import type { Assessment, AssessmentAttempt } from '@/lib/types'

type AssessmentWithDay = Assessment & { dayNumber: number | null }

function isFinished(attempt: AssessmentAttempt | undefined) {
  return Boolean(attempt && attempt.status !== 'in_progress')
}

function scorePercent(attempt: AssessmentAttempt | undefined) {
  if (!attempt?.question_count || attempt.correct_count === null) return null
  return Math.round((attempt.correct_count / attempt.question_count) * 100)
}

function elapsedLabel(attempt: AssessmentAttempt) {
  if (!attempt.submitted_at) return null
  const elapsed =
    new Date(attempt.submitted_at).getTime() -
    new Date(attempt.started_at).getTime()
  if (!Number.isFinite(elapsed) || elapsed < 0) return null
  const minutes = Math.max(1, Math.round(elapsed / 60_000))
  return `${minutes} min`
}

function statusTone(
  attempt: AssessmentAttempt | undefined
): 'neutral' | 'teal' | 'amber' | 'danger' {
  if (!attempt) return 'neutral'
  if (attempt.status === 'submitted') return 'teal'
  if (attempt.status === 'in_progress') return 'amber'
  return 'danger'
}

export default async function StudentsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const course = await getCourseById(id)
  if (!course || !(await canManageCourse(course))) notFound()

  const [roster, rawAssessments, days, attempts] = await Promise.all([
    getRoster(course.id),
    getAssessments(course.id),
    getCourseDays(course.id),
    getCourseAttempts(course.id),
  ])

  const dayNumbers = new Map(days.map((day) => [day.id, day.day_number]))
  const assessments: AssessmentWithDay[] = rawAssessments
    .map((assessment) => ({
      ...assessment,
      dayNumber: assessment.day_id
        ? (dayNumbers.get(assessment.day_id) ?? null)
        : null,
    }))
    .sort(
      (a, b) =>
        (a.dayNumber ?? 999) - (b.dayNumber ?? 999) || a.position - b.position
    )

  const byStudent = new Map<string, AssessmentAttempt[]>()
  for (const attempt of attempts) {
    const list = byStudent.get(attempt.student_id) ?? []
    list.push(attempt)
    byStudent.set(attempt.student_id, list)
  }

  const finishedAttempts = attempts.filter((attempt) =>
    isFinished(attempt)
  ).length
  const completeStudents = roster.filter((student) => {
    const own = byStudent.get(student.id) ?? []
    return (
      assessments.length > 0 &&
      assessments.every((assessment) =>
        isFinished(own.find((attempt) => attempt.assessment_id === assessment.id))
      )
    )
  }).length
  const integrityEvents = attempts.reduce(
    (total, attempt) => total + attempt.warning_count,
    0
  )

  return (
    <div className="space-y-4">
      <section
        aria-label="Roster summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryStat
          label="Enrolled students"
          value={roster.length}
          detail={`${completeStudents} completed every assessment`}
          icon={<UsersIcon width={17} height={17} />}
        />
        <SummaryStat
          label="Assessments"
          value={assessments.length}
          detail="Across all published and draft days"
          icon={<CheckIcon width={17} height={17} />}
        />
        <SummaryStat
          label="Finished attempts"
          value={finishedAttempts}
          detail={`${attempts.filter((a) => a.status === 'in_progress').length} currently in progress`}
          icon={<ClockIcon width={17} height={17} />}
        />
        <SummaryStat
          label="Integrity events"
          value={integrityEvents}
          detail="Open a student for assessment-level detail"
          icon={<AlertIcon width={17} height={17} />}
          attention={integrityEvents > 0}
        />
      </section>

      <Panel>
        <PanelHeader
          title="Students"
          description={
            roster.length === 0
              ? undefined
              : 'Progress, average score, integrity activity, and full assessment history for every enrolled student.'
          }
        />

        {roster.length === 0 ? (
          <EmptyState
            title="No students yet"
            description={`Share the course code ${course.join_code} so they can sign up and join.`}
          />
        ) : (
          <div className="scroll-x">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-navy-50/60">
                  {['Student', 'Progress', 'Average', 'Integrity', 'Assessment details'].map(
                    (label) => (
                      <th
                        key={label}
                        scope="col"
                        className="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-ink-soft uppercase first:sm:px-5"
                      >
                        {label}
                      </th>
                    )
                  )}
                  <th scope="col" className="px-3 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {roster.map((student) => {
                  const ownAttempts = byStudent.get(student.id) ?? []
                  const attemptByAssessment = new Map(
                    ownAttempts.map((attempt) => [attempt.assessment_id, attempt])
                  )
                  const finished = ownAttempts.filter((attempt) =>
                    isFinished(attempt)
                  )
                  const scored = finished
                    .map(scorePercent)
                    .filter((score): score is number => score !== null)
                  const average =
                    scored.length > 0
                      ? Math.round(
                          scored.reduce((sum, score) => sum + score, 0) /
                            scored.length
                        )
                      : null
                  const warnings = ownAttempts.reduce(
                    (sum, attempt) => sum + attempt.warning_count,
                    0
                  )
                  const missing = Math.max(0, assessments.length - finished.length)

                  return (
                    <tr
                      key={student.id}
                      className="align-top transition-colors hover:bg-navy-50/40"
                    >
                      <th
                        scope="row"
                        className="w-[230px] px-4 py-4 text-left font-normal sm:px-5"
                      >
                        <span className="block text-[14px] font-semibold text-navy-900">
                          {student.full_name || '—'}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-ink-soft">
                          {student.email}
                        </span>
                        <span className="mt-1 block text-[11px] text-ink-faint">
                          Enrolled {formatDate(student.enrolled_at)}
                        </span>
                      </th>

                      <td className="w-[120px] px-4 py-4">
                        <p className="text-[14px] font-semibold tabular-nums text-navy-900">
                          {finished.length}/{assessments.length}
                        </p>
                        <p
                          className={cx(
                            'mt-1 text-[11px]',
                            missing > 0 ? 'text-amber-700' : 'text-teal-700'
                          )}
                        >
                          {missing > 0
                            ? `${missing} still due`
                            : 'All completed'}
                        </p>
                      </td>

                      <td className="w-[100px] px-4 py-4">
                        {average === null ? (
                          <span className="text-[13px] text-ink-faint">—</span>
                        ) : (
                          <>
                            <p className="text-[14px] font-semibold tabular-nums text-navy-900">
                              {average}%
                            </p>
                            <p className="mt-1 text-[11px] text-ink-faint">
                              {scored.length} scored
                            </p>
                          </>
                        )}
                      </td>

                      <td className="w-[110px] px-4 py-4">
                        <Badge tone={warnings > 0 ? 'amber' : 'neutral'}>
                          {warnings} event{warnings === 1 ? '' : 's'}
                        </Badge>
                      </td>

                      <td className="min-w-[360px] px-4 py-3">
                        <details className="group rounded-sm border border-line bg-surface">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-[13px] font-medium text-navy-800 hover:bg-navy-50">
                            <span>
                              View {assessments.length} assessment
                              {assessments.length === 1 ? '' : 's'}
                            </span>
                            <span className="text-[11px] font-normal text-ink-faint group-open:hidden">
                              Scores, status, time, warnings
                            </span>
                            <span className="hidden text-[11px] font-normal text-ink-faint group-open:inline">
                              Hide details
                            </span>
                          </summary>
                          <div className="grid gap-2 border-t border-line p-2 lg:grid-cols-2">
                            {assessments.map((assessment) => (
                              <AssessmentDetail
                                key={assessment.id}
                                courseId={course.id}
                                assessment={assessment}
                                attempt={attemptByAssessment.get(assessment.id)}
                              />
                            ))}
                          </div>
                        </details>
                      </td>

                      <td className="px-3 py-4 text-right">
                        <form action={removeStudent}>
                          <input type="hidden" name="course_id" value={course.id} />
                          <input type="hidden" name="student_id" value={student.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove ${student.full_name} from this course`}
                            className="text-danger-600"
                          >
                            <TrashIcon width={14} height={14} />
                            Remove
                          </Button>
                        </form>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {roster.length > 0 && assessments.length === 0 ? (
          <p className="border-t border-line px-4 py-3 text-[13px] text-ink-soft sm:px-5">
            Add assessments on the Assessments tab. Scores appear here as students
            sit them.
          </p>
        ) : null}
      </Panel>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  detail,
  icon,
  attention = false,
}: {
  label: string
  value: number
  detail: string
  icon: React.ReactNode
  attention?: boolean
}) {
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-medium tracking-wide text-ink-soft uppercase">
          {label}
        </p>
        <span className={attention ? 'text-amber-600' : 'text-teal-700'}>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-[24px] font-semibold tabular-nums text-navy-900">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-ink-faint">{detail}</p>
    </div>
  )
}

function AssessmentDetail({
  courseId,
  assessment,
  attempt,
}: {
  courseId: string
  assessment: AssessmentWithDay
  attempt?: AssessmentAttempt
}) {
  const percent = scorePercent(attempt)
  const elapsed = attempt ? elapsedLabel(attempt) : null
  const status = attempt ? ATTEMPT_STATUS_LABELS[attempt.status] : 'Not started'

  return (
    <Link
      href={`/admin/courses/${courseId}/assessments/${assessment.id}/results`}
      className="rounded-sm border border-line bg-navy-50/40 p-3 transition-colors hover:border-teal-500 hover:bg-teal-50/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-navy-900">
            {assessment.title}
          </p>
          <p className="mt-0.5 text-[10px] text-ink-faint">
            {assessment.dayNumber ? `Day ${assessment.dayNumber} · ` : ''}
            {ASSESSMENT_LABELS[assessment.kind]}
          </p>
        </div>
        <Badge tone={statusTone(attempt)}>{status}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          {percent === null || !attempt ? (
            <p className="text-[13px] text-ink-faint">No score yet</p>
          ) : (
            <p className="text-[16px] font-semibold tabular-nums text-navy-900">
              {attempt.correct_count}/{attempt.question_count}
              <span className="ml-1.5 text-[11px] font-normal text-ink-soft">
                {percent}%
              </span>
            </p>
          )}
        </div>
        {attempt ? (
          <p className="text-[10px] text-ink-faint">
            {[elapsed, `${attempt.warning_count} integrity`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : null}
      </div>
    </Link>
  )
}
