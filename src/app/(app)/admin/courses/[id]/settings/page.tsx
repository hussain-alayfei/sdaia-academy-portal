import { notFound } from 'next/navigation'

import { toggleCoursePublished } from '@/app/actions/admin'
import { CourseForm } from '@/components/admin/course-form'
import { AdminSectionHeader } from '@/components/admin/section-header'
import { Badge, Button, Panel } from '@/components/ui'
import { canManageCourse, getCourseById, requireManager } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

export default async function CourseSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [profile, course] = await Promise.all([
    requireManager(),
    getCourseById(id),
  ])
  if (!course || !(await canManageCourse(course))) notFound()

  let instructors:
    | Array<{ id: string; full_name: string; email: string; role: string }>
    | undefined

  if (profile.role === 'admin') {
    const supabase = await createClient()
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .in('role', ['admin', 'instructor'])
      .order('full_name')

    instructors = (data ?? []).map((row) => ({
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      role: row.role,
    }))
  }

  return (
    <div className="space-y-4">
      <AdminSectionHeader
        title="Edit course"
        description="Change name, code, dates, instructor, and whether the course is live."
      />

      <Panel className="max-w-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-navy-900">Visibility</p>
            <p className="mt-0.5 text-[12px] text-ink-faint">
              Live courses appear for students with the join code. Assessments
              still need their own Publish and Unlock.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone={course.is_published ? 'teal' : 'amber'}>
              {course.is_published ? 'Live' : 'Draft'}
            </Badge>
            <form action={toggleCoursePublished}>
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
                {course.is_published ? 'Set to draft' : 'Make live'}
              </Button>
            </form>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <CourseForm
            course={course}
            instructors={instructors}
            defaultOwnerId={course.owner_id}
          />
        </div>
      </Panel>
    </div>
  )
}
