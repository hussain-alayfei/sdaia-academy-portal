import type { NotificationEvent } from '@/lib/types'

export type NotificationFeedItem = NotificationEvent & {
  unread: boolean
}

export type ActionNeededItem = {
  assessmentId: string
  courseId: string
  courseTitle: string
  courseSlug: string
  dayId: string | null
  dayNumber: number | null
  title: string
  href: string
  cta: 'Start' | 'Continue'
  urgency: 'open' | 'missed'
}

export type StudentNotifications = {
  actionNeeded: ActionNeededItem[]
  recent: NotificationFeedItem[]
  actionNeededCount: number
  unreadEventCount: number
  badgeCount: number
}
