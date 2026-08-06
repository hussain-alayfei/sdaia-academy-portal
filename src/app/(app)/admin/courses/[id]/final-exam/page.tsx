import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { getFinalExamBoard } from '@/app/actions/final-exam'
import { FinalExamControl } from '@/components/admin/final-exam-control'
import { Alert, Panel } from '@/components/ui'
import { canManageCourse, getCourseById, requireManager } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Final exam control',
}

/**
 * Find the course's final exam assessment.
 * Prefers Day 5 titled Final, then any paper with an integrity warning limit.
 */
async function findFinalAssessment(courseId: string) {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('assessments')
    .select(
      'id, title, integrity_warning_limit, day:course_days(day_number)'
    )
    .eq('course_id', courseId)
    .order('position')

  const list = rows ?? []
  const byTitle = list.find((a) =>
    a.title.toLowerCase().includes('final')
  )
  if (byTitle) return byTitle

  const byDay5 = list.find((a) => a.day?.day_number === 5)
  if (byDay5) return byDay5

  return list.find((a) => a.integrity_warning_limit != null) ?? null
}

export default async function FinalExamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const [{ id: courseId }, { error }] = await Promise.all([
    params,
    searchParams,
  ])

  const [, course] = await Promise.all([
    requireManager(),
    getCourseById(courseId),
  ])
  if (!course || !(await canManageCourse(course))) notFound()

  const final = await findFinalAssessment(courseId)
  if (!final) {
    return (
      <Panel className="p-6">
        <h1 className="text-[18px] font-semibold text-navy-900">Final exam</h1>
        <p className="mt-2 text-[14px] text-ink-soft">
          This course does not have a Final exam assessment yet.
        </p>
      </Panel>
    )
  }

  const board = await getFinalExamBoard({
    courseId,
    assessmentId: final.id,
  })

  const enrolledOptions = board.rows.map((r) => ({
    id: r.studentId,
    label: `${r.fullName} · ${r.email}`,
  }))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight text-navy-900">
          Final exam control
        </h1>
        <p className="mt-1 text-[14px] text-ink-soft">
          Unlock, freeze, allowlist, live board, and a dry run that never keeps a
          score.
        </p>
      </div>

      {error ? (
        <Alert tone="danger" title="Something went wrong">
          {decodeURIComponent(error)}
        </Alert>
      ) : null}

      <FinalExamControl
        courseId={courseId}
        assessmentId={final.id}
        initial={board}
        enrolledOptions={enrolledOptions}
      />
    </div>
  )
}
