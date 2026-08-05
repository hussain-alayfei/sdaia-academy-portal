'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { reportIntegrityEvent } from '@/app/actions/quiz'
import { AlertIcon } from '@/components/icons'
import { Button, cx } from '@/components/ui'

/**
 * Watches for the obvious ways of looking something up mid-exam.
 *
 * ## The model
 *
 * Warnings are counted against the whole attempt. On a paper with an
 * `integrity_warning_limit`, reaching it freezes the attempt: no answering, the
 * clock stops, and an instructor has to unlock it. On a paper without one, the
 * older per-question rule still applies.
 *
 * ## What counts, and what deliberately does not
 *
 * Counting the wrong thing is worse here than under the old per-question rule.
 * A false positive used to cost one question; now it can stop the whole exam.
 * So the triggers are chosen for how *unambiguous* they are:
 *
 * - `visibilitychange` → hidden. The page genuinely went away: another tab,
 *   another app, a minimised window. This is the honest signal.
 * - Leaving fullscreen, but only after a grace period (see below).
 * - A blocked copy or paste, which is a deliberate keystroke.
 *
 * **`blur` is not counted.** It fires when someone clicks the address bar, when
 * an OS notification steals focus, when a second monitor is clicked, and — in
 * some embedded browsers — on every click inside the page itself. It is the
 * single largest source of false positives in this class of tool, and under a
 * freeze model it would end exams for no reason.
 *
 * Right-click, text selection, drag, double-click and resizing are all handled
 * by `exam-lockdown` and produce **no warning at all**. Students right-click and
 * double-click out of habit; punishing that would be noise, not integrity.
 *
 * ## Fullscreen
 *
 * Requested when the exam starts, and only if the browser can actually do it —
 * iPhone Safari cannot fullscreen a non-video element, so on those devices
 * fullscreen is skipped entirely and its warning is never armed rather than
 * freezing a student who has no way to comply.
 *
 * Escape always exits fullscreen and browsers do not allow that to be
 * suppressed. So exiting raises a blocking overlay with a short countdown; come
 * back inside it and nothing is recorded. Only staying outside counts.
 *
 * ## Why the count is not held here
 *
 * `record_integrity_event` increments a column on the attempt. If the tally
 * lived in React state, reloading the page would hand back a fresh set of
 * chances, which is exactly what someone might try after a warning.
 */

const EVENT_DESCRIPTIONS: Record<string, string> = {
  tab_hidden: 'you left this page for another tab or application',
  window_blur: 'this window lost focus',
  copy: 'you tried to copy the exam text',
  paste: 'you tried to paste into an answer',
  fullscreen_exit: 'you left fullscreen mode and did not come back',
}

/**
 * One alt-tab can fire several events at once, and returning fires more.
 * Anything inside this window counts once, so a single switch costs a single
 * warning rather than three.
 */
const DEBOUNCE_MS = 1500

/** How long a student has to return to fullscreen before it counts. */
const FULLSCREEN_GRACE_MS = 10_000

