'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireProfile } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import type {
  IntegrityEventKind,
  IntegrityResult,
  SubmitResult,
} from '@/lib/types'

/**
 * Everything a student's browser is allowed to ask for during an attempt.
 *
 * Each of these is a thin wrapper around a Postgres function. The reason they
 * are thin is the point: the timer, the one-attempt rule, the grading and the
 * warning count are all decided in the database, where a modified client cannot
 * reach them. These actions carry the request and translate errors.
 */

const INTEGRITY_KINDS: readonly IntegrityEventKind[] = [
  'tab_hidden',
  'window_blur',
  'copy',
  'paste',
  'context_menu',
  'fullscreen_exit',
]

/** Start, or resume. `start_attempt` hands back the existing attempt if any. */
export async function beginAttempt(formData: FormData) {
  const assessmentId = String(formData.get('assessment_id') ?? '')
  await requireProfile()

  const supabase = await createClient()
  const { error } = await supabase.rpc('start_attempt', {
    p_assessment: assessmentId,
  })

  if (error) {
    redirect(`/quiz/${assessmentId}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/quiz/${assessmentId}`)
  redirect(`/quiz/${assessmentId}`)
}

/**
 * Autosave one answer or flag.
 *
 * Fired on every selection, so it deliberately does not revalidate: the client
 * already knows what it just chose, and re-rendering the paper under the
 * student's cursor on each click would be both slow and jarring. The write is
 * what matters — it is why running out of time still grades the work done.
 */
export async function saveAnswer(input: {
  attemptId: string
  questionId: string
  optionId: string | null
  flagged: boolean
}): Promise<{ ok: boolean; message?: string }> {
  await requireProfile()
  const supabase = await createClient()

  const { error } = await supabase.rpc('save_response', {
    p_attempt: input.attemptId,
    p_question: input.questionId,
    p_option: input.optionId,
    p_flagged: input.flagged,
  })

  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

const idleResult = (message?: string): IntegrityResult & { message?: string } => ({
  active: true,
  question_invalidated: false,
  question_warning_count: 0,
  warning_count: 0,
  warning_limit: null,
  frozen: false,
  message,
})

/**
 * Record one integrity event and report where the student now stands.
 *
 * Counts live in the database, so a reload does not hand back a fresh set of
 * chances. On a paper with an `integrity_warning_limit`, reaching the limit
 * freezes the attempt server-side; on one without, a third event on the same
 * question zeroes that question instead.
 */
export async function reportIntegrityEvent(input: {
  attemptId: string
  questionId: string
  kind: string
}): Promise<IntegrityResult & { message?: string }> {
  await requireProfile()

  if (!INTEGRITY_KINDS.includes(input.kind as IntegrityEventKind)) {
    return idleResult('Unknown event')
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('record_integrity_event', {
    p_attempt: input.attemptId,
    p_kind: input.kind,
    p_question: input.questionId,
  })

  if (error) return idleResult(error.message)

  const result = (data ?? {}) as Partial<IntegrityResult>
  return {
    active: result.active ?? true,
    question_invalidated: result.question_invalidated ?? false,
    question_warning_count: result.question_warning_count ?? 0,
    warning_count: result.warning_count ?? 0,
    warning_limit: result.warning_limit ?? null,
    frozen: result.frozen ?? false,
  }
}

/**
 * Is this attempt still frozen?
 *
 * The freeze screen polls this so the student's exam reopens on its own once the
 * instructor unlocks it, rather than making them guess when to refresh.
 */
export async function checkAttemptFrozen(input: {
  attemptId: string
}): Promise<{ frozen: boolean; expiresAt: string | null }> {
  await requireProfile()
  const supabase = await createClient()

  const { data } = await supabase
    .from('assessment_attempts')
    .select('frozen_at, expires_at')
    .eq('id', input.attemptId)
    .maybeSingle()

  return {
    frozen: Boolean(data?.frozen_at),
    expiresAt: data?.expires_at ?? null,
  }
}

/**
 * Submit and grade. Idempotent in the database, so a double click, a timeout
 * landing next to a manual submit, or a retry after a dropped connection all
 * settle on one result.
 */
export async function finishAttempt(input: {
  attemptId: string
  reason?: 'submitted' | 'timed_out'
}): Promise<{ ok: true; result: SubmitResult } | { ok: false; message: string }> {
  await requireProfile()
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('submit_attempt', {
    p_attempt: input.attemptId,
    p_reason: input.reason ?? 'submitted',
  })

  if (error) return { ok: false, message: error.message }

  const result = (data ?? {}) as SubmitResult

  // Practice attempts are deleted inside submit_attempt — look up via the
  // returned payload when the row is already gone.
  if (result.practice) {
    revalidatePath('/admin')
    return { ok: true, result }
  }

  // The score now shows on the day page and the course overview, so clear those.
  // One extra query on submit is a fair price for not showing a stale "Start".
  const { data: attempt } = await supabase
    .from('assessment_attempts')
    .select(
      'assessment_id, assessment:assessments(day_id), course:courses(slug)'
    )
    .eq('id', input.attemptId)
    .maybeSingle()

  const slug = attempt?.course?.slug
  if (slug) {
    revalidatePath(`/c/${slug}`)
    revalidatePath(`/c/${slug}/day/[dayNumber]`, 'page')
  }
  revalidatePath(`/quiz/${attempt?.assessment_id ?? ''}`)

  return { ok: true, result }
}
