import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  CalendarIcon,
  ChevronRightIcon,
  ClipboardIcon,
} from '@/components/icons'
import {
  Arabic,
  Badge,
  EmptyState,
  PageHeader,
  Panel,
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

      <div className="mb-4">
        <h2 className="text-[17px] font-semibold text-navy-900">
          Daily schedule
        </h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          Open a day for its slides, labs and assessment.
        </p>
      </div>

      {days.length === 0 ? (
        <Panel>
          <EmptyState
            title="No days published yet"
            description="Your instructor is still preparing the schedule. It will appear here."
          />
        </Panel>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-3">
          {days.map((day) => {
            const count = counts[day.id] ?? 0
            const quizzes = assessmentsPerDay.get(day.id) ?? 0
            const weekday = formatWeekday(day.scheduled_date)
            const date = formatDate(day.scheduled_date)

            return (
              <li key={day.id} className="min-w-0">
                <Link
                  href={`/c/${course.slug}/day/${day.day_number}`}
                  className="group flex h-full min-h-[220px] flex-col rounded-md border border-line-strong bg-surface p-4 transition-colors hover:border-teal-400 hover:bg-navy-50/60 sm:min-h-[260px] sm:p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="grid size-14 place-items-center rounded-md border border-line bg-navy-50 text-center transition-colors group-hover:border-teal-300 group-hover:bg-teal-50">
                      <span className="text-[9px] leading-none font-semibold tracking-widest text-ink-faint uppercase">
                        Day
                      </span>
                      <span className="text-[24px] leading-none font-semibold text-navy-800 group-hover:text-teal-800">
                        {day.day_number}
                      </span>
                    </span>
                    {!day.is_published ? (
                      <Badge tone="amber">Draft</Badge>
                    ) : null}
                  </div>

                  <p className="mt-4 line-clamp-3 text-[15px] leading-snug font-semibold text-navy-900 group-hover:text-teal-800 sm:text-[16px]">
                    {day.title}
                  </p>

                  {day.title_ar ? (
                    <p className="mt-1.5 line-clamp-2 text-[13px] text-ink-soft">
                      <Arabic>{day.title_ar}</Arabic>
                    </p>
                  ) : null}

                  <div className="mt-auto space-y-2.5 pt-5">
                    {date ? (
                      <p className="text-[12px] text-ink-faint">
                        {weekday ? `${weekday}, ${date}` : date}
                      </p>
                    ) : null}
                    <p className="text-[12px] text-ink-faint">
                      {count === 1 ? '1 item' : `${count} items`}
                    </p>
                    {quizzes > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-xs border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800">
                        <ClipboardIcon width={12} height={12} />
                        {quizzes === 1
                          ? '1 assessment'
                          : `${quizzes} assessments`}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-teal-700">
                      Open
                      <ChevronRightIcon
                        width={14}
                        height={14}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
