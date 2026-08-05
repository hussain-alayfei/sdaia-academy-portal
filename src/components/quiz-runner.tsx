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
import { ExamLockdown } from '@/components/exam-lockdown'
import { IntegrityGuard } from '@/components/integrity-guard'
import { QuizFrozen } from '@/components/quiz-frozen'
import { Alert, Button, cx } from '@/components/ui'
import { formatClock } from '@/lib/format'
import {
  buildExamPages,
  pageOfQuestion,
  type ExamSection,
} from '@/lib/exam-sections'
import type { PaperQuestion } from '@/lib/quiz'

/**
 * The live attempt.
 *
 * Four things here are load-bearing:
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
 *    RLS refuses it until the attempt is submitted, and for a paper whose
 *    results are still hidden it refuses it then too — so there is nothing to
 *    find in the page source.
 *
 * 4. **Sections are paged, not merged.** A section marked `single_page` puts its
 *    whole run on one screen, which is what lets the shared use case sit above
 *    its five questions instead of being repeated in front of each one.
 */

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Red for the last five minutes, as agreed with the instructor. */
const RED_FROM_SECONDS = 300

export function QuizRunner({
  attemptId,
  title,
  questions,
  sections = [],
  expiresAt,
  initialWarnings,
  lockdown = false,
  resultsHidden = false,
  warningLimit = null,
  startFrozen = false,
}: {
  attemptId: string
  title: string
  questions: PaperQuestion[]
  sections?: ExamSection[]
  expiresAt: string
  initialWarnings: number
  /** Blocks selection, right-click, cut, drag and copy/save/print shortcuts. */
  lockdown?: boolean
  /** True when submitting will not reveal a score. Changes the closing copy. */
  resultsHidden?: boolean
  /** Warnings allowed before the attempt freezes. Null = legacy per-question. */
  warningLimit?: number | null
  /** The attempt was already frozen when this page rendered. */
  startFrozen?: boolean
}) {
  const router = useRouter()

  const pages = useMemo(
    () => buildExamPages(questions, sections),
    [questions, sections]
  )

  const [pageIndex, setPageIndex] = useState(0)
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
  const [frozen, setFrozen] = useState(startFrozen)

  /** Exam papers run in fullscreen; practice quizzes do not. */
  const examMode = warningLimit !== null

  const page = pages[pageIndex]

  /**
   * Which question an integrity event belongs to.
   *
   * On a one-question screen this is simply that question. On a `single_page`
   * section it follows the last option the student touched, so a penalty lands
   * on the question they were actually working through rather than always on
   * the first one of the group.
   */
  const [activeQuestionId, setActiveQuestionId] = useState<string>(
    () => questions[0]?.id ?? ''
  )

  useEffect(() => {
    const first = page ? questions[page.questions[0]] : undefined
    if (first) setActiveQuestionId(first.id)
  }, [page, questions])

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

  /**
   * Enter fullscreen once, when an exam attempt opens.
   *
   * Best effort by design. iPhone Safari cannot fullscreen a non-video element,
   * and any browser can refuse the request. A student on such a device sits the
   * exam windowed rather than being blocked, and the fullscreen warning is never
   * armed against them — `requireFullscreen` below is gated on the browser
   * actually being capable of it.
   */
  const canFullscreen =
    typeof document !== 'undefined' &&
    Boolean(document.fullscreenEnabled) &&
    typeof document.documentElement.requestFullscreen === 'function'

  useEffect(() => {
    if (!examMode || frozen || submitted.current || !canFullscreen) return
    if (document.fullscreenElement) return
    void document.documentElement.requestFullscreen?.().catch(() => {})
    // Once per mount: re-requesting on every render would fight the student.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Leaving fullscreen when the exam ends is courtesy, not policy. */
  useEffect(() => {
    if (!examMode) return
    return () => {
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => {})
      }
    }
  }, [examMode])

  /* Recompute from the deadline rather than decrementing, so a background tab
     that stopped receiving timers catches up the moment it returns. While the
     attempt is frozen the clock is paused server-side, so it must not tick here
     either — and it certainly must not time the student out. */
  useEffect(() => {
    if (frozen) return

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
  }, [expiresAt, submit, frozen])

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
    setActiveQuestionId(questionId)
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }))
    void persist(questionId, optionId, flags[questionId] ?? false)
  }

  const toggleFlag = (questionId: string) => {
    const next = !flags[questionId]
    setActiveQuestionId(questionId)
    setFlags((prev) => ({ ...prev, [questionId]: next }))
    void persist(questionId, answers[questionId] ?? null, next)
  }

  const goToPage = (target: number) => {
    if (target < 0 || target >= pages.length) return
    setDirection(target > pageIndex ? 'next' : 'prev')
    setPageIndex(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goToQuestion = (questionIndex: number) => {
    goToPage(pageOfQuestion(pages, questionIndex))
  }

  const unanswered = useMemo(
    () => questions.filter((q) => !answers[q.id]),
    [questions, answers]
  )
  const flagged = useMemo(
    () => questions.filter((q) => flags[q.id]),
    [questions, flags]
  )

  const answeredCount = questions.length - unanswered.length

  /** Runs of the same section, for the grouped navigator. */
  const navGroups = useMemo(() => {
    const groups: Array<{ section: ExamSection | null; items: number[] }> = []
    for (const [i, question] of questions.entries()) {
      const last = groups[groups.length - 1]
      if (last && questions[last.items[0]].section === question.section) {
        last.items.push(i)
      } else {
        groups.push({
          section: sections.find((s) => s.n === question.section) ?? null,
          items: [i],
        })
      }
    }
    return groups
  }, [questions, sections])

  const urgent = secondsLeft <= RED_FROM_SECONDS
  const critical = secondsLeft <= 60
  const isLastPage = pageIndex === pages.length - 1

  if (!page) return null

  // A frozen attempt shows nothing else. The questions are not merely hidden —
  // `save_response` and `submit_attempt` both refuse a frozen attempt, so there
  // is nothing to gain from digging them out of the page.
  if (frozen) {
    return <QuizFrozen attemptId={attemptId} warningLimit={warningLimit} />
  }

  return (
    <div className={cx('min-h-dvh bg-canvas', lockdown && 'select-none')}>
      <ExamLockdown active={lockdown && !finished} />

      <IntegrityGuard
        attemptId={attemptId}
        questionId={activeQuestionId}
        questionNumber={
          questions.findIndex((q) => q.id === activeQuestionId) + 1
        }
        active={!finished}
        warningLimit={warningLimit}
        requireFullscreen={examMode && canFullscreen}
        onWarning={(totalCount, questionCount, invalidated) => {
          setWarnings(totalCount)
          setIntegrityByQuestion((prev) => ({
            ...prev,
            [activeQuestionId]: { count: questionCount, invalidated },
          }))
        }}
        onFrozen={() => {
          setFrozen(true)
          router.refresh()
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

          {/* Kept visible once anything is on the record. A student who can see
              "2 of 5" knows exactly where they stand; one who cannot is being
              set up to be surprised by a freeze. */}
          {warnings > 0 ? (
            <span
              className={cx(
                'inline-flex items-center gap-1.5 rounded-xs border px-2.5 py-1.5 text-[13px] font-semibold',
                warningLimit !== null && warnings >= warningLimit - 1
                  ? 'border-danger-500 bg-danger-50 text-danger-600'
                  : 'border-amber-300 bg-amber-50 text-amber-800'
              )}
              title="Integrity warnings recorded during this attempt"
            >
              <AlertIcon width={14} height={14} />
              {warningLimit !== null
                ? `${warnings} of ${warningLimit} warnings`
                : `${warnings} integrity event${warnings === 1 ? '' : 's'}`}
            </span>
          ) : null}

          {/* Deliberately large. A student glancing up mid-question should read
              the remaining time without hunting for it, and the last five
              minutes should be impossible to miss. */}
          <div
            role="timer"
            aria-live="off"
            className={cx(
              'inline-flex items-center gap-2 rounded-sm border-2 px-3 py-1.5 sm:px-4 sm:py-2',
              urgent
                ? 'border-danger-500 bg-danger-50'
                : 'border-line-strong bg-navy-50'
            )}
          >
            <ClockIcon
              width={20}
              height={20}
              className={urgent ? 'text-danger-600' : 'text-navy-600'}
            />
            <span
              className={cx(
                'font-mono text-[22px] leading-none font-bold tabular-nums sm:text-[28px]',
                urgent ? 'text-danger-600' : 'text-navy-900',
                critical && 'animate-pulse'
              )}
            >
              {formatClock(secondsLeft)}
            </span>
          </div>
        </div>

        {urgent ? (
          <p className="border-t border-danger-500/30 bg-danger-50 px-4 py-1.5 text-center text-[13px] font-semibold text-danger-600 sm:px-6">
            {critical
              ? 'Less than one minute left. Your answers are already saved.'
              : 'Less than five minutes left.'}
          </p>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {/* --------------------------------------------------------- navigator */}
        <nav aria-label="Questions" className="mb-6 space-y-3">
          {navGroups.map((group, groupIndex) => (
            <div key={group.section?.n ?? `g${groupIndex}`}>
              {group.section ? (
                <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
                  {group.section.title}
                </p>
              ) : null}
              <ol className="flex flex-wrap gap-1.5">
                {group.items.map((i) => {
                  const q = questions[i]
                  const isAnswered = Boolean(answers[q.id])
                  const isFlagged = flags[q.id]
                  const isCurrent = page.questions.includes(i)
                  const invalidated = integrityByQuestion[q.id]?.invalidated

                  return (
                    <li key={q.id}>
                      <button
                        type="button"
                        onClick={() => goToQuestion(i)}
                        aria-current={isCurrent ? 'true' : undefined}
                        aria-label={`Question ${i + 1}${
                          isAnswered ? ', answered' : ', not answered'
                        }${isFlagged ? ', flagged' : ''}${
                          invalidated
                            ? ', worth zero points due to integrity events'
                            : ''
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
            </div>
          ))}
        </nav>

        {/* ----------------------------------------------------- section head */}
        <div
          key={page.key}
          className={cx(
            direction === 'next' ? 'animate-slide-next' : 'animate-slide-prev'
          )}
        >
          {page.section && page.opensSection ? (
            <div className="mb-5 rounded-md border border-line bg-navy-50/60 p-4 sm:p-5">
              <h2 className="text-[16px] font-semibold text-navy-900 sm:text-[18px]">
                {page.section.title}
              </h2>
              {page.section.brief ? (
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
                  {page.section.brief}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* -------------------------------------------------------- use case */}
          {page.section?.useCase ? (
            <section
              aria-label={page.section.useCase.title}
              className="mb-6 rounded-md border-2 border-navy-900/15 bg-surface p-5 sm:p-7"
            >
              <h3 className="text-[12px] font-semibold tracking-wide text-teal-700 uppercase">
                {page.section.useCase.title}
              </h3>

              <p className="mt-3 text-[15.5px] leading-relaxed text-ink sm:text-[16.5px]">
                {page.section.useCase.intro}
              </p>

              {page.section.useCase.requirements.length > 0 ? (
                <>
                  {page.section.useCase.requirementsTitle ? (
                    <p className="mt-5 text-[14px] font-semibold text-navy-900">
                      {page.section.useCase.requirementsTitle}
                    </p>
                  ) : null}
                  <ul className="mt-2.5 space-y-2">
                    {page.section.useCase.requirements.map((item) => (
                      <li
                        key={item}
                        className="flex gap-2.5 text-[14.5px] leading-relaxed text-ink"
                      >
                        <span
                          aria-hidden
                          className="mt-2 size-1.5 shrink-0 rounded-full bg-teal-600"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {page.section.useCase.closing ? (
                <p className="mt-5 border-t border-line pt-4 text-[14px] text-ink-soft">
                  {page.section.useCase.closing}
                </p>
              ) : null}
            </section>
          ) : null}

          {/* ------------------------------------------------------- questions */}
          <div className="space-y-5">
            {page.questions.map((questionIndex) => {
              const question = questions[questionIndex]
              const integrity = integrityByQuestion[question.id]

              return (
                <article
                  key={question.id}
                  className="rounded-md border border-line bg-surface p-5 sm:p-7"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <p className="text-[12px] font-semibold tracking-wide text-ink-faint uppercase">
                      Question {questionIndex + 1} of {questions.length}
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

                  {integrity?.invalidated ? (
                    <Alert
                      tone="danger"
                      className="mb-5 px-4 py-3.5 text-[14px]"
                      title="This question is worth zero points"
                    >
                      Three integrity events were recorded while you were on this
                      question. Continue with the rest of the assessment; your
                      other questions are unaffected.
                    </Alert>
                  ) : integrity?.count ? (
                    <Alert tone="amber" className="mb-5" title="Integrity warning">
                      {integrity.count} of 3 events recorded on this question.
                      Three events make only this question worth zero points.
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
              )
            })}
          </div>
        </div>

        {/* ------------------------------------------------------------ moves */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => goToPage(pageIndex - 1)}
            disabled={pageIndex === 0}
          >
            Previous
          </Button>

          {!isLastPage ? (
            <Button onClick={() => goToPage(pageIndex + 1)}>
              {page.questions.length > 1 ? 'Next' : 'Next question'}
            </Button>
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

        {!isLastPage ? (
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
              {resultsHidden
                ? ' Your score is not shown when you submit; your instructor releases marks after the exam.'
                : ''}
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
                    goToQuestion(unanswered[0].position)
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
