import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'
import type {
  Assessment,
  AssessmentScore,
  CourseDay,
  Profile,
  Resource,
} from '@/lib/types'

/**
 * Content reads. RLS decides visibility, so a student simply never receives
 * unpublished rows or rows belonging to another instructor's course — there is
 * no `is_published` filter to forget in application code.
 */

export const getCourseDays = cache(
  async (courseId: string): Promise<CourseDay[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('course_days')
      .select('*')
      .eq('course_id', courseId)
      .order('day_number')

    return data ?? []
  }
)

export const getDayByNumber = cache(
  async (courseId: string, dayNumber: number): Promise<CourseDay | null> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('course_days')
      .select('*')
      .eq('course_id', courseId)
      .eq('day_number', dayNumber)
      .maybeSingle()

    return data ?? null
  }
)

export const getResourcesForDay = cache(
  async (dayId: string): Promise<Resource[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('resources')
      .select('*')
      .eq('day_id', dayId)
      .order('position')
      .order('created_at')

    return data ?? []
  }
)

/** Resource counts per day, for the course overview list. */
export const getResourceCounts = cache(
  async (courseId: string): Promise<Record<string, number>> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('resources')
      .select('day_id')
      .eq('course_id', courseId)

    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
      counts[row.day_id] = (counts[row.day_id] ?? 0) + 1
    }
    return counts
  }
)

export const getAssessments = cache(
  async (courseId: string): Promise<Assessment[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('assessments')
      .select('*')
      .eq('course_id', courseId)
      .order('position')

    return data ?? []
  }
)

/** Scores for the signed-in student only (RLS enforces the restriction). */
export const getMyScores = cache(
  async (courseId: string): Promise<Record<string, AssessmentScore>> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('assessment_scores')
      .select('*')
      .eq('course_id', courseId)

    const byAssessment: Record<string, AssessmentScore> = {}
    for (const row of data ?? []) byAssessment[row.assessment_id] = row
    return byAssessment
  }
)

/* ------------------------------------------------ instructor-side reads -- */

export const getRoster = cache(
  async (courseId: string): Promise<Profile[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('enrollments')
      .select('student:profiles(*)')
      .eq('course_id', courseId)

    return (data ?? [])
      .map((row) => row.student as unknown as Profile)
      .filter(Boolean)
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }
)

export const getCourseScores = cache(
  async (courseId: string): Promise<AssessmentScore[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('assessment_scores')
      .select('*')
      .eq('course_id', courseId)

    return data ?? []
  }
)

export const getAllResources = cache(
  async (courseId: string): Promise<Resource[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('resources')
      .select('*')
      .eq('course_id', courseId)
      .order('position')

    return data ?? []
  }
)
