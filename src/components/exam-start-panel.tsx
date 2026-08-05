'use client'

import { useEffect, useState } from 'react'

import { beginAttempt } from '@/app/actions/quiz'
import { ExamLanguageToggle } from '@/components/exam-language-toggle'
import { Button } from '@/components/ui'
import {
  dirFor,
  readStoredLanguage,
  storeLanguage,
  type ExamLanguage,
} from '@/lib/exam-language'

/**
 * The briefing, and the choice of language to sit the exam in.
 *
 * The language control sits **above** the instructions rather than beside the
 * start button, because the instructions are the first thing a student has to
 * be able to read. Choosing here re-renders the briefing immediately, which is
 * also the honest preview of what the paper will look like.
 *
 * The choice is remembered in the browser and picked up again by the runner, so
 * pressing begin does not quietly drop it. It stays changeable during the exam.
 */
export function ExamStartPanel({
  assessmentId,
  instructions,
  instructionsAr,
  canStart,
  notReadyMessage,
}: {
  assessmentId: string
  instructions: string[]
  instructionsAr: string[]
  canStart: boolean
  notReadyMessage: string | null
}) {
  const bilingual = instructionsAr.length > 0
  const [language, setLanguage] = useState<ExamLanguage>('en')

  useEffect(() => {
    const stored = readStoredLanguage()
    if (stored) setLanguage(stored)
  }, [])

  const change = (next: ExamLanguage) => {
    setLanguage(next)
    storeLanguage(next)
  }

  const arabic = language === 'ar' && bilingual
  const points = arabic ? instructionsAr : instructions
  const heading = arabic ? 'اقرأ هذا قبل البدء' : 'Read this before you begin'
  const subheading = arabic
    ? 'هذه التعليمات تنطبق على الاختبار بأكمله.'
    : 'These rules apply for the whole exam.'

  return (
    <>
      {bilingual ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-navy-50/60 p-4">
          <div>
            <p className="text-[14px] font-semibold text-navy-900">
              Choose your exam language · اختر لغة الاختبار
            </p>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              You can change this at any time during the exam · يمكنك تغييرها في
              أي وقت أثناء الاختبار
            </p>
          </div>
          <ExamLanguageToggle value={language} onChange={change} />
        </div>
      ) : null}

      {points.length > 0 ? (
        <section
          aria-label="Exam instructions"
          dir={dirFor(arabic ? 'ar' : 'en')}
          lang={arabic ? 'ar' : 'en'}
          className="mt-4 rounded-md border-2 border-navy-900/20 bg-surface p-5 sm:p-7"
        >
          <h2 className="text-[20px] font-semibold text-navy-900 sm:text-[24px]">
            {heading}
          </h2>
          <p className="mt-1.5 text-[14px] text-ink-soft">{subheading}</p>

          <ol className="mt-5 space-y-3.5">
            {points.map((point, i) => (
              <li key={point} className="flex gap-3.5">
                <span
                  aria-hidden
                  className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-sm border border-navy-200 bg-navy-50 text-[13px] font-bold text-navy-800"
                >
                  {i + 1}
                </span>
                <span className="text-[15.5px] leading-relaxed text-ink sm:text-[16.5px]">
                  {point}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="mt-6">
        {canStart ? (
          <form action={beginAttempt}>
            <input type="hidden" name="assessment_id" value={assessmentId} />
            <Button type="submit">
              {arabic ? 'ابدأ الاختبار' : 'Begin the assessment'}
            </Button>
          </form>
        ) : (
          <p className="text-[14px] text-ink-soft">{notReadyMessage}</p>
        )}
      </div>
    </>
  )
}
