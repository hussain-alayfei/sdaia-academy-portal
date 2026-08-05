'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { cx } from '@/components/ui'

export function CourseTabs({ courseId }: { courseId: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const base = `/admin/courses/${courseId}`

  const tabs = [
    {
      href: base,
      label: 'Days',
      hint: 'Materials and publish each day',
    },
    {
      href: `${base}/assessments`,
      label: 'Assessments',
      hint: 'Questions, publish, and unlock',
    },
    {
      href: `${base}/students`,
      label: 'Students',
      hint: 'Scores and student detail',
    },
    {
      href: `${base}/settings`,
      label: 'Settings',
      hint: 'Name, dates, instructor, and visibility',
    },
  ]

  const activeIndex = tabs.findIndex((tab) =>
    tab.href === base
      ? pathname === base || pathname.startsWith(`${base}/days/`)
      : pathname.startsWith(tab.href)
  )

  const navRef = useRef<HTMLElement>(null)
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(
    null
  )
  const [optimisticIndex, setOptimisticIndex] = useState(activeIndex)

  useEffect(() => {
    setOptimisticIndex(activeIndex)
  }, [activeIndex])

  useEffect(() => {
    function measure() {
      const active = navRef.current?.querySelector<HTMLElement>(
        '[data-tab-active="true"]'
      )
      setIndicator(
        active ? { left: active.offsetLeft, width: active.offsetWidth } : null
      )
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [optimisticIndex])

  // Warm the RSC payloads so the first click is already cached.
  useEffect(() => {
    for (const tab of tabs) {
      router.prefetch(tab.href)
    }
    // tabs is stable for a given courseId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, router])

  return (
    <nav
      ref={navRef}
      aria-label="Course sections"
      aria-busy={pending || undefined}
      className={cx(
        'scroll-x relative -mb-px flex gap-0.5 border-b border-line',
        pending && 'opacity-80'
      )}
    >
      {tabs.map((tab, i) => {
        const isActive = i === optimisticIndex
        return (
          <Link
            key={tab.href}
            href={tab.href}
            title={tab.hint}
            prefetch
            data-tab-active={isActive ? 'true' : undefined}
            aria-current={i === activeIndex ? 'page' : undefined}
            onClick={(event) => {
              if (
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey ||
                event.button !== 0
              ) {
                return
              }
              event.preventDefault()
              setOptimisticIndex(i)
              startTransition(() => {
                router.push(tab.href)
              })
            }}
            className={cx(
              'shrink-0 px-3.5 py-2 text-[13px] font-medium transition-colors',
              isActive
                ? 'text-teal-800'
                : 'text-ink-soft hover:text-navy-800'
            )}
          >
            {tab.label}
          </Link>
        )
      })}

      {indicator ? (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-teal-600 transition-[transform,width] duration-150 ease-out"
          style={{
            width: indicator.width,
            transform: `translateX(${indicator.left}px)`,
          }}
        />
      ) : null}
    </nav>
  )
}
