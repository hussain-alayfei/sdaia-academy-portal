import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import type { Course, Profile } from '@/lib/types'

/**
 * Data Access Layer.
 *
 * Every read here goes through the user-scoped Supabase client, so Postgres
 * RLS is the real enforcement boundary. These helpers add ergonomics and a
 * second, explicit check in application code — they are not the only defence.
 *
 * `cache()` dedupes calls within a single render pass, so calling
 * `getProfile()` in a layout and again in a page costs one query.
 */

export const getUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser()
  if (!user) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  return data ?? null
})

/** Profile or bust. Redirects to /login when signed out. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  return profile
}

/** Instructor-or-admin gate for everything under /admin. */
export async function requireManager(): Promise<Profile> {
  const profile = await requireProfile()
  if (profile.role !== 'admin' && profile.role !== 'instructor') {
    redirect('/home')
  }
  return profile
}

export function isManager(profile: Profile | null): boolean {
  return profile?.role === 'admin' || profile?.role === 'instructor'
}

/**
 * Courses this person can manage.
 * RLS already limits the rows: admins see every course, instructors see only
 * the ones they own.
 */
export const getManagedCourses = cache(async (): Promise<Course[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('courses')
    .select('*')
    .order('start_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  return data ?? []
})

/** Courses this student is enrolled in. */
export const getEnrolledCourses = cache(async (): Promise<Course[]> => {
  const user = await getUser()
  if (!user) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('enrollments')
    .select('course:courses(*)')
    .eq('student_id', user.id)

  return (data ?? [])
    .map((row) => row.course as unknown as Course)
    .filter(Boolean)
})

/**
 * Load a course by slug. Returns null when the caller has no business seeing
 * it — RLS filters the row out rather than raising, so a missing row and a
 * forbidden row look identical from here, which is what we want.
 */
export const getCourseBySlug = cache(
  async (slug: string): Promise<Course | null> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('courses')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()

    return data ?? null
  }
)

export const getCourseById = cache(
  async (id: string): Promise<Course | null> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('courses')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    return data ?? null
  }
)

/** True when the signed-in user owns this course or is an admin. */
export async function canManageCourse(course: Course): Promise<boolean> {
  const profile = await getProfile()
  if (!profile) return false
  return profile.role === 'admin' || course.owner_id === profile.id
}
