'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

import { LocalTabs } from '@/components/admin/local-tabs'
import { ButtonLink, EmptyState, Panel } from '@/components/ui'
import { toTitleCaseEnglish } from '@/lib/format'

type DayTab = {
  id: string
  label: string
  count: number
  panel: ReactNode
}

/**
 * One day at a time so Assessments is not a wall of Day 1–5 lists.
 */
export function AssessmentsByDay({
  days,
  stranded,
  addForm,
}: {
  days: DayTab[]
  stranded: ReactNode | null
  addForm: ReactNode | null
}) {
  if (days.length === 0) {
    return (
      <EmptyState
        title="Add the days first"
        description="Create the schedule on the Days tab, then come back here."
      />
    )
  }

  const initial =
    days.find((d) => d.count > 0)?.id ?? days[0]?.id ?? 'day'

  const tabs = days.map((day) => ({
    id: day.id,
    label: day.label,
    hint: `Assessments on ${day.label}`,
  }))

  const panels = Object.fromEntries(days.map((day) => [day.id, day.panel]))

  return (
    <div className="space-y-5">
      {stranded}

      <LocalTabs
        ariaLabel="Assessments by day"
        initialTab={initial}
        tabs={tabs}
        panels={panels}
      />

      {addForm}
    </div>
  )
}

export function AssessmentDayPanel({
  courseId,
  dayId,
  dayTitle,
  children,
  empty,
}: {
  courseId: string
  dayId: string
  dayTitle: string
  children: ReactNode
  empty: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-navy-900">
          {toTitleCaseEnglish(dayTitle)}
        </h3>
        <ButtonLink
          href={`/admin/courses/${courseId}/days/${dayId}`}
          variant="secondary"
          size="sm"
        >
          Day materials
        </ButtonLink>
      </div>

      {empty ? (
        <Panel className="px-4 py-6 sm:px-5">
          <p className="text-[13px] text-ink-soft">
            No assessments on this day yet.{' '}
            <Link
              href={`/admin/courses/${courseId}/days/${dayId}`}
              className="font-medium text-teal-800 underline"
            >
              Open day materials
            </Link>{' '}
            or add one below.
          </p>
        </Panel>
      ) : (
        <ul className="overflow-hidden rounded-md border border-line-strong bg-surface divide-y divide-line">
          {children}
        </ul>
      )}
    </div>
  )
}
