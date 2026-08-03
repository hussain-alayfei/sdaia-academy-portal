import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  toggleAssessmentLocked,
  toggleAssessmentPublished,
} from '@/app/actions/admin'
import { AssessmentForm } from '@/components/admin/assessment-form'
import { ClipboardIcon, PlusIcon } from '@/components/icons'
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  PanelHeader,
  RowArrow,
} from '@/components/ui'
import { canManageCourse, getCourseById } from '@/lib/dal'
import { ASSESSMENT_LABELS, formatDuration } from '@/lib/format'
import { getQuestionCounts } from '@/lib/quiz'
import { getAssessments, getCourseDays } from '@/lib/queries'

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

  // Group by day so the tab mirrors what a student sees: everything sits on the
  // day it belongs to. Anything without a day is stranded and called out.
  const grouped = days.map((day) => ({
    day,
    items: assessments
      .filter((a) => a.day_id === day.id)
      .sort((a, b) => a.position - b.position),
  }))

  const stranded = assessments.filter(
    (a) => !a.day_id || !dayById.has(a.day_id)
  )

  return (
    <div className="space-y-6">
      {days.length === 0 ? (
        <EmptyState
          title="Add the days first"
          description="An assessment lives on a day, so the schedule has to exist before you can place one."
        />
      ) : null}

      {stranded.length > 0 ? (
        <Panel className="border-amber-200">
          <PanelHeader
            title="Not attached to a day"
            description="Students cannot see these. Open one and choose a day."
          />
          <ul className="divide-y divide-line">
            {stranded.map((a) => (
              <li key={a.id} className="px-4 py-3 sm:px-5">
                <Link
                  href={`/admin/courses/${course.id}/assessments/${a.id}`}
                  className="text-[14px] font-medium text-navy-900 hover:text-teal-800"
                >
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {grouped.map(({ day, items }) => (
        <Panel key={day.id}>
          <PanelHeader
            title={`Day ${day.day_number} · ${day.title}`}
            description={
              items.length === 0
                ? 'Nothing scheduled on this day yet.'
                : undefined
            }
          />

          {items.length > 0 ? (
            <ul className="divide-y divide-line">
              {items.map((assessment) => {
                const count = counts[assessment.id] ?? 0
                const ready = count === assessment.required_question_count

                return (
                  <li key={assessment.id}>
                    <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
                      <Link
                        href={`/admin/courses/${course.id}/assessments/${assessment.id}`}
                        className="group flex min-w-0 flex-1 items-center gap-3.5"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-sm border border-line bg-navy-50 text-navy-600 transition-colors group-hover:border-teal-200 group-hover:bg-teal-50 group-hover:text-teal-700">
                          <ClipboardIcon width={18} height={18} />
                        </span>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="font-medium text-navy-900 group-hover:text-teal-800">
                              {assessment.title}
                            </p>
                            <Badge tone="neutral">
                              {ASSESSMENT_LABELS[assessment.kind]}
                            </Badge>
                            <Badge
                              tone={assessment.is_published ? 'teal' : 'amber'}
                            >
                              {assessment.is_published ? 'Published' : 'Draft'}
                            </Badge>
                            {assessment.is_published ? (
                              <Badge
                                tone={assessment.is_locked ? 'amber' : 'teal'}
                              >
                                {assessment.is_locked ? 'Locked' : 'Open'}
                              </Badge>
                            ) : null}
                          </div>

                          <p className="mt-1 text-[12px] text-ink-faint">
                            {ready
                              ? `${count} question${count === 1 ? '' : 's'}`
                              : 'No questions yet'}
                            {' · '}
                            {formatDuration(assessment.duration_minutes)}
                          </p>
                        </div>
                      </Link>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <form action={toggleAssessmentPublished}>
                          <input
                            type="hidden"
                            name="course_id"
                            value={course.id}
                          />
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
                            variant="secondary"
                            size="sm"
                            disabled={!ready && !assessment.is_published}
                            title={
                              !ready
                                ? 'Add questions before publishing'
                                : undefined
                            }
                          >
                            {assessment.is_published ? 'Unpublish' : 'Publish'}
                          </Button>
                        </form>

                        {assessment.is_published ? (
                          <form action={toggleAssessmentLocked}>
                            <input
                              type="hidden"
                              name="course_id"
                              value={course.id}
                            />
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
                              variant={
                                assessment.is_locked ? 'primary' : 'secondary'
                              }
                              size="sm"
                            >
                              {assessment.is_locked
                                ? 'Unlock for students'
                                : 'Lock for students'}
                            </Button>
                          </form>
                        ) : null}

                        <Link
                          href={`/admin/courses/${course.id}/assessments/${assessment.id}`}
                          aria-label={`Open ${assessment.title}`}
                          className="group"
                        >
                          <RowArrow />
                        </Link>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </Panel>
      ))}

      {days.length > 0 ? (
        <Panel className="p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <PlusIcon width={16} height={16} className="text-teal-700" />
            <h2 className="text-[15px] font-semibold text-navy-900">
              Add an assessment
            </h2>
          </div>
          <AssessmentForm courseId={course.id} days={days} />
        </Panel>
      ) : null}
    </div>
  )
}
