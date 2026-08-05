import type { ReactNode } from 'react'

/** Compact page intro for instructor and course surfaces. */
export function AdminSectionHeader({
  eyebrow,
  title,
  description,
  meta,
  action,
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  meta?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-0.5 text-[10px] font-semibold tracking-[0.14em] text-teal-700 uppercase">
            {eyebrow}
          </p>
        ) : null}
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <h2 className="text-[17px] font-semibold text-navy-900">{title}</h2>
          {meta ? (
            <span className="text-[12px] text-ink-faint">{meta}</span>
          ) : null}
        </div>
        {description ? (
          <p className="mt-0.5 max-w-xl text-[13px] leading-snug text-ink-soft">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}
