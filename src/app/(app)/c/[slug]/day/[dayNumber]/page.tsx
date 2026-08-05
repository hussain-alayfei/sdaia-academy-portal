import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AssessmentCards } from '@/components/assessment-cards'
import { CalendarIcon } from '@/components/icons'
import { MaterialSection } from '@/components/material-section'
import { ResourceList } from '@/components/resource-list'
import { StudentViewBanner } from '@/components/student-view-banner'
import {
  Arabic,
  BackLink,
  Badge,
  EmptyState,
  PageHeader,
  Panel,
} from '@/components/ui'
import { getCourseBySlug, isManager, requireProfile } from '@/lib/dal'
import { RESOURCE_LABELS, formatDate, formatWeekday, toTitleCaseEnglish } from '@/lib/format'
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

const MATERIAL_GROUPS: Array<{
  kind: ResourceKind
  accent: string
  soft: string
}> = [
  {
    kind: 'slides',
    accent: '#0b6a61',
    soft: 'rgba(18,181,165,.10)',
  },
  {
    kind: 'notebook',
    accent: '#5f4080',
    soft: 'rgba(124,86,168,.10)',
  },
  {
    kind: 'lab',
    accent: '#2c7541',
    soft: 'rgba(61,158,86,.10)',
  },
  {
    kind: 'pdf',
    accent: '#255f96',
    soft: 'rgba(47,125,196,.10)',
  },
  {
    kind: 'dataset',
    accent: '#9c6011',
    soft: 'rgba(224,138,30,.10)',
  },
  {
    kind: 'link',
    accent: '#255f96',
    soft: 'rgba(47,125,196,.10)',
  },
  {
    kind: 'file',
    accent: '#4a5568',
    soft: 'rgba(104,115,134,.10)',
  },
]

