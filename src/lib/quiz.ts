import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'
import type {
  Assessment,
  AssessmentAttempt,
  AssessmentOption,
  AssessmentQuestion,
  AttemptStatus,
  IntegrityEvent,
  Profile,
  QuestionOrder,
} from '@/lib/types'

/**
 * Reads for the quiz engine.
 *
 * Nothing here is cached across users, and that is the point. Every row in this
 * file is either an answer key or one student's own work, so it all goes through
 * the user-scoped client where RLS applies. The cached readers in `published.ts`
 * deliberately know nothing about questions.
 */

/* ------------------------------------------------------------ instructor -- */

export type QuestionForEditing = AssessmentQuestion & {
  options: AssessmentOption[]
  correctOptionId: string | null
  rationale: string | null
}

const byLabel = (a: AssessmentOption, b: AssessmentOption) =>
  a.label.localeCompare(b.label)

/**
 * Questions with their options and the answer key, for the editor.
 *
 * Only an instructor can read this: the answer-key policy allows a student in
 * only for an assessment they have already submitted.
 */
export const getQuestionsForEditing = cache(
  async (assessmentId: string): Promise<QuestionForEditing[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('assessment_questions')
      .select(
        '*, options:assessment_options(*), answer:assessment_answer_keys(option_id, rationale)'
      )
      .eq('assessment_id', assessmentId)
      .order('position')

    return (data ?? []).map((row) => {
      const { options, answer, ...question } = row
      return {
        ...question,
        options: [...options].sort(byLabel),
        correctOptionId: answer?.option_id ?? null,
        rationale: answer?.rationale ?? null,
      }
    })
  }
)

export const getAssessmentById = cache(
  async (courseId: string, assessmentId: string): Promise<Assessment | null> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', assessmentId)
      .eq('course_id', courseId)
      .maybeSingle()

    return data ?? null
  }
)

/** Question count per assessment, for the admin list. */
export const getQuestionCounts = cache(
  async (courseId: string): Promise<Record<string, number>> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('assessment_questions')
      .select('assessment_id')
      .eq('course_id', courseId)

    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
      counts[row.assessment_id] = (counts[row.assessment_id] ?? 0) + 1
    }
    return counts
  }
)

export type AttemptWithStudent = AssessmentAttempt & {
  student: Pick<Profile, 'id' | 'full_name' | 'email'> | null
}

/** Every attempt on one assessment, newest activity first. */
export const getAttemptsForAssessment = cache(
  async (assessmentId: string): Promise<AttemptWithStudent[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('assessment_attempts')
      .select('*, student:profiles(id, full_name, email)')
      .eq('assessment_id', assessmentId)
      .eq('is_practice', false)
      .order('started_at', { ascending: false })

    return data ?? []
  }
)

/**
 * Correct answers per attempt, counted from the graded response rows.
 *
 * While an assessment's results are hidden, `submit_attempt` deliberately
 * leaves `attempt.correct_count` null, because that is a column the student can
 * read. `is_correct` on the responses is still written, and RLS keeps those
 * rows manager-only once the attempt is over, so the instructor's view of the
 * marks is rebuilt from there instead. Once results are released the stored
 * `correct_count` is backfilled and this becomes a no-op fallback.
 */
export const getGradedCounts = cache(
  async (assessmentId: string): Promise<Record<string, number>> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('assessment_responses')
      .select(
        'attempt_id, attempt:assessment_attempts!inner(assessment_id, is_practice)'
      )
      .eq('attempt.assessment_id', assessmentId)
      .eq('attempt.is_practice', false)
      .eq('is_correct', true)

    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
      counts[row.attempt_id] = (counts[row.attempt_id] ?? 0) + 1
    }
    return counts
  }
)

/** Every attempt across a whole course, for the roster grid. */
export const getCourseAttempts = cache(
  async (courseId: string): Promise<AssessmentAttempt[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('assessment_attempts')
      .select('*')
      .eq('course_id', courseId)
      .eq('is_practice', false)

    return data ?? []
  }
)

/** Integrity log for one assessment, oldest first so it reads as a timeline. */
export type IntegrityEventForResults = IntegrityEvent & {
  questionPosition: number | null
}

export const getIntegrityEvents = cache(
  async (assessmentId: string): Promise<IntegrityEventForResults[]> => {
    const supabase = await createClient()

    // Scoped through the attempt, because events carry no assessment_id of their
    // own — they hang off the attempt they happened during.
    const { data } = await supabase
      .from('assessment_integrity_events')
      .select(
        'id, attempt_id, course_id, student_id, question_id, question_warning_number, kind, warning_number, occurred_at, attempt:assessment_attempts!inner(assessment_id), question:assessment_questions(position)'
      )
      .eq('attempt.assessment_id', assessmentId)
      .order('occurred_at')

    return (data ?? []).map((event) => ({
      id: event.id,
      attempt_id: event.attempt_id,
      course_id: event.course_id,
      student_id: event.student_id,
      question_id: event.question_id,
      question_warning_number: event.question_warning_number,
      kind: event.kind,
      warning_number: event.warning_number,
      occurred_at: event.occurred_at,
      questionPosition: event.question?.position ?? null,
    }))
  }
)

