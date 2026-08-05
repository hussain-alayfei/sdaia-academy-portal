import { NotificationBell } from '@/components/notifications/notification-bell'
import { getStudentNotifications } from '@/lib/notifications'

/** Server wrapper so the header can stay mostly static while feed loads per user. */
export async function NotificationCenter() {
  const data = await getStudentNotifications()

  return (
    <NotificationBell
      actionNeeded={data.actionNeeded}
      recent={data.recent}
      badgeCount={data.badgeCount}
    />
  )
}
