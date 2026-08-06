import { notFound } from 'next/navigation'

import {
  setAssessmentResultsReleased,
  unlockFrozenAttempt,
} from '@/app/actions/admin'
import { ResultsExplorer } from '@/components/admin/results-explorer'
import { AlertIcon, CheckIcon, EyeOffIcon } from '@/components/icons'
import { BackLink, Button, cx } from '@/components/ui'
import { canManageCourse, getCourseById } from '@/lib/dal'
import {
  getAssessmentById,
  getAttemptsForAssessment,
  getCourseAttemptScores,
  getIntegrityEvents,
  getQuestionStats,
} from '@/lib/quiz'
import { resolveAttemptScore } from '@/lib/attempt-score'

/** Rounded up, because "frozen for 0 minutes" reads as though nothing is wrong. */
function minutesSince(iso: string | null): string {
  if (!iso) return 'a moment'
  const minutes = Math.max(
    1,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  )
  return `${minutes} minute${minutes === 1 ? '' : 's'}`
}

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; assessmentId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const [{ id, assessmentId }, { tab: tabParam }] = await Promise.all([
    params,
    searchParams,
  ])

  const course = await getCourseById(id)
  if (!course || !(await canManageCourse(course))) notFound()

  const [assessment, attempts, events, stats, tally] = await Promise.all([
    getAssessmentById(course.id, assessmentId),
    getAttemptsForAssessment(assessmentId),
    getIntegrityEvents(assessmentId),
    getQuestionStats(assessmentId),
    // Course-wide and aggregated in Postgres. The old per-assessment counter
    // tallied one row per correct answer in JavaScript, which silently
    // truncated at the API row cap on larger courses.
    getCourseAttemptScores(course.id),
  ])

  if (!assessment) notFound()

  const frozen = attempts.filter(
    (attempt) => attempt.frozen_at && attempt.status === 'in_progress'
  )

  const eventsByAttempt = new Map<string, typeof events>()
  for (const event of events) {
    const list = eventsByAttempt.get(event.attempt_id) ?? []
    list.push(event)
    eventsByAttempt.set(event.attempt_id, list)
  }

  const attemptRows = attempts.map((attempt) => ({
    id: attempt.id,
    status: attempt.status,
    started_at: attempt.started_at,
    submitted_at: attempt.submitted_at,
    // Shared with the Students matrix and the student detail page, so the same
    // attempt can no longer read `0/30` here and `—` there.
    correct_count: resolveAttemptScore(attempt, tally, attempt.id).correct,
    question_count: attempt.question_count,
    warning_count: attempt.warning_count,
    studentName: attempt.student?.full_name || '—',
    studentEmail: attempt.student?.email || '',
    events: (eventsByAttempt.get(attempt.id) ?? []).map((event) => ({
      id: event.id,
      kind: event.kind,
      questionPosition: event.questionPosition,
      question_warning_number: event.question_warning_number,
      occurred_at: event.occurred_at,
    })),
  }))

  const questionRows = stats.map((stat) => ({
    questionId: stat.questionId,
    stem: stat.stem,
    difficulty: stat.difficulty,
    answered: stat.answered,
    correct: stat.correct,
  }))

  return (
    <div className="space-y-5">
      <BackLink
        href={`/admin/courses/${course.id}/assessments/${assessment.id}`}
      >
        Back to assessment
      </BackLink>

      {/* Exam-day triage. Anyone here is sitting in front of a stopped exam
          with their clock paused, so this goes above everything else. */}
      {frozen.length > 0 ? (
        <div className="rounded-md border-2 border-danger-500 bg-danger-50 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-surface text-danger-600">
              <AlertIcon width={18} height={18} />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-danger-600">
                {frozen.length} frozen{' '}
                {frozen.length === 1 ? 'attempt' : 'attempts'} waiting for you
              </p>
              <p className="text-[13px] text-ink-soft">
                Their clocks are paused. Unlocking gives the waiting time back
                and resets their warnings to zero.
              </p>
            </div>
          </div>

          <ul className="mt-4 space-y-2.5">
            {frozen.map((attempt) => (
              <li
                key={attempt.id}
                className="flex flex-wrap items-center gap-3 rounded-sm border border-line bg-surface p-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-navy-900">
                    {attempt.student?.full_name || attempt.student?.email || '—'}
                  </p>
                  <p className="text-[12.5px] text-ink-faint">
                    Frozen for {minutesSince(attempt.frozen_at)} ·{' '}
                    {attempt.warning_count} warnings
                  </p>
                </div>

                <form
                  action={unlockFrozenAttempt}
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="course_id" value={course.id} />
                  <input
                    type="hidden"
                    name="assessment_id"
                    value={assessment.id}
                  />
                  <input type="hidden" name="attempt_id" value={attempt.id} />
                  <label className="text-[12.5px] text-ink-soft">
                    Extra minutes
                    <input
                      type="number"
                      name="extra_minutes"
                      defaultValue={0}
                      min={0}
                      max={60}
                      className="ml-2 w-16 rounded-xs border border-line-strong bg-surface px-2 py-1 text-[13px] text-navy-900"
                    />
                  </label>
                  <Button type="submit" size="sm">
                    Unlock
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* The reveal. Everything above is the instructor's view and is visible
          to them whatever this says; this control decides only what the class
          can see. */}
      <div
        className={cx(
          'flex flex-wrap items-start gap-4 rounded-md border p-4 sm:p-5',
          assessment.results_released
            ? 'border-line bg-surface'
            : 'border-amber-300 bg-amber-50'
        )}
      >
        <span
          className={cx(
            'mt-0.5 grid size-9 shrink-0 place-items-center rounded-sm border',
            assessment.results_released
              ? 'border-teal-200 bg-teal-50 text-teal-700'
              : 'border-amber-300 bg-surface text-amber-700'
          )}
        >
          {assessment.results_released ? (
            <CheckIcon width={18} height={18} />
          ) : (
            <EyeOffIcon width={18} height={18} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-navy-900">
            {assessment.results_released
              ? 'Students can see their results'
              : 'Results are hidden from students'}
          </p>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-ink-soft">
            {assessment.results_released
              ? 'Each student sees their score, the correct answer for every question, and the explanation.'
              : 'Students see only that their answers were received. No score, no correct answers and no explanations are readable by them until you release. Marking is already done, so releasing is instant.'}
          </p>
        </div>

        <form action={setAssessmentResultsReleased} className="shrink-0">
          <input type="hidden" name="course_id" value={course.id} />
          <input type="hidden" name="assessment_id" value={assessment.id} />
          <input
            type="hidden"
            name="released"
            value={assessment.results_released ? 'false' : 'true'}
          />
          <Button
            type="submit"
            variant={assessment.results_released ? 'secondary' : 'primary'}
          >
            {assessment.results_released
              ? 'Hide results again'
              : 'Release results to students'}
          </Button>
        </form>
      </div>

      <ResultsExplorer
        title={assessment.title}
        initialTab={tabParam === 'questions' ? 'questions' : 'attempts'}
        attempts={attemptRows}
        questions={questionRows}
      />
    </div>
  )
}
