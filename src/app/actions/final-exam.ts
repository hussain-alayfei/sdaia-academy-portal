'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireManager } from '@/lib/dal'
import { revalidateCourseContent } from '@/lib/published'
import { createClient } from '@/lib/supabase/server'

/**
 * Final-exam control centre actions.
 *
 * Kept separate from the general admin surface so the exam-day cockpit has one
 * place that knows about allowlists, single-student reset, and dry runs.
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
    throw new Error('Not allowed')
  }
  return { profile, supabase }
}

function revalidateFinalExam(courseId: string, assessmentId: string) {
  revalidatePath(`/admin/courses/${courseId}/final-exam`)
  revalidatePath(`/admin/courses/${courseId}/assessments/${assessmentId}`)
  revalidatePath(`/admin/courses/${courseId}/assessments/${assessmentId}/results`)
  revalidatePath(`/admin/courses/${courseId}/students`)
  revalidatePath(`/quiz/${assessmentId}`)
  revalidateCourseContent(courseId)
}

/** Grant a named student access while the paper stays locked. */
export async function grantFinalExamAccess(formData: FormData) {
  const courseId = String(formData.get('course_id') ?? '')
  const assessmentId = String(formData.get('assessment_id') ?? '')
  const studentId = String(formData.get('student_id') ?? '')
  const opensAtRaw = String(formData.get('opens_at') ?? '').trim()
  const closesAtRaw = String(formData.get('closes_at') ?? '').trim()
  const { profile, supabase } = await assertCanManage(courseId)

  if (!studentId) {
    redirect(`/admin/courses/${courseId}/final-exam?error=pick-student`)
  }

  const opensAt = opensAtRaw ? new Date(opensAtRaw).toISOString() : new Date().toISOString()
  const closesAt = closesAtRaw ? new Date(closesAtRaw).toISOString() : null

  if (closesAt && new Date(closesAt) <= new Date(opensAt)) {
    redirect(`/admin/courses/${courseId}/final-exam?error=window`)
  }

  const { error } = await supabase.from('assessment_access_grants').upsert(
    {
      assessment_id: assessmentId,
      student_id: studentId,
      course_id: courseId,
      opens_at: opensAt,
      closes_at: closesAt,
      created_by: profile.id,
    },
    { onConflict: 'assessment_id,student_id' }
  )

  if (error) {
    redirect(
      `/admin/courses/${courseId}/final-exam?error=${encodeURIComponent(error.message)}`
    )
  }

  revalidateFinalExam(courseId, assessmentId)
  redirect(`/admin/courses/${courseId}/final-exam`)
}

export async function revokeFinalExamAccess(formData: FormData) {
  const courseId = String(formData.get('course_id') ?? '')
  const assessmentId = String(formData.get('assessment_id') ?? '')
  const grantId = String(formData.get('grant_id') ?? '')
  const { supabase } = await assertCanManage(courseId)

  await supabase
    .from('assessment_access_grants')
    .delete()
    .eq('id', grantId)
    .eq('course_id', courseId)

  revalidateFinalExam(courseId, assessmentId)
  redirect(`/admin/courses/${courseId}/final-exam`)
}

/** Delete one student's attempt (and cascaded responses / integrity events). */
export async function resetStudentAttempt(formData: FormData) {
  const courseId = String(formData.get('course_id') ?? '')
  const assessmentId = String(formData.get('assessment_id') ?? '')
  const attemptId = String(formData.get('attempt_id') ?? '')
  const studentId = String(formData.get('student_id') ?? '')
  const { supabase } = await assertCanManage(courseId)

  await supabase
    .from('assessment_attempts')
    .delete()
    .eq('id', attemptId)
    .eq('assessment_id', assessmentId)
    .eq('course_id', courseId)

  if (studentId) {
    await supabase
      .from('assessment_scores')
      .delete()
      .eq('assessment_id', assessmentId)
      .eq('student_id', studentId)
      .eq('course_id', courseId)
  }

  revalidateFinalExam(courseId, assessmentId)
  redirect(`/admin/courses/${courseId}/final-exam`)
}

/**
 * Start (or resume) an instructor dry run — full runner, no grade kept.
 */
export async function startPracticeAttempt(formData: FormData) {
  const courseId = String(formData.get('course_id') ?? '')
  const assessmentId = String(formData.get('assessment_id') ?? '')
  await assertCanManage(courseId)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('start_practice_attempt', {
    p_assessment: assessmentId,
  })

  if (error) {
    redirect(
      `/admin/courses/${courseId}/final-exam?error=${encodeURIComponent(error.message)}`
    )
  }

  revalidatePath(`/quiz/${assessmentId}`)
  redirect(`/quiz/${assessmentId}`)
}

