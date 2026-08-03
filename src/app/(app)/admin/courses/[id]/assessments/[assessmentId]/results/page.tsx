import { notFound } from 'next/navigation'

import { AlertIcon } from '@/components/icons'
import {
  Badge,
  BackLink,
  EmptyState,
  Panel,
  PanelHeader,
  cx,
} from '@/components/ui'
import { canManageCourse, getCourseById } from '@/lib/dal'
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_TONES,
  formatDate,
} from '@/lib/format'
import {
  ATTEMPT_STATUS_LABELS,
  getAssessmentById,
  getAttemptsForAssessment,
  getIntegrityEvents,
  getQuestionStats,
} from '@/lib/quiz'
import type { IntegrityEventKind } from '@/lib/types'

const EVENT_LABELS: Record<IntegrityEventKind, string> = {
  tab_hidden: 'Switched tab or app',
  window_blur: 'Window lost focus',
  copy: 'Tried to copy',
  paste: 'Tried to paste',
  context_menu: 'Right-click menu',
}

/** Minutes between starting and submitting, or null while still open. */
function minutesTaken(startedAt: string, submittedAt: string | null) {
  if (!submittedAt) return null
  const ms = new Date(submittedAt).getTime() - new Date(startedAt).getTime()
  return Math.max(1, Math.round(ms / 60000))
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string; assessmentId: string }>
}) {
  const { id, assessmentId } = await params

  const course = await getCourseById(id)
  if (!course || !(await canManageCourse(course))) notFound()

  const [assessment, attempts, events, stats] = await Promise.all([
    getAssessmentById(course.id, assessmentId),
    getAttemptsForAssessment(assessmentId),
    getIntegrityEvents(assessmentId),
    getQuestionStats(assessmentId),
  ])

  if (!assessment) notFound()

  const eventsByAttempt = new Map<string, typeof events>()
  for (const event of events) {
    const list = eventsByAttempt.get(event.attempt_id) ?? []
    list.push(event)
    eventsByAttempt.set(event.attempt_id, list)
  }

  const marked = attempts.filter(
    (a) => a.status !== 'in_progress' && a.question_count
  )

  const average =
    marked.length === 0
      ? null
      : Math.round(
          (marked.reduce(
            (sum, a) => sum + (a.correct_count ?? 0) / (a.question_count || 1),
            0
          ) /
            marked.length) *
            100
        )

  const flaggedCount = attempts.filter(
    (a) => a.status === 'integrity_stopped' || a.warning_count > 0
  ).length

  return (
    <div className="space-y-6">
      <BackLink
        href={`/admin/courses/${course.id}/assessments/${assessment.id}`}
      >
        {assessment.title}
      </BackLink>

      <div>
        <h2 className="text-[19px] font-semibold text-navy-900">
          Results · {assessment.title}
        </h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          {attempts.length} attempt{attempts.length === 1 ? '' : 's'}
          {average !== null ? ` · class average ${average}%` : ''}
          {flaggedCount > 0
            ? ` · ${flaggedCount} with integrity warnings`
            : ' · no integrity warnings'}
        </p>
      </div>

      <Panel>
        <PanelHeader
          title="Attempts"
          description="Scores are written when a student submits. Nothing here is typed in."
        />

        {attempts.length === 0 ? (
          <EmptyState
            title="Nobody has sat this yet"
            description="Publish and unlock it, and results will appear here as students finish."
          />
        ) : (
          <div className="scroll-x">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-navy-50/60">
                  {['Student', 'Score', 'Status', 'Time taken', 'Integrity'].map(
                    (heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="px-4 py-2.5 text-[12px] font-semibold tracking-wide text-ink-soft uppercase"
                      >
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {attempts.map((attempt) => {
                  const total = attempt.question_count ?? 0
                  const correct = attempt.correct_count ?? 0
                  const stopped = attempt.status === 'integrity_stopped'
                  const taken = minutesTaken(
                    attempt.started_at,
                    attempt.submitted_at
                  )
                  const log = eventsByAttempt.get(attempt.id) ?? []
                  const penalized = log.some(
                    (event) => (event.question_warning_number ?? 0) >= 3
                  )

                  return (
                    <tr
                      key={attempt.id}
                      className={cx(
                        'align-top transition-colors',
                        stopped || penalized
                          ? 'bg-danger-50/40'
                          : 'hover:bg-navy-50/50'
                      )}
                    >
                      <td className="px-4 py-3">
                        <span className="block text-[14px] font-medium text-navy-900">
                          {attempt.student?.full_name || '—'}
                        </span>
                        <span className="block text-[12px] text-ink-faint">
                          {attempt.student?.email}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {attempt.status === 'in_progress' ? (
                          <span className="text-[13px] text-ink-faint">—</span>
                        ) : (
                          <span
                            className={cx(
                              'text-[14px] font-medium tabular-nums',
                              stopped || penalized
                                ? 'text-danger-600'
                                : 'text-navy-900'
                            )}
                          >
                            {correct}/{total}
                            <span className="ml-1.5 text-[12px] font-normal text-ink-faint">
                              {total > 0
                                ? `${Math.round((correct / total) * 100)}%`
                                : ''}
                            </span>
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            stopped
                              ? 'danger'
                              : attempt.status === 'timed_out'
                                ? 'amber'
                                : attempt.status === 'submitted'
                                  ? 'teal'
                                  : 'neutral'
                          }
                        >
                          {ATTEMPT_STATUS_LABELS[attempt.status]}
                        </Badge>
                        <span className="mt-1 block text-[12px] text-ink-faint">
                          {formatDate(attempt.submitted_at ?? attempt.started_at)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-[13px] text-ink-soft">
                        {taken === null
                          ? 'Still open'
                          : `${taken} min${taken === 1 ? '' : 's'}`}
                      </td>

                      <td className="px-4 py-3">
                        {log.length === 0 ? (
                          <span className="text-[13px] text-ink-faint">
                            Clean
                          </span>
                        ) : (
                          <div>
                            <span
                              className={cx(
                                'inline-flex items-center gap-1.5 text-[13px] font-medium',
                                stopped || penalized
                                  ? 'text-danger-600'
                                  : 'text-amber-700'
                              )}
                            >
                              <AlertIcon width={13} height={13} />
                              {log.length} event
                              {log.length === 1 ? '' : 's'}
                            </span>
                            <ul className="mt-1 space-y-0.5">
                              {log.map((event) => (
                                <li
                                  key={event.id}
                                  className="text-[12px] text-ink-faint"
                                >
                                  {EVENT_LABELS[event.kind]} ·{' '}
                                  {event.questionPosition !== null
                                    ? `Question ${event.questionPosition + 1}${
                                        event.question_warning_number
                                          ? ` (${event.question_warning_number}/3)`
                                          : ''
                                      } · `
                                    : ''}
                                  {new Date(event.occurred_at).toLocaleTimeString(
                                    'en-GB',
                                    { hour: '2-digit', minute: '2-digit' }
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Question by question"
          description="A question nobody got right is usually badly worded rather than hard. One everybody got right is not measuring anything."
        />

        {stats.length === 0 ? (
          <EmptyState title="No questions in this assessment" />
        ) : (
          <ol className="divide-y divide-line">
            {stats.map((stat, index) => {
              const rate =
                stat.answered === 0
                  ? null
                  : Math.round((stat.correct / stat.answered) * 100)

              return (
                <li
                  key={stat.questionId}
                  className="flex items-start gap-4 px-4 py-3.5 sm:px-5"
                >
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-sm border border-line bg-navy-50 text-[12px] font-semibold text-navy-700">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] text-navy-900">{stat.stem}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge tone={DIFFICULTY_TONES[stat.difficulty]}>
                        {DIFFICULTY_LABELS[stat.difficulty]}
                      </Badge>
                      <span className="text-[12px] text-ink-faint">
                        {stat.answered} answered
                      </span>
                    </div>
                  </div>

                  <div className="w-28 shrink-0 text-right">
                    {rate === null ? (
                      <span className="text-[13px] text-ink-faint">—</span>
                    ) : (
                      <>
                        <span
                          className={cx(
                            'text-[15px] font-medium tabular-nums',
                            rate < 30
                              ? 'text-danger-600'
                              : rate > 95
                                ? 'text-amber-700'
                                : 'text-navy-900'
                          )}
                        >
                          {rate}%
                        </span>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-navy-100">
                          <span
                            className={cx(
                              'block h-full rounded-full',
                              rate < 30
                                ? 'bg-danger-500'
                                : rate > 95
                                  ? 'bg-amber-500'
                                  : 'bg-teal-600'
                            )}
                            style={{ width: `${rate}%` }}
                          />
                        </span>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </Panel>
    </div>
  )
}
