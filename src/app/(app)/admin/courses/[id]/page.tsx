import Link from 'next/link'
import { notFound } from 'next/navigation'

import { clearCurrentDay, setCurrentDay, toggleDayPublished } from '@/app/actions/admin'
import { AddDayForm } from '@/components/admin/day-form'
import { AdminSectionHeader } from '@/components/admin/section-header'
import {
  Arabic,
  Button,
  ButtonLink,
  EmptyState,
  Panel,
  cx,
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
  const publishedCount = days.filter((d) => d.is_published).length

  return (
    <div className="space-y-4">
      <AdminSectionHeader
        title="Days"
        meta={`${days.length} total · ${publishedCount} live`}
        description="Open a day to manage materials. Publish when students should see it."
      />

      <Panel>
        {days.length === 0 ? (
          <EmptyState
            title="No days yet"
            description="Add Day 1 below to start building the schedule."
          />
        ) : (
          <ul className="divide-y divide-line">
            {days.map((day) => {
              const href = `/admin/courses/${course.id}/days/${day.id}`
              const materialCount = counts[day.id] ?? 0
              const scheduled = formatDate(day.scheduled_date)

              return (
                <li
                  key={day.id}
                  className={cx(
                    'flex flex-wrap items-center gap-3 px-3.5 py-3 sm:px-4',
                    day.is_current && 'bg-teal-50/40'
                  )}
                >
                  <Link
                    href={href}
                    className="group flex min-w-0 flex-1 items-center gap-3"
                  >
                    <span
                      className={cx(
                        'grid size-8 shrink-0 place-items-center text-[13px] font-semibold tabular-nums',
                        day.is_current
                          ? 'rounded-full bg-teal-600 text-white'
                          : 'rounded-sm border border-line bg-navy-50 text-navy-800'
                      )}
                    >
                      {day.day_number}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-navy-900 group-hover:text-teal-800">
                        {day.title}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-ink-faint">
                        <span
                          className={cx(
                            'font-medium',
                            day.is_published ? 'text-teal-700' : 'text-amber-700'
                          )}
                        >
                          {day.is_published ? 'Live' : 'Hidden'}
                        </span>
                        {day.is_current ? (
                          <>
                            <span aria-hidden>·</span>
                            <span className="font-medium text-teal-700">
                              Current
                            </span>
                          </>
                        ) : null}
                        {scheduled ? (
                          <>
                            <span aria-hidden>·</span>
                            <span>{scheduled}</span>
                          </>
                        ) : null}
                        <span aria-hidden>·</span>
                        <span>
                          {materialCount} material
                          {materialCount === 1 ? '' : 's'}
                        </span>
                        {day.title_ar ? (
                          <>
                            <span aria-hidden className="hidden sm:inline">
                              ·
                            </span>
                            <span className="hidden truncate sm:inline">
                              <Arabic>{day.title_ar}</Arabic>
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </Link>

                  <div className="flex shrink-0 items-center gap-1">
                    <form action={toggleDayPublished}>
                      <input type="hidden" name="course_id" value={course.id} />
                      <input type="hidden" name="day_id" value={day.id} />
                      <input
                        type="hidden"
                        name="next"
                        value={day.is_published ? 'false' : 'true'}
                      />
                      <Button type="submit" variant="ghost" size="sm">
                        {day.is_published ? 'Hide' : 'Publish'}
                      </Button>
                    </form>

                    <form
                      action={day.is_current ? clearCurrentDay : setCurrentDay}
                    >
                      <input type="hidden" name="course_id" value={course.id} />
                      <input type="hidden" name="day_id" value={day.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        {day.is_current ? 'Clear' : 'Set current'}
                      </Button>
                    </form>

                    <ButtonLink href={href} size="sm">
                      Open
                    </ButtonLink>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {takenDays.length < 5 ? (
        <details className="group rounded-md border border-dashed border-line-strong">
          <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-medium text-navy-900 sm:px-5 [&::-webkit-details-marker]:hidden">
            Add another day
            <span className="ms-2 text-[12px] font-normal text-ink-faint">
              Optional once Days 1–5 exist
            </span>
          </summary>
          <div className="border-t border-line px-4 py-4 sm:px-5">
            <AddDayForm courseId={course.id} takenDays={takenDays} />
          </div>
        </details>
      ) : null}
    </div>
  )
}
