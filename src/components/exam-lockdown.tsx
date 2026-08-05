'use client'

import { useEffect } from 'react'

/**
 * Closes the easy routes for lifting the paper out of the page.
 *
 * Selection, right-click, cut, drag and the copy/save/print shortcuts all stop
 * here. Copy and paste are deliberately *not* handled in this file — the
 * integrity guard already blocks those and records them against the question,
 * and one owner per event keeps the warning count honest.
 *
 * ## What this is worth
 *
 * A deterrent, and only that. A phone photographs the screen, view-source still
 * exists, and turning off JavaScript removes this entirely. What it removes is
 * the effortless path: select all, copy, paste into another tab. The measure
 * that actually holds is the per-attempt shuffle, which is enforced in the
 * database and makes a copied paper useless to the next student.
 *
 * Nothing here touches buttons, radios or links, so the exam stays fully
 * operable — a lockdown that breaks the answer options would cost more than it
 * protects.
 */

/** Keys that copy, save, print, or select the whole document. */
const BLOCKED_WITH_MODIFIER = new Set(['a', 'c', 'x', 's', 'p', 'u'])

export function ExamLockdown({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return

    const stop = (event: Event) => event.preventDefault()

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key.length !== 1) return
      if (!BLOCKED_WITH_MODIFIER.has(event.key.toLowerCase())) return
      event.preventDefault()
    }

    document.addEventListener('contextmenu', stop)
    document.addEventListener('selectstart', stop)
    document.addEventListener('dragstart', stop)
    document.addEventListener('cut', stop)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('contextmenu', stop)
      document.removeEventListener('selectstart', stop)
      document.removeEventListener('dragstart', stop)
      document.removeEventListener('cut', stop)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [active])

  return null
}
