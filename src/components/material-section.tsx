import type { CSSProperties, ReactNode } from 'react'

import { Badge } from '@/components/ui'

/**
 * Colourful category for student day materials.
 * Always expanded — students should see every item without toggling.
 */
export function MaterialSection({
  title,
  description,
  count,
  accent,
  soft,
  children,
}: {
  title: string
  description?: string
  count?: number
  accent: string
  soft: string
  /** Kept for call-site compatibility; sections are always open. */
  defaultOpen?: boolean
  /** @deprecated Ignored — sections stay text-only. */
  kind?: unknown
  children: ReactNode
}) {
  return (
    <section
      className="overflow-hidden rounded-md border border-line-strong bg-surface"
      style={{ borderTopColor: accent, borderTopWidth: 3 } as CSSProperties}
    >
      <header
        className="flex w-full items-start justify-between gap-3 border-b border-line px-4 py-3 text-left sm:px-5"
        style={{ backgroundColor: soft }}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h3
              className="text-[13px] font-semibold tracking-[0.12em] uppercase"
              style={{ color: accent }}
            >
              {title}
            </h3>
            {typeof count === 'number' ? (
              <Badge tone="neutral">
                {count} item{count === 1 ? '' : 's'}
              </Badge>
            ) : null}
          </div>
          {description ? (
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
              {description}
            </p>
          ) : null}
        </div>
      </header>
      <div className="bg-surface">{children}</div>
    </section>
  )
}
