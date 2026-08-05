'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useTransition, type ReactNode } from 'react'

import { cx } from '@/components/ui'

/**
 * Course list link that prefetches immediately and navigates with a transition
 * so the row can show pending feedback while the course shell loads.
 */
export function CourseOpenLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    router.prefetch(href)
  }, [href, router])

  return (
    <Link
      href={href}
      prefetch
      aria-busy={pending || undefined}
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
        startTransition(() => {
          router.push(href)
        })
      }}
      className={cx(className, pending && 'opacity-60')}
    >
      {children}
    </Link>
  )
}
