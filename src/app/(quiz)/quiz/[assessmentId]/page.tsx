import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { beginAttempt } from '@/app/actions/quiz'
import { AlertIcon, ClockIcon, EyeOffIcon, LockIcon } from '@/components/icons'
import { QuizExpired } from '@/components/quiz-expired'
import { QuizReview } from '@/components/quiz-review'
import { QuizRunner } from '@/components/quiz-runner'
import { Alert, Button, Panel } from '@/components/ui'
import { isManager, requireProfile } from '@/lib/dal'
import { ASSESSMENT_LABELS, formatDuration } from '@/lib/format'
import { getPublishedQuestionCounts } from '@/lib/published'
import {
  getAttemptPaper,
  getAttemptReview,
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
  searchParams: Promise<{ error?: string }>
}) {
  const [{ assessmentId }, { error }] = await Promise.all([params, searchParams])

  const profile = await requireProfile()
  const supabase = await createClient()

  // RLS decides this: a student sees the row only when it is published and they
  // are enrolled. A 404 covers both "no such quiz" and "not yours".
  const { data: assessment } = await supabase
    .from('assessments')
    .select(
      'id, course_id, kind, title, description, duration_minutes, is_locked, is_published, day:course_days(day_number), course:courses(slug, title)'
    )
    .eq('id', assessmentId)
    .maybeSingle()

  if (!assessment) notFound()

  const slug = assessment.course?.slug
  const dayNumber = assessment.day?.day_number
  const backHref =
    slug && dayNumber ? `/c/${slug}/day/${dayNumber}` : slug ? `/c/${slug}` : '/home'
  const backLabel = dayNumber ? `Back to day ${dayNumber}` : 'Back to the course'

  const attempt = await getMyAttempt(assessmentId)

  /* ---- instructors ---- */

  // Sitting your own quiz would consume the one attempt and write a score
  // against your name, so managers get sent to the editor instead.
  if (!attempt && isManager(profile)) {
    return (
      <Shell>
        <Panel className="p-6">
          <h1 className="text-[17px] font-semibold text-navy-900">
            {assessment.title}
          </h1>
          <p className="mt-2 text-[14px] text-ink-soft">
            You manage this course, so you cannot sit this yourself. An attempt
            is one per person and would record a score against your name. Use the
            editor to read the questions and the answer key.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
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
        expiresAt={attempt.expires_at}
        initialWarnings={attempt.warning_count}
      />
    )
  }

  /* ---- finished ---- */

  if (attempt) {
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
  const openable = !assessment.is_locked && questionCount > 0

  return (
    <Shell>
      <div className="animate-rise">
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

      <Panel className="mt-6 p-5 sm:p-6">
        <h2 className="text-[15px] font-semibold text-navy-900">
          Before you begin
        </h2>

        <ul className="mt-3 space-y-3 text-[14px] text-ink">
          <Rule icon={<ClockIcon width={16} height={16} />}>
            <strong className="font-medium text-navy-900">
              {formatDuration(assessment.duration_minutes)}
            </strong>{' '}
            for {questionCount} question{questionCount === 1 ? '' : 's'}. The
            clock starts when you press begin and runs on the server, so closing
            the page does not pause it.
          </Rule>

          <Rule icon={<LockIcon width={16} height={16} />}>
            <strong className="font-medium text-navy-900">One attempt.</strong>{' '}
            There is no second try, and no way to reopen it once submitted.
          </Rule>

          <Rule icon={<AlertIcon width={16} height={16} />}>
            One question at a time. You can skip, flag anything to come back to,
            and move freely between them. Every answer saves the moment you pick
            it, so a lost connection costs you nothing.
          </Rule>

          <Rule icon={<EyeOffIcon width={16} height={16} />}>
            <strong className="font-medium text-navy-900">
              Stay on this page.
            </strong>{' '}
            Switching tab or window, copying and pasting are recorded and shown to
            your instructor. You get two warnings; on the third the attempt is
            submitted as it stands and flagged.
          </Rule>
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {openable ? (
            <form action={beginAttempt}>
              <input type="hidden" name="assessment_id" value={assessment.id} />
              <Button type="submit">Begin the assessment</Button>
            </form>
          ) : (
            <p className="text-[14px] text-ink-soft">
              {questionCount === 0
                ? 'This assessment is not ready yet. Your instructor is still preparing it.'
                : 'This is not open yet. Your instructor will release it when the class is ready.'}
            </p>
          )}

          <Link
            href={backHref}
            className="text-[13px] font-medium text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-navy-900"
          >
            {backLabel}
          </Link>
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
