import Image from 'next/image'
import Link from 'next/link'

import { logout } from '@/app/actions/auth'
import { LogoutIcon, UsersIcon } from '@/components/icons'
import { getProfile, isManager } from '@/lib/dal'

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

export async function SiteHeader() {
  const profile = await getProfile()
  const manager = isManager(profile)

  return (
    <header className="sticky top-0 z-30 border-b border-navy-800 bg-navy-900">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/home"
          className="flex shrink-0 items-center rounded-sm bg-white px-2.5 py-1.5"
          aria-label="SDAIA Academy Portal, home"
        >
          <Image
            src="/sdaia-academy.png"
            alt="SDAIA Academy"
            width={1046}
            height={166}
            priority
            className="h-6 w-auto sm:h-8"
          />
        </Link>

        <nav className="ms-auto flex items-center gap-2">
          {manager ? (
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-sm border border-teal-500 bg-teal-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-teal-700"
            >
              <UsersIcon width={15} height={15} />
              Instructor area
            </Link>
          ) : null}

          {profile ? (
            <>
              <span
                className="ms-1 grid size-8 shrink-0 place-items-center rounded-full bg-navy-700 text-[11px] font-semibold text-white"
                title={profile.full_name || profile.email}
              >
                {initials(profile.full_name || profile.email)}
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-[13px] font-medium text-navy-200 hover:bg-navy-800 hover:text-white"
                >
                  <LogoutIcon width={16} height={16} />
                  <span className="sr-only sm:not-sr-only">Sign out</span>
                </button>
              </form>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  )
}
