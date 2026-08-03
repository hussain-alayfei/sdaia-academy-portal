'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { reportIntegrityEvent } from '@/app/actions/quiz'
import { AlertIcon } from '@/components/icons'
import { Button, cx } from '@/components/ui'

/**
 * Watches for the obvious ways of looking something up mid-quiz. Each question
 * gets its own server-owned count: the third event makes only that question
 * worth zero points, while the student continues the assessment.
 *
 * ## What this is and is not
 *
 * It is a deterrent. A browser can tell you the tab lost focus; it cannot tell
 * you why, and it knows nothing at all about the phone on the desk or the laptop
 * next to it. Anyone determined to cheat will, and disabling JavaScript removes
 * this entirely. What it does do is remove casual, opportunistic switching: the
 * student who would have glanced at another tab now knows the room is watching,
 * and the instructor sees the pattern afterwards either way.
 *
 * The measure that actually holds is the shuffled question order, which is
 * enforced server-side and makes copying from a neighbour useless.
 *
 * ## Why the count is not held here
 *
 * `record_integrity_event` increments a column on the attempt. If the tally lived
 * in React state, reloading the page would hand back a fresh set of chances,
 * which is exactly what someone might try after receiving a warning.
 */

const EVENT_DESCRIPTIONS: Record<string, string> = {
  tab_hidden: 'you switched to another tab or application',
  window_blur: 'this window lost focus',
  copy: 'you tried to copy the question text',
  paste: 'you tried to paste into an answer',
}

/**
 * One alt-tab fires `blur` and `visibilitychange` together, and returning fires
 * more. Anything inside this window counts once, so a single switch costs a
 * single warning rather than three.
 */
const DEBOUNCE_MS = 1500

export function IntegrityGuard({
  attemptId,
  questionId,
  questionNumber,
  active,
  onWarning,
}: {
  attemptId: string
  questionId: string
  questionNumber: number
  /** False once the attempt is over, so the result screen is not policed. */
  active: boolean
  onWarning?: (
    totalCount: number,
    questionCount: number,
    invalidated: boolean
  ) => void
}) {
  const [notice, setNotice] = useState<{
    kind: string
    questionCount: number
    invalidated: boolean
  } | null>(null)
  const lastEventAt = useRef(0)
  const inFlight = useRef(false)
  const paused = useRef(false)

  const record = useCallback(
    async (kind: string) => {
      if (!active || paused.current || inFlight.current) return

      const now = Date.now()
      if (now - lastEventAt.current < DEBOUNCE_MS) return
      lastEventAt.current = now

      inFlight.current = true
      try {
        const result = await reportIntegrityEvent({
          attemptId,
          questionId,
          kind,
        })
        if (result.message) return
        if (!result.active) return

        onWarning?.(
          result.warning_count,
          result.question_warning_count,
          result.question_invalidated
        )

        // Stop counting while the dialog is up: dismissing it moves focus, and
        // that would otherwise register as another offence.
        paused.current = true
        setNotice({
          kind,
          questionCount: result.question_warning_count,
          invalidated: result.question_invalidated,
        })
      } finally {
        inFlight.current = false
      }
    },
    [active, attemptId, onWarning, questionId]
  )

  useEffect(() => {
    if (!active) return

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void record('tab_hidden')
    }
    const onBlur = () => void record('window_blur')

    // Blocking these as well as logging them: the honest student gets a clear
    // signal that copying is not part of this, rather than silently building a
    // record against themselves.
    const onCopy = (event: Event) => {
      event.preventDefault()
      void record('copy')
    }
    const onPaste = (event: Event) => {
      event.preventDefault()
      void record('paste')
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    document.addEventListener('copy', onCopy)
    document.addEventListener('paste', onPaste)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('paste', onPaste)
    }
  }, [active, record])

  const dismiss = () => {
    setNotice(null)
    // Returning focus to the window fires another blur/visibility pair; hold the
    // debounce open across it.
    lastEventAt.current = Date.now()
    paused.current = false
  }

  if (!notice) return null

  const final = notice.invalidated
  const finalWarning = notice.questionCount === 2
  const reason = EVENT_DESCRIPTIONS[notice.kind] ?? 'something unexpected happened'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="integrity-title"
      className="fixed inset-0 z-50 grid place-items-center bg-navy-900/55 p-4 backdrop-blur-[2px]"
    >
      <div
        className={cx(
          'animate-pop w-full max-w-xl rounded-md border-2 bg-surface p-6 sm:p-8',
          final ? 'border-danger-500' : 'border-amber-400'
        )}
      >
        <div className="mb-3 flex items-center gap-2.5">
          <span
            className={
              final
                ? 'grid size-9 place-items-center rounded-sm bg-danger-50 text-danger-600'
                : 'grid size-9 place-items-center rounded-sm bg-amber-50 text-amber-700'
            }
          >
            <AlertIcon width={18} height={18} />
          </span>
          <h2
            id="integrity-title"
            className="text-[19px] font-semibold text-navy-900 sm:text-[21px]"
          >
            {final
              ? `Question ${questionNumber} is now worth zero points`
              : finalWarning
                ? `Final warning for question ${questionNumber}`
                : `Warning 1 of 3 for question ${questionNumber}`}
          </h2>
        </div>

        <p className="text-[15px] leading-relaxed text-ink">
          This attempt recorded that {reason}. Your instructor can see it.
        </p>

        <p className="mt-3 text-[15px] leading-relaxed text-ink">
          {final
            ? 'You may continue the assessment and answer every other question. This question cannot earn a point, even if its answer is correct.'
            : finalWarning
              ? 'One more recorded event while you are on this question will make this question worth zero points. Your assessment will not be submitted automatically.'
              : 'This warning applies only to this question. Three recorded events on the same question make that question worth zero points; the rest of your assessment continues normally.'}
        </p>

        <div className="mt-5">
          <Button onClick={dismiss} autoFocus>
            Back to the quiz
          </Button>
        </div>
      </div>
    </div>
  )
}