function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow: string
  title: string
}) {
  return (
    <div className="mb-3 border-b border-line pb-2">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-navy-600 uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-[18px] font-semibold text-navy-900">{title}</h2>
    </div>
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; dayNumber: string }>
}): Promise<Metadata> {
  const { slug, dayNumber } = await params
  const course = await getCourseBySlug(slug)
  if (!course) return { title: 'Day' }
  const day = await getDayByNumber(course.id, Number(dayNumber))
  return { title: day ? `Day ${day.day_number} · ${toTitleCaseEnglish(day.title)}` : 'Day' }
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

  const [profile, course] = await Promise.all([
    requireProfile(),
    getCourseBySlug(slug),
  ])
  if (!course) notFound()

  const manager = isManager(profile)
  const studentView = manager && query.view === 'student'

  const day = manager
    ? await getDayByNumber(course.id, parsed)
    : await getPublishedDayByNumber(course.id, parsed)
  if (!day || (studentView && !day.is_published)) notFound()

  const [rawResources, rawAssessments, questionCounts, attempts] =
    await Promise.all([
      manager
        ? getResourcesForDay(day.id)
        : getPublishedResourcesForDay(course.id, day.id),
      manager ? getAssessments(course.id) : getPublishedAssessments(course.id),
      manager
        ? getQuestionCounts(course.id)
        : getPublishedQuestionCounts(course.id),
      studentView ? Promise.resolve({}) : getMyAttempts(course.id),
    ])

  const resources = studentView
    ? rawResources.filter((r) => r.is_published)
    : rawResources
  const assessments = studentView
    ? rawAssessments.filter((a) => a.is_published)
    : rawAssessments

  const dayAssessments = assessments
    .filter((assessment) => assessment.day_id === day.id)
    .sort((a, b) => a.position - b.position)

  const weekday = formatWeekday(day.scheduled_date)
  const date = formatDate(day.scheduled_date)
  const when = date ? (weekday ? `${weekday}, ${date}` : date) : null

  const isCapstone = (r: Resource) =>
    (r.description ?? '').toLowerCase().includes('capstone-project') ||
    (/capstone/i.test(r.title) &&
      !(r.description ?? '').toLowerCase().includes('theory-exam'))
  const isLegacyCert = (r: Resource) =>
    (r.description ?? '').toLowerCase().includes('certification-pass')
  const capstone = resources.filter((r) => isCapstone(r) || isLegacyCert(r))
  const otherMaterials = resources.filter(
    (r) => !isCapstone(r) && !isLegacyCert(r)
  )
  const materialGroups = MATERIAL_GROUPS.map((group) => ({
    ...group,
    items: otherMaterials.filter((r: Resource) => r.kind === group.kind),
  })).filter((g) => g.items.length > 0)

  const showMaterialsEmpty =
    materialGroups.length === 0 && capstone.length === 0
  const hasSidebar = dayAssessments.length > 0

  const materialsColumn = (
    <div className="min-w-0 space-y-10">
      {capstone.length > 0 ? (
        <section>
          <SectionHeading
            eyebrow="Capstone"
            title="Project and submission"
          />
          <div className="space-y-5">
            <MaterialSection
              title="1. Groups spreadsheet"
              count={capstone.filter((r) => r.kind === 'link').length}
              accent="#0b6a61"
              soft="rgba(18,181,165,.10)"
            >
              <ResourceList
                resources={capstone.filter((r) => r.kind === 'link')}
                showKind={false}
                showDescription={false}
                emptyTitle="No groups spreadsheet yet"
                emptyDescription="The Capstone groups Excel sheet will appear here."
              />
            </MaterialSection>
            <MaterialSection
              title="2. Project guide"
              count={capstone.filter((r) => r.kind !== 'link').length}
              accent="#255f96"
              soft="rgba(47,125,196,.10)"
            >
              <ResourceList
                resources={capstone.filter((r) => r.kind !== 'link')}
                showKind={false}
                showDescription={false}
              />
            </MaterialSection>
          </div>
        </section>
      ) : null}

      {materialGroups.length > 0 ? (
        <section>
          <SectionHeading eyebrow="Materials" title="What you need today" />
          <div className="space-y-5">
            {materialGroups.map((group) => (
              <MaterialSection
                key={group.kind}
                title={RESOURCE_LABELS[group.kind]}
                count={group.items.length}
                accent={group.accent}
                soft={group.soft}
              >
                <ResourceList
                  resources={group.items}
                  showKind={false}
                  showDescription={false}
                />
              </MaterialSection>
            ))}
          </div>
        </section>
      ) : null}

      {showMaterialsEmpty ? (
        <section>
          <SectionHeading eyebrow="Materials" title="What you need today" />
          <Panel className="p-5">
            <EmptyState
              title="Nothing published yet"
              description="Materials for this day will appear here."
            />
          </Panel>
        </section>
      ) : null}
    </div>
  )

  const assessmentsColumn =
    dayAssessments.length > 0 ? (
      <aside className="min-w-0 lg:sticky lg:top-6">
        <SectionHeading
          eyebrow={day.day_number === 5 ? 'Exam' : 'Assessment'}
          title={day.day_number === 5 ? 'Final theory exam' : "Today's quiz"}
        />
        <AssessmentCards
          assessments={dayAssessments}
          attempts={attempts}
          questionCounts={questionCounts}
          studentView={studentView}
        />
      </aside>
    ) : null

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
        title={toTitleCaseEnglish(day.title)}
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-soft">
        {day.title_ar ? (
          <Arabic className="text-[15px] text-navy-800">{day.title_ar}</Arabic>
        ) : null}
        {when ? (
          <span className="flex items-center gap-1.5">
            <CalendarIcon width={14} height={14} />
            {when}
          </span>
        ) : null}
        {!day.is_published ? <Badge tone="amber">Draft</Badge> : null}
      </div>

      {day.summary ? (
        <section className="mb-10">
          <SectionHeading eyebrow="Summary" title="Focus for this day" />
          <Panel className="px-5 py-4 sm:px-6">
            <p className="text-[14px] leading-relaxed text-navy-800">
              {day.summary}
            </p>
          </Panel>
        </section>
      ) : null}

      {hasSidebar ? (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
          {materialsColumn}
          {assessmentsColumn}
        </div>
      ) : (
        materialsColumn
      )}
    </div>
  )
}
