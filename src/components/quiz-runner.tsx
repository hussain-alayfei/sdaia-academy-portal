'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { finishAttempt, saveAnswer } from '@/app/actions/quiz'
import { discardPracticeAttempt } from '@/app/actions/final-exam'
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  FlagIcon,
} from '@/components/icons'
import { ExamLanguageToggle } from '@/components/exam-language-toggle'
import { ExamLockdown } from '@/components/exam-lockdown'
import { IntegrityGuard } from '@/components/integrity-guard'
import { QuizFrozen } from '@/components/quiz-frozen'
import { Alert, Button, cx } from '@/components/ui'
import {
  dirFor,
  pickText,
  readStoredLanguage,
  storeLanguage,
  t,
  type ExamLanguage,
} from '@/lib/exam-language'
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
  initialLanguage = 'en',
  bilingual = false,
  isPractice = false,
  courseId,
  assessmentId,
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
  /** Language chosen on the rules screen. */
  initialLanguage?: ExamLanguage
  /** True when the paper actually carries a translation worth offering. */
  bilingual?: boolean
  /** Instructor dry run — banner + wipe on exit/submit; never grades. */
  isPractice?: boolean
  /** Needed to return to Final exam control after a dry run. */
  courseId?: string
  assessmentId?: string
}) {
  const router = useRouter()

  /**
   * Reading language. Held here, never sent to the server.
   *
   * Starts from what the rules screen chose, then re-reads storage once on
   * mount so a mid-exam reload comes back in the language the student was
   * actually reading rather than resetting to English.
   */
  const [language, setLanguage] = useState<ExamLanguage>(initialLanguage)

  useEffect(() => {
    const stored = readStoredLanguage()
    if (stored) setLanguage(stored)
  }, [])

  const changeLanguage = (next: ExamLanguage) => {
    setLanguage(next)
    storeLanguage(next)
  }

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

      if (isPractice && courseId) {
        router.push(`/admin/courses/${courseId}/final-exam`)
        return
      }

      router.refresh()
    },
    [attemptId, courseId, isPractice, router]
  )

  /**
   * Can this browser actually do fullscreen?
   *
   * iPhone Safari cannot fullscreen a non-video element. Where the answer is no,
   * the gate never appears and the fullscreen warning is never armed, so a
   * student on such a device sits the exam windowed rather than being locked out
   * of a rule they cannot satisfy.
   *
   * Entering fullscreen is *not* attempted here. `requestFullscreen` is refused
   * outside a user gesture, and this component mounts after a form redirect with
   * no gesture attached — an earlier version asked here and was silently
   * ignored, which is why the exam opened windowed. `IntegrityGuard` puts a
   * blocking gate over the paper instead, and its button supplies the gesture.
   */
  const canFullscreen =
    typeof document !== 'undefined' &&
    Boolean(document.fullscreenEnabled) &&
    typeof document.documentElement.requestFullscreen === 'function'

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
        setSaveMessage(result.message ?? t('didNotSave', language))
      }
    },
    [attemptId, language]
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
    const groups: Array<{
      section: ExamSection | null
      items: number[]
      answered: number
    }> = []
    for (const [i, question] of questions.entries()) {
      const last = groups[groups.length - 1]
      if (last && questions[last.items[0]].section === question.section) {
        last.items.push(i)
        if (answers[question.id]) last.answered += 1
      } else {
        groups.push({
          section: sections.find((s) => s.n === question.section) ?? null,
          items: [i],
          answered: answers[question.id] ? 1 : 0,
        })
      }
    }
    return groups
  }, [questions, sections, answers])

  const urgent = secondsLeft <= RED_FROM_SECONDS
  const critical = secondsLeft <= 60
  const isLastPage = pageIndex === pages.length - 1

  if (!page) return null

  // A frozen attempt shows nothing else. The questions are not merely hidden —
  // `save_response` and `submit_attempt` both refuse a frozen attempt, so there
  // is nothing to gain from digging them out of the page.
  if (frozen) {
    return (
      <div dir={dirFor(language)} lang={language}>
        {isPractice && courseId && assessmentId ? (
          <div className="border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-center sm:px-6">
            <p className="text-[13px] font-semibold text-amber-900">
              Dry run — nothing is saved for grades
            </p>
            <form action={discardPracticeAttempt} className="mt-1.5">
              <input type="hidden" name="attempt_id" value={attemptId} />
              <input type="hidden" name="assessment_id" value={assessmentId} />
              <input type="hidden" name="course_id" value={courseId} />
              <button
                type="submit"
                className="text-[12px] font-medium text-amber-800 underline decoration-amber-400 underline-offset-2 hover:text-amber-950"
              >
                Exit dry run
              </button>
            </form>
          </div>
        ) : null}
        <QuizFrozen
          attemptId={attemptId}
          warningLimit={warningLimit}
          language={language}
        />
      </div>
    )
  }

  return (
    // `dir` is set here rather than on <html> so only the exam mirrors. The
    // numbered navigator, the clock and the option letters stay legible either
    // way because they are Western numerals and Latin letters by design.
    <div
      dir={dirFor(language)}
      lang={language}
      className={cx('min-h-dvh bg-canvas', lockdown && 'select-none')}
    >
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
        language={language}
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

      {isPractice ? (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-center sm:px-6">
          <p className="text-[13px] font-semibold text-amber-900">
            Dry run — nothing is saved for grades
          </p>
          {courseId && assessmentId ? (
            <form action={discardPracticeAttempt} className="mt-1.5">
              <input type="hidden" name="attempt_id" value={attemptId} />
              <input type="hidden" name="assessment_id" value={assessmentId} />
              <input type="hidden" name="course_id" value={courseId} />
              <button
                type="submit"
                className="text-[12px] font-medium text-amber-800 underline decoration-amber-400 underline-offset-2 hover:text-amber-950"
              >
                Exit dry run
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------------------------------------ header */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-navy-900">
              {title}
            </p>
            <p className="text-[12px] text-ink-faint">
              {answeredCount} {t('of', language)} {questions.length}{' '}
              {t('answered', language)}
              {flagged.length > 0
                ? ` · ${flagged.length} ${t('flagged', language)}`
                : ''}
            </p>
          </div>

          {/* Stays reachable for the whole attempt. A student who picked the
              wrong language at the start must not have to abandon the exam to
              fix it. */}
          {bilingual ? (
            <ExamLanguageToggle
              value={language}
              onChange={changeLanguage}
              size="sm"
            />
          ) : null}

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
              title={t('warningsTitle', language)}
            >
              <AlertIcon width={14} height={14} />
              {warningLimit !== null
                ? `${warnings} ${t('of', language)} ${warningLimit} ${t('warnings', language)}`
                : `${warnings} ${t('integrityEvents', language)}`}
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
              ? t('timeLeftCritical', language)
              : t('timeLeftLow', language)}
          </p>
        ) : null}
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
        {/* --------------------------------------------------------- navigator */}
        {/* Sticky sidebar on large screens; stacks above the paper on smaller ones.
            With dir=rtl the first grid column sits on the right automatically. */}
        <aside className="lg:sticky lg:top-[5.5rem] lg:self-start">
          <nav
            aria-label={t('questionsNav', language)}
            className="space-y-3 rounded-md border border-line bg-surface p-3 sm:p-4"
          >
            {navGroups.map((group, groupIndex) => (
              <div key={group.section?.n ?? `g${groupIndex}`}>
                {group.section ? (
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <p className="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
                      {pickText(
                        group.section.title,
                        group.section.titleAr,
                        language
                      )}
                    </p>
                    <p className="shrink-0 text-[11px] tabular-nums text-ink-faint">
                      {group.answered}/{group.items.length}
                    </p>
                  </div>
                ) : null}
                <ol className="flex flex-wrap gap-1.5">
                  {group.items.map((i) => {
                    const q = questions[i]
                    const isAnswered = Boolean(answers[q.id])
                    const isFlagged = flags[q.id]
                    const isCurrent = page.questions.includes(i)
                    // Per-question zeroing only applies to legacy quizzes.
                    // Exam mode uses attempt-level warnings — never show a "0" chip.
                    const invalidated =
                      !examMode && integrityByQuestion[q.id]?.invalidated

                    return (
                      <li key={q.id}>
                        <button
                          type="button"
                          onClick={() => goToQuestion(i)}
                          aria-current={isCurrent ? 'true' : undefined}
                          aria-label={`${t('question', language)} ${i + 1}${
                            isAnswered
                              ? `, ${t('answered', language)}`
                              : ''
                          }${isFlagged ? `, ${t('flagged', language)}` : ''}`}
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
                              className="absolute -top-1 -end-1 size-2.5 rounded-full border border-surface bg-amber-500"
                            />
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
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
                {pickText(page.section.title, page.section.titleAr, language)}
              </h2>
              {page.section.brief ? (
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
                  {pickText(page.section.brief, page.section.briefAr, language)}
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
                {pickText(
                  page.section.useCase.title,
                  page.section.useCase.titleAr,
                  language
                )}
              </h3>

              <p className="mt-3 text-[15.5px] leading-relaxed text-ink sm:text-[16.5px]">
                {pickText(
                  page.section.useCase.intro,
                  page.section.useCase.introAr,
                  language
                )}
              </p>

              {page.section.useCase.requirements.length > 0 ? (
                <>
                  {page.section.useCase.requirementsTitle ? (
                    <p className="mt-5 text-[14px] font-semibold text-navy-900">
                      {pickText(
                        page.section.useCase.requirementsTitle,
                        page.section.useCase.requirementsTitleAr,
                        language
                      )}
                    </p>
                  ) : null}
                  <ul className="mt-2.5 space-y-2">
                    {(language === 'ar' &&
                    page.section.useCase.requirementsAr.length ===
                      page.section.useCase.requirements.length
                      ? page.section.useCase.requirementsAr
                      : page.section.useCase.requirements
                    ).map((item) => (
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
                  {pickText(
                    page.section.useCase.closing,
                    page.section.useCase.closingAr,
                    language
                  )}
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
                      {t('question', language)} {questionIndex + 1}{' '}
                      {t('of', language)} {questions.length}
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
                      {flags[question.id]
                        ? t('flaggedForLater', language)
                        : t('flagForLater', language)}
                    </button>
                  </div>

                  {/* Legacy quizzes only: attempt-level exam papers never show
                      a per-question integrity banner (that confused students). */}
                  {!examMode && integrity?.invalidated ? (
                    <Alert
                      tone="danger"
                      className="mb-5 px-4 py-3.5 text-[14px]"
                      title="This question is worth zero points"
                    >
                      Three integrity events were recorded while you were on this
                      question. Continue with the rest of the assessment; your
                      other questions are unaffected.
                    </Alert>
                  ) : !examMode && integrity?.count ? (
                    <Alert tone="amber" className="mb-5" title="Integrity warning">
                      {integrity.count} of 3 events recorded on this question.
                      Three events make only this question worth zero points.
                    </Alert>
                  ) : null}

                  <h1 className="text-[17px] leading-relaxed font-medium text-navy-900 sm:text-[18px]">
                    {pickText(question.stem, question.stemAr, language)}
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
                              {pickText(option.body, option.bodyAr, language)}
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
            {t('previous', language)}
          </Button>

          {!isLastPage ? (
            <Button onClick={() => goToPage(pageIndex + 1)}>
              {page.questions.length > 1
                ? t('next', language)
                : t('nextQuestion', language)}
            </Button>
          ) : (
            <Button onClick={() => setConfirming(true)}>
              {t('reviewAndSubmit', language)}
            </Button>
          )}

          <span className="ms-auto text-[12px] text-ink-faint">
            {save === 'saving'
              ? t('saving', language)
              : save === 'error'
                ? (saveMessage ?? t('notSaved', language))
                : save === 'saved'
                  ? t('saved', language)
                  : t('savesAsYouGo', language)}
          </span>
        </div>

        {!isLastPage ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-[13px] font-medium text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-navy-900"
            >
              {t('finishEarly', language)}
            </button>
          </div>
        ) : null}
        </main>
      </div>

      {/* ------------------------------------------------------ submit dialog */}
      {confirming ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-title"
          className="fixed inset-0 z-40 grid place-items-center bg-navy-900/55 p-4 backdrop-blur-[2px]"
        >
          <div
            dir={dirFor(language)}
            lang={language}
            className="animate-pop w-full max-w-md rounded-md border border-line bg-surface p-6 shadow-lg"
          >
            <h2
              id="submit-title"
              className="text-[16px] font-semibold text-navy-900"
            >
              {t('submitTitle', language)}
            </h2>

            <dl className="mt-4 space-y-2 text-[14px]">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-soft">{t('answeredLabel', language)}</dt>
                <dd className="font-medium text-navy-900">
                  {answeredCount} {t('of', language)} {questions.length}
                </dd>
              </div>
              {unanswered.length > 0 ? (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-danger-600">{t('leftBlank', language)}</dt>
                  <dd className="font-medium text-danger-600">
                    {unanswered.map((q) => q.position + 1).join(', ')}
                  </dd>
                </div>
              ) : null}
              {flagged.length > 0 ? (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-amber-800">{t('stillFlagged', language)}</dt>
                  <dd className="font-medium text-amber-800">
                    {flagged.map((q) => q.position + 1).join(', ')}
                  </dd>
                </div>
              ) : null}
            </dl>

            <p className="mt-4 text-[13px] text-ink-soft">
              {unanswered.length > 0
                ? t('blankCountAsWrong', language)
                : t('answeredEverything', language)}{' '}
              {t('oneAttemptNote', language)}
              {resultsHidden ? ` ${t('scoreHiddenNote', language)}` : ''}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => void submit('submitted')} disabled={submitting}>
                {submitting
                  ? t('submitting', language)
                  : t('submitForMarking', language)}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirming(false)}
                disabled={submitting}
              >
                {t('keepWorking', language)}
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
                  {t('goToFirstBlank', language)}
                </Button>
              ) : flagged.length > 0 ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setConfirming(false)
                    goToQuestion(flagged[0].position)
                  }}
                  disabled={submitting}
                >
                  <CheckIcon width={15} height={15} />
                  {t('goToFirstFlagged', language)}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
