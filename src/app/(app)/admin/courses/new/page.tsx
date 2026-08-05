import type { Metadata } from 'next'

import { CourseForm } from '@/components/admin/course-form'
import { BackLink, PageHeader, Panel } from '@/components/ui'
import { requireManager } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'New course' }

export default async function NewCoursePage() {
  const profile = await requireManager()
  const supabase = await createClient()

  let instructors:
    | Array<{ id: string; full_name: string; email: string; role: string }>
    | undefined

  if (profile.role === 'admin') {
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
    <>
      <div className="mb-5">
        <BackLink href="/admin">All courses</BackLink>
      </div>

      <PageHeader
        title="New course"
        description="Create the course first, then add days and materials. It stays a draft until you publish it."
      />

      <Panel className="max-w-2xl p-5 sm:p-6">
        <CourseForm
          instructors={instructors}
          defaultOwnerId={profile.id}
        />
      </Panel>
    </>
  )
}
