import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  deleteAssessment,
  toggleAssessmentLocked,
  toggleAssessmentPublished,
} from '@/app/actions/admin'
import {
  deleteQuestion,
  moveQuestion,
  resetAttempts,
} from '@/app/actions/questions'
import { AssessmentForm } from '@/components/admin/assessment-form'
import {
  AddQuestion,
  EditQuestion,
} from '@/components/admin/question-editor'
import { QuestionImport } from '@/components/admin/question-import'
import { TrashIcon } from '@/components/icons'
import {
  Alert,
  BackLink,
  Badge,
  Button,
  EmptyState,
  Panel,
  PanelHeader,
  cx,
} from '@/components/ui'
import { canManageCourse, getCourseById } from '@/lib/dal'
import {
  ASSESSMENT_LABELS,
  DIFFICULTY_LABELS,
  DIFFICULTY_TONES,
  formatDuration,
} from '@/lib/format'
import { getCourseDays } from '@/lib/queries'
import {
  getAssessmentById,
  getAttemptsForAssessment,
  getQuestionsForEditing,
} from '@/lib/quiz'
import type { QuestionDifficulty } from '@/lib/types'

export default async function AssessmentEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; assessmentId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const [{ id, assessmentId }, { error }] = await Promise.all([
    params,
    searchParams,
  ])

  const course = await getCourseById(id)
  if (!course || !(await canManageCourse(course))) notFound()

  const [assessment, days, questions, attempts] = await Promise.all([
    getAssessmentById(course.id, assessmentId),
    getCourseDays(course.id),
    getQuestionsForEditing(assessmentId),
    getAttemptsForAssessment(assessmentId),
  ])

  if (!assessment) notFound()

  const hasAttempts = attempts.length > 0
  const expected = assessment.required_question_count
  const ready = questions.length === expected

  const mix = questions.reduce<Record<QuestionDifficulty, number>>(
    (acc, q) => {
      acc[q.difficulty] += 1
      return acc
    },
    { easy: 0, medium: 0, hard: 0 }
  )

  return (
    <div className="space-y-6">
      <BackLink href={`/admin/courses/${course.id}/assessments`}>
        All assessments
      </BackLink>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[19px] font-semibold text-navy-900">
              {assessment.title}
            </h2>
            <Badge tone="neutral">{ASSESSMENT_LABELS[assessment.kind]}</Badge>
            <Badge tone={assessment.is_published ? 'teal' : 'amber'}>
              {assessment.is_published ? 'Published' : 'Draft'}
            </Badge>
            {assessment.is_published ? (
              <Badge tone={assessment.is_locked ? 'amber' : 'teal'}>
                {assessment.is_locked ? 'Locked' : 'Open'}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-[13px] text-ink-soft">
            {questions.length} of {expected} questions ·{' '}
            {formatDuration(assessment.duration_minutes)} ·{' '}
            {mix.easy} easy, {mix.medium} medium, {mix.hard} hard
          </p>
        </div>

        {hasAttempts ? (
          <Link
            href={`/admin/courses/${course.id}/assessments/${assessment.id}/results`}
            className="shrink-0 text-[13px] font-medium text-teal-700 hover:text-teal-800"
          >
            See results and integrity log ({attempts.length})
          </Link>
        ) : null}
      </div>

      {error === 'count' ? (
        <Alert title="Question count is not ready">
          A {assessment.kind} assessment needs exactly {expected} questions
          before it can be published. This one currently has {questions.length}.
        </Alert>
      ) : null}

      {error === 'publish-first' ? (
        <Alert title="Publish before unlocking">
          Students can only start an assessment after it is visible to them.
          Publish it first, then unlock it.
        </Alert>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
        <Panel className="p-5 sm:p-6">
          <h3 className="mb-1 text-[15px] font-semibold text-navy-900">
            Details and timing
          </h3>
          <p className="mb-4 text-[13px] text-ink-soft">
            Choose the student day page and set the server-enforced time limit.
          </p>
          <AssessmentForm
            courseId={course.id}
            days={days}
            assessment={assessment}
          />
        </Panel>

        <Panel className="p-5 sm:p-6">
          <h3 className="text-[15px] font-semibold text-navy-900">
            Student access
          </h3>
          <div className="mt-3 rounded-sm border border-line bg-navy-50/60 p-3">
            <p className="text-[14px] font-semibold text-navy-900">
              {!assessment.is_published
                ? 'Hidden from students'
                : assessment.is_locked
                  ? 'Visible, but locked'
                  : 'Visible and open'}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
              {!assessment.is_published
                ? 'Students cannot see this assessment yet.'
                : assessment.is_locked
                  ? 'Students can see the card, but they cannot start an attempt.'
                  : 'Students can see the card and start their timed attempt.'}
            </p>
          </div>

          {!ready ? (
            <Alert className="mt-3">
              Add exactly {expected} questions before publishing or unlocking.
              This assessment currently has {questions.length}.
            </Alert>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <form action={toggleAssessmentPublished}>
              <input type="hidden" name="course_id" value={course.id} />
              <input type="hidden" name="assessment_id" value={assessment.id} />
              <input
                type="hidden"
                name="next"
                value={assessment.is_published ? 'false' : 'true'}
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={!ready && !assessment.is_published}
              >
                {assessment.is_published
                  ? 'Hide from students'
                  : 'Publish as locked'}
              </Button>
            </form>

            {assessment.is_published ? (
              <form action={toggleAssessmentLocked}>
                <input type="hidden" name="course_id" value={course.id} />
                <input type="hidden" name="assessment_id" value={assessment.id} />
                <input
                  type="hidden"
                  name="next"
                  value={assessment.is_locked ? 'false' : 'true'}
                />
                <Button
                  type="submit"
                  variant={assessment.is_locked ? 'primary' : 'secondary'}
                  disabled={!ready && assessment.is_locked}
                >
                  {assessment.is_locked
                    ? 'Unlock for students'
                    : 'Lock for students'}
                </Button>
              </form>
            ) : null}
          </div>
        </Panel>
      </div>

      <QuestionImport
        courseId={course.id}
        assessmentId={assessment.id}
        kind={assessment.kind}
        expectedQuestionCount={assessment.required_question_count}
        hasAttempts={hasAttempts}
      />

      <Panel>
        <PanelHeader
          title="Questions"
          description={
            hasAttempts
              ? 'Locked for editing while attempts exist.'
              : 'Order only matters when shuffle is off.'
          }
        />

        {questions.length === 0 ? (
          <EmptyState
            title="No questions yet"
            description="Import a file above, or write one by hand."
          />
        ) : (
          <ol className="divide-y divide-line">
            {questions.map((question, index) => {
              const correct = question.options.find(
                (o) => o.id === question.correctOptionId
              )

              return (
                <li key={question.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-sm border border-line bg-navy-50 text-[12px] font-semibold text-navy-700">
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge tone={DIFFICULTY_TONES[question.difficulty]}>
                          {DIFFICULTY_LABELS[question.difficulty]}
                        </Badge>
                        {question.topic ? (
                          <Badge tone="neutral">{question.topic}</Badge>
                        ) : null}
                        {!correct ? (
                          <Badge tone="danger">No correct answer set</Badge>
                        ) : null}
                      </div>

                      <p className="text-[14px] font-medium text-navy-900">
                        {question.stem}
                      </p>

                      <ul className="mt-2 space-y-1">
                        {question.options.map((option) => {
                          const isKey = option.id === question.correctOptionId
                          return (
                            <li
                              key={option.id}
                              className={cx(
                                'flex gap-2 text-[13px]',
                                isKey
                                  ? 'font-medium text-teal-800'
                                  : 'text-ink-soft'
                              )}
                            >
                              <span className="w-4 shrink-0">
                                {option.label}
                              </span>
                              <span>{option.body}</span>
                            </li>
                          )
                        })}
                      </ul>

                      {question.rationale ? (
                        <p className="mt-2 text-[12.5px] text-ink-faint">
                          {question.rationale}
                        </p>
                      ) : null}

                      <EditQuestion
                        courseId={course.id}
                        assessmentId={assessment.id}
                        question={question}
                        disabled={hasAttempts}
                      />
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <form action={moveQuestion}>
                        <input
                          type="hidden"
                          name="course_id"
                          value={course.id}
                        />
                        <input
                          type="hidden"
                          name="assessment_id"
                          value={assessment.id}
                        />
                        <input
                          type="hidden"
                          name="question_id"
                          value={question.id}
                        />
                        <input type="hidden" name="direction" value="up" />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          disabled={index === 0}
                          aria-label={`Move question ${index + 1} up`}
                        >
                          ↑
                        </Button>
                      </form>

                      <form action={moveQuestion}>
                        <input
                          type="hidden"
                          name="course_id"
                          value={course.id}
                        />
                        <input
                          type="hidden"
                          name="assessment_id"
                          value={assessment.id}
                        />
                        <input
                          type="hidden"
                          name="question_id"
                          value={question.id}
                        />
                        <input type="hidden" name="direction" value="down" />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          disabled={index === questions.length - 1}
                          aria-label={`Move question ${index + 1} down`}
                        >
                          ↓
                        </Button>
                      </form>

                      <form action={deleteQuestion}>
                        <input
                          type="hidden"
                          name="course_id"
                          value={course.id}
                        />
                        <input
                          type="hidden"
                          name="assessment_id"
                          value={assessment.id}
                        />
                        <input
                          type="hidden"
                          name="question_id"
                          value={question.id}
                        />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          disabled={hasAttempts}
                          aria-label={`Delete question ${index + 1}`}
                        >
                          <TrashIcon width={15} height={15} />
                        </Button>
                      </form>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </Panel>

      <AddQuestion
        courseId={course.id}
        assessmentId={assessment.id}
        disabled={hasAttempts}
      />

      {hasAttempts ? (
        <Panel className="border-danger-500/25 p-5 sm:p-6">
          <h3 className="text-[15px] font-semibold text-navy-900">
            Reset attempts
          </h3>
          <p className="mt-1 mb-4 max-w-lg text-[13px] text-ink-soft">
            Deletes all {attempts.length} attempt
            {attempts.length === 1 ? '' : 's'}, their answers, their integrity
            log and the scores that came from them. Students would sit it again
            from scratch. Do this when a question needs fixing after the class
            has started.
          </p>
          <form action={resetAttempts}>
            <input type="hidden" name="course_id" value={course.id} />
            <input type="hidden" name="assessment_id" value={assessment.id} />
            <Button type="submit" variant="danger" size="sm">
              Reset all attempts
            </Button>
          </form>
        </Panel>
      ) : (
        <Panel className="border-danger-500/25 p-5 sm:p-6">
          <h3 className="text-[15px] font-semibold text-navy-900">
            Delete this assessment
          </h3>
          <p className="mt-1 mb-4 max-w-lg text-[13px] text-ink-soft">
            Removes it along with its {questions.length} question
            {questions.length === 1 ? '' : 's'}. This cannot be undone.
          </p>
          <form action={deleteAssessment}>
            <input type="hidden" name="course_id" value={course.id} />
            <input type="hidden" name="assessment_id" value={assessment.id} />
            <Button type="submit" variant="danger" size="sm">
              <TrashIcon width={15} height={15} />
              Delete assessment
            </Button>
          </form>
        </Panel>
      )}
    </div>
  )
}
