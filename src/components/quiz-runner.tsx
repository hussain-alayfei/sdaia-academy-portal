'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { finishAttempt, saveAnswer } from '@/app/actions/quiz'
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  FlagIcon,
} from '@/components/icons'
import { IntegrityGuard } from '@/components/integrity-guard'
import { Alert, Button, cx } from '@/components/ui'
import { formatClock } from '@/lib/format'
import type { PaperQuestion } from '@/lib/quiz'

/**
 * The live attempt.
 *
 * Three things here are load-bearing:
 *
 * 1. **The clock is the server's.** `expiresAt` was stamped by `start_attempt`
 *    and every tick recomputes against it, so the countdown survives a throttled
 *    background tab and cannot be extended by changing the system time. When it
 *    reaches zero the attempt is submitted; `submit_attempt` checks the deadline
 *    again anyway, so a client that never fires still gets graded correctly.
 *
 * 2. **Every selection is written immediately.** The point is not convenience.
 *    It means a closed laptop, a flat battery or a timeout grades the work
 *    actually done rather than losing all of it.
 *
 * 3. **Nothing here knows the right answer.** The paper arrives without a key —
 *    RLS refuses it until the attempt is submitted — so there is nothing to find
 *    in the page source.
 */

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function QuizRunner({
  attemptId,
  title,
  questions,
  expiresAt,
  initialWarnings,
}: {
  attemptId: string
  title: string
  questions: PaperQuestion[]
  expiresAt: string
  initialWarnings: number
}) {
  const router = useRouter()

  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  const [answers, setAnswers] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, q.selectedOptionId]))
  )
  const [flags, setFlags] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, q.flagged]))
  )
  const [save, setSave] = useState<SaveState>('idle')
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [warnings, setWarnings] = useState(initialWarnings)
  const [integrityByQuestion, setIntegrityByQuestion] = useState<
    Record<string, { count: number; invalidated: boolean }>
  >(() =>
    Object.fromEntries(
      questions.map((q) => [
        q.id,
        {
          count: q.integrityWarningCount,
          invalidated: q.integrityInvalidated,
        },
      ])
    )
  )
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  )

  /**
   * Two things track the same fact for different reasons. The ref closes the
   * race — the countdown and a click can both call `submit` in the same tick, and
   * a state update would not have landed in time to stop the second. The state is
   * what render reads, so the integrity guard actually switches off.
   */
  const submitted = useRef(false)
  const [finished, setFinished] = useState(false)

  const submit = useCallback(
    async (reason: 'submitted' | 'timed_out') => {
      if (submitted.current) return
      submitted.current = true
      setFinished(true)
      setSubmitting(true)

      const result = await finishAttempt({ attemptId, reason })
      if (!result.ok) {
        // Almost always "already finished", which means the server got there
        // first. Reloading lands on the result screen either way.
        setSaveMessage(result.message)
      }
      router.refresh()
    },
    [attemptId, router]
  )

  /* Recompute from the deadline rather than decrementing, so a background tab
     that stopped receiving timers catches up the moment it returns. */
  useEffect(() => {
    const tick = () => {
      const left = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      )
      setSecondsLeft(left)
      if (left === 0) void submit('timed_out')
    }

    const id = window.setInterval(tick, 1000)
    tick()
    return () => window.clearInterval(id)
  }, [expiresAt, submit])

  /* Closing the tab mid-attempt loses nothing — answers are already saved — but
     the attempt cannot be restarted, so it is worth one confirmation. */
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (submitted.current) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const persist = useCallback(
    async (questionId: string, optionId: string | null, flagged: boolean) => {
      setSave('saving')
      const result = await saveAnswer({
        attemptId,
        questionId,
        optionId,
        flagged,
      })

      if (result.ok) {
        setSave('saved')
        setSaveMessage(null)
      } else {
        setSave('error')
        setSaveMessage(result.message ?? 'That did not save.')
      }
    },
    [attemptId]
  )

  const choose = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }))
    void persist(questionId, optionId, flags[questionId] ?? false)
  }

  const toggleFlag = (questionId: string) => {
    const next = !flags[questionId]
    setFlags((prev) => ({ ...prev, [questionId]: next }))
    void persist(questionId, answers[questionId] ?? null, next)
  }

  const go = (target: number) => {
    if (target < 0 || target >= questions.length) return
    setDirection(target > index ? 'next' : 'prev')
    setIndex(target)
  }

  const unanswered = useMemo(
    () => questions.filter((q) => !answers[q.id]),
    [questions, answers]
  )
  const flagged = useMemo(
    () => questions.filter((q) => flags[q.id]),
    [questions, flags]
  )

  const question = questions[index]
  const answeredCount = questions.length - unanswered.length

  const urgency =
    secondsLeft <= 60 ? 'danger' : secondsLeft <= 300 ? 'amber' : 'calm'

  return (
    <div className="min-h-dvh bg-canvas">
      <IntegrityGuard
        attemptId={attemptId}
        questionId={question.id}
        questionNumber={index + 1}
        active={!finished}
        onWarning={(totalCount, questionCount, invalidated) => {
          setWarnings(totalCount)
          setIntegrityByQuestion((prev) => ({
            ...prev,
            [question.id]: { count: questionCount, invalidated },
          }))
        }}
      />

      {/* ------------------------------------------------------------ header */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-navy-900">
              {title}
            </p>
            <p className="text-[12px] text-ink-faint">
              {answeredCount} of {questions.length} answered
              {flagged.length > 0 ? ` · ${flagged.length} flagged` : ''}
            </p>
          </div>

          {warnings > 0 ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-xs border border-amber-200 bg-amber-50 px-2 py-1 text-[12px] font-medium text-amber-800"
              title="Integrity events recorded during this attempt"
            >
              <AlertIcon width={13} height={13} />
              {warnings} integrity event{warnings === 1 ? '' : 's'}
            </span>
          ) : null}

          <span
            role="timer"
            aria-live="off"
            className={cx(
              'inline-flex items-center gap-1.5 rounded-xs border px-2.5 py-1 font-mono text-[14px] font-medium tabular-nums',
              urgency === 'danger' &&
                'border-danger-500/30 bg-danger-50 text-danger-600',
              urgency === 'amber' && 'border-amber-200 bg-amber-50 text-amber-800',
              urgency === 'calm' && 'border-line bg-navy-50 text-navy-800'
            )}
          >
            <ClockIcon width={14} height={14} />
            {formatClock(secondsLeft)}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {/* --------------------------------------------------------- navigator */}
        <nav aria-label="Questions" className="mb-6">
          <ol className="flex flex-wrap gap-1.5">
            {questions.map((q, i) => {
              const isAnswered = Boolean(answers[q.id])
              const isFlagged = flags[q.id]
              const isCurrent = i === index
              const invalidated = integrityByQuestion[q.id]?.invalidated

              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={isCurrent ? 'true' : undefined}
                    aria-label={`Question ${i + 1}${
                      isAnswered ? ', answered' : ', not answered'
                    }${isFlagged ? ', flagged' : ''}${
                      invalidated ? ', worth zero points due to integrity events' : ''
                    }`}
                    className={cx(
                      'relative grid size-9 place-items-center rounded-sm border text-[13px] font-medium transition-colors',
                      isCurrent
                        ? 'border-navy-900 bg-navy-900 text-white'
                        : invalidated
                          ? 'border-danger-500/40 bg-danger-50 text-danger-600'
                        : isAnswered
                          ? 'border-teal-300 bg-teal-50 text-teal-800 hover:border-teal-500'
                          : 'border-line-strong bg-surface text-ink-soft hover:border-navy-400 hover:text-navy-800'
                    )}
                  >
                    {i + 1}
                    {isFlagged ? (
                      <span
                        aria-hidden
                        className="absolute -top-1 -right-1 size-2.5 rounded-full border border-surface bg-amber-500"
                      />
                    ) : null}
                    {invalidated ? (
                      <span
                        aria-hidden
                        className="absolute -bottom-1 -left-1 grid size-3.5 place-items-center rounded-full border border-surface bg-danger-500 text-[8px] font-bold text-white"
                      >
                        0
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        {/* ---------------------------------------------------------- question */}
        {question ? (
          <article
            key={question.id}
            className={cx(
              'rounded-md border border-line bg-surface p-5 sm:p-7',
              direction === 'next' ? 'animate-slide-next' : 'animate-slide-prev'
            )}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <p className="text-[12px] font-semibold tracking-wide text-ink-faint uppercase">
                Question {index + 1} of {questions.length}
              </p>

              <button
                type="button"
                onClick={() => toggleFlag(question.id)}
                className={cx(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-xs border px-2 py-1 text-[12px] font-medium transition-colors',
                  flags[question.id]
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-line-strong bg-surface text-ink-soft hover:border-amber-300 hover:text-amber-800'
                )}
              >
                <FlagIcon width={13} height={13} />
                {flags[question.id] ? 'Flagged for later' : 'Flag for later'}
              </button>
            </div>

            {integrityByQuestion[question.id]?.invalidated ? (
              <Alert
                tone="danger"
                className="mb-5 px-4 py-3.5 text-[14px]"
                title="This question is worth zero points"
              >
                Three integrity events were recorded while you were on this
                question. Continue with the rest of the assessment; your other
                questions are unaffected.
              </Alert>
            ) : integrityByQuestion[question.id]?.count ? (
              <Alert tone="amber" className="mb-5" title="Integrity warning">
                {integrityByQuestion[question.id].count} of 3 events recorded on
                this question. Three events make only this question worth zero
                points.
              </Alert>
            ) : null}

            <h1 className="text-[17px] leading-relaxed font-medium text-navy-900 sm:text-[18px]">
              {question.stem}
            </h1>

            <ul className="mt-5 space-y-2.5">
              {question.options.map((option, i) => {
                const selected = answers[question.id] === option.id

                return (
                  <li key={option.id}>
                    <label
                      className={cx(
                        'flex cursor-pointer items-start gap-3 rounded-sm border p-3.5 transition-colors sm:p-4',
                        selected
                          ? 'border-teal-500 bg-teal-50/70 ring-1 ring-teal-500/30'
                          : 'border-line-strong bg-surface hover:border-navy-400 hover:bg-navy-50/60'
                      )}
                    >
                      <input
                        type="radio"
                        name={`q-${question.id}`}
                        checked={selected}
                        onChange={() => choose(question.id, option.id)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className={cx(
                          'grid size-6 shrink-0 place-items-center rounded-full border text-[12px] font-semibold',
                          selected
                            ? 'border-teal-600 bg-teal-600 text-white'
                            : 'border-line-strong bg-surface text-ink-soft'
                        )}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-[14.5px] leading-relaxed text-ink">
                        {option.body}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </article>
        ) : null}

        {/* ------------------------------------------------------------ moves */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => go(index - 1)}
            disabled={index === 0}
          >
            Previous
          </Button>

          {index < questions.length - 1 ? (
            <Button onClick={() => go(index + 1)}>Next question</Button>
          ) : (
            <Button onClick={() => setConfirming(true)}>Review and submit</Button>
          )}

          <span className="ml-auto text-[12px] text-ink-faint">
            {save === 'saving'
              ? 'Saving…'
              : save === 'error'
                ? (saveMessage ?? 'Not saved')
                : save === 'saved'
                  ? 'Answers saved'
                  : 'Every answer saves as you go'}
          </span>
        </div>

        {questions.length > 1 && index < questions.length - 1 ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-[13px] font-medium text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-navy-900"
            >
              Finish early and submit
            </button>
          </div>
        ) : null}
      </main>

      {/* ------------------------------------------------------ submit dialog */}
      {confirming ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-title"
          className="fixed inset-0 z-40 grid place-items-center bg-navy-900/55 p-4 backdrop-blur-[2px]"
        >
          <div className="animate-pop w-full max-w-md rounded-md border border-line bg-surface p-6 shadow-lg">
            <h2
              id="submit-title"
              className="text-[16px] font-semibold text-navy-900"
            >
              Submit this attempt?
            </h2>

            <dl className="mt-4 space-y-2 text-[14px]">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-soft">Answered</dt>
                <dd className="font-medium text-navy-900">
                  {answeredCount} of {questions.length}
                </dd>
              </div>
              {unanswered.length > 0 ? (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-danger-600">Left blank</dt>
                  <dd className="font-medium text-danger-600">
                    {unanswered.map((q) => q.position + 1).join(', ')}
                  </dd>
                </div>
              ) : null}
              {flagged.length > 0 ? (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-amber-800">Still flagged</dt>
                  <dd className="font-medium text-amber-800">
                    {flagged.map((q) => q.position + 1).join(', ')}
                  </dd>
                </div>
              ) : null}
            </dl>

            <p className="mt-4 text-[13px] text-ink-soft">
              {unanswered.length > 0
                ? 'Blank answers count as wrong. You can go back and fill them in.'
                : 'You have answered everything.'}{' '}
              This is your one attempt, so it cannot be reopened.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => void submit('submitted')} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit for marking'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirming(false)}
                disabled={submitting}
              >
                Keep working
              </Button>
              {unanswered.length > 0 ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setConfirming(false)
                    go(unanswered[0].position)
                  }}
                  disabled={submitting}
                >
                  <CheckIcon width={15} height={15} />
                  Go to the first blank
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
