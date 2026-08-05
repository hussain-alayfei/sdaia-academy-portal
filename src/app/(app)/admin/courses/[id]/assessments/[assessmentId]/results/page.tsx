import { notFound } from 'next/navigation'

import { setAssessmentResultsReleased } from '@/app/actions/admin'
import { ResultsExplorer } from '@/components/admin/results-explorer'
import { CheckIcon, EyeOffIcon } from '@/components/icons'
import { BackLink, Button, cx } from '@/components/ui'
import { canManageCourse, getCourseById } from '@/lib/dal'
import {
  getAssessmentById,
  getAttemptsForAssessment,
  getGradedCounts,
  getIntegrityEvents,
  getQuestionStats,
} from '@/lib/quiz'

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

  const [assessment, attempts, events, stats, gradedCounts] = await Promise.all([
    getAssessmentById(course.id, assessmentId),
    getAttemptsForAssessment(assessmentId),
    getIntegrityEvents(assessmentId),
    getQuestionStats(assessmentId),
    getGradedCounts(assessmentId),
  ])

  if (!assessment) notFound()

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
    // While results are withheld the attempt carries no `correct_count` — the
    // student can read that column. The mark is rebuilt from the graded
    // responses, which are manager-only once the attempt is over.
    correct_count:
      attempt.correct_count ??
      (attempt.status === 'in_progress'
        ? null
        : (gradedCounts[attempt.id] ?? 0)),
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
