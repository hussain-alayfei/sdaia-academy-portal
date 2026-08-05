import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  toggleAssessmentLocked,
  toggleAssessmentPublished,
} from '@/app/actions/admin'
import {
  AssessmentDayPanel,
  AssessmentsByDay,
} from '@/components/admin/assessments-by-day'
import { AssessmentForm } from '@/components/admin/assessment-form'
import { AdminSectionHeader } from '@/components/admin/section-header'
import { PlusIcon } from '@/components/icons'
import { Badge, Button, ButtonLink, Panel } from '@/components/ui'
import { canManageCourse, getCourseById } from '@/lib/dal'
import { getQuestionCounts } from '@/lib/quiz'
import { getAssessments, getCourseDays } from '@/lib/queries'

function studentFacingStatus(input: {
  published: boolean
  locked: boolean
  ready: boolean
}): { label: string; tone: 'teal' | 'amber' | 'neutral'; hint: string } {
  if (!input.ready) {
    return {
      label: 'Needs questions',
      tone: 'amber',
      hint: 'Open it and import or add questions first.',
    }
  }
  if (!input.published) {
    return {
      label: 'Draft',
      tone: 'neutral',
      hint: 'Questions are in. Publish when students should see the card.',
    }
  }
  if (input.locked) {
    return {
      label: 'Locked',
      tone: 'amber',
      hint: 'Students see it but cannot start until you unlock.',
    }
  }
  return {
    label: 'Open',
    tone: 'teal',
    hint: 'Students can start this assessment now.',
  }
}

export default async function AssessmentsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const course = await getCourseById(id)
  if (!course || !(await canManageCourse(course))) notFound()

  const [assessments, days, counts] = await Promise.all([
    getAssessments(course.id),
    getCourseDays(course.id),
    getQuestionCounts(course.id),
  ])

  const dayById = new Map(days.map((d) => [d.id, d]))

  const grouped = days.map((day) => ({
    day,
    items: assessments
      .filter((a) => a.day_id === day.id)
      .sort((a, b) => a.position - b.position),
  }))

  const stranded = assessments.filter(
    (a) => !a.day_id || !dayById.has(a.day_id)
  )

  const dayTabs = grouped.map(({ day, items }) => ({
    id: day.id,
    label: `Day ${day.day_number}`,
    count: items.length,
    panel: (
      <AssessmentDayPanel
        courseId={course.id}
        dayId={day.id}
        dayTitle={day.title}
        empty={items.length === 0}
      >
        {items.map((assessment) => {
          const count = counts[assessment.id] ?? 0
          const ready = count === assessment.required_question_count
          const status = studentFacingStatus({
            published: assessment.is_published,
            locked: assessment.is_locked,
            ready,
          })
          const href = `/admin/courses/${course.id}/assessments/${assessment.id}`

          return (
            <li
              key={assessment.id}
              className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={href}
                    className="text-[14px] font-semibold text-navy-900 hover:text-teal-800"
                  >
                    {assessment.title}
                  </Link>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <p className="mt-0.5 text-[12px] text-ink-faint" title={status.hint}>
                  {ready
                    ? `${count} q`
                    : `${count}/${assessment.required_question_count} q`}
                  {' · '}
                  {assessment.duration_minutes} min
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1">
                <form action={toggleAssessmentPublished}>
                  <input type="hidden" name="course_id" value={course.id} />
                  <input
                    type="hidden"
                    name="assessment_id"
                    value={assessment.id}
                  />
                  <input
                    type="hidden"
                    name="next"
                    value={assessment.is_published ? 'false' : 'true'}
                  />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={!ready && !assessment.is_published}
                    title={
                      !ready ? 'Add questions before publishing' : status.hint
                    }
                  >
                    {assessment.is_published ? 'Unpublish' : 'Publish'}
                  </Button>
                </form>

                {assessment.is_published ? (
                  <form action={toggleAssessmentLocked}>
                    <input type="hidden" name="course_id" value={course.id} />
                    <input
                      type="hidden"
                      name="assessment_id"
                      value={assessment.id}
                    />
                    <input
                      type="hidden"
                      name="next"
                      value={assessment.is_locked ? 'false' : 'true'}
                    />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      title={status.hint}
                    >
                      {assessment.is_locked ? 'Unlock' : 'Lock'}
                    </Button>
                  </form>
                ) : null}

                <ButtonLink href={href} size="sm">
                  Open
                </ButtonLink>
              </div>
            </li>
          )
        })}
      </AssessmentDayPanel>
    ),
  }))

  return (
    <div className="space-y-4">
      <AdminSectionHeader
        title="Assessments"
        description="Open a paper to edit, then publish and unlock."
      />

      <AssessmentsByDay
        days={dayTabs}
        stranded={
          stranded.length > 0 ? (
            <Panel className="border-amber-200 p-4 sm:p-5">
              <p className="text-[13px] font-semibold text-amber-900">
                Not attached to a day
              </p>
              <p className="mt-1 text-[12px] text-ink-soft">
                Students cannot see these. Open one and choose a day.
              </p>
              <ul className="mt-3 space-y-1">
                {stranded.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/admin/courses/${course.id}/assessments/${a.id}`}
                      className="text-[13px] font-medium text-teal-800 hover:underline"
                    >
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null
        }
        addForm={
          days.length > 0 ? (
            <details className="group rounded-md border border-dashed border-line-strong bg-navy-50/40">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 text-[13px] font-semibold text-navy-900 sm:px-5 [&::-webkit-details-marker]:hidden">
                <PlusIcon width={16} height={16} className="text-teal-700" />
                Add a new assessment
                <span className="ms-auto text-[12px] font-normal text-ink-faint group-open:hidden">
                  Rarely needed — most papers already exist
                </span>
              </summary>
              <div className="border-t border-line px-4 py-5 sm:px-5">
                <p className="mb-4 text-[12px] text-ink-soft">
                  New assessments start as drafts and locked. Add questions,
                  then Publish and Unlock from this list.
                </p>
                <AssessmentForm courseId={course.id} days={days} />
              </div>
            </details>
          ) : null
        }
      />
    </div>
  )
}
