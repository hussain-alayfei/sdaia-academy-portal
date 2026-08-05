import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { CSSProperties } from 'react'

import {
  CalendarIcon,
  ChevronRightIcon,
  ClipboardIcon,
} from '@/components/icons'
import {
  Arabic,
  BackLink,
  Badge,
  EmptyState,
  PageHeader,
  Panel,
} from '@/components/ui'
import { StudentViewBanner } from '@/components/student-view-banner'
import { getCourseBySlug, isManager, requireProfile } from '@/lib/dal'
import {
  ASSESSMENT_LABELS,
  formatDate,
  formatDateRange,
  formatWeekday,
  toTitleCaseEnglish,
} from '@/lib/format'
import type { AssessmentKind } from '@/lib/types'
import {
  getPublishedAssessments,
  getPublishedCourseDays,
} from '@/lib/published'
import {
  getAssessments,
  getCourseDays,
} from '@/lib/queries'

// Fixed per day so the connected journey is easy to scan and each day keeps
// the same visual identity on every render.
const DAY_HOVER_COLORS = [
  { border: '#12b5a5', soft: 'rgba(18,181,165,.08)', text: '#0b6a61' }, // teal
  { border: '#3d9e56', soft: 'rgba(61,158,86,.08)', text: '#2c7541' }, // green
  { border: '#2f7dc4', soft: 'rgba(47,125,196,.08)', text: '#255f96' }, // blue
  { border: '#7c56a8', soft: 'rgba(124,86,168,.08)', text: '#5f4080' }, // violet
  { border: '#e08a1e', soft: 'rgba(224,138,30,.08)', text: '#9c6011' }, // orange
] as const

/**
 * What to print on a day tile's assessment chip. A day usually holds one
 * thing, so name it exactly ("Pre-assessment", "Quiz"); only fall back to a
 * count when a day holds several, where naming them all would not fit.
 */
