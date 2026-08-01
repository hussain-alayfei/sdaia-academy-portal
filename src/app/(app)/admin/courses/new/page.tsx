import type { Metadata } from 'next'

import { CourseForm } from '@/components/admin/course-form'

import { BackLink, PageHeader, Panel } from '@/components/ui'
import { requireManager } from '@/lib/dal'

export const metadata: Metadata = { title: 'New course' }

export default async function NewCoursePage() {
  await requireManager()

  return (
    <>
      <div className="mb-5">
        <BackLink href="/admin">All courses</BackLink>
      </div>

      <PageHeader
        title="New course"
        description="Create the course first, then add days and materials. It stays a draft until you publish it."
      />

      <Panel className="max-w-2xl p-5 sm:p-6">
        <CourseForm />
      </Panel>
    </>
  )
}
