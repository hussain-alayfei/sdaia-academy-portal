import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AssessmentList } from '@/components/assessment-list'
import { CalendarIcon } from '@/components/icons'
import {
  Arabic,
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
  RowArrow,
} from '@/components/ui'
import { getCourseBySlug, isManager, requireProfile } from '@/lib/dal'
import { formatDate, formatDateRange, formatWeekday } from '@/lib/format'
import {
  getPublishedAssessments,
  getPublishedCourseDays,
  getPublishedResourceCounts,
} from '@/lib/published'
import {
  getAssessments,
  getCourseDays,
  getMyScores,
  getResourceCounts,
} from '@/lib/queries'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const course = await getCourseBySlug(slug)
  return { title: course?.title ?? 'Course' }
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // The gate and the course load are independent, so pay for one round trip
  // instead of two. RLS still scopes the course read to this user.
  const [profile, course] = await Promise.all([
    requireProfile(),
    getCourseBySlug(slug),
  ])

  // RLS hides courses the viewer is not enrolled in or does not own, so a
  // null here means "not yours" just as much as "does not exist".
  if (!course) notFound()

  // Students share one cached, published-only copy of the schedule — a whole
  // cohort opening this page costs the database one read rather than thirty.
  // Instructors read live, because they need to see their own drafts.
  const live = isManager(profile)

  const [days, counts, assessments, scores] = await Promise.all([
    live ? getCourseDays(course.id) : getPublishedCourseDays(course.id),
    live ? getResourceCounts(course.id) : getPublishedResourceCounts(course.id),
    live ? getAssessments(course.id) : getPublishedAssessments(course.id),
    // Never cached: this is the one thing on the page that differs per student.
    getMyScores(course.id),
  ])

  const range = formatDateRange(course.start_date, course.end_date)

  return (
    <>
      <PageHeader
        eyebrow="Course"
        title={course.title}
        description={course.description ?? undefined}
      />

      {(course.title_ar || range) && (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-soft">
          {course.title_ar ? (
            <Arabic className="text-[15px] text-navy-800">
              {course.title_ar}
            </Arabic>
          ) : null}
          {range ? (
            <span className="flex items-center gap-1.5">
              <CalendarIcon width={14} height={14} />
              {range}
            </span>
          ) : null}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        <Panel>
          <PanelHeader
            title="Daily schedule"
            description="Slides, labs and notebooks for each day."
          />

          {days.length === 0 ? (
            <EmptyState
              title="No days published yet"
              description="Your instructor is still preparing the schedule. It will appear here."
            />
          ) : (
            <ul className="divide-y divide-line">
              {days.map((day) => {
                const count = counts[day.id] ?? 0
                const weekday = formatWeekday(day.scheduled_date)
                const date = formatDate(day.scheduled_date)

                return (
                  <li key={day.id}>
                    <Link
                      href={`/c/${course.slug}/day/${day.day_number}`}
                      className="group flex items-center gap-4 px-4 py-4 hover:bg-navy-50 sm:px-5"
                    >
                      <span className="grid size-11 shrink-0 place-items-center rounded-sm border border-line bg-navy-50 text-center group-hover:border-teal-200 group-hover:bg-teal-50">
                        <span className="text-[10px] leading-none font-medium tracking-wide text-ink-faint uppercase">
                          Day
                        </span>
                        <span className="text-[15px] leading-tight font-semibold text-navy-800">
                          {day.day_number}
                        </span>
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="font-medium text-navy-900 group-hover:text-teal-800">
                            {day.title}
                          </p>
                          {!day.is_published ? (
                            <Badge tone="amber">Draft</Badge>
                          ) : null}
                        </div>

                        {day.title_ar ? (
                          <p className="truncate text-[13px] text-ink-soft">
                            <Arabic>{day.title_ar}</Arabic>
                          </p>
                        ) : null}

                        <p className="mt-1 text-[12px] text-ink-faint">
                          {[
                            weekday && date ? `${weekday}, ${date}` : date,
                            count === 1 ? '1 item' : `${count} items`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>

                      <RowArrow />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Assessments"
            description="Pre-test, post-test and the final quiz."
          />
          <AssessmentList assessments={assessments} scores={scores} />
        </Panel>
      </div>
    </>
  )
}
