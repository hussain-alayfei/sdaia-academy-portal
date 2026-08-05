import { notFound } from 'next/navigation'

import { CourseTabs } from '@/components/admin/course-tabs'
import { Arabic, BackLink, Badge, ButtonLink } from '@/components/ui'
import { canManageCourse, getCourseById, requireManager } from '@/lib/dal'
import { toTitleCaseEnglish } from '@/lib/format'

export default async function CourseAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [, course] = await Promise.all([requireManager(), getCourseById(id)])

  // canManageCourse reuses the profile already loaded above, so it is free.
  if (!course || !(await canManageCourse(course))) notFound()

  return (
    <>
      <div className="mb-4">
        <BackLink href="/admin">All courses</BackLink>
      </div>

      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line pb-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="text-[22px] font-semibold tracking-tight text-navy-900 sm:text-[24px]">
              {toTitleCaseEnglish(course.title)}
            </h1>
            <Badge tone={course.is_published ? 'teal' : 'amber'}>
              {course.is_published ? 'Live' : 'Draft'}
            </Badge>
          </div>
          {course.title_ar ? (
            <p className="mt-0.5 text-[13px] text-ink-soft">
              <Arabic>{course.title_ar}</Arabic>
            </p>
          ) : null}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="rounded-xs border border-line bg-navy-50 px-2 py-1 font-mono text-[12px] tracking-wide text-navy-800">
              {course.join_code}
            </span>
            <span className="text-[12px] text-ink-faint">Student join code</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ButtonLink
            href={`/c/${course.slug}?view=student`}
            variant="secondary"
            size="sm"
          >
            Preview
          </ButtonLink>
        </div>
      </header>

      <CourseTabs courseId={course.id} />

      <div className="pt-5">{children}</div>
    </>
  )
}
