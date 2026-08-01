'use client'

import { useActionState, useRef } from 'react'

import { saveScore, type FormState } from '@/app/actions/admin'
import { cx } from '@/components/ui'

/**
 * One editable score. Saves on blur so an instructor can tab straight across
 * a roster without reaching for a button. Clearing the box deletes the score.
 */
export function ScoreCell({
  courseId,
  assessmentId,
  studentId,
  maxScore,
  initial,
}: {
  courseId: string
  assessmentId: string
  studentId: string
  maxScore: number
  initial: number | null
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveScore,
    undefined
  )
  const formRef = useRef<HTMLFormElement>(null)
  const lastSaved = useRef<string>(initial === null ? '' : String(initial))

  function handleBlur(event: React.FocusEvent<HTMLInputElement>) {
    const value = event.currentTarget.value.trim()
    if (value === lastSaved.current) return
    lastSaved.current = value
    formRef.current?.requestSubmit()
  }

  return (
    <form ref={formRef} action={action} className="contents">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="assessment_id" value={assessmentId} />
      <input type="hidden" name="student_id" value={studentId} />

      <label className="sr-only" htmlFor={`score-${assessmentId}-${studentId}`}>
        Score out of {maxScore}
      </label>
      <input
        id={`score-${assessmentId}-${studentId}`}
        name="score"
        type="number"
        min={0}
        max={maxScore}
        step="0.5"
        inputMode="decimal"
        defaultValue={initial ?? ''}
        onBlur={handleBlur}
        aria-invalid={Boolean(state?.message)}
        title={state?.message}
        className={cx(
          'w-20 rounded-sm border bg-surface px-2 py-1 text-[13px] tabular-nums',
          'focus:border-teal-600 focus:outline-none',
          state?.message
            ? 'border-danger-500'
            : 'border-line-strong',
          pending && 'opacity-60'
        )}
        placeholder="—"
      />
    </form>
  )
}
