'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { finishAttempt } from '@/app/actions/quiz'

/**
 * Closes out an attempt whose clock ran down while nobody was watching.
 *
 * A student who shuts the laptop mid-quiz leaves a row that is still
 * `in_progress` with a deadline in the past. Nothing submits it, because the only
 * thing that would have was the countdown in their browser. This runs on the next
 * page load and grades what was saved.
 *
 * It is a client component rather than a call in the page because a Server
 * Component render should not be writing to the database — a refresh or a
 * prefetch would fire it again. `submit_attempt` is idempotent regardless.
 */
export function QuizExpired({ attemptId }: { attemptId: string }) {
  const router = useRouter()
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true

    void finishAttempt({ attemptId, reason: 'timed_out' }).then(() => {
      router.refresh()
    })
  }, [attemptId, router])

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="animate-fade text-center">
        <p className="text-[16px] font-medium text-navy-900">Time is up.</p>
        <p className="mt-1 text-[14px] text-ink-soft">
          Marking the answers you saved…
        </p>
      </div>
    </div>
  )
}