export type QuestionStat = {
  questionId: string
  position: number
  stem: string
  difficulty: AssessmentQuestion['difficulty']
  answered: number
  correct: number
}

/**
 * How the class did on each question.
 *
 * The point of this is to find the broken item: a question everybody got wrong
 * is usually badly worded rather than hard, and a question everybody got right
 * is not measuring anything.
 */
export const getQuestionStats = cache(
  async (assessmentId: string): Promise<QuestionStat[]> => {
    const supabase = await createClient()

    const [{ data: questions }, { data: responses }] = await Promise.all([
      supabase
        .from('assessment_questions')
        .select('id, position, stem, difficulty')
        .eq('assessment_id', assessmentId)
        .order('position'),
      supabase
        .from('assessment_responses')
        .select('question_id, is_correct, attempt:assessment_attempts!inner(assessment_id, status, is_practice)')
        .eq('attempt.assessment_id', assessmentId)
        .eq('attempt.is_practice', false)
        .neq('attempt.status', 'in_progress'),
    ])

    const tally = new Map<string, { answered: number; correct: number }>()
    for (const row of responses ?? []) {
      const current = tally.get(row.question_id) ?? { answered: 0, correct: 0 }
      current.answered += 1
      if (row.is_correct) current.correct += 1
      tally.set(row.question_id, current)
    }

    return (questions ?? []).map((q) => ({
      questionId: q.id,
      position: q.position,
      stem: q.stem,
      difficulty: q.difficulty,
      answered: tally.get(q.id)?.answered ?? 0,
      correct: tally.get(q.id)?.correct ?? 0,
    }))
  }
)

/* --------------------------------------------------------------- student -- */

/** This student's attempt on one assessment, or null if they have not begun. */
export const getMyAttempt = cache(
  async (assessmentId: string): Promise<AssessmentAttempt | null> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('assessment_attempts')
      .select('*')
      .eq('assessment_id', assessmentId)
      .maybeSingle()

    return data ?? null
  }
)

/** Every attempt this student holds in one course, keyed by assessment. */
export const getMyAttempts = cache(
  async (courseId: string): Promise<Record<string, AssessmentAttempt>> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('assessment_attempts')
      .select('*')
      .eq('course_id', courseId)
      .eq('is_practice', false)

    const byAssessment: Record<string, AssessmentAttempt> = {}
    for (const row of data ?? []) byAssessment[row.assessment_id] = row
    return byAssessment
  }
)

export type PaperQuestion = {
  id: string
  position: number
  section: number
  format: AssessmentQuestion['format']
  stem: string
  /** Null falls back to the English stem at render time. */
  stemAr: string | null
  options: Array<{ id: string; body: string; bodyAr: string | null }>
  selectedOptionId: string | null
  flagged: boolean
  integrityWarningCount: number
  integrityInvalidated: boolean
}

/** Narrow the jsonb snapshot into the shape it was written as. */
export function readQuestionOrder(value: unknown): QuestionOrder {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const { q, o } = entry as { q?: unknown; o?: unknown }
    if (typeof q !== 'string' || !Array.isArray(o)) return []
    return [{ q, o: o.filter((id): id is string => typeof id === 'string') }]
  })
}

/**
 * The paper as this student sees it: their frozen question order, their frozen
 * option order, and whatever they have answered so far. No correctness.
 *
 * If the instructor edited the assessment after the attempt began, questions
 * that no longer exist drop out and newly added ones do not appear. The paper
 * a student started is the paper they finish.
 */