/** Exit a dry run without submitting — wipe the practice attempt. */
export async function discardPracticeAttempt(formData: FormData) {
  const attemptId = String(formData.get('attempt_id') ?? '')
  const assessmentId = String(formData.get('assessment_id') ?? '')
  const courseId = String(formData.get('course_id') ?? '')
  await requireManager()

  const supabase = await createClient()
  const { error } = await supabase.rpc('discard_practice_attempt', {
    p_attempt: attemptId,
  })

  if (error) {
    redirect(
      `/quiz/${assessmentId}?error=${encodeURIComponent(error.message)}`
    )
  }

  if (courseId) {
    revalidateFinalExam(courseId, assessmentId)
    redirect(`/admin/courses/${courseId}/final-exam`)
  }

  redirect(`/quiz/${assessmentId}`)
}

/** Snapshot for the live board — called from the client every 5s. */
export async function getFinalExamBoard(input: {
  courseId: string
  assessmentId: string
}) {
  const { supabase } = await assertCanManage(input.courseId)

  const [
    { data: assessment },
    { data: enrollments },
    { data: attempts },
    { data: grants },
    { data: gradedRows },
  ] = await Promise.all([
    supabase
      .from('assessments')
      .select(
        'id, title, is_published, is_locked, duration_minutes, integrity_warning_limit, results_released, required_question_count'
      )
      .eq('id', input.assessmentId)
      .eq('course_id', input.courseId)
      .maybeSingle(),
    supabase
      .from('enrollments')
      .select('student_id, student:profiles(id, full_name, email)')
      .eq('course_id', input.courseId)
      .order('enrolled_at'),
    supabase
      .from('assessment_attempts')
      .select(
        'id, student_id, status, warning_count, frozen_at, started_at, submitted_at, expires_at, correct_count, question_count, is_practice'
      )
      .eq('assessment_id', input.assessmentId)
      .eq('is_practice', false),
    supabase
      .from('assessment_access_grants')
      .select(
        'id, student_id, opens_at, closes_at, created_at, student:profiles(id, full_name, email)'
      )
      .eq('assessment_id', input.assessmentId)
      .order('created_at', { ascending: false }),
    // Aggregated in Postgres. This used to select one row per correct answer
    // and count them here, which silently truncated at the API row cap once a
    // course had enough marked answers — the board then under-reported while
    // the Results page, fetching fewer rows, stayed correct.
    supabase.rpc('manager_attempt_scores', { p_course: input.courseId }),
  ])

  if (!assessment) throw new Error('Assessment not found')

  const gradedByAttempt = new Map<string, number>()
  for (const row of gradedRows ?? []) {
    gradedByAttempt.set(row.attempt_id, row.correct)
  }

  const attemptByStudent = new Map(
    (attempts ?? []).map((a) => [a.student_id, a])
  )

  const rows = (enrollments ?? []).map((row) => {
    const attempt = attemptByStudent.get(row.student_id) ?? null
    let status:
      | 'not_started'
      | 'in_progress'
      | 'warnings'
      | 'frozen'
      | 'submitted' = 'not_started'

    if (attempt) {
      if (attempt.frozen_at) status = 'frozen'
      else if (attempt.status === 'in_progress') {
        status = attempt.warning_count > 0 ? 'warnings' : 'in_progress'
      } else status = 'submitted'
    }

    const instructorCorrect =
      attempt?.correct_count ??
      (attempt && status === 'submitted'
        ? (gradedByAttempt.get(attempt.id) ?? null)
        : null)

    return {
      studentId: row.student_id,
      fullName: row.student?.full_name ?? 'Student',
      email: row.student?.email ?? '',
      status,
      attemptId: attempt?.id ?? null,
      warningCount: attempt?.warning_count ?? 0,
      startedAt: attempt?.started_at ?? null,
      submittedAt: attempt?.submitted_at ?? null,
      correctCount: instructorCorrect,
      questionCount: attempt?.question_count ?? null,
    }
  })

  return {
    fetchedAt: new Date().toISOString(),
    assessment,
    rows,
    grants: (grants ?? []).map((g) => ({
      id: g.id,
      studentId: g.student_id,
      fullName: g.student?.full_name ?? 'Student',
      email: g.student?.email ?? '',
      opensAt: g.opens_at,
      closesAt: g.closes_at,
      createdAt: g.created_at,
    })),
  }
}
