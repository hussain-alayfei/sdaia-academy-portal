import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { CSSProperties } from 'react'

import { AssessmentCards } from '@/components/assessment-cards'
import { CalendarIcon, ResourceIcon } from '@/components/icons'
import { ResourceList } from '@/components/resource-list'
import { StudentViewBanner } from '@/components/student-view-banner'
import {
  Arabic,
  BackLink,
  Badge,
  PageHeader,
  Panel,
  PanelHeader,
} from '@/components/ui'
import { getCourseBySlug, isManager, requireProfile } from '@/lib/dal'
import { RESOURCE_LABELS, formatDate, formatWeekday } from '@/lib/format'
import {
  getPublishedAssessments,
  getPublishedDayByNumber,
  getPublishedQuestionCounts,
  getPublishedResourcesForDay,
} from '@/lib/published'
import {
  getAssessments,
  getDayByNumber,
  getResourcesForDay,
} from '@/lib/queries'
import { getMyAttempts, getQuestionCounts } from '@/lib/quiz'
import type { Resource, ResourceKind } from '@/lib/types'

/* Strong section identity without turning the working UI into decorative cards. */
const MATERIAL_GROUPS: Array<{
  kind: ResourceKind
  description: string
  accent: string
  soft: string
}> = [
  {
    kind: 'slides',
    description: 'Presentation decks and lesson slides.',
    accent: '#12b5a5',
    soft: 'rgba(18,181,165,.08)',
  },
  {
    kind: 'pdf',
    description: 'Reading material and reference documents.',
    accent: '#2f7dc4',
    soft: 'rgba(47,125,196,.08)',
  },
  {
    kind: 'notebook',
    description: 'Interactive notebooks that open in Google Colab.',
    accent: '#7c56a8',
    soft: 'rgba(124,86,168,.08)',
  },
  {
    kind: 'lab',
    description: 'Hands-on exercises and guided practice.',
    accent: '#3d9e56',
    soft: 'rgba(61,158,86,.08)',
  },
  {
    kind: 'dataset',
    description: 'Data files used by notebooks and labs.',
    accent: '#e08a1e',
    soft: 'rgba(224,138,30,.08)',
  },
  {
    kind: 'link',
    description: 'External tools, references and useful links.',
    accent: '#2f7dc4',
    soft: 'rgba(47,125,196,.08)',
  },
  {
    kind: 'file',
    description: 'Additional files supplied by your instructor.',
    accent: '#687386',
    soft: 'rgba(104,115,134,.08)',
  },
]

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; dayNumber: string }>
}): Promise<Metadata> {
  const { slug, dayNumber } = await params
  const course = await getCourseBySlug(slug)
  if (!course) return { title: 'Day' }
  const day = await getDayByNumber(course.id, Number(dayNumber))
  return { title: day ? `Day ${day.day_number} · ${day.title}` : 'Day' }
}

export default async function DayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; dayNumber: string }>
  searchParams: Promise<{ view?: string }>
}) {
  const [{ slug, dayNumber }, query] = await Promise.all([params, searchParams])

  const parsed = Number(dayNumber)
  if (!Number.isInteger(parsed) || parsed < 1) notFound()

  // Independent of each other, so run them together rather than in sequence.
  const [profile, course] = await Promise.all([
    requireProfile(),
    getCourseBySlug(slug),
  ])
  if (!course) notFound()

  // Students read the shared cached copy; instructors read live so drafts and
  // unpublished materials still show up while they are preparing the day.
  const manager = isManager(profile)
  const studentView = manager && query.view === 'student'
  const live = manager && !studentView

  const day = live
    ? await getDayByNumber(course.id, parsed)
    : await getPublishedDayByNumber(course.id, parsed)
  if (!day) notFound()

  const [resources, assessments, questionCounts, attempts] = await Promise.all([
    live
      ? getResourcesForDay(day.id)
      : getPublishedResourcesForDay(course.id, day.id),
    live ? getAssessments(course.id) : getPublishedAssessments(course.id),
    live ? getQuestionCounts(course.id) : getPublishedQuestionCounts(course.id),
    // Never cached: this is the one thing on the page that differs per student.
    studentView ? Promise.resolve({}) : getMyAttempts(course.id),
  ])

  const dayAssessments = assessments
    .filter((assessment) => assessment.day_id === day.id)
    .sort((a, b) => a.position - b.position)

  // Bucket by kind, preserving GROUP_ORDER, so slides always lead and loose
  // files trail.
  const groups = MATERIAL_GROUPS.map((group) => ({
    ...group,
    items: resources.filter((r: Resource) => r.kind === group.kind),
  })).filter((g) => g.items.length > 0)

  const weekday = formatWeekday(day.scheduled_date)
  const date = formatDate(day.scheduled_date)

  return (
    <div>
      {studentView ? (
        <StudentViewBanner exitHref={`/admin/courses/${course.id}`} />
      ) : null}

      <div className="mb-5">
        <BackLink
          href={`/c/${course.slug}${studentView ? '?view=student' : ''}`}
        >
          {course.title}
        </BackLink>
      </div>

      <PageHeader
        eyebrow={`Day ${day.day_number}`}
        title={day.title}
        description={day.summary ?? undefined}
      />

      {(day.title_ar || date) && (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-soft">
          {day.title_ar ? (
            <Arabic className="text-[15px] text-navy-800">{day.title_ar}</Arabic>
          ) : null}
          {date ? (
            <span className="flex items-center gap-1.5">
              <CalendarIcon width={14} height={14} />
              {weekday ? `${weekday}, ${date}` : date}
            </span>
          ) : null}
          {!day.is_published ? <Badge tone="amber">Draft</Badge> : null}
        </div>
      )}

      {/* Assessments lead the day. They are the thing with a deadline on it. */}
      {dayAssessments.length > 0 ? (
        <div className="mb-6">
          <AssessmentCards
            assessments={dayAssessments}
            attempts={attempts}
            questionCounts={questionCounts}
            studentView={studentView}
          />
        </div>
      ) : null}

      <div className="mb-4 mt-8">
        <h2 className="text-[18px] font-semibold text-navy-900">
          Course materials
        </h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          Materials are grouped by type so slides, labs and supporting files
          are easy to find.
        </p>
      </div>

      {groups.length === 0 ? (
        <Panel>
          <PanelHeader title="Materials" />
          <ResourceList resources={[]} />
        </Panel>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Panel
              key={group.kind}
              className="overflow-hidden"
              style={
                {
                  borderInlineStartColor: group.accent,
                  borderInlineStartWidth: '3px',
                } as CSSProperties
              }
            >
              <PanelHeader
                title={
                  <span className="flex items-center gap-2.5">
                    <span
                      className="grid size-8 place-items-center rounded-sm border"
                      style={{
                        borderColor: group.accent,
                        backgroundColor: group.soft,
                        color: group.accent,
                      }}
                    >
                      <ResourceIcon kind={group.kind} width={16} height={16} />
                    </span>
                    <span>{RESOURCE_LABELS[group.kind]}</span>
                    <Badge tone="neutral">
                      {group.items.length} item
                      {group.items.length === 1 ? '' : 's'}
                    </Badge>
                  </span>
                }
                description={group.description}
              />
              <ResourceList resources={group.items} showKind={false} />
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}