function assessmentChipLabel(kinds: AssessmentKind[]): string | null {
  if (kinds.length === 0) return null
  if (kinds.length === 1) return ASSESSMENT_LABELS[kinds[0]]
  return `${kinds.length} assessments`
}

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
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ view?: string }>
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams])

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
  // Instructors always read live (including Student view), so out-of-band DB
  // edits show up immediately when previewing as a student.
  const manager = isManager(profile)
  const studentView = manager && query.view === 'student'

  const [rawDays, rawAssessments] = await Promise.all([
    manager ? getCourseDays(course.id) : getPublishedCourseDays(course.id),
    manager ? getAssessments(course.id) : getPublishedAssessments(course.id),
  ])

  const days = studentView ? rawDays.filter((d) => d.is_published) : rawDays
  const assessments = studentView
    ? rawAssessments.filter((a) => a.is_published)
    : rawAssessments

  // Assessments live on their day, so all this page needs is a hint that there
  // is something to sit there. Track the kinds rather than a bare count: a day
  // holding the pre-assessment must not be labelled "1 quiz". The cards
  // themselves, and the student's own score, belong to the day page.
  const assessmentsPerDay = new Map<string, AssessmentKind[]>()
  for (const assessment of assessments) {
    if (!assessment.day_id) continue
    const list = assessmentsPerDay.get(assessment.day_id) ?? []
    list.push(assessment.kind)
    assessmentsPerDay.set(assessment.day_id, list)
  }

  const range = formatDateRange(course.start_date, course.end_date)

  return (
    <div>
      {studentView ? (
        <StudentViewBanner exitHref={`/admin/courses/${course.id}`} />
      ) : null}

      <div className="mb-5">
        <BackLink href="/home">My courses</BackLink>
      </div>

      <PageHeader
        eyebrow="Course"
        title={course.title}
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

      <div className="mb-5">
        <h2 className="text-[17px] font-semibold text-navy-900">
          Your five-day journey
        </h2>
      </div>

      {days.length === 0 ? (
        <Panel>
          <EmptyState
            title="No days published yet"
            description="Your instructor is still preparing the schedule. It will appear here."
          />
        </Panel>
      ) : (
        <ol className="relative grid gap-4 before:absolute before:top-5 before:bottom-5 before:left-5 before:w-px before:bg-line-strong before:content-[''] md:grid-cols-5 md:gap-2 md:before:top-5 md:before:right-[10%] md:before:bottom-auto md:before:left-[10%] md:before:h-px md:before:w-auto">
          {days.map((day, index) => {
            const brand = DAY_HOVER_COLORS[index % DAY_HOVER_COLORS.length]
            const current = day.is_current
            const chip = assessmentChipLabel(assessmentsPerDay.get(day.id) ?? [])
            const weekday = formatWeekday(day.scheduled_date)
            const date = formatDate(day.scheduled_date)

            return (
              <li
                key={day.id}
                className="relative min-w-0 ps-14 md:ps-0 md:pt-14"
              >
                <span
                  aria-hidden={!current}
                  aria-label={current ? `Day ${day.day_number}, current day` : undefined}
                  style={{
                    '--brand': brand.border,
                    '--brand-soft': brand.soft,
                    '--brand-text': brand.text,
                  } as CSSProperties}
                  className={
                    current
                      ? 'absolute top-0 left-0 z-[1] grid size-10 place-items-center rounded-full border-2 border-[var(--brand)] bg-[var(--brand)] text-[14px] font-bold text-white shadow-[0_0_0_4px_var(--brand-soft)] md:left-1/2 md:-translate-x-1/2'
                      : 'absolute top-0 left-0 z-[1] grid size-10 place-items-center rounded-full border-2 border-[var(--brand)] bg-surface text-[14px] font-semibold text-[var(--brand-text)] md:left-1/2 md:-translate-x-1/2'
                  }
                >
                  {day.day_number}
                </span>
                <Link
                  href={`/c/${course.slug}/day/${day.day_number}${
                    studentView ? '?view=student' : ''
                  }`}
                  prefetch
                  style={
                    {
                      '--brand': brand.border,
                      '--brand-soft': brand.soft,
                      '--brand-text': brand.text,
                    } as CSSProperties
                  }
                  className={
                    current
                      ? 'group relative flex h-full min-h-[140px] flex-col rounded-md border-2 border-[var(--brand)] bg-[var(--brand-soft)] p-4 transition-colors duration-200 md:min-h-[168px]'
                      : 'group relative flex h-full min-h-[140px] flex-col rounded-md border border-line-strong bg-surface p-4 transition-colors duration-200 hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] md:min-h-[168px]'
                  }
                >
                  <div className="flex min-h-6 items-start justify-between gap-2">
                    <span className="text-[10px] font-semibold tracking-[0.16em] text-[var(--brand-text)] uppercase">
                      Day {day.day_number}
                    </span>
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {current ? <Badge tone="teal">Today</Badge> : null}
                      {!day.is_published ? (
                        <Badge tone="amber">Draft</Badge>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-2 line-clamp-2 text-[14px] leading-snug font-semibold text-navy-900 transition-colors duration-200 group-hover:text-[var(--brand-text)]">
                    {toTitleCaseEnglish(day.title)}
                  </p>

                  {day.title_ar ? (
                    <p className="mt-1 line-clamp-1 text-[11px] leading-relaxed text-ink-soft">
                      <Arabic>{day.title_ar}</Arabic>
                    </p>
                  ) : null}

                  <div className="mt-auto space-y-2 pt-3">
                    {date ? (
                      <p className="truncate text-[10px] text-ink-faint">
                        {weekday ? `${weekday}, ${date}` : date}
                      </p>
                    ) : null}

                    <div className="flex items-center gap-1.5">
                      {chip ? (
                        <span className="inline-flex min-w-0 items-center gap-1 rounded-xs border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-800">
                          <ClipboardIcon
                            width={10}
                            height={10}
                            className="shrink-0"
                          />
                          <span className="truncate">{chip}</span>
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="ms-auto inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-teal-700 transition-colors duration-200 group-hover:text-[var(--brand-text)]">
                        Open
                        <ChevronRightIcon width={12} height={12} />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
