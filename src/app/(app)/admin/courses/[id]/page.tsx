import Link from 'next/link'
import { notFound } from 'next/navigation'

import { clearCurrentDay, setCurrentDay, toggleDayPublished } from '@/app/actions/admin'
import { AddDayForm } from '@/components/admin/day-form'
import {
  Arabic,
  Badge,
  Button,
  EmptyState,
  Panel,
  PanelHeader,
  RowArrow,
} from '@/components/ui'
import { canManageCourse, getCourseById } from '@/lib/dal'
import { formatDate } from '@/lib/format'
import { getCourseDays, getResourceCounts } from '@/lib/queries'

export default async function CourseSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const course = await getCourseById(id)
  if (!course || !(await canManageCourse(course))) notFound()

  const [days, counts] = await Promise.all([
    getCourseDays(course.id),
    getResourceCounts(course.id),
  ])

  const takenDays = days.map((d) => d.day_number)

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader
          title="Schedule"
          description="Students only see days you have published. Use Current day to fill that day's circle on the student journey."
        />

        {days.length === 0 ? (
          <EmptyState
            title="No days yet"
            description="Add Day 1 below to start building the schedule."
          />
        ) : (
          <ul className="divide-y divide-line">
            {days.map((day) => (
              <li
                key={day.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5"
              >
                <Link
                  href={`/admin/courses/${course.id}/days/${day.id}`}
                  className="group flex min-w-0 flex-1 items-center gap-4"
                >
                  <span
                    className={
                      day.is_current
                        ? 'grid size-11 shrink-0 place-items-center rounded-full border-2 border-teal-600 bg-teal-600 text-center text-white'
                        : 'grid size-11 shrink-0 place-items-center rounded-sm border border-line bg-navy-50 text-center'
                    }
                  >
                    <span
                      className={
                        day.is_current
                          ? 'text-[10px] leading-none font-medium tracking-wide text-teal-50 uppercase'
                          : 'text-[10px] leading-none font-medium tracking-wide text-ink-faint uppercase'
                      }
                    >
                      Day
                    </span>
                    <span
                      className={
                        day.is_current
                          ? 'text-[15px] leading-tight font-semibold text-white'
                          : 'text-[15px] leading-tight font-semibold text-navy-800'
                      }
                    >
                      {day.day_number}
                    </span>
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-medium text-navy-900 group-hover:text-teal-800">
                        {day.title}
                      </p>
                      <Badge tone={day.is_published ? 'teal' : 'amber'}>
                        {day.is_published ? 'Published' : 'Draft'}
                      </Badge>
                      {day.is_current ? (
                        <Badge tone="teal">Current day</Badge>
                      ) : null}
                    </div>
                    {day.title_ar ? (
                      <p className="truncate text-[13px] text-ink-soft">
                        <Arabic>{day.title_ar}</Arabic>
                      </p>
                    ) : null}
                    <p className="mt-1 text-[12px] text-ink-faint">
                      {[
                        formatDate(day.scheduled_date),
                        `${counts[day.id] ?? 0} items`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </Link>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <form
                    action={day.is_current ? clearCurrentDay : setCurrentDay}
                  >
                    <input type="hidden" name="course_id" value={course.id} />
                    <input type="hidden" name="day_id" value={day.id} />
                    <Button type="submit" variant="secondary" size="sm">
                      {day.is_current ? 'Clear current' : 'Set as current day'}
                    </Button>
                  </form>

                  <form action={toggleDayPublished}>
                    <input type="hidden" name="course_id" value={course.id} />
                    <input type="hidden" name="day_id" value={day.id} />
                    <input
                      type="hidden"
                      name="next"
                      value={day.is_published ? 'false' : 'true'}
                    />
                    <Button type="submit" variant="secondary" size="sm">
                      {day.is_published ? 'Unpublish' : 'Publish'}
                    </Button>
                  </form>

                  <Link
                    href={`/admin/courses/${course.id}/days/${day.id}`}
                    className="group"
                    aria-label={`Manage day ${day.day_number}`}
                  >
                    <RowArrow />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {takenDays.length < 5 ? (
        <Panel className="p-5 sm:p-6">
          <h2 className="mb-4 text-[15px] font-semibold text-navy-900">
            Add a day
          </h2>
          <AddDayForm courseId={course.id} takenDays={takenDays} />
        </Panel>
      ) : null}
    </div>
  )
}
