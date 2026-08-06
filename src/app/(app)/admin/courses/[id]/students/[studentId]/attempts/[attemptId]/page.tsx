import { notFound } from 'next/navigation'

import { CheckIcon, CrossIcon, AlertIcon } from '@/components/icons'
import { BackLink, Panel, cx } from '@/components/ui'
import { canManageCourse, getCourseById } from '@/lib/dal'
import { resolveAttemptScore } from '@/lib/attempt-score'
import { ATTEMPT_STATUS_LABELS, getAttemptById, getAttemptReview } from '@/lib/quiz'
import { createClient } from '@/lib/supabase/server'

/**
 * One student's paper, as they answered it.
 *
 * Until now there was no way for an instructor to see what any individual
 * student actually chose — the only per-question data in the app was the
 * class-level percentage on the Results page, and the only screen that rendered
 * a student's own answers was the student's own review, which an instructor
 * cannot reach. Marking a dispute meant reading raw database rows.
 *
 * Questions appear in the order this student sat them, not the authored order,
 * because the paper is shuffled per attempt and "question 7" means nothing
 * unless it means the seventh thing *they* saw.
 *
 * This deliberately ignores `results_released`. That flag decides what the
 * student may see; the instructor is the person who decides when to flip it,
 * and cannot make that call blind.
 */
export default async function AttemptAnswersPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string; attemptId: string }>
}) {
  const { id, studentId, attemptId } = await params

  const course = await getCourseById(id)
  if (!course || !(await canManageCourse(course))) notFound()

  const attempt = await getAttemptById(attemptId)

  // Guard the attempt actually belongs to this course *and* this student, so a
  // hand-edited URL cannot pull a paper in under the wrong heading.
  if (
    !attempt ||
    attempt.course_id !== course.id ||
    attempt.student_id !== studentId
  ) {
    notFound()
  }

  const supabase = await createClient()
  const { data: assessment } = await supabase
    .from('assessments')
    .select('id, title, results_released')
    .eq('id', attempt.assessment_id)
    .maybeSingle()

  const questions = await getAttemptReview(attempt)

  const tally = { [attempt.id]: { correct: 0, answered: 0 } }
  const graded = questions.filter((q) => q.isCorrect).length
  tally[attempt.id] = { correct: graded, answered: questions.length }

  const score = resolveAttemptScore(attempt, tally, attempt.id)
  const answered = questions.filter((q) => q.selectedOptionId).length

  return (
    <div className="space-y-5">
      <BackLink href={`/admin/courses/${course.id}/students/${studentId}`}>
        Back to {attempt.student?.full_name || 'the student'}
      </BackLink>

      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-wide text-teal-700 uppercase">
              {assessment?.title ?? 'Assessment'}
            </p>
            <h1 className="mt-1 text-[22px] font-semibold text-navy-900 sm:text-[26px]">
              {attempt.student?.full_name || attempt.student?.email || 'Student'}
            </h1>
            <p className="mt-1.5 text-[13.5px] text-ink-soft">
              {ATTEMPT_STATUS_LABELS[attempt.status]} · {answered} of{' '}
              {questions.length} answered
              {attempt.warning_count > 0
                ? ` · ${attempt.warning_count} integrity warning${attempt.warning_count === 1 ? '' : 's'}`
                : ''}
            </p>
          </div>

          {score.finished ? (
            <div className="shrink-0 text-right">
              <p className="text-[30px] leading-none font-semibold tabular-nums text-navy-900">
                {score.correct}
                <span className="text-[18px] text-ink-faint">
                  /{score.total ?? questions.length}
                </span>
              </p>
              {score.percent !== null ? (
                <p className="mt-1 text-[13px] font-medium text-ink-soft">
                  {score.percent}%
                </p>
              ) : null}
            </div>
          ) : (
            <span className="shrink-0 rounded-xs border border-amber-300 bg-amber-50 px-2.5 py-1 text-[13px] font-medium text-amber-800">
              Still in progress
            </span>
          )}
        </div>

        {assessment && !assessment.results_released ? (
          <p className="mt-4 rounded-sm border border-line bg-navy-50/60 px-3.5 py-2.5 text-[13px] text-ink-soft">
            Results are still withheld, so this student cannot see any of this
            yet. You are looking at it as the instructor.
          </p>
        ) : null}
      </Panel>

      <ol className="space-y-3">
        {questions.map((question, index) => {
          const chosen = question.options.find(
            (o) => o.id === question.selectedOptionId
          )
          const correct = question.options.find(
            (o) => o.id === question.correctOptionId
          )
          const blank = !question.selectedOptionId

          return (
            <li key={question.id}>
              <article
                className={cx(
                  'rounded-md border bg-surface p-4 sm:p-5',
                  question.isCorrect
                    ? 'border-teal-200'
                    : blank
                      ? 'border-line'
                      : 'border-danger-500/30'
                )}
              >
                <div className="flex items-start gap-3.5">
                  <span
                    className={cx(
                      'grid size-8 shrink-0 place-items-center rounded-sm text-[13px] font-bold',
                      question.isCorrect
                        ? 'bg-teal-50 text-teal-700'
                        : blank
                          ? 'bg-navy-50 text-ink-faint'
                          : 'bg-danger-50 text-danger-600'
                    )}
                  >
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] leading-relaxed font-medium text-navy-900">
                      {question.stem}
                    </p>

                    <dl className="mt-3 space-y-1.5 text-[14px]">
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-ink-faint">Their answer:</dt>
                        <dd
                          className={cx(
                            'font-medium',
                            question.isCorrect
                              ? 'text-teal-800'
                              : blank
                                ? 'text-ink-faint italic'
                                : 'text-danger-600'
                          )}
                        >
                          {blank
                            ? 'Left blank'
                            : `${chosen?.label ?? '?'} · ${chosen?.body ?? ''}`}
                        </dd>
                      </div>

                      {!question.isCorrect ? (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-ink-faint">Correct answer:</dt>
                          <dd className="font-medium text-teal-800">
                            {correct
                              ? `${correct.label} · ${correct.body}`
                              : '—'}
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    {question.integrityInvalidated ? (
                      <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-xs border border-danger-500/30 bg-danger-50 px-2 py-1 text-[12px] font-medium text-danger-600">
                        <AlertIcon width={13} height={13} />
                        Zeroed by integrity events
                      </p>
                    ) : null}

                    {question.rationale ? (
                      <p className="mt-3 border-t border-line pt-3 text-[13.5px] leading-relaxed text-ink-soft">
                        {question.rationale}
                      </p>
                    ) : null}
                  </div>

                  <span className="shrink-0">
                    {question.isCorrect ? (
                      <CheckIcon
                        width={20}
                        height={20}
                        className="text-teal-600"
                      />
                    ) : blank ? null : (
                      <CrossIcon
                        width={20}
                        height={20}
                        className="text-danger-500"
                      />
                    )}
                  </span>
                </div>
              </article>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
