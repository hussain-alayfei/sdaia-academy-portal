import { notFound } from 'next/navigation'

import { CourseTabs } from '@/components/admin/course-tabs'

import { Arabic, BackLink, Badge, Button } from '@/components/ui'
import { toggleCoursePublished } from '@/app/actions/admin'
import { canManageCourse, getCourseById, requireManager } from '@/lib/dal'

export default async function CourseAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  await requireManager()
  const { id } = await params

  const course = await getCourseById(id)
  if (!course || !(await canManageCourse(course))) notFound()

  return (
    <>
      <div className="mb-5">
        <BackLink href="/admin">All courses</BackLink>
      </div>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-semibold text-navy-900 sm:text-[26px]">
              {course.title}
            </h1>
            <Badge tone={course.is_published ? 'teal' : 'amber'}>
              {course.is_published ? 'Live' : 'Draft'}
            </Badge>
          </div>
          {course.title_ar ? (
            <p className="mt-0.5 text-[14px] text-ink-soft">
              <Arabic>{course.title_ar}</Arabic>
            </p>
          ) : null}
          <p className="mt-2 text-[12px] text-ink-faint">
            Course code{' '}
            <span className="rounded-xs border border-line bg-navy-50 px-1.5 py-0.5 font-mono tracking-wide text-navy-800">
              {course.join_code}
            </span>
          </p>
        </div>

        <form action={toggleCoursePublished} className="shrink-0">
          <input type="hidden" name="course_id" value={course.id} />
          <input
            type="hidden"
            name="next"
            value={course.is_published ? 'false' : 'true'}
          />
          <Button
            type="submit"
            variant={course.is_published ? 'secondary' : 'primary'}
            size="sm"
          >
            {course.is_published ? 'Unpublish' : 'Publish course'}
          </Button>
        </form>
      </div>

      <CourseTabs courseId={course.id} />

      <div className="pt-6">{children}</div>
    </>
  )
}
