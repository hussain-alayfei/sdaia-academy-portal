'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

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

  // Schedule is the index route, so only an exact match counts; the others
  // also match their nested pages.
  const activeIndex = tabs.findIndex((tab) =>
    tab.href === base
      ? pathname === base || pathname.startsWith(`${base}/days/`)
      : pathname.startsWith(tab.href)
  )

  const navRef = useRef<HTMLElement>(null)
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(
    null
  )

  // Measured, not fixed-width, because "Assessments" and "Schedule" are not
  // the same number of pixels. Re-measured on resize so a narrower viewport
  // (or the tab bar wrapping) can't leave the bar pointing at a stale spot.
  useEffect(() => {
    function measure() {
      const active = navRef.current?.querySelector<HTMLElement>(
        '[aria-current="page"]'
      )
      setIndicator(
        active ? { left: active.offsetLeft, width: active.offsetWidth } : null
      )
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [activeIndex])

  return (
    <nav
      ref={navRef}
      className="scroll-x relative -mb-px flex gap-1 border-b border-line"
    >
      {tabs.map((tab, i) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={i === activeIndex ? 'page' : undefined}
          className={cx(
            'shrink-0 px-3 py-2.5 text-[13px] font-medium transition-colors',
            i === activeIndex
              ? 'text-teal-800'
              : 'text-ink-soft hover:text-navy-800'
          )}
        >
          {tab.label}
        </Link>
      ))}

      {indicator ? (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-teal-600 transition-[transform,width] duration-200 ease-out"
          style={{
            width: indicator.width,
            transform: `translateX(${indicator.left}px)`,
          }}
        />
      ) : null}
    </nav>
  )
}
