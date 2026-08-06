import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { beginAttempt } from '@/app/actions/quiz'
import { AlertIcon, ClockIcon, EyeOffIcon, LockIcon } from '@/components/icons'
import { QuizExpired } from '@/components/quiz-expired'
import { QuizReview } from '@/components/quiz-review'
import { QuizRunner } from '@/components/quiz-runner'
import { QuizPreview } from '@/components/quiz-preview'
import { QuizSubmitted } from '@/components/quiz-submitted'
import { ExamStartPanel } from '@/components/exam-start-panel'
import { StudentViewBanner } from '@/components/student-view-banner'
import { Alert, BackLink, Button, Panel, cx } from '@/components/ui'
import { isManager, requireProfile } from '@/lib/dal'
import { readExamSections } from '@/lib/exam-sections'
import { ASSESSMENT_LABELS, formatDuration } from '@/lib/format'
import { getPublishedQuestionCounts } from '@/lib/published'
import {
  getAttemptPaper,
  getAttemptReview,
  getQuestionsForEditing,
  getMyAttempt,
  secondsRemaining,
} from '@/lib/quiz'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Assessment',
}

export default async function QuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ assessmentId: string }>
  searchParams: Promise<{ error?: string; view?: string }>
}) {
  const [{ assessmentId }, { error, view }] = await Promise.all([
    params,
    searchParams,
  ])

  const profile = await requireProfile()
  const supabase = await createClient()

  // RLS decides this: a student sees the row only when it is published and they
  // are enrolled. A 404 covers both "no such quiz" and "not yours".
  const { data: assessment } = await supabase
    .from('assessments')
    .select(
      'id, course_id, kind, title, description, duration_minutes, required_question_count, is_locked, is_published, sections, instructions, instructions_ar, results_released, integrity_warning_limit, day:course_days(day_number), course:courses(slug, title)'
    )
    .eq('id', assessmentId)
    .maybeSingle()

  if (!assessment) notFound()

  const studentView = isManager(profile) && view === 'student'

  const slug = assessment.course?.slug
  const dayNumber = assessment.day?.day_number
  const previewQuery = studentView ? '?view=student' : ''
  const backHref =
    slug && dayNumber
      ? `/c/${slug}/day/${dayNumber}${previewQuery}`
      : slug
        ? `/c/${slug}${previewQuery}`
        : '/home'
  const backLabel = dayNumber ? `Back to day ${dayNumber}` : 'Back to the course'

  const attempt = studentView ? null : await getMyAttempt(assessmentId)
  const isPractice = Boolean(attempt?.is_practice)

  /* ---- instructors ---- */

  // Sitting your own quiz would consume the one attempt and write a score
  // against your name. Dry runs (is_practice) are the only exception — started
  // from the Final exam control tab and wiped on submit or exit.
  if (!attempt && isManager(profile) && !studentView) {
    return (
      <Shell>
        <Panel className="p-6">
          <h1 className="text-[17px] font-semibold text-navy-900">
            {assessment.title}
          </h1>
          <p className="mt-2 text-[14px] text-ink-soft">
            You manage this course, so you cannot sit this yourself. An attempt
            is one per person and would record a score against your name. Use
            the Final exam tab for a dry run that never keeps a score, or the
            editor to read the questions and the answer key.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/admin/courses/${assessment.course_id}/final-exam`}
              className="text-[14px] font-medium text-teal-700 hover:text-teal-800"
            >
              Final exam control
            </Link>
            <Link
              href={`/admin/courses/${assessment.course_id}/assessments/${assessment.id}`}
              className="text-[14px] font-medium text-teal-700 hover:text-teal-800"
            >
              Open in the editor
            </Link>
          </div>
        </Panel>
      </Shell>
    )
  }

  /* ---- live attempt ---- */

  if (attempt && attempt.status === 'in_progress') {
    if (secondsRemaining(attempt.expires_at) <= 0) {
      return <QuizExpired attemptId={attempt.id} />
    }

    const paper = await getAttemptPaper(attempt)

    return (
      <QuizRunner
        attemptId={attempt.id}
        title={assessment.title}
        questions={paper}
        sections={readExamSections(assessment.sections)}
        expiresAt={attempt.expires_at}
        initialWarnings={attempt.warning_count}
        lockdown
        resultsHidden={!assessment.results_released}
        warningLimit={assessment.integrity_warning_limit}
        startFrozen={Boolean(attempt.frozen_at)}
        bilingual={Boolean(assessment.instructions_ar)}
        isPractice={isPractice}
        courseId={assessment.course_id}
        assessmentId={assessment.id}
      />
    )
  }

  /* ---- finished ---- */

  // Practice attempts are deleted on submit — if we somehow still have a
  // finished practice row, send the manager back to the control tab.
  if (attempt && isPractice) {
    return (
      <Shell>
        <Panel className="p-6">
          <h1 className="text-[17px] font-semibold text-navy-900">
            Dry run finished
          </h1>
          <p className="mt-2 text-[14px] text-ink-soft">
            Nothing was saved for grades. You can start another dry run from the
            Final exam tab.
          </p>
          <div className="mt-5">
            <Link
              href={`/admin/courses/${assessment.course_id}/final-exam`}
              className="text-[14px] font-medium text-teal-700 hover:text-teal-800"
            >
              Back to Final exam control
            </Link>
          </div>
        </Panel>
      </Shell>
    )
  }

  if (attempt) {
    // Held-back results are held back everywhere. There is no score on the
    // attempt and RLS refuses the keys, so building the review would produce an
    // empty screen rather than a hidden one.
    if (!assessment.results_released) {
      return (
        <QuizSubmitted
          attempt={attempt}
          title={assessment.title}
          backHref={backHref}
          backLabel={backLabel}
        />
      )
    }

    const questions = await getAttemptReview(attempt)
    return (
      <QuizReview
        attempt={attempt}
        title={assessment.title}
        questions={questions}
        backHref={backHref}
        backLabel={backLabel}
      />
    )
  }

  /* ---- rules screen ---- */

  const counts = await getPublishedQuestionCounts(assessment.course_id)
  const questionCount = counts[assessment.id] ?? 0
  const previewQuestions = studentView
    ? await getQuestionsForEditing(assessment.id)
    : []

  // Allowlist: a named student may start while the paper stays locked for the class.
  const { data: grant } = studentView
    ? { data: null }
    : await supabase
        .from('assessment_access_grants')
        .select('id, opens_at, closes_at')
        .eq('assessment_id', assessment.id)
        .eq('student_id', profile.id)
        .maybeSingle()

  const now = Date.now()
  const grantActive = Boolean(
    grant &&
      new Date(grant.opens_at).getTime() <= now &&
      (grant.closes_at == null || new Date(grant.closes_at).getTime() > now)
  )

  const questionsReady =
    questionCount === assessment.required_question_count
  const openable =
    questionsReady && (!assessment.is_locked || grantActive)

  const notReadyMessage = !questionsReady
    ? 'This assessment is not ready yet. Your instructor is still preparing it.'
    : grant && !grantActive
      ? 'Your access window for this exam is not open right now.'
      : 'This is not open yet. Your instructor will release it when the class is ready.'

  // Stored as one point per line, so authoring stays plain text.
  const toPoints = (value: string | null) =>
    (value ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

  const instructionPoints = toPoints(assessment.instructions)
  const instructionPointsAr = toPoints(assessment.instructions_ar)

  return (
    <Shell>
      {studentView ? (
        <StudentViewBanner
          exitHref={`/admin/courses/${assessment.course_id}/assessments/${assessment.id}`}
        />
      ) : null}

      <div className="animate-page">
        <div className="mb-5">
          <BackLink href={backHref}>{backLabel}</BackLink>
        </div>
        <p className="text-[12px] font-semibold tracking-wide text-teal-700 uppercase">
          {ASSESSMENT_LABELS[assessment.kind]}
          {dayNumber ? ` · Day ${dayNumber}` : ''}
        </p>
        <h1 className="mt-1.5 text-[24px] font-semibold text-navy-900 sm:text-[28px]">
          {assessment.title}
        </h1>
        {assessment.description ? (
          <p className="mt-2 max-w-xl text-[15px] text-ink-soft">
            {assessment.description}
          </p>
        ) : null}
      </div>

      {error ? (
        <Alert className="mt-5" title="Could not start">
          {error}
        </Alert>
      ) : null}

      {/* The exam briefing. Set deliberately larger than the rest of the page:
          this is the one block a student must actually read, and it loses that
          job the moment it looks like the small print underneath it. */}
      {/* An assessment carrying its own briefing gets the bilingual start
          panel: language choice, the instructions in that language, and the
          begin button together. Everything else keeps the short rules list. */}
      {instructionPoints.length > 0 && !studentView ? (
        <ExamStartPanel
          assessmentId={assessment.id}
          instructions={instructionPoints}
          instructionsAr={instructionPointsAr}
          canStart={openable}
          notReadyMessage={notReadyMessage}
        />
      ) : null}

      <Panel
        className={cx(
          'mt-6 p-5 sm:p-6',
          instructionPoints.length > 0 && !studentView && 'hidden'
        )}
      >
        {/* Only shown when the assessment carries no briefing of its own.
            Rendering both put the clock, the one-attempt rule and the integrity
            policy on the same screen twice, in two different voices. */}
        {instructionPoints.length === 0 ? (
          <>
            <h2 className="text-[15px] font-semibold text-navy-900">
              Before you begin
            </h2>

            <ul className="mt-3 space-y-3 text-[14px] text-ink">
          <Rule icon={<ClockIcon width={16} height={16} />}>
            {studentView ? (
              <>
                Students receive <strong className="font-medium text-navy-900">{formatDuration(assessment.duration_minutes)}</strong>{' '}
                for {questionCount} question{questionCount === 1 ? '' : 's'}.
                Your preview has no timer, so you can inspect it calmly.
              </>
            ) : (
              <>
                <strong className="font-medium text-navy-900">{formatDuration(assessment.duration_minutes)}</strong>{' '}
                for {questionCount} question{questionCount === 1 ? '' : 's'}.
                The clock starts when you press begin and runs on the server,
                so closing the page does not pause it.
              </>
            )}
          </Rule>

          <Rule icon={<LockIcon width={16} height={16} />}>
            {studentView ? (
              <>
                <strong className="font-medium text-navy-900">Unlimited previews.</strong>{' '}
                Restart as often as needed; no attempt or score is created.
              </>
            ) : (
              <>
                <strong className="font-medium text-navy-900">One attempt.</strong>{' '}
                There is no second try, and no way to reopen it once submitted.
              </>
            )}
          </Rule>

          <Rule icon={<AlertIcon width={16} height={16} />}>
            Move freely between questions. Flag anything you want to review
            later, then come back to it. {studentView ? 'Preview answers stay only in this browser until you exit.' : 'Every answer saves the moment you pick it, so a lost connection costs you nothing.'}
          </Rule>

          <Rule icon={<EyeOffIcon width={16} height={16} />}>
            <strong className="font-medium text-navy-900">
              Stay on this page.
            </strong>{' '}
            {studentView
              ? 'The real student attempt records leaving the page, leaving fullscreen and copy or paste. Preview mode does not create integrity records.'
              : assessment.integrity_warning_limit !== null
                ? `Leaving this page for another tab or app, or trying to copy or paste, is recorded as a warning. On a computer, leaving fullscreen also counts after a short grace. After ${assessment.integrity_warning_limit} warnings your exam freezes and only your instructor can reopen it — your clock pauses while you wait, so you lose no time.`
                : 'Switching tab or window, copying and pasting are recorded per question. A large warning explains each recorded event. Three events while you are on the same question make only that question worth zero points. The assessment continues, and your other questions are unaffected.'}
          </Rule>
            </ul>
          </>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {studentView ? (
            <QuizPreview
              title={assessment.title}
              questions={previewQuestions.map((question) => ({
                id: question.id,
                stem: question.stem,
                options: question.options.map((option) => ({
                  id: option.id,
                  body: option.body,
                })),
                correctOptionId: question.correctOptionId,
                rationale: question.rationale,
              }))}
              questionCount={assessment.required_question_count}
            />
          ) : openable ? (
            <form action={beginAttempt}>
              <input type="hidden" name="assessment_id" value={assessment.id} />
              <Button type="submit">Begin the assessment</Button>
            </form>
          ) : (
            <p className="text-[14px] text-ink-soft">{notReadyMessage}</p>
          )}
        </div>
      </Panel>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      {children}
    </div>
  )
}

function Rule({
  icon,
  children,
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-sm border border-line bg-navy-50 text-navy-600">
        {icon}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  )
}
