import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CalendarIcon, ClipboardIcon } from '@/components/icons'
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

  const [days, counts, assessments] = await Promise.all([
    live ? getCourseDays(course.id) : getPublishedCourseDays(course.id),
    live ? getResourceCounts(course.id) : getPublishedResourceCounts(course.id),
    live ? getAssessments(course.id) : getPublishedAssessments(course.id),
  ])

  // Assessments live on their day, so all this page needs is a count per day to
  // hint that there is something to sit there. The cards themselves, and the
  // student's own score, belong to the day page.
  const assessmentsPerDay = new Map<string, number>()
  for (const assessment of assessments) {
    if (!assessment.day_id) continue
    assessmentsPerDay.set(
      assessment.day_id,
      (assessmentsPerDay.get(assessment.day_id) ?? 0) + 1
    )
  }

  const range = formatDateRange(course.start_date, course.end_date)

  return (
    <div>
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

      <Panel>
        <PanelHeader
          title="Daily schedule"
          description="Open a day for its slides, labs and assessment."
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
              const quizzes = assessmentsPerDay.get(day.id) ?? 0
              const weekday = formatWeekday(day.scheduled_date)
              const date = formatDate(day.scheduled_date)

              return (
                <li key={day.id}>
                  <Link
                    href={`/c/${course.slug}/day/${day.day_number}`}
                    className="group flex items-center gap-5 px-4 py-5 transition-colors hover:bg-navy-50 sm:gap-6 sm:px-6 sm:py-6"
                  >
                    {/* The day number is the thing people navigate by, so it is
                        the largest element on the row rather than a small chip. */}
                    <span className="grid size-16 shrink-0 place-items-center rounded-md border border-line bg-navy-50 text-center transition-colors group-hover:border-teal-300 group-hover:bg-teal-50 sm:size-[70px]">
                      <span className="text-[10px] leading-none font-semibold tracking-widest text-ink-faint uppercase">
                        Day
                      </span>
                      <span className="text-[26px] leading-tight font-semibold text-navy-800 group-hover:text-teal-800 sm:text-[28px]">
                        {day.day_number}
                      </span>
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <p className="text-[17px] font-semibold text-navy-900 group-hover:text-teal-800 sm:text-[19px]">
                          {day.title}
                        </p>
                        {!day.is_published ? (
                          <Badge tone="amber">Draft</Badge>
                        ) : null}
                      </div>

                      {day.title_ar ? (
                        <p className="mt-0.5 truncate text-[14px] text-ink-soft">
                          <Arabic>{day.title_ar}</Arabic>
                        </p>
                      ) : null}

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-ink-faint">
                        {date ? (
                          <span>{weekday ? `${weekday}, ${date}` : date}</span>
                        ) : null}
                        <span>{count === 1 ? '1 item' : `${count} items`}</span>
                        {quizzes > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-xs border border-teal-200 bg-teal-50 px-2 py-0.5 font-medium text-teal-800">
                            <ClipboardIcon width={12} height={12} />
                            {quizzes === 1
                              ? '1 assessment'
                              : `${quizzes} assessments`}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <RowArrow className="size-10" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}
