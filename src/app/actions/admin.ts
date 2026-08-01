'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { revalidateCourseContent } from '@/lib/published'
import { createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/dal'

/**
 * `values` echoes the submitted fields back on failure. React 19 resets an
 * uncontrolled form once its action settles, so without this a validation
 * error would wipe everything the instructor typed.
 */
export type FormState =
  | {
      errors?: Record<string, string[]>
      message?: string
      ok?: boolean
      values?: Record<string, string>
    }
  | undefined

const fail = (
  message: string,
  values?: Record<string, string>
): FormState => ({ message, values })

/** Pull the named fields out of FormData as plain strings, for echoing back. */
function echo(formData: FormData, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of keys) out[key] = String(formData.get(key) ?? '')
  return out
}

/**
 * Second gate in front of every mutation. RLS is the real boundary — this
 * exists so a mistake surfaces as a clear error instead of a silent no-op.
 */
async function assertCanManage(courseId: string) {
  const profile = await requireManager()
  const supabase = await createClient()

  const { data: course } = await supabase
    .from('courses')
    .select('id, owner_id, slug')
    .eq('id', courseId)
    .maybeSingle()

  if (!course) throw new Error('Course not found')
  if (profile.role !== 'admin' && course.owner_id !== profile.id) {
    throw new Error('You do not manage this course')
  }
  return { profile, course, supabase }
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48)
}

/* ============================================================== courses == */

const CourseSchema = z.object({
  title: z.string().trim().min(3, 'Give the course a title.'),
  title_ar: z.string().trim().optional(),
  description: z.string().trim().optional(),
  join_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{4,32}$/, 'Use 4–32 letters, numbers or hyphens.'),
  start_date: z.string().trim().optional(),
  end_date: z.string().trim().optional(),
})

const COURSE_FIELDS = [
  'title',
  'title_ar',
  'description',
  'join_code',
  'start_date',
  'end_date',
]

