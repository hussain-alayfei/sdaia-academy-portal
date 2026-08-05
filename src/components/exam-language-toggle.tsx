'use client'

import { cx } from '@/components/ui'
import {
  EXAM_LANGUAGES,
  LANGUAGE_LABELS,
  type ExamLanguage,
} from '@/lib/exam-language'

/**
 * English / العربية.
 *
 * A segmented control rather than a dropdown: both options are visible at once,
 * so a student who cannot read the current language can still see the other one
 * and reach it in a single press. A dropdown labelled only in the language you
 * cannot read is a trap.
 *
 * Each label is written in its own language and never translated — "العربية"
 * looks like Arabic to someone who needs Arabic, whatever the interface is
 * currently set to.
 *
 * Deliberately never disabled during an attempt. Switching is free: answers are
 * stored by option id, so reading a question in one language and answering in
 * the other records exactly the same thing.
 */
export function ExamLanguageToggle({
  value,
  onChange,
  size = 'md',
  label,
}: {
  value: ExamLanguage
  onChange: (next: ExamLanguage) => void
  size?: 'sm' | 'md'
  label?: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      {label ? (
        <span className="text-[13px] font-medium text-ink-soft">{label}</span>
      ) : null}

      <div
        role="group"
        aria-label="Exam language"
        // Always laid out left-to-right so the two buttons do not swap places
        // when the language changes. A control that moves when you press it is
        // disorienting, especially mid-exam.
        dir="ltr"
        className="inline-flex rounded-sm border border-line-strong bg-surface p-0.5"
      >
        {EXAM_LANGUAGES.map((language) => {
          const active = language === value

          return (
            <button
              key={language}
              type="button"
              onClick={() => onChange(language)}
              aria-pressed={active}
              lang={language}
              className={cx(
                'rounded-xs font-medium transition-colors',
                size === 'sm'
                  ? 'px-2.5 py-1 text-[13px]'
                  : 'px-3.5 py-1.5 text-[14px]',
                active
                  ? 'bg-navy-900 text-white'
                  : 'text-ink-soft hover:bg-navy-50 hover:text-navy-900'
              )}
            >
              {LANGUAGE_LABELS[language]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
