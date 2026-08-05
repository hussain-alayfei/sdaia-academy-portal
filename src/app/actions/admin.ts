'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { MAX_COURSE_DAYS } from '@/lib/course'
import { QUESTION_COUNTS } from '@/lib/assessment-schema'
import { toTitleCaseEnglish } from '@/lib/format'
import {
  courseLinkContext,
  emitCourseEvent,
} from '@/lib/notifications'
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
  'owner_id',
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
  const title = toTitleCaseEnglish(v.title)
  const supabase = await createClient()

  // Admins may assign the course to another instructor; everyone else owns their own.
  let ownerId = profile.id
  const requestedOwner = String(formData.get('owner_id') ?? '').trim()
  if (profile.role === 'admin' && requestedOwner) {
    const { data: owner } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', requestedOwner)
      .maybeSingle()

    if (
      owner &&
      (owner.role === 'admin' || owner.role === 'instructor')
    ) {
      ownerId = owner.id
    } else {
      return fail('Choose a valid instructor for this course.', sent)
    }
  }

  const base = slugify(title) || 'course'
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`

  const { data, error } = await supabase
    .from('courses')
    .insert({
      title,
      title_ar: v.title_ar || null,
      description: v.description || null,
      join_code: v.join_code,
      slug,
      owner_id: ownerId,
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
  const { profile, supabase } = await assertCanManage(courseId)
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
  const title = toTitleCaseEnglish(v.title)

  const patch: {
    title: string
    title_ar: string | null
    description: string | null
    join_code: string
    start_date: string | null
    end_date: string | null
    owner_id?: string
  } = {
    title,
    title_ar: v.title_ar || null,
    description: v.description || null,
    join_code: v.join_code,
    start_date: v.start_date || null,
    end_date: v.end_date || null,
  }

  if (profile.role === 'admin') {
    const requestedOwner = String(formData.get('owner_id') ?? '').trim()
    if (requestedOwner) {
      const { data: owner } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', requestedOwner)
        .maybeSingle()

      if (
        !owner ||
        (owner.role !== 'admin' && owner.role !== 'instructor')
      ) {
        return fail('Choose a valid instructor for this course.', sent)
      }
      patch.owner_id = owner.id
    }
  }

  const { error } = await supabase
    .from('courses')
    .update(patch)
    .eq('id', courseId)

  if (error) {
    return fail(
      error.code === '23505'
        ? 'That course code is already in use. Pick another.'
        : error.message,
      sent
    )
  }

  revalidatePath(`/admin/courses/${courseId}`)
  revalidatePath('/admin')
  return { ok: true, values: { ...sent, title } }
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
  day_number: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_COURSE_DAYS, `Courses run for ${MAX_COURSE_DAYS} days.`),
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
  const title = toTitleCaseEnglish(v.title)
  const { error } = await supabase.from('course_days').insert({
    course_id: courseId,
    day_number: v.day_number,
    title,
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
  const { profile, supabase } = await assertCanManage(courseId)

  await supabase
    .from('course_days')
    .update({ is_published: next })
    .eq('id', dayId)
    .eq('course_id', courseId)

  if (next) {
    const ctx = await courseLinkContext(courseId, dayId)
    await emitCourseEvent({
      courseId,
      dayId,
      actorId: profile.id,
      kind: 'day_published',
      entityType: 'day',
      entityId: dayId,
      title:
        ctx.dayNumber != null
          ? `Day ${ctx.dayNumber} is now available`
          : 'A new day is available',
      body: 'Open the day to see materials and assessments.',
      href: ctx.dayHref,
    })
  }

  revalidatePath(`/admin/courses/${courseId}`)
  revalidatePath(`/admin/courses/${courseId}/days/${dayId}`)
  revalidateCourseContent(courseId)
}

/**
 * Mark one day as the cohort's current day on the student journey map.
 *
 * Clears any other current flag in the same course first so the unique
 * partial index stays happy and students always see at most one highlight.
 */
export async function setCurrentDay(formData: FormData) {
  const courseId = String(formData.get('course_id') ?? '')
  const dayId = String(formData.get('day_id') ?? '')
  const { supabase } = await assertCanManage(courseId)

  await supabase
    .from('course_days')
    .update({ is_current: false })
    .eq('course_id', courseId)
    .eq('is_current', true)

  await supabase
    .from('course_days')
    .update({ is_current: true })
    .eq('id', dayId)
    .eq('course_id', courseId)

  revalidatePath(`/admin/courses/${courseId}`)
  revalidatePath(`/admin/courses/${courseId}/days/${dayId}`)
  revalidateCourseContent(courseId)
}

export async function clearCurrentDay(formData: FormData) {
  const courseId = String(formData.get('course_id') ?? '')
  const dayId = String(formData.get('day_id') ?? '')
  const { supabase } = await assertCanManage(courseId)

  await supabase
    .from('course_days')
    .update({ is_current: false })
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
  const { profile, supabase } = await assertCanManage(courseId)

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

  const { data: day } = await supabase
    .from('course_days')
    .select('id')
    .eq('id', dayId)
    .eq('course_id', courseId)
    .maybeSingle()

  if (!day) return fail('That day is not part of this course.')

  const { data: created, error } = await supabase
    .from('resources')
    .insert({
      course_id: courseId,
      day_id: dayId,
      kind: v.kind,
      title: v.title,
      description: v.description || null,
      external_url: v.external_url,
      is_published: true,
    })
    .select('id, title, kind')
    .single()

  if (error) return fail(error.message)

  if (created) {
    const ctx = await courseLinkContext(courseId, dayId)
    await emitCourseEvent({
      courseId,
      dayId,
      actorId: profile.id,
      kind: 'resource_added',
      entityType: 'resource',
      entityId: created.id,
      title:
        ctx.dayNumber != null
          ? `New material on Day ${ctx.dayNumber}`
          : 'New material added',
      body: created.title,
      href: ctx.dayHref,
    })
  }

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
  const { profile, supabase } = await assertCanManage(input.courseId)

  const { data: day } = await supabase
    .from('course_days')
    .select('id')
    .eq('id', input.dayId)
    .eq('course_id', input.courseId)
    .maybeSingle()

  if (!day) return fail('That day is not part of this course.')

  // The client picks the object path, so pin it to this course and day —
  // otherwise a manager of course A could attach an object from course B.
  const expectedPrefix = `${input.courseId}/${input.dayId}/`
  if (!input.path.startsWith(expectedPrefix) || input.path.includes('..')) {
    return fail('Rejected: file path does not belong to this day.')
  }

  if (input.title.trim().length < 2) {
    return { errors: { title: ['Give the item a title.'] } }
  }

  const { data: created, error } = await supabase
    .from('resources')
    .insert({
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
    .select('id, title')
    .single()

  if (error) {
    // Do not leave the object behind if the row could not be written.
    await supabase.storage.from('course-files').remove([input.path])
    return fail(error.message)
  }

  if (created) {
    const ctx = await courseLinkContext(input.courseId, input.dayId)
    await emitCourseEvent({
      courseId: input.courseId,
      dayId: input.dayId,
      actorId: profile.id,
      kind: 'resource_added',
      entityType: 'resource',
      entityId: created.id,
      title:
        ctx.dayNumber != null
          ? `New material on Day ${ctx.dayNumber}`
          : 'New material added',
      body: created.title,
      href: ctx.dayHref,
    })
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
  const { profile, supabase } = await assertCanManage(courseId)

  await supabase
    .from('resources')
    .update({ is_published: next })
    .eq('id', resourceId)
    .eq('course_id', courseId)

  if (next) {
    const { data: resource } = await supabase
      .from('resources')
      .select('id, title')
      .eq('id', resourceId)
      .eq('course_id', courseId)
      .maybeSingle()

    if (resource) {
      const ctx = await courseLinkContext(courseId, dayId)
      await emitCourseEvent({
        courseId,
        dayId,
        actorId: profile.id,
        kind: 'resource_added',
        entityType: 'resource',
        entityId: resource.id,
        title:
          ctx.dayNumber != null
            ? `New material on Day ${ctx.dayNumber}`
            : 'New material added',
        body: resource.title,
        href: ctx.dayHref,
      })
    }
  }

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
  day_id: z.string().trim().min(1, 'Choose which day this belongs to.'),
  duration_minutes: z.coerce
    .number()
    .int()
    .min(1, 'Give students at least a minute.')
    .max(300, 'Three hours is the ceiling.'),
})

/**
 * `position` orders assessments within a day rather than across the course, so
 * day 1 shows the pre-assessment above the quiz and day 5 shows the quiz above
 * the post-assessment. It is derived from the kind and never typed in.
 */
function positionForKind(kind: 'pre' | 'post' | 'quiz') {
  return kind === 'pre' ? 0 : kind === 'quiz' ? 1 : 2
}

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
    day_id: formData.get('day_id'),
    duration_minutes: formData.get('duration_minutes'),
  })

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors }
  }

  const v = parsed.data

  // The day has to belong to this course. Without this check a manager of one
  // course could park an assessment on another course's day.
  const { data: day } = await supabase
    .from('course_days')
    .select('id')
    .eq('id', v.day_id)
    .eq('course_id', courseId)
    .maybeSingle()

  if (!day) return { errors: { day_id: ['That day is not part of this course.'] } }

  const payload = {
    course_id: courseId,
    day_id: v.day_id,
    kind: v.kind,
    title: v.title,
    description: v.description || null,
    duration_minutes: v.duration_minutes,
    shuffle: formData.get('shuffle') === 'on',
    position: positionForKind(v.kind),
  }

  const { error } = assessmentId
    ? await supabase
        .from('assessments')
        .update(payload)
        .eq('id', assessmentId)
        .eq('course_id', courseId)
    : await supabase.from('assessments').insert({
        ...payload,
        required_question_count: QUESTION_COUNTS[v.kind],
        is_published: false,
        is_locked: true,
      })

  if (error) return fail(error.message)

  revalidatePath(`/admin/courses/${courseId}/assessments`)
  revalidateCourseContent(courseId)
  return { ok: true }
}

/**
 * Publish makes the card appear on the day page. Unlock lets students begin.
 *
 * Publishing an assessment with no questions would show students a card they
 * cannot open, so that is refused here rather than discovered by the class.
 */
export async function toggleAssessmentPublished(formData: FormData) {
  const courseId = String(formData.get('course_id') ?? '')
  const assessmentId = String(formData.get('assessment_id') ?? '')
  const next = formData.get('next') === 'true'
  const { profile, supabase } = await assertCanManage(courseId)

  if (next) {
    const { data: assessment } = await supabase
      .from('assessments')
      .select('required_question_count')
      .eq('id', assessmentId)
      .eq('course_id', courseId)
      .maybeSingle()

    if (!assessment) {
      redirect(`/admin/courses/${courseId}/assessments`)
    }

    const { count } = await supabase
      .from('assessment_questions')
      .select('id', { count: 'exact', head: true })
      .eq('assessment_id', assessmentId)

    if (count !== assessment.required_question_count) {
      redirect(
        `/admin/courses/${courseId}/assessments/${assessmentId}?error=count`
      )
    }
  }

  await supabase
    .from('assessments')
    .update({ is_published: next })
    .eq('id', assessmentId)
    .eq('course_id', courseId)

  if (next) {
    const { data: assessment } = await supabase
      .from('assessments')
      .select('id, title, day_id')
      .eq('id', assessmentId)
      .eq('course_id', courseId)
      .maybeSingle()

    if (assessment) {
      const ctx = await courseLinkContext(courseId, assessment.day_id)
      await emitCourseEvent({
        courseId,
        dayId: assessment.day_id,
        actorId: profile.id,
        kind: 'assessment_published',
        entityType: 'assessment',
        entityId: assessment.id,
        title:
          ctx.dayNumber != null
            ? `${assessment.title} is on Day ${ctx.dayNumber}`
            : `${assessment.title} is now visible`,
        body: 'Open the day when you are ready. It may still be locked.',
        href: ctx.dayHref,
      })
    }
  }

  revalidatePath(`/admin/courses/${courseId}/assessments`)
  revalidatePath(`/admin/courses/${courseId}/assessments/${assessmentId}`)
  revalidateCourseContent(courseId)
}

export async function toggleAssessmentLocked(formData: FormData) {
  const courseId = String(formData.get('course_id') ?? '')
  const assessmentId = String(formData.get('assessment_id') ?? '')
  const next = formData.get('next') === 'true'
  const { profile, supabase } = await assertCanManage(courseId)

  if (!next) {
    const { data: assessment } = await supabase
      .from('assessments')
      .select('required_question_count, is_published')
      .eq('id', assessmentId)
      .eq('course_id', courseId)
      .maybeSingle()

    if (!assessment?.is_published) {
      redirect(
        `/admin/courses/${courseId}/assessments/${assessmentId}?error=publish-first`
      )
    }

    const { count } = await supabase
      .from('assessment_questions')
      .select('id', { count: 'exact', head: true })
      .eq('assessment_id', assessmentId)

    if (count !== assessment.required_question_count) {
      redirect(
        `/admin/courses/${courseId}/assessments/${assessmentId}?error=count`
      )
    }
  }

  await supabase
    .from('assessments')
    .update({ is_locked: next })
    .eq('id', assessmentId)
    .eq('course_id', courseId)

  // next=true means lock; next=false means unlock for students.
  if (!next) {
    const { data: assessment } = await supabase
      .from('assessments')
      .select('id, title, day_id')
      .eq('id', assessmentId)
      .eq('course_id', courseId)
      .maybeSingle()

    if (assessment) {
      const ctx = await courseLinkContext(courseId, assessment.day_id)
      await emitCourseEvent({
        courseId,
        dayId: assessment.day_id,
        actorId: profile.id,
        kind: 'assessment_unlocked',
        entityType: 'assessment',
        entityId: assessment.id,
        title: `${assessment.title} is open`,
        body:
          ctx.dayNumber != null
            ? `Day ${ctx.dayNumber} · You can start it now.`
            : 'You can start it now.',
        href: `/quiz/${assessment.id}`,
      })
    }
  }

  revalidatePath(`/admin/courses/${courseId}/assessments`)
  revalidatePath(`/admin/courses/${courseId}/assessments/${assessmentId}`)
  revalidateCourseContent(courseId)
}

/**
 * Publish or withhold the marks for one assessment.
 *
 * While an assessment is withheld, `submit_attempt` writes no `correct_count`
 * and no score row, and RLS refuses the student both the answer keys and their
 * own graded responses. Releasing backfills all of it inside
 * `set_assessment_results_released`, so the ordinary review screen lights up for
 * the whole class at once. It is reversible.
 */
export async function setAssessmentResultsReleased(formData: FormData) {
  const courseId = String(formData.get('course_id') ?? '')
  const assessmentId = String(formData.get('assessment_id') ?? '')
  const released = formData.get('released') === 'true'
  const { supabase } = await assertCanManage(courseId)

  const { error } = await supabase.rpc('set_assessment_results_released', {
    p_assessment: assessmentId,
    p_released: released,
  })

  if (error) {
    redirect(
      `/admin/courses/${courseId}/assessments/${assessmentId}/results?error=release`
    )
  }

  revalidatePath(
    `/admin/courses/${courseId}/assessments/${assessmentId}/results`
  )
  revalidatePath(`/admin/courses/${courseId}/assessments/${assessmentId}`)
  revalidateCourseContent(courseId)
}

/**
 * Reopen a frozen attempt.
 *
 * `unlock_attempt` gives back the time the student spent frozen, adds any extra
 * minutes granted, and resets their warning count — without that last part they
 * resume sitting on the limit and the next stray event freezes them again
 * instantly. The integrity log keeps the full history either way.
 */
export async function unlockFrozenAttempt(formData: FormData) {
  const courseId = String(formData.get('course_id') ?? '')
  const assessmentId = String(formData.get('assessment_id') ?? '')
  const attemptId = String(formData.get('attempt_id') ?? '')
  const extraMinutes = Number(formData.get('extra_minutes') ?? 0)
  const { supabase } = await assertCanManage(courseId)

  const { error } = await supabase.rpc('unlock_attempt', {
    p_attempt: attemptId,
    p_extra_minutes: Number.isFinite(extraMinutes)
      ? Math.max(0, Math.min(60, Math.trunc(extraMinutes)))
      : 0,
  })

  if (error) {
    redirect(
      `/admin/courses/${courseId}/assessments/${assessmentId}/results?error=${encodeURIComponent(error.message)}`
    )
  }

  revalidatePath(
    `/admin/courses/${courseId}/assessments/${assessmentId}/results`
  )
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
  // Called from the assessment's own page, which no longer exists.
  redirect(`/admin/courses/${courseId}/assessments`)
}

/* =============================================================== roster == */

// Scores are no longer entered by hand. `submit_attempt` writes them when a
// student finishes a quiz, which is the only way a score can now appear.

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
  revalidatePath(`/admin/courses/${courseId}/students/${studentId}`)
}