export async function createCourse(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await requireManager()
  const sent = echo(formData, COURSE_FIELDS)

  const parsed = CourseSchema.safeParse({
    title: formData.get('title'),
    title_ar: formData.get('title_ar'),
    description: formData.get('description'),
    join_code: formData.get('join_code'),
    start_date: formData.get('start_date'),
    end_date: formData.get('end_date'),
  })

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values: sent }
  }

  const v = parsed.data
  const supabase = await createClient()

  const base = slugify(v.title) || 'course'
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`

  const { data, error } = await supabase
    .from('courses')
    .insert({
      title: v.title,
      title_ar: v.title_ar || null,
      description: v.description || null,
      join_code: v.join_code,
      slug,
      owner_id: profile.id,
      start_date: v.start_date || null,
      end_date: v.end_date || null,
      is_published: false,
    })
    .select('id')
    .single()

  if (error) {
    return fail(
      error.code === '23505'
        ? 'That course code is already in use. Pick another.'
        : error.message,
      sent
    )
  }

  revalidatePath('/admin')
  redirect(`/admin/courses/${data.id}`)
}

export async function updateCourse(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const courseId = String(formData.get('course_id') ?? '')
  const { supabase } = await assertCanManage(courseId)

  const parsed = CourseSchema.safeParse({
    title: formData.get('title'),
    title_ar: formData.get('title_ar'),
    description: formData.get('description'),
    join_code: formData.get('join_code'),
    start_date: formData.get('start_date'),
    end_date: formData.get('end_date'),
  })

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors }
  }

  const v = parsed.data
  const { error } = await supabase
    .from('courses')
    .update({
      title: v.title,
      title_ar: v.title_ar || null,
      description: v.description || null,
      join_code: v.join_code,
      start_date: v.start_date || null,
      end_date: v.end_date || null,
    })
    .eq('id', courseId)

  if (error) {
    return fail(
      error.code === '23505'
        ? 'That course code is already in use. Pick another.'
        : error.message
    )
  }

  revalidatePath(`/admin/courses/${courseId}`)
  return { ok: true }
}

export async function toggleCoursePublished(formData: FormData) {
  const courseId = String(formData.get('course_id') ?? '')
  const next = formData.get('next') === 'true'
  const { supabase } = await assertCanManage(courseId)

  await supabase
    .from('courses')
    .update({ is_published: next })
    .eq('id', courseId)

  revalidatePath(`/admin/courses/${courseId}`)
  revalidatePath('/admin')
}

/* ================================================================= days == */

const DaySchema = z.object({
  day_number: z.coerce.number().int().min(1).max(60),
  title: z.string().trim().min(2, 'Give the day a title.'),
  title_ar: z.string().trim().optional(),
  summary: z.string().trim().optional(),
  scheduled_date: z.string().trim().optional(),
})

export async function createDay(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const courseId = String(formData.get('course_id') ?? '')
  const { supabase } = await assertCanManage(courseId)
  const sent = echo(formData, [
    'day_number',
    'title',
    'title_ar',
    'summary',
    'scheduled_date',
  ])

  const parsed = DaySchema.safeParse({
    day_number: formData.get('day_number'),
    title: formData.get('title'),
    title_ar: formData.get('title_ar'),
    summary: formData.get('summary'),
    scheduled_date: formData.get('scheduled_date'),
  })

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values: sent }
  }

  const v = parsed.data
  const { error } = await supabase.from('course_days').insert({
    course_id: courseId,
    day_number: v.day_number,
    title: v.title,
    title_ar: v.title_ar || null,
    summary: v.summary || null,
    scheduled_date: v.scheduled_date || null,
    is_published: false,
  })

  if (error) {
    return fail(
      error.code === '23505'
        ? `Day ${v.day_number} already exists in this course.`
        : error.message,
      sent
    )
  }

  revalidatePath(`/admin/courses/${courseId}`)
  revalidateCourseContent(courseId)
  return { ok: true }
}

export async function toggleDayPublished(formData: FormData) {
  const courseId = String(formData.get('course_id') ?? '')
  const dayId = String(formData.get('day_id') ?? '')
  const next = formData.get('next') === 'true'
  const { supabase } = await assertCanManage(courseId)

  await supabase
    .from('course_days')
    .update({ is_published: next })
    .eq('id', dayId)
    .eq('course_id', courseId)

  revalidatePath(`/admin/courses/${courseId}`)
  revalidatePath(`/admin/courses/${courseId}/days/${dayId}`)
  revalidateCourseContent(courseId)
}

export async function deleteDay(formData: FormData) {
  const courseId = String(formData.get('course_id') ?? '')
  const dayId = String(formData.get('day_id') ?? '')
  const { supabase } = await assertCanManage(courseId)

  // Remove stored objects first so the bucket does not keep orphans.
  const { data: files } = await supabase
    .from('resources')
    .select('storage_path')
    .eq('day_id', dayId)
    .not('storage_path', 'is', null)

  const paths = (files ?? [])
    .map((f) => f.storage_path)
    .filter((p): p is string => Boolean(p))

  if (paths.length > 0) {
    await supabase.storage.from('course-files').remove(paths)
  }

  await supabase
    .from('course_days')
    .delete()
    .eq('id', dayId)
    .eq('course_id', courseId)

  revalidatePath(`/admin/courses/${courseId}`)
  revalidateCourseContent(courseId)
  redirect(`/admin/courses/${courseId}`)
}

/* ============================================================ resources == */

const RESOURCE_KINDS = [
  'slides',
  'pdf',
  'notebook',
  'lab',
  'link',
  'dataset',
  'file',
] as const

const LinkResourceSchema = z.object({
  title: z.string().trim().min(2, 'Give the item a title.'),
  description: z.string().trim().optional(),
  kind: z.enum(RESOURCE_KINDS),
  external_url: z.string().trim().url('Enter a full URL, including https://'),
})

export async function addLinkResource(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const courseId = String(formData.get('course_id') ?? '')
  const dayId = String(formData.get('day_id') ?? '')
  const { supabase } = await assertCanManage(courseId)

  const parsed = LinkResourceSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    kind: formData.get('kind'),
    external_url: formData.get('external_url'),
  })

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors }
  }

  const v = parsed.data
  const { error } = await supabase.from('resources').insert({
    course_id: courseId,
    day_id: dayId,
    kind: v.kind,
    title: v.title,
    description: v.description || null,
    external_url: v.external_url,
    is_published: true,
  })

  if (error) return fail(error.message)

  revalidatePath(`/admin/courses/${courseId}/days/${dayId}`)
  revalidateCourseContent(courseId)
  return { ok: true }
}

/**
 * Records a file the browser has already pushed straight to Supabase Storage.
 *
 * Uploading through a Server Action would mean buffering the whole file in the
 * Next.js process and raising `serverActions.bodySizeLimit` (1 MB by default),
 * which a 100 MB slide deck would blow through. The browser talks to Storage
 * directly instead — still authenticated, still subject to the bucket's RLS —
 * and this action only writes the row.
 */
export async function registerUploadedResource(input: {
  courseId: string
  dayId: string
  path: string
  title: string
  description?: string
  kind: string
  size: number
  mimeType: string | null
}): Promise<FormState> {
  const { supabase } = await assertCanManage(input.courseId)

  // The client picks the object path, so pin it to this course and day —
  // otherwise a manager of course A could attach an object from course B.
  const expectedPrefix = `${input.courseId}/${input.dayId}/`
  if (!input.path.startsWith(expectedPrefix) || input.path.includes('..')) {
    return fail('Rejected: file path does not belong to this day.')
  }

  if (input.title.trim().length < 2) {
    return { errors: { title: ['Give the item a title.'] } }
  }

  const { error } = await supabase.from('resources').insert({
    course_id: input.courseId,
    day_id: input.dayId,
    kind: (RESOURCE_KINDS as readonly string[]).includes(input.kind)
      ? (input.kind as (typeof RESOURCE_KINDS)[number])
      : 'file',
    title: input.title.trim(),
    description: input.description?.trim() || null,
    storage_path: input.path,
    file_size: input.size,
    mime_type: input.mimeType,
    is_published: true,
  })

  if (error) {
    // Do not leave the object behind if the row could not be written.
    await supabase.storage.from('course-files').remove([input.path])
    return fail(error.message)
  }

  revalidatePath(`/admin/courses/${input.courseId}/days/${input.dayId}`)
  revalidateCourseContent(input.courseId)
  return { ok: true }
}

export async function toggleResourcePublished(formData: FormData) {
  const courseId = String(formData.get('course_id') ?? '')
  const dayId = String(formData.get('day_id') ?? '')
  const resourceId = String(formData.get('resource_id') ?? '')
  const next = formData.get('next') === 'true'
  const { supabase } = await assertCanManage(courseId)

  await supabase
    .from('resources')
    .update({ is_published: next })
    .eq('id', resourceId)
    .eq('course_id', courseId)

  revalidatePath(`/admin/courses/${courseId}/days/${dayId}`)
  revalidateCourseContent(courseId)
}

export async function deleteResource(formData: FormData) {
  const courseId = String(formData.get('course_id') ?? '')
  const dayId = String(formData.get('day_id') ?? '')
  const resourceId = String(formData.get('resource_id') ?? '')
  const { supabase } = await assertCanManage(courseId)

  const { data: resource } = await supabase
    .from('resources')
    .select('storage_path')
    .eq('id', resourceId)
    .eq('course_id', courseId)
    .maybeSingle()

  if (resource?.storage_path) {
    await supabase.storage.from('course-files').remove([resource.storage_path])
  }

  await supabase
    .from('resources')
    .delete()
    .eq('id', resourceId)
    .eq('course_id', courseId)

  revalidatePath(`/admin/courses/${courseId}/days/${dayId}`)
  revalidateCourseContent(courseId)
}

/* ========================================================== assessments == */

const AssessmentSchema = z.object({
  kind: z.enum(['pre', 'post', 'quiz']),
  title: z.string().trim().min(2, 'Give the assessment a title.'),
  description: z.string().trim().optional(),
  external_url: z
    .string()
    .trim()
    .url('Enter a full URL, including https://')
    .optional()
    .or(z.literal('')),
  max_score: z.coerce.number().min(1).max(1000),
})

export async function saveAssessment(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const courseId = String(formData.get('course_id') ?? '')
  const assessmentId = String(formData.get('assessment_id') ?? '')
  const { supabase } = await assertCanManage(courseId)

  const parsed = AssessmentSchema.safeParse({
    kind: formData.get('kind'),
    title: formData.get('title'),
    description: formData.get('description'),
    external_url: formData.get('external_url'),
    max_score: formData.get('max_score'),
  })

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors }
  }

  const v = parsed.data
  const url = v.external_url || null
  // No link yet means there is nothing to open, so keep it locked.
  const isLocked = formData.get('is_locked') === 'on' || !url

  const payload = {
    course_id: courseId,
    kind: v.kind,
    title: v.title,
    description: v.description || null,
    external_url: url,
    max_score: v.max_score,
    is_locked: isLocked,
    position: v.kind === 'pre' ? 0 : v.kind === 'post' ? 1 : 2,
  }

  const { error } = assessmentId
    ? await supabase
        .from('assessments')
        .update(payload)
        .eq('id', assessmentId)
        .eq('course_id', courseId)
    : await supabase.from('assessments').insert(payload)

  if (error) return fail(error.message)

  revalidatePath(`/admin/courses/${courseId}/assessments`)
  revalidateCourseContent(courseId)
  return { ok: true }
}

export async function deleteAssessment(formData: FormData) {
  const courseId = String(formData.get('course_id') ?? '')
  const assessmentId = String(formData.get('assessment_id') ?? '')
  const { supabase } = await assertCanManage(courseId)

  await supabase
    .from('assessments')
    .delete()
    .eq('id', assessmentId)
    .eq('course_id', courseId)

  revalidatePath(`/admin/courses/${courseId}/assessments`)
  revalidateCourseContent(courseId)
}

/* =============================================================== scores == */

export async function saveScore(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const courseId = String(formData.get('course_id') ?? '')
  const assessmentId = String(formData.get('assessment_id') ?? '')
  const studentId = String(formData.get('student_id') ?? '')
  const { profile, supabase } = await assertCanManage(courseId)

  const raw = String(formData.get('score') ?? '').trim()

  // Empty clears any previously recorded score.
  if (raw === '') {
    await supabase
      .from('assessment_scores')
      .delete()
      .eq('assessment_id', assessmentId)
      .eq('student_id', studentId)

    revalidatePath(`/admin/courses/${courseId}/students`)
    return { ok: true }
  }

  const score = Number(raw)
  if (!Number.isFinite(score) || score < 0) {
    return fail('Score must be a number of 0 or more.')
  }

  const { data: assessment } = await supabase
    .from('assessments')
    .select('max_score')
    .eq('id', assessmentId)
    .eq('course_id', courseId)
    .maybeSingle()

  const maxScore = assessment?.max_score ?? 100
  if (score > maxScore) {
    return fail(`Score cannot exceed the maximum of ${maxScore}.`)
  }

  const { error } = await supabase.from('assessment_scores').upsert(
    {
      assessment_id: assessmentId,
      student_id: studentId,
      course_id: courseId,
      score,
      max_score: maxScore,
      recorded_by: profile.id,
      recorded_at: new Date().toISOString(),
    },
    { onConflict: 'assessment_id,student_id' }
  )

  if (error) return fail(error.message)

  revalidatePath(`/admin/courses/${courseId}/students`)
  return { ok: true }
}

export async function removeStudent(formData: FormData) {
  const courseId = String(formData.get('course_id') ?? '')
  const studentId = String(formData.get('student_id') ?? '')
  const { supabase } = await assertCanManage(courseId)

  await supabase
    .from('enrollments')
    .delete()
    .eq('course_id', courseId)
    .eq('student_id', studentId)

  revalidatePath(`/admin/courses/${courseId}/students`)
}
