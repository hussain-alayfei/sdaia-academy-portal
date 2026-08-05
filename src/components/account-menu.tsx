'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

import { logout } from '@/app/actions/auth'
import { LogoutIcon } from '@/components/icons'
import { cx } from '@/components/ui'

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

/**
 * Avatar opens a preview menu — Edit info and Sign out live here,
 * not as direct header jumps.
 */
export function AccountMenu({
  fullName,
  email,
}: {
  fullName: string
  email: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const displayName = fullName.trim() || email
  const mark = initials(fullName || email)

  useEffect(() => {
    if (!open) return

    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        title="Account"
        aria-label={`Account, ${displayName}`}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          'group inline-flex h-9 items-center rounded-sm bg-navy-50 px-2 text-navy-800 transition',
          'hover:bg-navy-100 focus-visible:bg-navy-100',
          open && 'bg-navy-100'
        )}
      >
        <span className="grid size-5 place-items-center text-[11px] font-semibold leading-none">
          {mark}
        </span>
        <span
          className={cx(
            'max-w-0 overflow-hidden whitespace-nowrap text-[13px] font-medium opacity-0 transition-all duration-500 ease-in-out',
            'group-hover:ms-1.5 group-hover:max-w-[5rem] group-hover:opacity-100',
            'group-focus-visible:ms-1.5 group-focus-visible:max-w-[5rem] group-focus-visible:opacity-100',
            open && 'ms-1.5 max-w-[5rem] opacity-100'
          )}
        >
          Profile
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Account menu"
          className="absolute start-0 top-[calc(100%+6px)] z-40 w-64 overflow-hidden rounded-md border border-line-strong bg-surface shadow-sm"
        >
          <div className="border-b border-line px-3.5 py-3">
            <p className="truncate text-[14px] font-semibold text-navy-900">
              {displayName}
            </p>
            {fullName.trim() ? (
              <p className="mt-0.5 truncate text-[12px] text-ink-soft">{email}</p>
            ) : null}
          </div>

          <div className="p-1.5">
            <Link
              href="/profile"
              role="menuitem"
              prefetch
              onClick={() => setOpen(false)}
              className="flex w-full items-center rounded-sm px-2.5 py-2 text-[13px] font-medium text-navy-800 hover:bg-navy-50"
            >
              Edit info
            </Link>
            <form action={logout}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-[13px] font-medium text-navy-800 hover:bg-navy-50"
              >
                <LogoutIcon width={16} height={16} strokeWidth={1.7} />
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
