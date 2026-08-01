import { notFound } from 'next/navigation'

import { CourseForm } from '@/components/admin/course-form'
import { Panel, PanelHeader } from '@/components/ui'
import { canManageCourse, getCourseById } from '@/lib/dal'

export default async function CourseSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const course = await getCourseById(id)
  if (!course || !(await canManageCourse(course))) notFound()

  return (
    <Panel className="max-w-2xl">
      <PanelHeader
        title="Course details"
        description="Changing the course code stops the old one working immediately."
      />
      <div className="p-5 sm:p-6">
        <CourseForm course={course} />
      </div>
    </Panel>
  )
}