export function IntegrityGuard({
  attemptId,
  questionId,
  questionNumber,
  active,
  warningLimit,
  requireFullscreen = false,
  onWarning,
  onFrozen,
}: {
  attemptId: string
  questionId: string
  questionNumber: number
  /** False once the attempt is over or frozen, so neither is policed. */
  active: boolean
  /** Warnings allowed before the attempt freezes. Null = legacy per-question. */
  warningLimit: number | null
  requireFullscreen?: boolean
  onWarning?: (
    totalCount: number,
    questionCount: number,
    invalidated: boolean
  ) => void
  onFrozen?: () => void
}) {
  const [notice, setNotice] = useState<{
    kind: string
    count: number
    questionCount: number
    invalidated: boolean
  } | null>(null)

  /** Non-null while the student is outside fullscreen and the clock is ticking. */
  const [graceLeft, setGraceLeft] = useState<number | null>(null)

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

        if (result.frozen) {
          onFrozen?.()
          return
        }

        // Stop counting while the dialog is up: dismissing it moves focus, and
        // that would otherwise register as another offence.
        paused.current = true
        setNotice({
          kind,
          count: result.warning_count,
          questionCount: result.question_warning_count,
          invalidated: result.question_invalidated,
        })
      } finally {
        inFlight.current = false
      }
    },
    [active, attemptId, onFrozen, onWarning, questionId]
  )

  /* ------------------------------------------------- leaving the page -- */

  useEffect(() => {
    if (!active) return

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void record('tab_hidden')
    }

    // Blocked as well as logged: the honest student gets a clear signal that
    // copying is not part of this, rather than silently building a record
    // against themselves.
    const onCopy = (event: Event) => {
      event.preventDefault()
      void record('copy')
    }
    const onPaste = (event: Event) => {
      event.preventDefault()
      void record('paste')
    }

    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('copy', onCopy)
    document.addEventListener('paste', onPaste)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('paste', onPaste)
    }
  }, [active, record])

  /* ---------------------------------------------------- fullscreen -- */

  useEffect(() => {
    if (!active || !requireFullscreen) return

    const onChange = () => {
      if (document.fullscreenElement) {
        setGraceLeft(null)
      } else {
        setGraceLeft(Math.ceil(FULLSCREEN_GRACE_MS / 1000))
      }
    }

    document.addEventListener('fullscreenchange', onChange)
    onChange()

    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [active, requireFullscreen])

  /* The grace countdown. Returning to fullscreen clears it before it fires, so
     an accidental Escape costs nothing. */
  useEffect(() => {
    if (graceLeft === null) return

    if (graceLeft <= 0) {
      setGraceLeft(null)
      void record('fullscreen_exit')
      return
    }

    const id = window.setTimeout(() => setGraceLeft((n) => (n ?? 1) - 1), 1000)
    return () => window.clearTimeout(id)
  }, [graceLeft, record])

  const returnToFullscreen = () => {
    void document.documentElement.requestFullscreen?.().catch(() => {
      // Refused or unsupported. Nothing to police, so stop the countdown
      // rather than freezing someone whose browser will not comply.
      setGraceLeft(null)
    })
  }

  const dismiss = () => {
    setNotice(null)
    // Returning focus to the window fires another visibility change; hold the
    // debounce open across it.
    lastEventAt.current = Date.now()
    paused.current = false
  }

  /* ------------------------------------------------------------ render -- */

  if (graceLeft !== null && !notice) {
    return (
      <Overlay tone="amber">
        <Heading tone="amber">Return to fullscreen</Heading>
        <p className="mt-4 text-[17px] leading-relaxed text-ink sm:text-[19px]">
          Your exam must stay in fullscreen. Come back within{' '}
          <strong className="font-bold text-navy-900 tabular-nums">
            {graceLeft} second{graceLeft === 1 ? '' : 's'}
          </strong>{' '}
          and nothing is recorded.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          If you stay outside fullscreen, this counts as one warning.
        </p>
        <div className="mt-6">
          <Button onClick={returnToFullscreen} autoFocus>
            Return to fullscreen
          </Button>
        </div>
      </Overlay>
    )
  }

  if (!notice) return null

  const reason = EVENT_DESCRIPTIONS[notice.kind] ?? 'something unexpected happened'
  const limited = warningLimit !== null
  const remaining = limited ? Math.max(0, warningLimit - notice.count) : null
  const lastChance = remaining === 1

  return (
    <Overlay tone={lastChance ? 'danger' : 'amber'}>
      <Heading tone={lastChance ? 'danger' : 'amber'}>
        {limited
          ? `Warning ${notice.count} of ${warningLimit}`
          : notice.invalidated
            ? `Question ${questionNumber} is now worth zero points`
            : `Warning ${notice.questionCount} of 3 for question ${questionNumber}`}
      </Heading>

      <p className="mt-4 text-[17px] leading-relaxed text-ink sm:text-[19px]">
        This exam recorded that <strong className="font-semibold text-navy-900">{reason}</strong>.
        Your instructor can see it.
      </p>

      {limited ? (
        <p
          className={cx(
            'mt-4 rounded-md border-2 px-4 py-3.5 text-[17px] leading-relaxed font-semibold sm:text-[19px]',
            lastChance
              ? 'border-danger-500 bg-danger-50 text-danger-600'
              : 'border-amber-300 bg-amber-50 text-amber-800'
          )}
        >
          {lastChance
            ? 'One more warning will freeze your exam. You will not be able to answer anything until an instructor unlocks it.'
            : `You have ${remaining} warning${remaining === 1 ? '' : 's'} left before your exam freezes.`}
        </p>
      ) : (
        <p className="mt-3 text-[15px] leading-relaxed text-ink">
          {notice.invalidated
            ? 'You may continue and answer every other question. This question cannot earn a point.'
            : 'Three events on the same question make only that question worth zero points.'}
        </p>
      )}

      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
        Stay on this page for the rest of the exam. Right-clicking and resizing
        your window are fine and are never recorded.
      </p>

      <div className="mt-6">
        <Button onClick={dismiss} autoFocus>
          Back to the exam
        </Button>
      </div>
    </Overlay>
  )
}

/* ------------------------------------------------------------- chrome -- */

function Overlay({
  tone,
  children,
}: {
  tone: 'amber' | 'danger'
  children: React.ReactNode
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="integrity-title"
      className="fixed inset-0 z-50 grid place-items-center bg-navy-900/75 p-4 backdrop-blur-[3px]"
    >
      <div
        className={cx(
          'animate-pop w-full max-w-2xl rounded-md border-4 bg-surface p-6 sm:p-9',
          tone === 'danger' ? 'border-danger-500' : 'border-amber-400'
        )}
      >
        {children}
      </div>
    </div>
  )
}

function Heading({
  tone,
  children,
}: {
  tone: 'amber' | 'danger'
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3.5">
      <span
        className={cx(
          'grid size-12 shrink-0 place-items-center rounded-sm',
          tone === 'danger'
            ? 'bg-danger-50 text-danger-600'
            : 'bg-amber-50 text-amber-700'
        )}
      >
        <AlertIcon width={26} height={26} />
      </span>
      <h2
        id="integrity-title"
        className={cx(
          'text-[24px] leading-tight font-bold sm:text-[30px]',
          tone === 'danger' ? 'text-danger-600' : 'text-navy-900'
        )}
      >
        {children}
      </h2>
    </div>
  )
}
