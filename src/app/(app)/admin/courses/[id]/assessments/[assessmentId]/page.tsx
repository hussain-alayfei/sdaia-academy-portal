import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  deleteAssessment,
  toggleAssessmentLocked,
  toggleAssessmentPublished,
} from '@/app/actions/admin'
import { resetAttempts } from '@/app/actions/questions'
import {
  AssessmentEditorShell,
  AssessmentTabJump,
  type AssessmentEditorTab,
} from '@/components/admin/assessment-editor-tabs'
import { AssessmentForm } from '@/components/admin/assessment-form'
import { AddQuestion } from '@/components/admin/question-editor'
import { QuestionImport } from '@/components/admin/question-import'
import { QuestionList } from '@/components/admin/question-list'
import { TrashIcon } from '@/components/icons'
import {
  Alert,
  BackLink,
  Badge,
  Button,
  Panel,
} from '@/components/ui'
import { canManageCourse, getCourseById } from '@/lib/dal'
import { ASSESSMENT_LABELS, formatDuration } from '@/lib/format'
import { getCourseDays } from '@/lib/queries'
import {
  getAssessmentById,
  getAttemptsForAssessment,
  getQuestionsForEditing,
} from '@/lib/quiz'
import type { QuestionDifficulty } from '@/lib/types'

function resolveTab(
  raw: string | undefined,
  ready: boolean
): AssessmentEditorTab {
  if (raw === 'access' || raw === 'questions' || raw === 'danger') return raw
  return ready ? 'access' : 'questions'
}

