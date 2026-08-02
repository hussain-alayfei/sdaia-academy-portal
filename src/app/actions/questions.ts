'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireManager } from '@/lib/dal'
import { revalidateCourseContent } from '@/lib/published'
import {
  OPTION_LABELS,
  parseAssessmentFile,
  type ParsedQuestion,
} from '@/lib/assessment-schema'
import { createClient } from '@/lib/supabase/server'
import type { AssessmentKind } from '@/lib/types'

/**
 * Authoring actions: import a question file, edit a single question, and reset
 * attempts.
 *
 * The writes themselves live in Postgres functions
 * (`import_assessment_questions`, `save_assessment_question`) because a question
 * spans three tables and must land whole. These actions validate, call the
 * function, and translate whatever comes back into something an instructor can
 * act on.
 */

async function assertCanManage(courseId: string) {
  const profile = await requireManager()
  const supabase = await createClient()

  const { data: course } = await supabase
    .from('courses')
    .select('id, owner_id')
    .eq('id', courseId)
    .maybeSingle()

  if (!course) throw new Error('Course not found')
  if (profile.role !== 'admin' && course.owner_id !== profile.id) {
    throw new Error('You do not manage this course')
  }
  return { profile, supabase }
}

/* ================================================================ import == */

export type ImportState =
  | {
      ok?: boolean
      message?: string
      errors?: string[]
      warnings?: string[]
      /** Set after a dry run, so the instructor sees the paper before it lands. */
      preview?: ParsedQuestion[]
      /** Normalised JSON echoed back, so the Import button can resubmit it. */
      raw?: string
      imported?: number
    }
  | undefined

/**
 * One action, two modes.
 *
 * `check` parses and reports without writing anything. `apply` re-parses the
 * same text and imports it. Re-parsing rather than trusting a preview token
 * keeps the action stateless and means the validation that gates the write is
 * the same code that produced the report.
 */
export async function importQuestions(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const courseId = String(formData.get('course_id') ?? '')
  const assessmentId = String(formData.get('assessment_id') ?? '')
  const apply = formData.get('mode') === 'apply'
  const { supabase } = await assertCanManage(courseId)

  const { data: assessment } = await supabase
    .from('assessments')
    .select('id, kind, title, day_id, duration_minutes')
    .eq('id', assessmentId)
    .eq('course_id', courseId)
    .maybeSingle()

  if (!assessment) return { errors: ['That assessment no longer exists.'] }

  // A file beats the textarea when both are present: uploading is the deliberate
  // act, and the textarea may still hold whatever was checked a moment ago.
  const upload = formData.get('file')
  let raw = String(formData.get('raw') ?? '')

  if (upload instanceof File && upload.size > 0) {
    raw = await upload.text()
  }

  const result = parseAssessmentFile(raw, assessment.kind as AssessmentKind)

  if (!result.ok) {
    return {
      errors: result.report.errors,
      warnings: result.report.warnings,
      raw,
    }
  }

  const warnings = [...result.report.warnings]

  if (
    result.file.assessment.duration_minutes !== assessment.duration_minutes
  ) {
    return {
      errors: [
        `The file allows ${result.file.assessment.duration_minutes} minutes, but "${assessment.title}" is configured for ${assessment.duration_minutes} minutes. Update the assessment settings or correct the file.`,
      ],
      warnings,
      raw,
    }
  }

  if (assessment.day_id) {
    const { data: day } = await supabase
      .from('course_days')
      .select('day_number')
      .eq('id', assessment.day_id)
      .eq('course_id', courseId)
      .maybeSingle()

    if (day && result.file.assessment.day !== day.day_number) {
      return {
        errors: [
          `The file declares Day ${result.file.assessment.day}, but "${assessment.title}" belongs to Day ${day.day_number}.`,
        ],
        warnings,
        raw,
      }
    }
  }

  if (!apply) {
    return {
      warnings,
      preview: result.file.questions,
      // Hand back canonical JSON so an uploaded file becomes editable text.
      raw: JSON.stringify(result.file, null, 2),
      message: `${result.file.questions.length} questions parsed. Nothing has been saved yet.`,
    }
  }

  const payload = result.file.questions.map((q) => ({
    difficulty: q.difficulty,
    topic: q.topic ?? null,
    stem: q.stem,
    options: Object.fromEntries(OPTION_LABELS.map((l) => [l, q.options[l]])),
    correct: q.correct,
    rationale: q.rationale ?? null,
  }))

  const { data: imported, error } = await supabase.rpc(
    'import_assessment_questions',
    { p_assessment: assessmentId, p_questions: payload }
  )

  if (error) return { errors: [error.message], warnings, raw }

  revalidatePath(`/admin/courses/${courseId}/assessments`)
  revalidatePath(`/admin/courses/${courseId}/assessments/${assessmentId}`)
  revalidateCourseContent(courseId)

  return {
    ok: true,
    imported: imported ?? 0,
    warnings,
    message: `Imported ${imported} questions.`,
  }
}

/* ====================================================== single question == */

const QuestionFormSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']),
  topic: z.string().trim().max(80).optional(),
  stem: z.string().trim().min(15, 'Write the question out in full.'),
  A: z.string().trim().min(1, 'Option A cannot be empty.'),
  B: z.string().trim().min(1, 'Option B cannot be empty.'),
  C: z.string().trim().min(1, 'Option C cannot be empty.'),
  D: z.string().trim().min(1, 'Option D cannot be empty.'),
  correct: z.enum(OPTION_LABELS),
  rationale: z.string().trim().max(1200).optional(),
})

export type QuestionFormState =
  | {
      ok?: boolean
      message?: string
      errors?: Record<string, string[]>
    }
  | undefined

export async function saveQuestion(
  _prev: QuestionFormState,
  formData: FormData
): Promise<QuestionFormState> {
  const courseId = String(formData.get('course_id') ?? '')
  const assessmentId = String(formData.get('assessment_id') ?? '')
  const questionId = String(formData.get('question_id') ?? '')
  const { supabase } = await assertCanManage(courseId)

  const parsed = QuestionFormSchema.safeParse({
    difficulty: formData.get('difficulty'),
    topic: formData.get('topic'),
    stem: formData.get('stem'),
    A: formData.get('A'),
    B: formData.get('B'),
    C: formData.get('C'),
    D: formData.get('D'),
    correct: formData.get('correct'),
    rationale: formData.get('rationale'),
  })

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors }
  }

  const v = parsed.data
  const { error } = await supabase.rpc('save_assessment_question', {
    p_assessment: assessmentId,
    p_question_id: questionId || null,
    p_payload: {
      difficulty: v.difficulty,
      topic: v.topic ?? null,
      stem: v.stem,
      options: { A: v.A, B: v.B, C: v.C, D: v.D },
      correct: v.correct,
      rationale: v.rationale ?? null,
    },
  })

  if (error) return { message: error.message }

  revalidatePath(`/admin/courses/${courseId}/assessments/${assessmentId}`)
  revalidateCourseContent(courseId)
  return { ok: true }
}

export async function deleteQuestion(formData: FormData) {
  const courseId = String(formData.get('course_id') ?? '')
  const assessmentId = String(formData.get('assessment_id') ?? '')
  const questionId = String(formData.get('question_id') ?? '')
  const { supabase } = await assertCanManage(courseId)

  await supabase
    .from('assessment_questions')
    .delete()
    .eq('id', questionId)
    .eq('assessment_id', assessmentId)

  revalidatePath(`/admin/courses/${courseId}/assessments/${assessmentId}`)
  revalidateCourseContent(courseId)
}

/**
 * Nudge one question up or down.
 *
 * Swaps positions with its neighbour rather than renumbering the whole set, so
 * two instructors reordering at once cannot collapse everything to zero.
 */
export async function moveQuestion(formData: FormData) {
  const courseId = String(formData.get('course_id') ?? '')
  const assessmentId = String(formData.get('assessment_id') ?? '')
  const questionId = String(formData.get('question_id') ?? '')
  const direction = formData.get('direction') === 'up' ? 'up' : 'down'
  const { supabase } = await assertCanManage(courseId)

  const { data: questions } = await supabase
    .from('assessment_questions')
    .select('id, position')
    .eq('assessment_id', assessmentId)
    .order('position')

  const ordered = questions ?? []
  const index = ordered.findIndex((q) => q.id === questionId)
  if (index === -1) return

  const swapWith = direction === 'up' ? index - 1 : index + 1
  if (swapWith < 0 || swapWith >= ordered.length) return

  const a = ordered[index]
  const b = ordered[swapWith]

  await Promise.all([
    supabase
      .from('assessment_questions')
      .update({ position: b.position })
      .eq('id', a.id),
    supabase
      .from('assessment_questions')
      .update({ position: a.position })
      .eq('id', b.id),
  ])

  revalidatePath(`/admin/courses/${courseId}/assessments/${assessmentId}`)
  revalidateCourseContent(courseId)
}

/* =============================================================== attempts == */

/**
 * Throw away every attempt on one assessment, and the scores that came from
 * them.
 *
 * This exists because editing questions is blocked while attempts exist. Fixing
 * a broken question therefore means openly discarding the results it produced,
 * rather than quietly leaving grades that no longer match the paper.
 */
export async function resetAttempts(formData: FormData) {
  const courseId = String(formData.get('course_id') ?? '')
  const assessmentId = String(formData.get('assessment_id') ?? '')
  const { supabase } = await assertCanManage(courseId)

  // Attempts first: deleting them cascades to responses and integrity events.
  await supabase
    .from('assessment_attempts')
    .delete()
    .eq('assessment_id', assessmentId)
    .eq('course_id', courseId)

  await supabase
    .from('assessment_scores')
    .delete()
    .eq('assessment_id', assessmentId)
    .eq('course_id', courseId)

  revalidatePath(`/admin/courses/${courseId}/assessments/${assessmentId}`)
  revalidatePath(`/admin/courses/${courseId}/assessments/${assessmentId}/results`)
  revalidatePath(`/admin/courses/${courseId}/students`)
  revalidateCourseContent(courseId)
}
