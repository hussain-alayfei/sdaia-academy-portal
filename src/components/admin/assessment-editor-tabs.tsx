'use client'

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react'

import { cx } from '@/components/ui'

export type AssessmentEditorTab = 'access' | 'questions' | 'danger'

const TABS: { id: AssessmentEditorTab; label: string; hint: string }[] = [
  { id: 'access', label: 'Access', hint: 'Title, timing, publish and unlock' },
  {
    id: 'questions',
    label: 'Questions',
    hint: 'Import or edit the question bank',
  },
  {
    id: 'danger',
    label: 'Danger',
    hint: 'Reset attempts or delete this paper',
  },
]

const TabContext = createContext<(tab: AssessmentEditorTab) => void>(() => {})

export function useAssessmentEditorTab() {
  return useContext(TabContext)
}

/** Inline control to jump tabs without a server navigation. */
export function AssessmentTabJump({
  tab,
  children,
  className,
}: {
  tab: AssessmentEditorTab
  children: ReactNode
  className?: string
}) {
  const setTab = useAssessmentEditorTab()
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
 * Client-side tabs so switching Access / Questions / Danger does not wait
 * for a server round-trip. All panels ship in the first RSC payload; we only
 * toggle visibility.
 */
export function AssessmentEditorShell({
  initialTab,
  questionCount,
  expectedCount,
  access,
  questions,
  danger,
}: {
  initialTab: AssessmentEditorTab
  questionCount: number
  expectedCount: number
  access: ReactNode
  questions: ReactNode
  danger: ReactNode
}) {
  const [tab, setTab] = useState<AssessmentEditorTab>(initialTab)

  return (
    <TabContext.Provider value={setTab}>
      <div className="space-y-5">
        <nav
          aria-label="Assessment sections"
          className="scroll-x relative -mb-px flex gap-1 border-b border-line"
        >
          {TABS.map((item) => {
            const isActive = item.id === tab
            const label =
              item.id === 'questions'
                ? `Questions (${questionCount}/${expectedCount})`
                : item.label

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
                {label}
              </button>
            )
          })}
        </nav>

        <div className="pt-1">
          <div hidden={tab !== 'access'}>{access}</div>
          <div hidden={tab !== 'questions'}>{questions}</div>
          <div hidden={tab !== 'danger'}>{danger}</div>
        </div>
      </div>
    </TabContext.Provider>
  )
}
