import Link from 'next/link'

import { CheckIcon, ClipboardIcon, ClockIcon, LockIcon } from '@/components/icons'
import { RowArrow, cx } from '@/components/ui'
import { ASSESSMENT_LABELS, formatDuration } from '@/lib/format'
import type { Assessment, AssessmentAttempt } from '@/lib/types'

/**
 * The assessments belonging to one day, as wide rows.
 *
 * These used to sit in a narrow column beside the schedule, with a paragraph of
 * explanation under each one that students read once and then scrolled past. A
 * quiz needs exactly one thing said about it — can I start it, or what did I
 * get — so each row carries a single state and nothing else.
 */

type State =
  | { kind: 'locked' }
  | { kind: 'ready' }
  | { kind: 'open' }
  | { kind: 'done'; correct: number; total: number; flagged: boolean }

function stateOf(
  assessment: Assessment,
  attempt: AssessmentAttempt | undefined,
  questionCount: number
): State {
  if (attempt && attempt.status !== 'in_progress') {
    return {
      kind: 'done',
      correct: attempt.correct_count ?? 0,
      total: attempt.question_count ?? questionCount,
      flagged: attempt.status === 'integrity_stopped',
    }
  }
  if (attempt) return { kind: 'open' }
  if (assessment.is_locked || questionCount === 0) return { kind: 'locked' }
  return { kind: 'ready' }
}

export function AssessmentCards({
  assessments,
  attempts,
  questionCounts,
  studentView = false,
}: {
  assessments: Assessment[]
  attempts: Record<string, AssessmentAttempt>
  questionCounts: Record<string, number>
  studentView?: boolean
}) {
  if (assessments.length === 0) return null

  return (
    <ul className="space-y-3">
      {assessments.map((assessment) => {
        const count = questionCounts[assessment.id] ?? 0
        const state = stateOf(assessment, attempts[assessment.id], count)
        const interactive = state.kind !== 'locked'

        const inner = (
          <>
            <span
              className={cx(
                'grid size-12 shrink-0 place-items-center rounded-sm border transition-colors',
                state.kind === 'locked'
                  ? 'border-line bg-navy-50 text-ink-faint'
                  : state.kind === 'done'
                    ? state.flagged
                      ? 'border-danger-500/30 bg-danger-50 text-danger-600'
                      : 'border-teal-200 bg-teal-50 text-teal-700'
                    : 'border-line bg-navy-50 text-navy-600 group-hover:border-teal-300 group-hover:bg-teal-50 group-hover:text-teal-700'
              )}
            >
              {state.kind === 'locked' ? (
                <LockIcon width={20} height={20} />
              ) : state.kind === 'done' ? (
                <CheckIcon width={20} height={20} />
              ) : (
                <ClipboardIcon width={20} height={20} />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
                {ASSESSMENT_LABELS[assessment.kind]}
              </span>

              <span
                className={cx(
                  'mt-0.5 block text-[17px] font-semibold sm:text-[18px]',
                  state.kind === 'locked'
                    ? 'text-ink-soft'
                    : 'text-navy-900 group-hover:text-teal-800'
                )}
              >
                {assessment.title}
              </span>

              <span className="mt-1.5 block text-[13px] text-ink-soft">
                {count > 0 ? `${count} questions · ` : ''}
                {formatDuration(assessment.duration_minutes)} · one attempt
              </span>
            </span>

            <span className="shrink-0 text-right">
              {state.kind === 'done' ? (
                <>
                  <span
                    className={cx(
                      'block text-[22px] leading-none font-semibold tabular-nums',
                      state.flagged ? 'text-danger-600' : 'text-navy-900'
                    )}
                  >
                    {state.correct}
                    <span className="text-[15px] text-ink-faint">
                      /{state.total}
                    </span>
                  </span>
                  <span className="mt-1 block text-[12px] font-medium text-teal-700">
                    See your answers
                  </span>
                </>
              ) : state.kind === 'open' ? (
                <span className="inline-flex items-center gap-1.5 rounded-xs border border-amber-200 bg-amber-50 px-2.5 py-1 text-[13px] font-medium text-amber-800">
                  <ClockIcon width={14} height={14} />
                  Continue
                </span>
              ) : state.kind === 'ready' ? (
                <span className="inline-flex items-center gap-1.5 rounded-sm border border-teal-600 bg-teal-600 px-3.5 py-2 text-[14px] font-medium text-white transition-colors group-hover:bg-teal-700">
                  Start
                </span>
              ) : (
                <span className="text-[13px] text-ink-faint">Opens soon</span>
              )}
            </span>

            {interactive && state.kind !== 'ready' ? <RowArrow /> : null}
          </>
        )

        return (
          <li key={assessment.id}>
            {interactive ? (
              <Link
                href={`/quiz/${assessment.id}${
                  studentView ? '?view=student' : ''
                }`}
                className={cx(
                  'group flex items-center gap-4 rounded-md border bg-surface p-4 transition-colors sm:gap-5 sm:p-5',
                  state.kind === 'done'
                    ? 'border-line hover:border-teal-300 hover:bg-teal-50/30'
                    : 'border-line-strong hover:border-teal-400 hover:bg-navy-50/50'
                )}
              >
                {inner}
              </Link>
            ) : (
              <div className="flex items-center gap-4 rounded-md border border-line bg-navy-50/40 p-4 sm:gap-5 sm:p-5">
                {inner}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
