'use client'

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react'

import { cx } from '@/components/ui'

type TabDef = { id: string; label: string; hint?: string }

const TabJumpContext = createContext<(id: string) => void>(() => {})

export function useLocalTabJump() {
  return useContext(TabJumpContext)
}

export function LocalTabJump({
  tab,
  children,
  className,
}: {
  tab: string
  children: ReactNode
  className?: string
}) {
  const setTab = useLocalTabJump()
  return (
    <button
      type="button"
      onClick={() => setTab(tab)}
      className={
        className ?? 'font-medium text-teal-800 underline hover:text-teal-900'
      }
    >
      {children}
    </button>
  )
}

/**
 * Instant in-page tabs. All panels render once; only visibility toggles.
 * Use for Access / Materials / Danger style chunking — not for real routes.
 */
export function LocalTabs({
  tabs,
  initialTab,
  panels,
  ariaLabel = 'Sections',
}: {
  tabs: TabDef[]
  initialTab: string
  panels: Record<string, ReactNode>
  ariaLabel?: string
}) {
  const fallback = tabs[0]?.id ?? initialTab
  const start = tabs.some((t) => t.id === initialTab) ? initialTab : fallback
  const [tab, setTab] = useState(start)

  return (
    <TabJumpContext.Provider value={setTab}>
      <div className="space-y-5">
        <nav
          aria-label={ariaLabel}
          className="scroll-x relative -mb-px flex gap-1 border-b border-line"
        >
          {tabs.map((item) => {
            const isActive = item.id === tab
            return (
              <button
                key={item.id}
                type="button"
                title={item.hint}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setTab(item.id)}
                className={cx(
                  'shrink-0 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors',
                  isActive
                    ? 'border-teal-600 text-teal-800'
                    : 'border-transparent text-ink-soft hover:text-navy-800'
                )}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="pt-1">
          {tabs.map((item) => (
            <div key={item.id} hidden={tab !== item.id}>
              {panels[item.id]}
            </div>
          ))}
        </div>
      </div>
    </TabJumpContext.Provider>
  )
}
