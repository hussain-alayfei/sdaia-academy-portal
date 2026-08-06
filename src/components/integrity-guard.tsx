'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { reportIntegrityEvent } from '@/app/actions/quiz'
import { AlertIcon } from '@/components/icons'
import { Button, cx } from '@/components/ui'
import {
  describeIntegrityEvent,
  dirFor,
  t,
  type ExamLanguage,
} from '@/lib/exam-language'

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
 * Browsers refuse `requestFullscreen` outside a user gesture, so the exam
 * cannot auto-enter fullscreen on load. The first overlay is a **start gate**:
 * the student presses one button to enter fullscreen. That first entry is never
 * timed and never warned — there is nothing to "return" from yet.
 *
 * Only after the student has been in fullscreen once does leaving it arm the
 * 10 second grace countdown. Come back inside it and nothing is recorded. Only
 * staying outside after that first entry counts as a warning.
 *
 * Phones and small touch devices skip fullscreen entirely
 * (`examSupportsFullscreen` in the runner) so mobile students are not stranded
 * behind a gate they cannot keep. Desktop still uses the start gate + grace.
 *
 * Escape always exits fullscreen and browsers do not allow that to be
 * suppressed.
 *
 * ## Why the count is not held here
 *
 * `record_integrity_event` increments a column on the attempt. If the tally
 * lived in React state, reloading the page would hand back a fresh set of
 * chances, which is exactly what someone might try after a warning.
 */

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
  language = 'en',
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
  /** Matches the exam runner language so overlays are fully bilingual. */
  language?: ExamLanguage
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

  /**
   * Whether the document is fullscreen *right now*.
   *
   * Driven by state rather than by reacting to `fullscreenchange` alone. An
   * earlier version only listened for the event, so once a student was already
   * outside fullscreen no further event ever fired: the overlay vanished and the
   * paper stayed readable in a window for the rest of the exam. Holding the
   * condition in state means the gate reappears whenever it is true, however the
   * student got there — including on first load.
   */
  const [isFullscreen, setIsFullscreen] = useState(true)

  /**
   * True once the student has entered fullscreen at least once this attempt.
   *
   * Until then the overlay is a start gate only: no grace timer, no warning.
   * Arming the countdown before the first entry was punishing students who took
   * more than ten seconds to find the button.
   *
   * The ref is what `sync` reads so a leave that fires in the same tick as the
   * first entry still sees the armed flag; state drives the start-gate copy.
   */
  const fullscreenArmedRef = useRef(false)
  const [fullscreenArmed, setFullscreenArmed] = useState(false)

  /** Seconds left to return before the exit is recorded. Null = not counting. */
  const [graceLeft, setGraceLeft] = useState<number | null>(null)

  /** One warning per exit, not a drip for as long as they stay outside. */
  const chargedForThisExit = useRef(false)

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

    const sync = () => {
      const inside = Boolean(document.fullscreenElement)
      setIsFullscreen(inside)

      if (inside) {
        fullscreenArmedRef.current = true
        setFullscreenArmed(true)
        setGraceLeft(null)
        chargedForThisExit.current = false
        return
      }

      // Still on the start gate: outside fullscreen, never been in. Show the
      // button, but do not start the grace countdown and do not warn.
      if (!fullscreenArmedRef.current) {
        setGraceLeft(null)
        return
      }

      if (!chargedForThisExit.current) {
        setGraceLeft((current) =>
          current === null ? Math.ceil(FULLSCREEN_GRACE_MS / 1000) : current
        )
      }
    }

    document.addEventListener('fullscreenchange', sync)
    sync()

    return () => document.removeEventListener('fullscreenchange', sync)
  }, [active, requireFullscreen])

  /* The grace countdown. Only runs after the first successful fullscreen entry.
     Returning to fullscreen clears it before it fires, so an accidental Escape
     costs nothing. */
  useEffect(() => {
    if (graceLeft === null) return
    if (!fullscreenArmedRef.current) {
      setGraceLeft(null)
      return
    }

    if (graceLeft <= 0) {
      setGraceLeft(null)
      chargedForThisExit.current = true
      void record('fullscreen_exit')
      return
    }

    const id = window.setTimeout(() => setGraceLeft((n) => (n ?? 1) - 1), 1000)
    return () => window.clearTimeout(id)
  }, [graceLeft, record])

  /**
   * The only reliable way in.
   *
   * `requestFullscreen` is refused outside a user gesture, which is why asking
   * for it in a mount effect silently did nothing and the exam opened windowed.
   * This runs from a real button press, so the browser honours it.
   */
  const enterFullscreen = () => {
    const request = document.documentElement.requestFullscreen?.bind(
      document.documentElement
    )
    if (!request) return

    request().catch(() => {
      // Refused. Do not strand the student behind a gate they cannot pass.
      fullscreenArmedRef.current = true
      setFullscreenArmed(true)
      setIsFullscreen(true)
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

  const dir = dirFor(language)

  /* ------------------------------------------------------------ render -- */

  /**
   * The gate. Opaque, not translucent: while it is up the paper behind it must
   * be unreadable, or leaving fullscreen becomes a way to browse the exam
   * calmly. It is shown from state, so it returns every single time the student
   * is outside fullscreen — including the very first render, which is what
   * makes the exam enter fullscreen at all.
   */
  if (active && requireFullscreen && !isFullscreen && !notice) {
    const starting = !fullscreenArmed
    const counting = !starting && graceLeft !== null

    return (
      <Overlay
        tone={starting ? 'amber' : counting ? 'amber' : 'danger'}
        opaque
        dir={dir}
        lang={language}
      >
        <Heading tone={starting ? 'amber' : counting ? 'amber' : 'danger'}>
          {starting
            ? t('enterFullscreenToBegin', language)
            : counting
              ? t('returnToFullscreen', language)
              : t('fullscreenRequired', language)}
        </Heading>

        <p className="mt-4 text-[17px] leading-relaxed text-ink sm:text-[19px]">
          {starting
            ? t('fullscreenStartBody', language)
            : t('fullscreenHiddenPaper', language)}
        </p>

        {starting ? null : counting ? (
          <p className="mt-4 rounded-md border-2 border-amber-300 bg-amber-50 px-4 py-3.5 text-[17px] leading-relaxed font-semibold text-amber-800 sm:text-[19px]">
            {t('returnWithin', language)}{' '}
            <span className="tabular-nums">
              {graceLeft}{' '}
              {graceLeft === 1
                ? t('second', language)
                : t('seconds', language)}
            </span>{' '}
            {t('nothingRecorded', language)}
          </p>
        ) : (
          <p className="mt-4 rounded-md border-2 border-danger-500 bg-danger-50 px-4 py-3.5 text-[17px] leading-relaxed font-semibold text-danger-600 sm:text-[19px]">
            {t('fullscreenWarningRecorded', language)}
          </p>
        )}

        <div className="mt-6">
          <Button onClick={enterFullscreen} autoFocus>
            {starting
              ? t('enterFullscreenStart', language)
              : t('enterFullscreen', language)}
          </Button>
        </div>

        <p className="mt-4 text-[14px] leading-relaxed text-ink-faint">
          {starting
            ? t('clockNotStartedNote', language)
            : t('answersSavedTimeRunning', language)}
        </p>
      </Overlay>
    )
  }

  if (!notice) return null

  const reason = describeIntegrityEvent(notice.kind, language)
  const limited = warningLimit !== null
  const remaining = limited ? Math.max(0, warningLimit - notice.count) : null
  const lastChance = remaining === 1

  return (
    <Overlay
      tone={lastChance ? 'danger' : 'amber'}
      dir={dir}
      lang={language}
    >
      <Heading tone={lastChance ? 'danger' : 'amber'}>
        {limited
          ? `${t('warning', language)} ${notice.count} ${t('of', language)} ${warningLimit}`
          : notice.invalidated
            ? `${t('question', language)} ${questionNumber} ${t('questionWorthZero', language)}`
            : `${t('warning', language)} ${notice.questionCount} ${t('of', language)} 3 ${t('warningForQuestion', language)} ${questionNumber}`}
      </Heading>

      <p className="mt-4 text-[17px] leading-relaxed text-ink sm:text-[19px]">
        {t('warningRecordedLead', language)}{' '}
        <strong className="font-semibold text-navy-900">{reason}</strong>.{' '}
        {t('warningInstructorSees', language)}
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
            ? t('lastChanceFreeze', language)
            : `${t('youHave', language)} ${remaining} ${t('warnings', language)} ${t('warningsLeftBeforeFreeze', language)}`}
        </p>
      ) : (
        <p className="mt-3 text-[15px] leading-relaxed text-ink">
          {notice.invalidated
            ? t('continueOtherQuestions', language)
            : t('threeEventsZero', language)}
        </p>
      )}

      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
        {t('stayOnPage', language)}
      </p>

      <div className="mt-6">
        <Button onClick={dismiss} autoFocus>
          {t('backToExam', language)}
        </Button>
      </div>
    </Overlay>
  )
}

/* ------------------------------------------------------------- chrome -- */

function Overlay({
  tone,
  opaque = false,
  dir,
  lang,
  children,
}: {
  tone: 'amber' | 'danger'
  /** Fully hides the paper behind it, rather than blurring it. */
  opaque?: boolean
  dir: 'ltr' | 'rtl'
  lang: ExamLanguage
  children: React.ReactNode
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="integrity-title"
      dir={dir}
      lang={lang}
      className={cx(
        'fixed inset-0 z-50 grid place-items-center p-4',
        opaque ? 'bg-canvas' : 'bg-navy-900/75 backdrop-blur-[3px]'
      )}
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
