'use client'

import { useEffect, useRef, useState, useTransition } from 'react'

import { markNotificationsRead } from '@/app/actions/notifications'
import { BellIcon } from '@/components/icons'
import {
  ActionNeededList,
  RecentActivityList,
} from '@/components/notifications/notification-list'
import { ButtonLink, cx } from '@/components/ui'
import type {
  ActionNeededItem,
  NotificationFeedItem,
} from '@/lib/notification-types'

const FADE_MS = 200

export function NotificationBell({
  actionNeeded,
  recent,
  badgeCount,
}: {
  actionNeeded: ActionNeededItem[]
  recent: NotificationFeedItem[]
  badgeCount: number
}) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [, startTransition] = useTransition()
  const closeRef = useRef<HTMLButtonElement>(null)
  const markedRef = useRef(false)
  const hasAction = actionNeeded.length > 0

  function openPanel() {
    setMounted(true)
    // Next frame so CSS transitions run from the closed state.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true))
    })
  }

  function closePanel() {
    setVisible(false)
    window.setTimeout(() => setMounted(false), FADE_MS)
  }

  useEffect(() => {
    if (!mounted) return

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closePanel()
    }

    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    if (visible) closeRef.current?.focus()

    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closePanel is stable enough for this effect
  }, [mounted, visible])

  useEffect(() => {
    if (!visible || markedRef.current) return
    const unreadIds = recent.filter((e) => e.unread).map((e) => e.id)
    if (unreadIds.length === 0) return
    markedRef.current = true
    startTransition(() => {
      void markNotificationsRead(unreadIds)
    })
  }, [visible, recent])

  const badgeLabel =
    badgeCount > 9 ? '9+' : badgeCount > 0 ? String(badgeCount) : null

  return (
    <>
      <button
        type="button"
        aria-label={
          hasAction
            ? `Notifications, ${actionNeeded.length} unfinished assessment${actionNeeded.length === 1 ? '' : 's'}`
            : badgeCount > 0
              ? `Notifications, ${badgeCount} needing attention`
              : 'Notifications'
        }
        aria-expanded={visible}
        aria-haspopup="dialog"
        onClick={() => (mounted ? closePanel() : openPanel())}
        className={cx(
          'group relative inline-flex h-9 items-center rounded-sm px-2 transition',
          hasAction
            ? 'bg-amber-500 text-navy-950 shadow-[0_0_0_3px_rgba(245,158,11,0.35)] hover:bg-amber-400'
            : 'text-navy-700 hover:bg-navy-50 hover:text-navy-950',
          visible && !hasAction && 'bg-navy-50 text-navy-950',
          hasAction && 'animate-[pulse_2.4s_ease-in-out_infinite]'
        )}
      >
        <span className="relative grid size-[18px] shrink-0 place-items-center">
          <BellIcon width={18} height={18} strokeWidth={1.7} />
          {badgeLabel ? (
            <span
              className={cx(
                'absolute -end-2 -top-2 grid min-w-[1.15rem] place-items-center rounded-full px-1 text-[9px] font-bold leading-none text-white ring-2',
                hasAction ? 'bg-danger-500 ring-amber-500' : 'bg-teal-500 ring-surface'
              )}
            >
              {badgeLabel}
            </span>
          ) : null}
        </span>
        <span
          className={cx(
            'max-w-0 overflow-hidden whitespace-nowrap text-[13px] font-medium opacity-0 transition-all duration-500 ease-in-out',
            'group-hover:ms-1.5 group-hover:max-w-[8rem] group-hover:opacity-100',
            'group-focus-visible:ms-1.5 group-focus-visible:max-w-[8rem] group-focus-visible:opacity-100',
            visible && 'ms-1.5 max-w-[8rem] opacity-100'
          )}
        >
          Notifications
        </span>
      </button>

      {mounted ? (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label="Close notifications"
            className={cx(
              'absolute inset-0 bg-navy-950/45 backdrop-blur-[1px] transition-opacity duration-200 ease-out',
              visible ? 'opacity-100' : 'opacity-0'
            )}
            onClick={closePanel}
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
            className={cx(
              'absolute inset-y-0 end-0 flex w-full max-w-md flex-col border-s border-line bg-surface shadow-2xl',
              'transition-[opacity,transform] duration-200 ease-out',
              visible
                ? 'translate-x-0 opacity-100'
                : 'translate-x-4 opacity-0'
            )}
          >
            <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-navy-900">
                  Notifications
                </p>
                <p className="mt-0.5 text-[12px] text-ink-soft">
                  {hasAction
                    ? `${actionNeeded.length} unfinished assessment${actionNeeded.length === 1 ? '' : 's'} waiting for you`
                    : 'Updates from your courses'}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={closePanel}
                className="rounded-sm px-2 py-1 text-[12px] font-medium text-ink-soft hover:bg-navy-50 hover:text-navy-900"
              >
                Close
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <section
                className={cx(
                  'border-b border-line',
                  hasAction ? 'bg-amber-50' : 'bg-navy-50/40'
                )}
              >
                <div className="px-4 pt-3.5 sm:px-5">
                  <p
                    className={cx(
                      'text-[10px] font-semibold tracking-[0.12em] uppercase',
                      hasAction ? 'text-amber-900' : 'text-ink-faint'
                    )}
                  >
                    Unfinished assessments
                    {hasAction ? ` · ${actionNeeded.length}` : ''}
                  </p>
                  {hasAction ? (
                    <p className="mt-1 text-[12px] leading-snug text-amber-950/80">
                      Open one below and finish it. These stay here until you
                      submit.
                    </p>
                  ) : null}
                </div>
                <ActionNeededList
                  items={actionNeeded}
                  compact
                  onNavigate={closePanel}
                />
              </section>

              <section>
                <p className="px-4 pt-3.5 text-[10px] font-semibold tracking-[0.12em] text-ink-faint uppercase sm:px-5">
                  Recent activity
                </p>
                <RecentActivityList
                  items={recent.slice(0, 12)}
                  onNavigate={closePanel}
                />
              </section>
            </div>

            <footer className="border-t border-line bg-navy-50/50 px-4 py-3 sm:px-5">
              <ButtonLink
                href="/notifications"
                variant="secondary"
                size="sm"
                className="w-full justify-center"
                onClick={closePanel}
              >
                Open full notifications page
              </ButtonLink>
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  )
}
