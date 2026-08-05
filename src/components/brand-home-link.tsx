'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { cx } from '@/components/ui'

/**
 * Brand mark that prefetches its destination so a revisit feels instant,
 * matching the instructor course-tab warm cache behaviour.
 */
export function BrandHomeLink({
  href,
  className,
}: {
  href: string
  className?: string
}) {
  const router = useRouter()

  useEffect(() => {
    router.prefetch(href)
  }, [href, router])

  return (
    <Link
      href={href}
      prefetch
      className={cx('flex shrink-0 items-center', className)}
      aria-label="SDAIA Academy Portal, home"
    >
      <Image
        src="/sdaia-academy-logo.jpg"
        alt="SDAIA Academy"
        width={900}
        height={280}
        priority
        className="h-9 w-auto sm:h-11"
      />
    </Link>
  )
}
