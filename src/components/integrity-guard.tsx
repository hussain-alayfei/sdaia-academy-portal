'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { reportIntegrityEvent } from '@/app/actions/quiz'
import { AlertIcon } from '@/components/icons'
import { Button } from '@/components/ui'

/**
 * Watches for the obvious ways of looking something up mid-quiz, warns twice,
 * and lets the database end the attempt on the third.
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
 * which is exactly what someone would try after the second warning.
 */

const EVENT_DESCRIPTIONS: Record<string, string> = {
  tab_hidden: 'you switched to another tab or application',
  window_blur: 'this window lost focus',
  copy: 'you tried to copy the question text',
  paste: 'you tried to paste into an answer',
  context_menu: 'you opened the right-click menu',
}

/**
 * One alt-tab fires `blur` and `visibilitychange` together, and returning fires
 * more. Anything inside this window counts once, so a single switch costs a
 * single warning rather than three.
 */
const DEBOUNCE_MS = 1500

export function IntegrityGuard({
  attemptId,
  active,
  onWarning,
  onStopped,
}: {
  attemptId: string
  /** False once the attempt is over, so the result screen is not policed. */
  active: boolean
  onWarning?: (count: number) => void
  onStopped: () => void
}) {
  const [notice, setNotice] = useState<{ kind: string; count: number } | null>(
    null
  )
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
        const result = await reportIntegrityEvent({ attemptId, kind })
        if (result.message) return

        onWarning?.(result.warning_count)

        if (result.stopped) {
          // The database has already submitted the attempt. Let the page reload
          // into the result screen, which explains what happened.
          onStopped()
          return
        }

        // Stop counting while the dialog is up: dismissing it moves focus, and
        // that would otherwise register as another offence.
        paused.current = true
        setNotice({ kind, count: result.warning_count })
      } finally {
        inFlight.current = false
      }
    },
    [active, attemptId, onStopped, onWarning]
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
    const onContextMenu = (event: Event) => {
      event.preventDefault()
      void record('context_menu')
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    document.addEventListener('copy', onCopy)
    document.addEventListener('paste', onPaste)
    document.addEventListener('contextmenu', onContextMenu)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('paste', onPaste)
      document.removeEventListener('contextmenu', onContextMenu)
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

  const final = notice.count >= 2
  const reason = EVENT_DESCRIPTIONS[notice.kind] ?? 'something unexpected happened'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="integrity-title"
      className="fixed inset-0 z-50 grid place-items-center bg-navy-900/55 p-4 backdrop-blur-[2px]"
    >
      <div className="animate-pop w-full max-w-md rounded-md border border-line bg-surface p-6 shadow-lg">
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
            className="text-[16px] font-semibold text-navy-900"
          >
            {final ? 'Second and final warning' : 'First warning'}
          </h2>
        </div>

        <p className="text-[14px] text-ink">
          This attempt recorded that {reason}. Your instructor can see it.
        </p>

        <p className="mt-2 text-[14px] text-ink">
          {final
            ? 'If it happens once more, your attempt is submitted exactly as it stands and flagged for review. Stay on this page until you have finished.'
            : 'You have one more warning. After that the attempt is submitted as it stands and flagged for your instructor.'}
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
