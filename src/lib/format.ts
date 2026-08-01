import type { AssessmentKind, ResourceKind } from '@/lib/types'

/* Fixed locale + UTC so the server and client render identical strings and
   React never reports a hydration mismatch. */
const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const DATE_SHORT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

const WEEKDAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  timeZone: 'UTC',
})

export function formatDate(value: string | null | undefined) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : DATE.format(d)
}

export function formatWeekday(value: string | null | undefined) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : WEEKDAY.format(d)
}

export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined
) {
  if (!start) return null
  const s = new Date(start)
  if (Number.isNaN(s.getTime())) return null
  if (!end) return DATE.format(s)

  const e = new Date(end)
  if (Number.isNaN(e.getTime())) return DATE.format(s)

  return `${DATE_SHORT.format(s)} – ${DATE.format(e)}`
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return null
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** i
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}

export const RESOURCE_LABELS: Record<ResourceKind, string> = {
  slides: 'Slides',
  pdf: 'PDF',
  notebook: 'Notebook',
  lab: 'Lab',
  link: 'Link',
  dataset: 'Dataset',
  file: 'File',
}

export const ASSESSMENT_LABELS: Record<AssessmentKind, string> = {
  pre: 'Pre-assessment',
  post: 'Post-assessment',
  quiz: 'Final quiz',
}

/** Colab, Kaggle and friends open in a new tab; uploads download in place. */
export function isExternalNotebook(url: string | null | undefined) {
  if (!url) return false
  return /colab\.research\.google\.com|kaggle\.com|github\.com|deepnote\.com/i.test(
    url
  )
}

export function percent(score: number, max: number) {
  if (!max) return 0
  return Math.round((score / max) * 100)
}
