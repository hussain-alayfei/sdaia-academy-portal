import type { Metadata } from 'next'

import { CourseOpenLink } from '@/components/admin/course-open-link'
import { CalendarIcon, PlusIcon, UsersIcon } from '@/components/icons'
import {
  Arabic,
  Badge,
  ButtonLink,
  EmptyState,
  cx,
} from '@/components/ui'
import { getManagedCourses, requireManager } from '@/lib/dal'
import { formatDateRange, toTitleCaseEnglish } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import type { Course } from '@/lib/types'

export const metadata: Metadata = { title: 'Instructor' }

type OwnerInfo = { id: string; full_name: string; email: string }

export default async function AdminPage() {
  const supabase = await createClient()

  const [profile, courses, { data: enrollments }] = await Promise.all([
    requireManager(),
    getManagedCourses(),
    supabase.from('enrollments').select('course_id'),
  ])

  const counts: Record<string, number> = {}
  for (const row of enrollments ?? []) {
    counts[row.course_id] = (counts[row.course_id] ?? 0) + 1
  }

  const ownerIds = [...new Set(courses.map((c) => c.owner_id))]
  const ownersById: Record<string, OwnerInfo> = {}

  if (ownerIds.length > 0) {
    const { data: owners } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', ownerIds)

    for (const owner of owners ?? []) {
      ownersById[owner.id] = owner
    }
  }

  // Always show current user name for own courses even if profile join is thin.
  ownersById[profile.id] = {
    id: profile.id,
    full_name: profile.full_name || profile.email,
    email: profile.email,
  }

  const sortedCourses = [...courses].sort((a, b) => {
    // Your courses first, then others.
    const aMine = a.owner_id === profile.id ? 0 : 1
    const bMine = b.owner_id === profile.id ? 0 : 1
    if (aMine !== bMine) return aMine - bMine
    // Prefer -01 / lower join codes so GENAI-01 appears before GENAI-02.
    return a.join_code.localeCompare(b.join_code, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  })

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-navy-900">
            Courses
          </h1>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            Pick a course to manage days, assessments, and students.
          </p>
        </div>
        <ButtonLink href="/admin/courses/new" size="sm">
          <PlusIcon width={15} height={15} />
          New course
        </ButtonLink>
      </header>

      <CourseGrid
        courses={sortedCourses}
        counts={counts}
        ownersById={ownersById}
        currentUserId={profile.id}
        emptyTitle="No courses yet"
        emptyAction
      />
    </div>
  )
}

function instructorLabel(
  course: Course,
  ownersById: Record<string, OwnerInfo>,
  currentUserId: string
) {
  if (course.owner_id === currentUserId) {
    const me = ownersById[currentUserId]
    return me?.full_name?.trim() || me?.email || 'You'
  }
  const owner = ownersById[course.owner_id]
  if (!owner) return 'Instructor'
  return owner.full_name?.trim() || owner.email
}

function CourseGrid({
  courses,
  counts,
  ownersById,
  currentUserId,
  emptyTitle,
  emptyAction,
}: {
  courses: Course[]
  counts: Record<string, number>
  ownersById: Record<string, OwnerInfo>
  currentUserId: string
  emptyTitle?: string
  emptyAction?: boolean
}) {
  if (courses.length === 0) {
    return (
      <EmptyState
        title={emptyTitle ?? 'Nothing here'}
        action={
          emptyAction ? (
            <ButtonLink href="/admin/courses/new" size="sm">
              Create your first course
            </ButtonLink>
          ) : undefined
        }
      />
    )
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((course) => {
        const dates = formatDateRange(course.start_date, course.end_date)
        const enrolled = counts[course.id] ?? 0
        const instructor = instructorLabel(course, ownersById, currentUserId)
        const mine = course.owner_id === currentUserId

        return (
          <li key={course.id} className="min-w-0">
            <CourseOpenLink
              href={`/admin/courses/${course.id}`}
              className={cx(
                'group flex h-full min-h-[11.5rem] flex-col rounded-md border bg-surface p-4',
                'transition-[border-color,box-shadow,transform] duration-150',
                'hover:border-teal-500/50 hover:shadow-sm active:scale-[0.99]',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600',
                mine ? 'border-teal-300 ring-1 ring-teal-100' : 'border-line'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <Badge tone={course.is_published ? 'teal' : 'amber'}>
                  {course.is_published ? 'Live' : 'Draft'}
                </Badge>
                <span className="rounded-xs border border-line bg-navy-50 px-1.5 py-0.5 font-mono text-[11px] tracking-wide text-navy-800">
                  {course.join_code}
                </span>
              </div>

              <div className="mt-3 min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold leading-snug text-navy-900 group-hover:text-teal-800">
                  {toTitleCaseEnglish(course.title)}
                </h3>
                {course.title_ar ? (
                  <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink-soft">
                    <Arabic>{course.title_ar}</Arabic>
                  </p>
                ) : null}

                <p
                  className={cx(
                    'mt-3 inline-flex max-w-full items-center truncate rounded-xs border px-2 py-1 text-[12px] font-semibold',
                    mine
                      ? 'border-teal-200 bg-teal-50 text-teal-900'
                      : 'border-navy-100 bg-navy-50 text-navy-800'
                  )}
                  title={instructor}
                >
                  {instructor}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-[12px] text-ink-faint">
                <span className="inline-flex items-center gap-1 font-medium text-navy-700">
                  <UsersIcon width={13} height={13} />
                  {enrolled} enrolled
                </span>
                {dates ? (
                  <span className="inline-flex items-center gap-1">
                    <CalendarIcon width={13} height={13} />
                    {dates}
                  </span>
                ) : null}
              </div>

              <span className="mt-3 inline-flex items-center text-[13px] font-medium text-teal-800">
                Open course
                <span
                  aria-hidden
                  className="ms-1 transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </span>
            </CourseOpenLink>
          </li>
        )
      })}
    </ul>
  )
}
