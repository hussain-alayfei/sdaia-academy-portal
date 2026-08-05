import { CheckIcon, EyeOffIcon } from '@/components/icons'
import { BackLink, Panel } from '@/components/ui'
import type { AssessmentAttempt } from '@/lib/types'

/**
 * What a student sees after submitting a paper whose results are still hidden.
 *
 * There is no score here because there is no score to show: while
 * `results_released` is false, `submit_attempt` never writes `correct_count`, no
 * `assessment_scores` row exists, and RLS refuses both the answer keys and the
 * student's own graded responses. This screen is the honest report of that
 * state rather than a UI that hides a number it was handed.
 *
 * The point is to close the exam calmly — confirm the work is in, say plainly
 * when marks arrive, and give a way back to the course.
 */
export function QuizSubmitted({
  attempt,
  title,
  backHref,
  backLabel,
}: {
  attempt: AssessmentAttempt
  title: string
  backHref: string
  backLabel: string
}) {
  const ranOut = attempt.status === 'timed_out'

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="animate-page">
        <div className="mb-5">
          <BackLink href={backHref}>{backLabel}</BackLink>
        </div>

        <Panel className="p-6 sm:p-8">
          <span className="grid size-12 place-items-center rounded-sm border border-teal-200 bg-teal-50 text-teal-700">
            <CheckIcon width={24} height={24} />
          </span>

          <h1 className="mt-4 text-[22px] font-semibold text-navy-900 sm:text-[26px]">
            Your answers have been received
          </h1>

          <p className="mt-3 text-[15px] leading-relaxed text-ink">
            {title} is complete
            {ranOut
              ? '. The time ran out, and everything you had answered was submitted for you.'
              : ' and your attempt is closed.'}{' '}
            Nothing further is needed from you.
          </p>

          <div className="mt-6 flex gap-3 rounded-md border border-line bg-navy-50/60 p-4 sm:p-5">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-sm border border-line bg-surface text-navy-600">
              <EyeOffIcon width={16} height={16} />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-navy-900">
                Results are not published yet
              </p>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
                Your score and the correct answers are held back until your
                instructor releases them for the whole class. When that happens
                this page will show your mark, the right answer for every
                question, and an explanation of why it is right.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
