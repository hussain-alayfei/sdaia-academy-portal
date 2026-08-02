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
  Badge,
  EmptyState,
  PageHeader,
  Panel,
} from '@/components/ui'
import { getCourseBySlug, isManager, requireProfile } from '@/lib/dal'
import {
  ASSESSMENT_LABELS,
  formatDate,
  formatDateRange,
  formatWeekday,
} from '@/lib/format'
import type { AssessmentKind } from '@/lib/types'
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

// The five hues of the SDAIA mosaic mark, cycled by position so the schedule
// grid reads as varied instead of every tile turning the same shade of teal
// on hover. Fixed per day rather than truly random: a tile should hover to
// the same colour every time, not reroll on each render.
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
        <ul
          className="grid justify-start gap-3"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 220px))',
          }}
        >
          {days.map((day, index) => {
            const brand = DAY_HOVER_COLORS[index % DAY_HOVER_COLORS.length]
            const count = counts[day.id] ?? 0
            const chip = assessmentChipLabel(assessmentsPerDay.get(day.id) ?? [])
            const weekday = formatWeekday(day.scheduled_date)
            const date = formatDate(day.scheduled_date)
            const meta = [
              date ? (weekday ? `${weekday}, ${date}` : date) : null,
              count === 1 ? '1 item' : `${count} items`,
            ]
              .filter(Boolean)
              .join(' · ')

            return (
              <li key={day.id} className="min-w-0">
                {/*
                  Height comes from the content, with a floor to keep the row
                  even. It used to be aspect-square, which fixed the height at
                  the tile's width and then clipped the title and the Arabic
                  subtitle into each other once either ran long.
                */}
                <Link
                  href={`/c/${course.slug}/day/${day.day_number}`}
                  style={
                    {
                      '--brand': brand.border,
                      '--brand-soft': brand.soft,
                      '--brand-text': brand.text,
                    } as CSSProperties
                  }
                  className="group relative flex h-full min-h-[184px] flex-col rounded-md border border-line-strong bg-surface p-3.5 transition-colors duration-200 hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="grid size-10 place-items-center rounded-md border border-line bg-navy-50 text-center transition-colors duration-200 group-hover:border-[var(--brand)] group-hover:bg-[var(--brand-soft)]">
                      <span className="text-[8px] leading-none font-semibold tracking-widest text-ink-faint uppercase">
                        Day
                      </span>
                      <span className="text-[18px] leading-none font-semibold text-navy-800 transition-colors duration-200 group-hover:text-[var(--brand-text)]">
                        {day.day_number}
                      </span>
                    </span>
                    {!day.is_published ? (
                      <Badge tone="amber">Draft</Badge>
                    ) : null}
                  </div>

                  <p className="mt-3 line-clamp-2 text-[13px] leading-snug font-semibold text-navy-900 transition-colors duration-200 group-hover:text-[var(--brand-text)]">
                    {day.title}
                  </p>

                  {day.title_ar ? (
                    <p className="mt-1.5 line-clamp-1 text-[11px] leading-relaxed text-ink-soft">
                      <Arabic>{day.title_ar}</Arabic>
                    </p>
                  ) : null}

                  <div className="mt-auto space-y-2 pt-3">
                    {meta ? (
                      <p className="truncate text-[10px] text-ink-faint">
                        {meta}
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
        </ul>
      )}
    </div>
  )
}
