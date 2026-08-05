import 'server-only'

import { cache } from 'react'

import { getEnrolledCourses, getSessionUser } from '@/lib/dal'
import {
  getPublishedAssessments,
  getPublishedCourseDays,
} from '@/lib/published'
import { getMyAttempts } from '@/lib/quiz'
import { createClient } from '@/lib/supabase/server'
import type {
  ActionNeededItem,
  NotificationFeedItem,
  StudentNotifications,
} from '@/lib/notification-types'
import type { NotificationEventKind } from '@/lib/types'

export type {
  ActionNeededItem,
  NotificationFeedItem,
  StudentNotifications,
} from '@/lib/notification-types'

const FINISHED: ReadonlySet<string> = new Set([
  'submitted',
  'timed_out',
  'integrity_stopped',
])

const FEED_LIMIT = 30

type EmitInput = {
  courseId: string
  dayId?: string | null
  actorId: string
  kind: NotificationEventKind
  entityType: 'resource' | 'day' | 'assessment'
  entityId: string
  title: string
  body: string
  href: string
}

/** Write one course activity event. Failures are logged; they must not block admin actions. */
export async function emitCourseEvent(input: EmitInput): Promise<void> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('notification_events').insert({
      course_id: input.courseId,
      day_id: input.dayId ?? null,
      actor_id: input.actorId,
      kind: input.kind,
      entity_type: input.entityType,
      entity_id: input.entityId,
      title: input.title,
      body: input.body,
      href: input.href,
    })
    if (error) console.error('emitCourseEvent', error.message)
  } catch (err) {
    console.error('emitCourseEvent', err)
  }
}

/** Resolve slug + day number for student deep links. */
export async function courseLinkContext(courseId: string, dayId?: string | null) {
  const supabase = await createClient()
  const { data: course } = await supabase
    .from('courses')
    .select('slug, title')
    .eq('id', courseId)
    .maybeSingle()

  let dayNumber: number | null = null
  if (dayId) {
    const { data: day } = await supabase
      .from('course_days')
      .select('day_number')
      .eq('id', dayId)
      .eq('course_id', courseId)
      .maybeSingle()
    dayNumber = day?.day_number ?? null
  }

  return {
    slug: course?.slug ?? null,
    title: course?.title ?? 'Course',
    dayNumber,
    dayHref:
      course?.slug && dayNumber != null
        ? `/c/${course.slug}/day/${dayNumber}`
        : course?.slug
          ? `/c/${course.slug}`
          : '/home',
  }
}

export const getStudentNotificationFeed = cache(
  async (limit = FEED_LIMIT): Promise<NotificationFeedItem[]> => {
    const user = await getSessionUser()
    if (!user) return []

    const courses = await getEnrolledCourses()
    const published = courses.filter((c) => c.is_published)
    if (published.length === 0) return []

    const courseIds = published.map((c) => c.id)
    const supabase = await createClient()

    const { data: events } = await supabase
      .from('notification_events')
      .select('*')
      .in('course_id', courseIds)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (!events?.length) return []

    const eventIds = events.map((e) => e.id)
    const { data: reads } = await supabase
      .from('notification_reads')
      .select('event_id')
      .eq('student_id', user.id)
      .in('event_id', eventIds)

    const readSet = new Set((reads ?? []).map((r) => r.event_id))

    return events.map((event) => ({
      ...event,
      unread: !readSet.has(event.id),
    }))
  }
)

export const getActionNeeded = cache(
  async (): Promise<ActionNeededItem[]> => {
    const user = await getSessionUser()
    if (!user) return []

    const courses = (await getEnrolledCourses()).filter((c) => c.is_published)
    if (courses.length === 0) return []

    const now = Date.now()
    const items: ActionNeededItem[] = []

    await Promise.all(
      courses.map(async (course) => {
        const [days, assessments, attempts] = await Promise.all([
          getPublishedCourseDays(course.id),
          getPublishedAssessments(course.id),
          getMyAttempts(course.id),
        ])

        const dayById = new Map(days.map((d) => [d.id, d]))

        for (const assessment of assessments) {
          if (assessment.is_locked) continue
          if (assessment.day_id && !dayById.has(assessment.day_id)) continue

          const attempt = attempts[assessment.id]
          if (attempt && FINISHED.has(attempt.status)) continue

          const day = assessment.day_id
            ? dayById.get(assessment.day_id)
            : undefined
          const dayNumber = day?.day_number ?? null
          const closesAt = assessment.closes_at
            ? new Date(assessment.closes_at).getTime()
            : null
          const missed = closesAt != null && closesAt < now

          items.push({
            assessmentId: assessment.id,
            courseId: course.id,
            courseTitle: course.title,
            courseSlug: course.slug,
            dayId: assessment.day_id,
            dayNumber,
            title: assessment.title,
            href: `/quiz/${assessment.id}`,
            cta: attempt?.status === 'in_progress' ? 'Continue' : 'Start',
            urgency: missed ? 'missed' : 'open',
          })
        }
      })
    )

    items.sort((a, b) => {
      if (a.urgency !== b.urgency) return a.urgency === 'missed' ? -1 : 1
      return (a.dayNumber ?? 99) - (b.dayNumber ?? 99)
    })

    return items
  }
)

export const getStudentNotifications = cache(
  async (): Promise<StudentNotifications> => {
    const [actionNeeded, recent] = await Promise.all([
      getActionNeeded(),
      getStudentNotificationFeed(),
    ])

    const unreadEventCount = recent.filter((e) => e.unread).length
    const actionNeededCount = actionNeeded.length

    return {
      actionNeeded,
      recent,
      actionNeededCount,
      unreadEventCount,
      badgeCount: actionNeededCount + unreadEventCount,
    }
  }
)

export async function markEventsRead(eventIds: string[]): Promise<void> {
  const user = await getSessionUser()
  if (!user || eventIds.length === 0) return

  const unique = [...new Set(eventIds)]
  const supabase = await createClient()
  const rows = unique.map((event_id) => ({
    student_id: user.id,
    event_id,
    read_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('notification_reads')
    .upsert(rows, { onConflict: 'student_id,event_id' })

  if (error) console.error('markEventsRead', error.message)
}
