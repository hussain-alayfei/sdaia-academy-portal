import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

import { AlertIcon, ArrowLeftIcon, ChevronRightIcon } from '@/components/icons'

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

/* --------------------------------------------------------------- Button -- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-teal-600 text-white border-teal-600 hover:bg-teal-700 hover:border-teal-700 disabled:bg-teal-600/50 disabled:border-transparent',
  secondary:
    'bg-surface text-navy-800 border-line-strong hover:bg-navy-50 disabled:text-ink-faint',
  ghost:
    'bg-transparent text-navy-700 border-transparent hover:bg-navy-100/70 disabled:text-ink-faint',
  danger:
    'bg-danger-500 text-white border-danger-500 hover:bg-danger-600 hover:border-danger-600',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
}

function buttonClass(variant: Variant, size: Size, className?: string) {
  return cx(
    'inline-flex items-center justify-center rounded-sm border font-medium',
    'transition-colors duration-100 disabled:cursor-not-allowed',
    VARIANTS[variant],
    SIZES[size],
    className
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />
}

/* ---------------------------------------------------------------- Panel -- */

export function Panel({
  className,
  ...props
}: ComponentProps<'section'>) {
  return (
    <section
      className={cx(
        'rounded-md border border-line bg-surface',
        className
      )}
      {...props}
    />
  )
}

export function PanelHeader({
  title,
  description,
  action,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-navy-900">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[13px] text-ink-soft">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/* ---------------------------------------------------------------- Badge -- */

type Tone = 'neutral' | 'teal' | 'amber' | 'navy' | 'danger'

const TONES: Record<Tone, string> = {
  neutral: 'bg-navy-50 text-ink-soft border-line',
  teal: 'bg-teal-50 text-teal-800 border-teal-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  navy: 'bg-navy-800 text-white border-navy-800',
  danger: 'bg-danger-50 text-danger-600 border-danger-500/30',
}

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: ComponentProps<'span'> & { tone?: Tone }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-xs border px-1.5 py-0.5',
        'text-[11px] font-medium tracking-wide uppercase',
        TONES[tone],
        className
      )}
      {...props}
    />
  )
}

/* ---------------------------------------------------------------- Field -- */

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  error?: string[] | string
  htmlFor: string
  children: ReactNode
}) {
  const messages = Array.isArray(error) ? error : error ? [error] : []
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-[13px] font-medium text-navy-800"
      >
        {label}
      </label>
      {children}
      {hint && messages.length === 0 ? (
        <p className="text-[12px] text-ink-faint">{hint}</p>
      ) : null}
      {messages.map((m) => (
        <p key={m} className="text-[12px] text-danger-600">
          {m}
        </p>
      ))}
    </div>
  )
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cx(
        'block w-full rounded-sm border border-line-strong bg-surface px-3 py-2',
        'text-sm text-ink placeholder:text-ink-faint',
        'focus:border-teal-600 focus:outline-none',
        'disabled:bg-navy-50 disabled:text-ink-faint',
        'aria-[invalid=true]:border-danger-500',
        className
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cx(
        'block w-full rounded-sm border border-line-strong bg-surface px-3 py-2',
        'text-sm text-ink placeholder:text-ink-faint',
        'focus:border-teal-600 focus:outline-none',
        className
      )}
      {...props}
    />
  )
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cx(
        'block w-full rounded-sm border border-line-strong bg-surface px-3 py-2',
        'text-sm text-ink focus:border-teal-600 focus:outline-none',
        className
      )}
      {...props}
    />
  )
}

/* ---------------------------------------------------------------- Alert -- */

export function Alert({
  tone = 'danger',
  title,
  className,
  children,
}: {
  tone?: 'danger' | 'amber' | 'teal'
  title?: string
  className?: string
  children: ReactNode
}) {
  const styles = {
    danger: 'border-danger-500/30 bg-danger-50 text-danger-600',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    teal: 'border-teal-200 bg-teal-50 text-teal-800',
  }[tone]

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx(
        'flex gap-2.5 rounded-sm border px-3 py-2.5 text-[13px]',
        styles,
        className
      )}
    >
      <AlertIcon className="mt-px shrink-0" width={16} height={16} />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={title ? 'mt-0.5' : undefined}>{children}</div>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- EmptyState -- */

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-sm font-medium text-navy-800">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-soft">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------ PageTitle -- */

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[12px] font-medium tracking-wide text-teal-700 uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[22px] font-semibold text-navy-900 sm:text-[26px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}

/* ------------------------------------------------------------ navigation -- */

/**
 * The "go here" affordance on a clickable row. A filled circle rather than a
 * bare chevron, so it reads as a control at a glance instead of decoration.
 * Put it inside a group-hover parent.
 */
export function RowArrow({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        'grid size-8 shrink-0 place-items-center rounded-full border',
        'border-line-strong bg-navy-50 text-navy-600',
        'transition-colors group-hover:border-teal-600 group-hover:bg-teal-600 group-hover:text-white',
        className
      )}
    >
      <ChevronRightIcon width={17} height={17} />
    </span>
  )
}

/** Back link styled as a real button so it is obviously tappable. */
export function BackLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={cx(
        'inline-flex items-center gap-2 rounded-sm border border-line-strong',
        'bg-surface px-3 py-1.5 text-[13px] font-medium text-navy-800',
        'transition-colors hover:border-teal-600 hover:text-teal-800'
      )}
    >
      <ArrowLeftIcon width={16} height={16} />
      {children}
    </Link>
  )
}

/** Renders Arabic text with the right face and direction inside an LTR page. */
export function Arabic({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span lang="ar" dir="rtl" className={cx('font-arabic', className)}>
      {children}
    </span>
  )
}
