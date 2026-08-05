import Link from 'next/link'
import type { ReactNode } from 'react'

import { cx } from '@/components/ui'

/**
 * Icon-first header control: label expands on hover / keyboard focus.
 */
export function HeaderExpandLink({
  href,
  label,
  icon,
  className,
  title,
}: {
  href: string
  label: string
  icon: ReactNode
  className?: string
  title?: string
}) {
  return (
    <Link
      href={href}
      prefetch
      title={title ?? label}
      aria-label={label}
      className={cx(
        'group inline-flex h-9 items-center rounded-sm px-2 text-navy-700 transition',
        'hover:bg-navy-50 hover:text-navy-950',
        'focus-visible:bg-navy-50 focus-visible:text-navy-950',
        className
      )}
    >
      <span className="grid size-[18px] shrink-0 place-items-center">{icon}</span>
      <span
        className={cx(
          'max-w-0 overflow-hidden whitespace-nowrap text-[13px] font-medium opacity-0 transition-all duration-500 ease-in-out',
          'group-hover:ms-1.5 group-hover:max-w-[9rem] group-hover:opacity-100',
          'group-focus-visible:ms-1.5 group-focus-visible:max-w-[9rem] group-focus-visible:opacity-100'
        )}
      >
        {label}
      </span>
    </Link>
  )
}
