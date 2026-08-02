import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CalendarIcon } from '@/components/icons'
import { Arabic, PageHeader, Panel, PanelHeader, RowArrow } from '@/components/ui'
import { getEnrolledCourses, isManager, requireProfile } from '@/lib/dal'
import { formatDateRange } from '@/lib/format'

import { JoinCourseForm } from './join-form'

export const metadata: Metadata = { title: 'Home' }

const JOIN_ERRORS: Record<string, string> = {
  invalid_code: 'That course code was not recognised. Check it and try again.',
  course_not_open: 'That course is not open for enrolment yet.',
  not_a_student: 'Instructor accounts do not need a course code.',
  not_authenticated: 'Your session expired. Please sign in again.',
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ join_error?: string }>
}) {
  // Students are the common case here, and they always need both. Fetching in
  // parallel costs a manager one wasted query on the way to /admin, which is
  // cheaper than making every student wait for two sequential round trips.
  const [profile, courses] = await Promise.all([
    requireProfile(),
    getEnrolledCourses(),
  ])

  if (isManager(profile)) redirect('/admin')

  const { join_error } = await searchParams

  // The common case: one cohort, one course. Skip the pointless list.
  if (courses.length === 1 && !join_error) {
    redirect(`/c/${courses[0].slug}`)
  }

  const firstName = profile.full_name.trim().split(/\s+/)[0]

  if (courses.length === 0) {
    return (
      <>
        <PageHeader
          title={firstName ? `Welcome, ${firstName}` : 'Welcome'}
          description="Enter your course code to see your slides, labs and assessments."
        />
        <Panel className="p-5 sm:p-6">
          <JoinCourseForm
            initialError={join_error ? JOIN_ERRORS[join_error] : undefined}
          />
        </Panel>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome, ${firstName}` : 'Welcome'}
        description="Choose a course to continue."
      />

      <Panel>
        <PanelHeader title="Your courses" />
        <ul className="divide-y divide-line">
          {courses.map((course) => (
            <li key={course.id}>
              <Link
                href={`/c/${course.slug}`}
                className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-navy-50 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-navy-900">
                    {course.title}
                  </p>
                  {course.title_ar ? (
                    <p className="truncate text-[13px] text-ink-soft">
                      <Arabic>{course.title_ar}</Arabic>
                    </p>
                  ) : null}
                  {course.start_date ? (
                    <p className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-faint">
                      <CalendarIcon width={13} height={13} />
                      {formatDateRange(course.start_date, course.end_date)}
                    </p>
                  ) : null}
                </div>
                <RowArrow />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="mt-6 p-5 sm:p-6">
        <h2 className="mb-1 text-[15px] font-semibold text-navy-900">
          Join another course
        </h2>
        <p className="mb-4 text-[13px] text-ink-soft">
          Have a second course code? Enter it here.
        </p>
        <JoinCourseForm
          initialError={join_error ? JOIN_ERRORS[join_error] : undefined}
        />
      </Panel>
    </>
  )
}