export async function getAttemptPaper(
  attempt: AssessmentAttempt
): Promise<PaperQuestion[]> {
  const order = readQuestionOrder(attempt.question_order)
  if (order.length === 0) return []

  const supabase = await createClient()
  const questionIds = order.map((entry) => entry.q)

  const [{ data: questions }, { data: responses }, { data: events }] =
    await Promise.all([
    supabase
      .from('assessment_questions')
      .select(
        'id, stem, stem_ar, section, format, options:assessment_options(id, body, body_ar)'
      )
      .in('id', questionIds),
    supabase
      .from('assessment_responses')
      .select('question_id, selected_option_id, flagged')
      .eq('attempt_id', attempt.id),
    supabase
      .from('assessment_integrity_events')
      .select('question_id, question_warning_number')
      .eq('attempt_id', attempt.id)
      .not('question_id', 'is', null),
  ])

  const byId = new Map((questions ?? []).map((q) => [q.id, q]))
  const answers = new Map(
    (responses ?? []).map((r) => [
      r.question_id,
      { selectedOptionId: r.selected_option_id, flagged: r.flagged },
    ])
  )
  const warningCounts = new Map<string, number>()
  for (const event of events ?? []) {
    if (!event.question_id) continue
    warningCounts.set(
      event.question_id,
      Math.max(
        warningCounts.get(event.question_id) ?? 0,
        event.question_warning_number ?? 0
      )
    )
  }

  return order.flatMap((entry, index) => {
    const question = byId.get(entry.q)
    if (!question) return []

    const options = new Map(question.options.map((o) => [o.id, o]))
    const ordered = entry.o.flatMap((id) => {
      const option = options.get(id)
      return option
        ? [{ id: option.id, body: option.body, bodyAr: option.body_ar ?? null }]
        : []
    })

    const answer = answers.get(entry.q)
    const integrityWarningCount = warningCounts.get(entry.q) ?? 0

    return [
      {
        id: question.id,
        position: index,
        section: question.section ?? 1,
        format: question.format ?? 'multiple_choice',
        stem: question.stem,
        stemAr: question.stem_ar ?? null,
        options: ordered,
        selectedOptionId: answer?.selectedOptionId ?? null,
        flagged: answer?.flagged ?? false,
        integrityWarningCount,
        integrityInvalidated: integrityWarningCount >= 3,
      },
    ]
  })
}

export type ReviewQuestion = {
  id: string
  position: number
  stem: string
  difficulty: AssessmentQuestion['difficulty']
  topic: string | null
  options: Array<{ id: string; label: string; body: string }>
  selectedOptionId: string | null
  correctOptionId: string | null
  rationale: string | null
  isCorrect: boolean
  integrityWarningCount: number
  integrityInvalidated: boolean
}

/**
 * The review screen, available only once the attempt is submitted.
 *
 * The answer key read here succeeds purely because of RLS: the policy on
 * `assessment_answer_keys` opens for a student whose attempt has a
 * `submitted_at`. Calling this mid-attempt returns null keys rather than
 * leaking, but the caller should not be calling it at all.
 */
export async function getAttemptReview(
  attempt: AssessmentAttempt
): Promise<ReviewQuestion[]> {
  const order = readQuestionOrder(attempt.question_order)
  const supabase = await createClient()

  const [
    { data: questions },
    { data: responses },
    { data: keys },
    { data: events },
  ] =
    await Promise.all([
      supabase
        .from('assessment_questions')
        .select('id, stem, difficulty, topic, options:assessment_options(id, label, body)')
        .eq('assessment_id', attempt.assessment_id),
      supabase
        .from('assessment_responses')
        .select('question_id, selected_option_id, is_correct')
        .eq('attempt_id', attempt.id),
      supabase
        .from('assessment_answer_keys')
        .select('question_id, option_id, rationale'),
      supabase
        .from('assessment_integrity_events')
        .select('question_id, question_warning_number')
        .eq('attempt_id', attempt.id)
        .not('question_id', 'is', null),
    ])

  const answers = new Map((responses ?? []).map((r) => [r.question_id, r]))
  const keyByQuestion = new Map((keys ?? []).map((k) => [k.question_id, k]))
  const warningCounts = new Map<string, number>()
  for (const event of events ?? []) {
    if (!event.question_id) continue
    warningCounts.set(
      event.question_id,
      Math.max(
        warningCounts.get(event.question_id) ?? 0,
        event.question_warning_number ?? 0
      )
    )
  }

  // Show them in the order they sat, falling back to stored position for
  // anything the snapshot does not mention.
  const rank = new Map(order.map((entry, i) => [entry.q, i]))
  const sorted = [...(questions ?? [])].sort(
    (a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999)
  )

  return sorted.map((question, index) => {
    const answer = answers.get(question.id)
    const key = keyByQuestion.get(question.id)
    const integrityWarningCount = warningCounts.get(question.id) ?? 0

    return {
      id: question.id,
      position: index,
      stem: question.stem,
      difficulty: question.difficulty,
      topic: question.topic,
      options: [...question.options].sort((a, b) => a.label.localeCompare(b.label)),
      selectedOptionId: answer?.selected_option_id ?? null,
      correctOptionId: key?.option_id ?? null,
      rationale: key?.rationale ?? null,
      isCorrect: answer?.is_correct === true,
      integrityWarningCount,
      integrityInvalidated: integrityWarningCount >= 3,
    }
  })
}

/** Seconds left on the clock, floored at zero. */
export function secondsRemaining(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.floor(ms / 1000))
}

export function isAttemptOpen(attempt: AssessmentAttempt): boolean {
  return attempt.status === 'in_progress' && secondsRemaining(attempt.expires_at) > 0
}

export const ATTEMPT_STATUS_LABELS: Record<AttemptStatus, string> = {
  in_progress: 'In progress',
  submitted: 'Submitted',
  timed_out: 'Ran out of time',
  integrity_stopped: 'Stopped for switching away',
}
