import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CalendarIcon } from '@/components/icons'
import { ResourceList } from '@/components/resource-list'
import {
  Arabic,
  BackLink,
  Badge,
  PageHeader,
  Panel,
  PanelHeader,
} from '@/components/ui'
import { getCourseBySlug, requireProfile } from '@/lib/dal'
import { RESOURCE_LABELS, formatDate, formatWeekday } from '@/lib/format'
import { getDayByNumber, getResourcesForDay } from '@/lib/queries'
import type { Resource, ResourceKind } from '@/lib/types'

/* Group order controls how sections stack on the page. */
const GROUP_ORDER: ResourceKind[] = [
  'slides',
  'pdf',
  'notebook',
  'lab',
  'dataset',
  'link',
  'file',
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
}: {
  params: Promise<{ slug: string; dayNumber: string }>
}) {
  await requireProfile()
  const { slug, dayNumber } = await params

  const parsed = Number(dayNumber)
  if (!Number.isInteger(parsed) || parsed < 1) notFound()

  const course = await getCourseBySlug(slug)
  if (!course) notFound()

  const day = await getDayByNumber(course.id, parsed)
  if (!day) notFound()

  const resources = await getResourcesForDay(day.id)

  // Bucket by kind, preserving GROUP_ORDER, so slides always lead and loose
  // files trail.
  const groups = GROUP_ORDER.map((kind) => ({
    kind,
    items: resources.filter((r: Resource) => r.kind === kind),
  })).filter((g) => g.items.length > 0)

  const weekday = formatWeekday(day.scheduled_date)
  const date = formatDate(day.scheduled_date)

  return (
    <>
      <div className="mb-5">
        <BackLink href={`/c/${course.slug}`}>{course.title}</BackLink>
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

      {groups.length === 0 ? (
        <Panel>
          <PanelHeader title="Materials" />
          <ResourceList resources={[]} />
        </Panel>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <Panel key={group.kind}>
              <PanelHeader
                title={RESOURCE_LABELS[group.kind]}
                description={
                  group.kind === 'notebook' || group.kind === 'lab'
                    ? 'Opens in Google Colab in a new tab.'
                    : undefined
                }
              />
              <ResourceList resources={group.items} />
            </Panel>
          ))}
        </div>
      )}
    </>
  )
}
