'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cx } from '@/components/ui'

export function CourseTabs({ courseId }: { courseId: string }) {
  const pathname = usePathname()
  const base = `/admin/courses/${courseId}`

  const tabs = [
    { href: base, label: 'Schedule' },
    { href: `${base}/assessments`, label: 'Assessments' },
    { href: `${base}/students`, label: 'Students' },
    { href: `${base}/settings`, label: 'Settings' },
  ]

  return (
    <nav className="scroll-x -mb-px flex gap-1 border-b border-line">
      {tabs.map((tab) => {
        // Schedule is the index route, so only an exact match counts; the
        // others also match their nested pages.
        const active =
          tab.href === base
            ? pathname === base || pathname.startsWith(`${base}/days/`)
            : pathname.startsWith(tab.href)

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'shrink-0 border-b-2 px-3 py-2.5 text-[13px] font-medium',
              active
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-ink-soft hover:border-line-strong hover:text-navy-800'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
