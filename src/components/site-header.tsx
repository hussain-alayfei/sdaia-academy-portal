import { Suspense } from 'react'

import { AccountMenu } from '@/components/account-menu'
import { BrandHomeLink } from '@/components/brand-home-link'
import { HeaderExpandLink } from '@/components/header-expand-link'
import { NotificationCenter } from '@/components/notifications/notification-center'
import { BellIcon, HomeIcon, UsersIcon } from '@/components/icons'
import { getProfile, isManager } from '@/lib/dal'

function BellPlaceholder() {
  return (
    <span
      aria-hidden
      className="inline-flex h-9 items-center gap-0 rounded-sm px-2 text-navy-700"
    >
      <BellIcon width={18} height={18} strokeWidth={1.7} />
    </span>
  )
}

export async function SiteHeader() {
  const profile = await getProfile()
  const manager = isManager(profile)
  // Instructors land on /admin; students on /home. Avoid /home → /admin
  // redirect which stacked two different loading UIs.
  const homeHref = manager ? '/admin' : '/home'

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="relative mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* English LTR: Home → Profile → Notifications → Instructor */}
        <nav aria-label="Account" className="flex min-w-0 items-center gap-2">
          {profile ? (
            <HeaderExpandLink
              href={homeHref}
              label="Home"
              title={manager ? 'Instructor home' : 'My courses'}
              icon={<HomeIcon width={18} height={18} strokeWidth={1.75} />}
            />
          ) : null}

          {profile ? (
            <AccountMenu
              fullName={profile.full_name || ''}
              email={profile.email}
            />
          ) : null}

          {profile ? (
            <Suspense fallback={<BellPlaceholder />}>
              <NotificationCenter />
            </Suspense>
          ) : null}

          {manager ? (
            <HeaderExpandLink
              href="/admin"
              label="Instructor"
              title="Instructor area"
              icon={<UsersIcon width={18} height={18} strokeWidth={1.75} />}
            />
          ) : null}
        </nav>

        <BrandHomeLink href={homeHref} />
      </div>
      <div
        aria-hidden
        className="h-[3px] w-full bg-[linear-gradient(90deg,var(--brand-cyan),var(--brand-indigo),var(--brand-orange),var(--brand-red),var(--brand-lime))]"
      />
    </header>
  )
}
