import Link from 'next/link'

import { AlertIcon, CheckIcon, CrossIcon } from '@/components/icons'
import { Alert, Badge, ButtonLink, Panel, cx } from '@/components/ui'
import { DIFFICULTY_LABELS, DIFFICULTY_TONES } from '@/lib/format'
import type { ReviewQuestion } from '@/lib/quiz'
import type { AssessmentAttempt } from '@/lib/types'

/**
 * The result, then every question with the answer given and the answer wanted.
 *
 * Showing the full paper back is a deliberate trade: it is the version a student
 * actually learns from, and it means the question bank is spent once the cohort
 * has sat it. Write fresh questions for the next intake rather than reusing these.
 */
export function QuizReview({
  attempt,
  title,
  questions,
  backHref,
  backLabel,
}: {
  attempt: AssessmentAttempt
  title: string
  questions: ReviewQuestion[]
  backHref: string
  backLabel: string
}) {
  const total = attempt.question_count ?? questions.length
  const correct = attempt.correct_count ?? 0
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0
  const penalizedCount = questions.filter(
    (question) => question.integrityInvalidated
  ).length

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="animate-page">
        <p className="text-[12px] font-semibold tracking-wide text-ink-faint uppercase">
          {title}
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
          <p className="text-[40px] leading-none font-semibold text-navy-900 tabular-nums">
            {correct}
            <span className="text-[24px] text-ink-faint"> / {total}</span>
          </p>
          <p className="pb-1 text-[15px] text-ink-soft">{percent}% correct</p>
        </div>

        {attempt.status === 'timed_out' ? (
          <Alert tone="amber" className="mt-4" title="Time ran out">
            The clock reached zero before you submitted, so this was marked on the
            answers saved up to that point.
          </Alert>
        ) : null}

        {attempt.status === 'integrity_stopped' ? (
          <Alert tone="danger" className="mt-4" title="Attempt ended early">
            This attempt used the previous integrity policy and was submitted
            automatically after {attempt.warning_count} recorded events. New
            attempts continue and apply penalties question by question.
          </Alert>
        ) : null}

        {penalizedCount > 0 ? (
          <Alert
            tone="danger"
            className="mt-4"
            title={`${penalizedCount} question${penalizedCount === 1 ? '' : 's'} received no point`}
          >
            Three integrity events were recorded on each marked question. The
            rest of the assessment was scored normally.
          </Alert>
        ) : null}

        {attempt.status === 'submitted' &&
        attempt.warning_count > 0 &&
        penalizedCount === 0 ? (
          <Alert tone="amber" className="mt-4">
            {attempt.warning_count} integrity event
            {attempt.warning_count === 1 ? ' was' : 's were'} recorded during
            this attempt. No question reached the three-event penalty.
          </Alert>
        ) : null}

        <p className="mt-4 text-[14px] text-ink-soft">
          Every question is below with what you chose and what was correct. This
          was your one attempt, so it stays as it is.
        </p>

        <div className="mt-5">
          <ButtonLink href={backHref} variant="secondary">
            {backLabel}
          </ButtonLink>
        </div>
      </div>

      <ol className="mt-8 space-y-4">
        {questions.map((question, index) => (
          <li key={question.id}>
            <Panel
              className={cx(
                'p-5 sm:p-6',
                question.isCorrect
                  ? 'border-teal-200'
                  : 'border-danger-500/30'
              )}
            >
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <span
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-xs px-2 py-0.5 text-[12px] font-medium',
                    question.integrityInvalidated
                      ? 'bg-danger-50 text-danger-600'
                      : question.isCorrect
                      ? 'bg-teal-50 text-teal-800'
                      : 'bg-danger-50 text-danger-600'
                  )}
                >
                  {question.isCorrect && !question.integrityInvalidated ? (
                    <CheckIcon width={13} height={13} />
                  ) : (
                    <CrossIcon width={13} height={13} />
                  )}
                  {question.integrityInvalidated
                    ? 'No point · integrity rule'
                    : question.isCorrect
                      ? 'Correct'
                      : 'Wrong'}
                </span>
                <span className="text-[12px] text-ink-faint">
                  Question {index + 1}
                </span>
                <Badge tone={DIFFICULTY_TONES[question.difficulty]}>
                  {DIFFICULTY_LABELS[question.difficulty]}
                </Badge>
                {question.topic ? (
                  <Badge tone="neutral">{question.topic}</Badge>
                ) : null}
              </div>

              <p className="text-[15px] leading-relaxed font-medium text-navy-900">
                {question.stem}
              </p>

              {question.integrityInvalidated ? (
                <p className="mt-2 text-[13px] font-medium text-danger-600">
                  {question.integrityWarningCount} events were recorded on this
                  question, so it could not earn a point.
                </p>
              ) : null}

              <ul className="mt-3 space-y-2">
                {question.options.map((option) => {
                  const chosen = option.id === question.selectedOptionId
                  const isKey = option.id === question.correctOptionId

                  return (
                    <li
                      key={option.id}
                      className={cx(
                        'flex items-start gap-3 rounded-sm border p-3',
                        isKey
                          ? 'border-teal-400 bg-teal-50/60'
                          : chosen
                            ? 'border-danger-500/40 bg-danger-50/50'
                            : 'border-line bg-surface'
                      )}
                    >
                      <span
                        className={cx(
                          'grid size-6 shrink-0 place-items-center rounded-full border text-[12px] font-semibold',
                          isKey
                            ? 'border-teal-600 bg-teal-600 text-white'
                            : chosen
                              ? 'border-danger-500 bg-danger-50 text-danger-600'
                              : 'border-line-strong bg-surface text-ink-soft'
                        )}
                      >
                        {option.label}
                      </span>

                      <span className="min-w-0 flex-1 text-[14px] leading-relaxed text-ink">
                        {option.body}
                      </span>

                      {(chosen || isKey) && (
                        <span
                          className={cx(
                            'shrink-0 text-[11px] font-medium tracking-wide uppercase',
                            isKey ? 'text-teal-800' : 'text-danger-600'
                          )}
                        >
                          {isKey && chosen
                            ? 'your answer'
                            : isKey
                              ? 'correct'
                              : 'you chose'}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>

              {!question.selectedOptionId ? (
                <p className="mt-3 text-[13px] text-ink-faint">
                  You left this one blank.
                </p>
              ) : null}

              {question.rationale ? (
                <p className="mt-3 flex gap-2 rounded-sm bg-navy-50 p-3 text-[13.5px] leading-relaxed text-ink-soft">
                  <AlertIcon className="mt-0.5 shrink-0" width={14} height={14} />
                  {question.rationale}
                </p>
              ) : null}
            </Panel>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        <Link
          href={backHref}
          className="text-[14px] font-medium text-teal-700 hover:text-teal-800"
        >
          {backLabel}
        </Link>
      </div>
    </div>
  )
}
