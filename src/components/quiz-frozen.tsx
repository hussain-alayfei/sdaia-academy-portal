'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { checkAttemptFrozen } from '@/app/actions/quiz'
import { AlertIcon } from '@/components/icons'

/**
 * The exam is stopped and waiting for an instructor.
 *
 * Deliberately a dead end with nothing to click. The student cannot answer,
 * cannot submit, and cannot reopen this themselves — `save_response` and
 * `submit_attempt` both refuse a frozen attempt, so nothing here is guarded by
 * the UI alone.
 *
 * The clock is paused: `expires_at` is pushed forward by however long the
 * freeze lasted when the instructor unlocks, so waiting costs no exam time.
 * Saying so plainly matters — a student staring at a stopped exam otherwise
 * assumes their time is draining away.
 *
 * It polls rather than asking them to refresh, so the exam simply comes back on
 * its own the moment it is unlocked.
 */
export function QuizFrozen({
  attemptId,
  warningLimit,
}: {
  attemptId: string
  warningLimit: number | null
}) {
  const router = useRouter()
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    const id = window.setInterval(async () => {
      setChecking(true)
      try {
        const { frozen } = await checkAttemptFrozen({ attemptId })
        if (!frozen) router.refresh()
      } finally {
        setChecking(false)
      }
    }, 5000)

    return () => window.clearInterval(id)
  }, [attemptId, router])

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas p-4">
      <div className="w-full max-w-2xl rounded-md border-4 border-danger-500 bg-surface p-6 sm:p-10">
        <div className="flex items-center gap-3.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-sm bg-danger-50 text-danger-600">
            <AlertIcon width={26} height={26} />
          </span>
          <h1 className="text-[26px] leading-tight font-bold text-danger-600 sm:text-[34px]">
            Your exam is frozen
          </h1>
        </div>

        <p className="mt-5 text-[18px] leading-relaxed text-ink sm:text-[20px]">
          You reached {warningLimit ?? 5} integrity warnings, so this exam has
          stopped. You cannot answer any more questions until an instructor
          unlocks it.
        </p>

        <div className="mt-6 rounded-md border-2 border-teal-200 bg-teal-50 p-5">
          <p className="text-[18px] leading-relaxed font-semibold text-teal-900 sm:text-[20px]">
            Raise your hand and tell your instructor now.
          </p>
          <p className="mt-2 text-[16px] leading-relaxed text-teal-900">
            Your clock is paused. The time you spend waiting is added back, so
            you will not lose any exam time.
          </p>
        </div>

        <p className="mt-5 text-[15.5px] leading-relaxed text-ink-soft">
          Every answer you had already chosen is saved. When your instructor
          unlocks the exam it reopens here automatically, on the same question,
          with a fresh set of warnings.
        </p>

        <p className="mt-4 text-[13px] text-ink-faint">
          {checking ? 'Checking…' : 'Waiting for your instructor.'} Keep this page
          open.
        </p>
      </div>
    </div>
  )
}