export default async function AssessmentEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; assessmentId: string }>
  searchParams: Promise<{ error?: string; tab?: string }>
}) {
  const [{ id, assessmentId }, { error, tab: tabParam }] = await Promise.all([
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
  const initialTab = resolveTab(tabParam, ready)
  const baseHref = `/admin/courses/${course.id}/assessments/${assessment.id}`

  const mix = questions.reduce<Record<QuestionDifficulty, number>>(
    (acc, q) => {
      acc[q.difficulty] += 1
      return acc
    },
    { easy: 0, medium: 0, hard: 0 }
  )

  const nextStep =
    questions.length < expected
      ? `Next: add ${expected - questions.length} more question${
          expected - questions.length === 1 ? '' : 's'
        } (${questions.length}/${expected}).`
      : questions.length > expected
        ? `Next: remove ${questions.length - expected} question${
            questions.length - expected === 1 ? '' : 's'
          } so you have exactly ${expected}.`
        : !assessment.is_published
          ? 'Next: Publish so students can see the card (still locked).'
          : assessment.is_locked
            ? 'Next: Unlock when the class is ready to start.'
            : 'Open to students — they can start now.'

  return (
    <div className="space-y-5">
      <BackLink href={`/admin/courses/${course.id}/assessments`}>
        Assessments
      </BackLink>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-teal-700 uppercase">
            Edit assessment
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-[20px] font-semibold text-navy-900">
              {assessment.title}
            </h2>
            <Badge tone="neutral">{ASSESSMENT_LABELS[assessment.kind]}</Badge>
            <Badge
              tone={
                !ready
                  ? 'amber'
                  : !assessment.is_published
                    ? 'neutral'
                    : assessment.is_locked
                      ? 'amber'
                      : 'teal'
              }
            >
              {!ready
                ? 'Needs questions'
                : !assessment.is_published
                  ? 'Ready to publish'
                  : assessment.is_locked
                    ? 'Published · Locked'
                    : 'Open to students'}
            </Badge>
          </div>
          <p className="mt-1 text-[13px] text-ink-soft">
            {questions.length} of {expected} questions ·{' '}
            {formatDuration(assessment.duration_minutes)} · {mix.easy} easy,{' '}
            {mix.medium} medium, {mix.hard} hard
          </p>
        </div>

        {hasAttempts ? (
          <Link
            href={`${baseHref}/results`}
            className="shrink-0 rounded-sm border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-teal-800 hover:border-teal-600"
          >
            Results ({attempts.length})
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

      <AssessmentEditorShell
        initialTab={initialTab}
        questionCount={questions.length}
        expectedCount={expected}
        access={
          <div className="space-y-5">
            <p className="rounded-md border border-teal-200 bg-teal-50/70 px-3 py-2 text-[13px] font-medium text-teal-900">
              {nextStep}
            </p>

            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
              <Panel className="p-5 sm:p-6">
                <h3 className="mb-1 text-[15px] font-semibold text-navy-900">
                  Details and timing
                </h3>
                <p className="mb-4 text-[13px] text-ink-soft">
                  Choose the student day page and set the server-enforced time
                  limit.
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
                    Add exactly {expected} questions before publishing or
                    unlocking. This assessment currently has {questions.length}.{' '}
                    <AssessmentTabJump tab="questions">
                      Go to Questions
                    </AssessmentTabJump>
                  </Alert>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={toggleAssessmentPublished}>
                    <input type="hidden" name="course_id" value={course.id} />
                    <input
                      type="hidden"
                      name="assessment_id"
                      value={assessment.id}
                    />
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
                      <input
                        type="hidden"
                        name="assessment_id"
                        value={assessment.id}
                      />
                      <input
                        type="hidden"
                        name="next"
                        value={assessment.is_locked ? 'false' : 'true'}
                      />
                      <Button
                        type="submit"
                        variant={
                          assessment.is_locked ? 'primary' : 'secondary'
                        }
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
          </div>
        }
        questions={
          <div className="space-y-5">
            <p className="text-[13px] text-ink-soft">
              {questions.length === expected ? (
                <>
                  Question count is ready ({expected}). When you are done
                  editing, open the{' '}
                  <AssessmentTabJump tab="access">Access</AssessmentTabJump> tab
                  to publish.
                </>
              ) : (
                <>
                  Need exactly <strong>{expected}</strong> questions. You have{' '}
                  <strong>{questions.length}</strong>.
                </>
              )}
            </p>

            <details className="group rounded-md border border-dashed border-line-strong bg-navy-50/40">
              <summary className="cursor-pointer list-none px-4 py-3.5 text-[13px] font-semibold text-navy-900 sm:px-5 [&::-webkit-details-marker]:hidden">
                Import questions from file
                <span className="ms-2 text-[12px] font-normal text-ink-faint group-open:hidden">
                  Paste JSON or upload — kept closed so the page stays short
                </span>
              </summary>
              <div className="border-t border-line px-4 py-4 sm:px-5">
                <QuestionImport
                  courseId={course.id}
                  assessmentId={assessment.id}
                  kind={assessment.kind}
                  expectedQuestionCount={assessment.required_question_count}
                  hasAttempts={hasAttempts}
                />
              </div>
            </details>

            <QuestionList
              courseId={course.id}
              assessmentId={assessment.id}
              questions={questions}
              hasAttempts={hasAttempts}
            />

            <AddQuestion
              courseId={course.id}
              assessmentId={assessment.id}
              disabled={hasAttempts}
            />
          </div>
        }
        danger={
          <div className="space-y-5">
            <p className="max-w-xl text-[13px] text-ink-soft">
              These actions cannot be undone from the UI. Use only when you mean
              to wipe attempts or remove the whole paper.
            </p>

            {hasAttempts ? (
              <Panel className="border-danger-500/25 p-5 sm:p-6">
                <h3 className="text-[15px] font-semibold text-navy-900">
                  Reset attempts
                </h3>
                <p className="mt-1 mb-4 max-w-lg text-[13px] text-ink-soft">
                  Deletes all {attempts.length} attempt
                  {attempts.length === 1 ? '' : 's'}, their answers, their
                  integrity log and the scores that came from them. Students
                  would sit it again from scratch. Do this when a question needs
                  fixing after the class has started.
                </p>
                <form action={resetAttempts}>
                  <input type="hidden" name="course_id" value={course.id} />
                  <input
                    type="hidden"
                    name="assessment_id"
                    value={assessment.id}
                  />
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
                  <input
                    type="hidden"
                    name="assessment_id"
                    value={assessment.id}
                  />
                  <Button type="submit" variant="danger" size="sm">
                    <TrashIcon width={15} height={15} />
                    Delete assessment
                  </Button>
                </form>
              </Panel>
            )}
          </div>
        }
      />
    </div>
  )
}
