'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { CheckIcon, CrossIcon, FlagIcon } from '@/components/icons'
import { Alert, Button, cx } from '@/components/ui'

export type PreviewQuestion = {
  id: string
  stem: string
  options: Array<{ id: string; body: string }>
  correctOptionId: string | null
  rationale: string | null
}

function shuffled<T>(values: T[]): T[] {
  const copy = [...values]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function makePaper(questions: PreviewQuestion[], count: number) {
  return shuffled(questions)
    .slice(0, count)
    .map((question) => ({
      ...question,
      options: shuffled(question.options),
    }))
}

export function QuizPreview({
  title,
  questions,
  questionCount,
}: {
  title: string
  questions: PreviewQuestion[]
  questionCount: number
}) {
  const [paper, setPaper] = useState(() => makePaper(questions, questionCount))
  const [open, setOpen] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [flags, setFlags] = useState<Record<string, boolean>>({})

  const answered = useMemo(
    () => paper.filter((question) => answers[question.id]).length,
    [answers, paper]
  )
  const flagged = useMemo(
    () => paper.filter((question) => flags[question.id]).length,
    [flags, paper]
  )

  const reset = useCallback(() => {
    setPaper(makePaper(questions, questionCount))
    setAnswers({})
    setFlags({})
    setIndex(0)
    setDirection('next')
    setReviewing(false)
  }, [questionCount, questions])

  const close = useCallback(() => {
    setOpen(false)
    reset()
  }, [reset])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [close, open])

  const go = (target: number) => {
    if (target < 0 || target >= paper.length) return
    setDirection(target > index ? 'next' : 'prev')
    setIndex(target)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => setOpen(true)} disabled={!paper.length}>
          Begin preview
        </Button>
        <p className="text-[13px] text-ink-soft">
          Unlimited practice. Nothing is saved or scored.
        </p>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} instructor preview`}
          className="fixed inset-0 z-50 min-h-dvh overflow-y-auto bg-canvas animate-page"
        >
          <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
            <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-navy-900">{title}</p>
                <p className="text-[12px] text-ink-faint">
                  Instructor preview · {reviewing ? 'Answer review' : `${answered} of ${paper.length} answered${flagged ? ` · ${flagged} flagged` : ''}`}
                </p>
              </div>
              <span className="rounded-xs border border-teal-200 bg-teal-50 px-2 py-1 text-[12px] font-medium text-teal-800">
                No database writes
              </span>
              <Button type="button" variant="secondary" size="sm" onClick={close}>
                Exit preview
              </Button>
            </div>
          </header>

          <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
            <Alert tone="teal" className="mb-5" title="Safe testing mode">
              This simulates the student flow in this browser only. It has no timer,
              attempt record, integrity record, or score.
            </Alert>

            {reviewing ? (
              <div className="animate-page space-y-4">
                <div className="rounded-md border border-line bg-surface p-5">
                  <h1 className="text-[18px] font-semibold text-navy-900">Preview complete</h1>
                  <p className="mt-1 text-[14px] text-ink-soft">
                    Review the answer key below. No score was calculated or stored.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="button" onClick={reset}>Try another shuffled preview</Button>
                    <Button type="button" variant="secondary" onClick={close}>Exit preview</Button>
                  </div>
                </div>

                {paper.map((question, questionIndex) => {
                  const selected = answers[question.id]
                  return (
                    <article key={question.id} className="rounded-md border border-line bg-surface p-5 sm:p-6">
                      <p className="text-[12px] font-semibold tracking-wide text-ink-faint uppercase">
                        Question {questionIndex + 1}
                      </p>
                      <h2 className="mt-2 text-[16px] leading-relaxed text-navy-900">{question.stem}</h2>
                      <ul className="mt-4 space-y-2">
                        {question.options.map((option, optionIndex) => {
                          const correct = option.id === question.correctOptionId
                          const chosen = option.id === selected
                          return (
                            <li key={option.id} className={cx(
                              'flex items-start gap-3 rounded-sm border p-3 text-[14px]',
                              correct ? 'border-teal-300 bg-teal-50 text-teal-900' :
                                chosen ? 'border-danger-500/30 bg-danger-50 text-danger-600' : 'border-line bg-surface text-ink-soft'
                            )}>
                              <span className="mt-0.5 shrink-0">{correct ? <CheckIcon width={16} height={16} /> : chosen ? <CrossIcon width={16} height={16} /> : String.fromCharCode(65 + optionIndex)}</span>
                              <span>{option.body}</span>
                            </li>
                          )
                        })}
                      </ul>
                      {question.rationale ? <p className="mt-4 border-s-2 border-teal-300 ps-3 text-[13px] text-ink-soft">{question.rationale}</p> : null}
                    </article>
                  )
                })}
              </div>
            ) : (
              <>
                <nav aria-label="Questions" className="mb-6">
                  <ol className="flex flex-wrap gap-1.5">
                    {paper.map((question, questionIndex) => (
                      <li key={question.id}>
                        <button
                          type="button"
                          onClick={() => go(questionIndex)}
                          aria-current={index === questionIndex ? 'true' : undefined}
                          aria-label={`Question ${questionIndex + 1}${answers[question.id] ? ', answered' : ', not answered'}${flags[question.id] ? ', flagged' : ''}`}
                          className={cx(
                            'relative grid size-9 place-items-center rounded-sm border text-[13px] font-medium transition-colors',
                            index === questionIndex ? 'border-navy-900 bg-navy-900 text-white' :
                              answers[question.id] ? 'border-teal-300 bg-teal-50 text-teal-800' : 'border-line-strong bg-surface text-ink-soft'
                          )}
                        >
                          {questionIndex + 1}
                          {flags[question.id] ? <span aria-hidden className="absolute -top-1 -right-1 size-2.5 rounded-full border border-surface bg-amber-500" /> : null}
                        </button>
                      </li>
                    ))}
                  </ol>
                </nav>

                {paper[index] ? (
                  <article key={paper[index].id} className={cx('rounded-md border border-line bg-surface p-5 sm:p-7', direction === 'next' ? 'animate-slide-next' : 'animate-slide-prev')}>
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <p className="text-[12px] font-semibold tracking-wide text-ink-faint uppercase">Question {index + 1} of {paper.length}</p>
                      <button type="button" onClick={() => setFlags((current) => ({ ...current, [paper[index].id]: !current[paper[index].id] }))} className={cx('inline-flex shrink-0 items-center gap-1.5 rounded-xs border px-2 py-1 text-[12px] font-medium', flags[paper[index].id] ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-line-strong bg-surface text-ink-soft')}>
                        <FlagIcon width={13} height={13} />
                        {flags[paper[index].id] ? 'Flagged for later' : 'Flag for later'}
                      </button>
                    </div>
                    <h1 className="text-[17px] leading-relaxed font-medium text-navy-900 sm:text-[18px]">{paper[index].stem}</h1>
                    <ul className="mt-5 space-y-2.5">
                      {paper[index].options.map((option, optionIndex) => {
                        const selected = answers[paper[index].id] === option.id
                        return (
                          <li key={option.id}>
                            <label className={cx('flex cursor-pointer items-start gap-3 rounded-sm border p-3.5 transition-colors sm:p-4', selected ? 'border-teal-500 bg-teal-50/70 ring-1 ring-teal-500/30' : 'border-line-strong bg-surface hover:border-navy-400 hover:bg-navy-50/60')}>
                              <input type="radio" name={`preview-${paper[index].id}`} checked={selected} onChange={() => setAnswers((current) => ({ ...current, [paper[index].id]: option.id }))} className="sr-only" />
                              <span aria-hidden className={cx('grid size-6 shrink-0 place-items-center rounded-full border text-[12px] font-semibold', selected ? 'border-teal-600 bg-teal-600 text-white' : 'border-line-strong bg-surface text-ink-soft')}>{String.fromCharCode(65 + optionIndex)}</span>
                              <span className="text-[14.5px] leading-relaxed text-ink">{option.body}</span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </article>
                ) : null}

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button type="button" variant="secondary" onClick={() => go(index - 1)} disabled={index === 0}>Previous</Button>
                  {index < paper.length - 1 ? <Button type="button" onClick={() => go(index + 1)}>Next question</Button> : <Button type="button" onClick={() => setReviewing(true)}>Finish preview</Button>}
                  <span className="ms-auto text-[12px] text-ink-faint">Answers stay in this browser preview only</span>
                </div>
              </>
            )}
          </main>
        </div>
      ) : null}
    </>
  )
}
