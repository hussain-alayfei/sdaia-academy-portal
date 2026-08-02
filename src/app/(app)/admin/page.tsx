import type { Metadata } from 'next'
import Link from 'next/link'

import { PlusIcon, UsersIcon } from '@/components/icons'
import {
  Arabic,
  Badge,
  ButtonLink,
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
  RowArrow,
} from '@/components/ui'
import { getManagedCourses, requireManager } from '@/lib/dal'
import { formatDateRange } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Instructor' }

export default async function AdminPage() {
  const supabase = await createClient()

  // All three are independent. One round trip for all enrolment counts too —
  // RLS already limits those rows to courses this instructor manages.
  const [profile, courses, { data: enrollments }] = await Promise.all([
    requireManager(),
    getManagedCourses(),
    supabase.from('enrollments').select('course_id'),
  ])

  const counts: Record<string, number> = {}
  for (const row of enrollments ?? []) {
    counts[row.course_id] = (counts[row.course_id] ?? 0) + 1
  }

  const mine = courses.filter((c) => c.owner_id === profile.id)
  const others = courses.filter((c) => c.owner_id !== profile.id)

  return (
    <>
      <PageHeader
        eyebrow="Instructor"
        title="Courses"
        description={
          profile.role === 'admin'
            ? 'You can see every course. Yours are listed first.'
            : 'Courses you own.'
        }
        action={
          <ButtonLink href="/admin/courses/new">
            <PlusIcon width={16} height={16} />
            New course
          </ButtonLink>
        }
      />

      <div className="space-y-6">
        <CourseTable
          title="Your courses"
          courses={mine}
          counts={counts}
          empty="You have not created a course yet."
        />

        {profile.role === 'admin' && others.length > 0 ? (
          <CourseTable
            title="Other instructors' courses"
            description="Visible because you are an admin."
            courses={others}
            counts={counts}
          />
        ) : null}
      </div>
    </>
  )
}

function CourseTable({
  title,
  description,
  courses,
  counts,
  empty,
}: {
  title: string
  description?: string
  courses: Awaited<ReturnType<typeof getManagedCourses>>
  counts: Record<string, number>
  empty?: string
}) {
  return (
    <Panel>
      <PanelHeader title={title} description={description} />
      {courses.length === 0 ? (
        <EmptyState
          title={empty ?? 'Nothing here'}
          action={
            <ButtonLink href="/admin/courses/new" size="sm">
              Create your first course
            </ButtonLink>
          }
        />
      ) : (
        <ul className="divide-y divide-line">
          {courses.map((course) => (
            <li key={course.id}>
              <Link
                href={`/admin/courses/${course.id}`}
                className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-navy-50 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="font-medium text-navy-900 group-hover:text-teal-800">
                      {course.title}
                    </p>
                    <Badge tone={course.is_published ? 'teal' : 'amber'}>
                      {course.is_published ? 'Live' : 'Draft'}
                    </Badge>
                  </div>

                  {course.title_ar ? (
                    <p className="truncate text-[13px] text-ink-soft">
                      <Arabic>{course.title_ar}</Arabic>
                    </p>
                  ) : null}

                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-faint">
                    <span className="flex items-center gap-1">
                      <UsersIcon width={13} height={13} />
                      {counts[course.id] ?? 0} enrolled
                    </span>
                    <span className="font-mono tracking-wide">
                      {course.join_code}
                    </span>
                    {formatDateRange(course.start_date, course.end_date) ? (
                      <span>
                        {formatDateRange(course.start_date, course.end_date)}
                      </span>
                    ) : null}
                  </p>
                </div>

                <RowArrow />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
