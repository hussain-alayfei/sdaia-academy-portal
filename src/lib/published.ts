import 'server-only'

import { revalidateTag, unstable_cache } from 'next/cache'

import { createCacheReader } from '@/lib/supabase/cache-reader'
import type { Assessment, CourseDay, Resource } from '@/lib/types'

/**
 * Cached, published-only course content.
 *
 * ## The problem this solves
 *
 * A cohort opens Day 1 at the same moment. Without a cache that is thirty
 * separate function invocations each running the same handful of queries, so the
 * database does thirty times the work to produce thirty identical answers.
 *
 * ## Why it is safe to share one answer between students
 *
 * These readers take a course id and return only rows with `is_published` true.
 * Nothing here varies by viewer, so there is no per-user data to leak. Anything
 * that *is* per-user — scores, enrolments — deliberately stays out of this file
 * and keeps running through the user-scoped, uncached client.
 *
 * Two invariants callers must hold:
 *
 * 1. **Authorise first.** Only call these after RLS has confirmed the viewer may
 *    see the course, which the page does by loading the course through the
 *    user-scoped client and 404ing on null.
 * 2. **Students only.** Instructors must keep using the live readers in
 *    `queries.ts`, or drafts would vanish from their own editing screens.
 *
 * ## Freshness
 *
 * Every entry is tagged `course-content:<courseId>`, and each admin mutation
 * calls `revalidateCourseContent`. An instructor's edit is therefore visible to
 * students on their next page load, not after a timeout. `revalidate` is a
 * backstop for anything that ever slips through without a tag.
 */

const ONE_HOUR = 3600

export function courseContentTag(courseId: string) {
  return `course-content:${courseId}`
}

/**
 * Drop the cached content for one course.
 *
 * Call this from every mutation that changes what a student would see: days,
 * resources, assessments, and publish toggles. Defined next to the tag so the
 * two cannot drift apart.
 *
 * Measured behaviour: the entry is marked stale, so exactly one subsequent
 * request is served the old copy while the refresh happens behind it, and every
 * request after that is fresh. In practice a single student may need one extra
 * refresh right after an instructor publishes something.
 *
 * `updateTag` expires outright and would close that one-request gap, but it is
 * only legal inside a Server Action and could not be exercised from a test
 * harness, so this ships the variant that was verified end to end. Swapping them
 * is a one-line change if that gap ever matters.
 */
export function revalidateCourseContent(courseId: string) {
  revalidateTag(courseContentTag(courseId), 'max')
}

/** Days of a course that students are allowed to see. */
export const getPublishedCourseDays = (courseId: string) =>
  unstable_cache(
    async (id: string): Promise<CourseDay[]> => {
      const supabase = createCacheReader()
      const { data } = await supabase
        .from('course_days')
        .select('*')
        .eq('course_id', id)
        .eq('is_published', true)
        .order('day_number')

      return data ?? []
    },
    ['published-course-days'],
    { tags: [courseContentTag(courseId)], revalidate: ONE_HOUR }
  )(courseId)

/** One day by its number, or null when it is not published. */
export const getPublishedDayByNumber = (courseId: string, dayNumber: number) =>
  unstable_cache(
    async (id: string, n: number): Promise<CourseDay | null> => {
      const supabase = createCacheReader()
      const { data } = await supabase
        .from('course_days')
        .select('*')
        .eq('course_id', id)
        .eq('day_number', n)
        .eq('is_published', true)
        .maybeSingle()

      return data ?? null
    },
    ['published-day-by-number'],
    { tags: [courseContentTag(courseId)], revalidate: ONE_HOUR }
  )(courseId, dayNumber)

/**
 * Published resources for one day.
 *
 * Scoped by course id as well as day id so a caller cannot be tricked into
 * reading another course's materials by passing a foreign day id.
 */
export const getPublishedResourcesForDay = (courseId: string, dayId: string) =>
  unstable_cache(
    async (cid: string, did: string): Promise<Resource[]> => {
      const supabase = createCacheReader()
      const { data } = await supabase
        .from('resources')
        .select('*')
        .eq('course_id', cid)
        .eq('day_id', did)
        .eq('is_published', true)
        .order('position')
        .order('created_at')

      return data ?? []
    },
    ['published-resources-for-day'],
    { tags: [courseContentTag(courseId)], revalidate: ONE_HOUR }
  )(courseId, dayId)

/** Item count per day, for the schedule list. */
export const getPublishedResourceCounts = (courseId: string) =>
  unstable_cache(
    async (id: string): Promise<Record<string, number>> => {
      const supabase = createCacheReader()
      const { data } = await supabase
        .from('resources')
        .select('day_id')
        .eq('course_id', id)
        .eq('is_published', true)

      const counts: Record<string, number> = {}
      for (const row of data ?? []) {
        counts[row.day_id] = (counts[row.day_id] ?? 0) + 1
      }
      return counts
    },
    ['published-resource-counts'],
    { tags: [courseContentTag(courseId)], revalidate: ONE_HOUR }
  )(courseId)

/**
 * Assessments for a course.
 *
 * The row itself is the same for everyone; a student's own score is not, and is
 * fetched separately through the user-scoped client.
 */
export const getPublishedAssessments = (courseId: string) =>
  unstable_cache(
    async (id: string): Promise<Assessment[]> => {
      const supabase = createCacheReader()
      const { data } = await supabase
        .from('assessments')
        .select('*')
        .eq('course_id', id)
        .order('position')

      return data ?? []
    },
    ['published-assessments'],
    { tags: [courseContentTag(courseId)], revalidate: ONE_HOUR }
  )(courseId)
