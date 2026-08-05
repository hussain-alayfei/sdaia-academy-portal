import Link from 'next/link'

import { cx } from '@/components/ui'
import type {
  ActionNeededItem,
  NotificationFeedItem,
} from '@/lib/notification-types'

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

export function ActionNeededList({
  items,
  compact = false,
  onNavigate,
}: {
  items: ActionNeededItem[]
  compact?: boolean
  onNavigate?: () => void
}) {
  if (items.length === 0) {
    return (
      <p className="px-4 py-4 text-[13px] text-ink-faint sm:px-5">
        You’re caught up — no unfinished assessments.
      </p>
    )
  }

  return (
    <ul className={cx(!compact && 'divide-y divide-amber-100')}>
      {items.map((item) => (
        <li key={item.assessmentId}>
          <Link
            href={item.href}
            onClick={onNavigate}
            className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-amber-100/70 sm:px-5"
          >
            <span
              className={cx(
                'mt-1.5 size-2 shrink-0 rounded-full',
                item.urgency === 'missed' ? 'bg-danger-500' : 'bg-amber-500'
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-amber-900 uppercase">
                {item.urgency === 'missed'
                  ? 'Overdue assessment'
                  : 'Unfinished assessment'}
              </p>
              <p className="mt-0.5 text-[14px] font-semibold text-navy-900">
                {item.title}
              </p>
              <p className="mt-0.5 text-[12px] text-ink-soft">
                {item.dayNumber != null
                  ? `Day ${item.dayNumber} · ${item.courseTitle}`
                  : item.courseTitle}
              </p>
              <p className="mt-1.5 text-[12px] font-semibold text-teal-800">
                {item.cta === 'Continue'
                  ? 'Continue where you left off →'
                  : 'Start this assessment now →'}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function RecentActivityList({
  items,
  emptyLabel = 'No new activity yet.',
  onNavigate,
}: {
  items: NotificationFeedItem[]
  emptyLabel?: string
  onNavigate?: () => void
}) {
  if (items.length === 0) {
    return (
      <p className="px-4 py-4 text-[13px] text-ink-faint sm:px-5">{emptyLabel}</p>
    )
  }

  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            onClick={onNavigate}
            className={cx(
              'flex items-start gap-2.5 px-4 py-3 transition-colors hover:bg-navy-50/80 sm:px-5',
              item.unread && 'bg-teal-50/30'
            )}
          >
            <span
              className={cx(
                'mt-1.5 size-1.5 shrink-0 rounded-full',
                item.unread ? 'bg-teal-600' : 'bg-line-strong'
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-navy-900">
                {item.title}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-soft">
                {item.body}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-faint">
                {relativeTime(item.created_at)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
