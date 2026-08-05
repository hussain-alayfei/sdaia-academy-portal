import { AdminSectionHeader } from '@/components/admin/section-header'
import {
  ActionNeededList,
  RecentActivityList,
} from '@/components/notifications/notification-list'
import { BackLink, Panel } from '@/components/ui'
import { isManager, requireProfile } from '@/lib/dal'
import { getStudentNotifications } from '@/lib/notifications'

export default async function NotificationsPage() {
  const profile = await requireProfile()
  const data = await getStudentNotifications()
  const manager = isManager(profile)
  const backHref = manager ? '/admin' : '/home'
  const backLabel = manager ? 'Instructor home' : 'My courses'

  return (
    <div className="space-y-5">
      <BackLink href={backHref}>{backLabel}</BackLink>

      <AdminSectionHeader
        title="Notifications"
        meta={
          data.badgeCount > 0
            ? `${data.actionNeededCount} action needed · ${data.unreadEventCount} unread`
            : 'All clear'
        }
        description="Unfinished assessments stay until you submit. Recent activity is what changed in your courses."
      />

      <Panel className="overflow-hidden">
        <div className="border-b border-line bg-amber-50/60 px-4 py-2.5 sm:px-5">
          <h3 className="text-[13px] font-semibold text-amber-900">
            Unfinished assessments
          </h3>
          <p className="text-[12px] text-amber-800/80">
            Open and submit these. They stay listed until you finish.
          </p>
        </div>
        <ActionNeededList items={data.actionNeeded} />
      </Panel>

      <Panel className="overflow-hidden">
        <div className="border-b border-line px-4 py-2.5 sm:px-5">
          <h3 className="text-[13px] font-semibold text-navy-900">Recent</h3>
          <p className="text-[12px] text-ink-soft">
            Course and assessment activity from the last few days.
          </p>
        </div>
        <RecentActivityList items={data.recent} />
      </Panel>
    </div>
  )
}
