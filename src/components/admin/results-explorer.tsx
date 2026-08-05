'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { AdminSectionHeader } from '@/components/admin/section-header'
import { AlertIcon } from '@/components/icons'
import {
  Badge,
  EmptyState,
  Input,
  Panel,
  cx,
} from '@/components/ui'
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_TONES,
  formatDate,
} from '@/lib/format'
import type {
  AttemptStatus,
  IntegrityEventKind,
  QuestionDifficulty,
} from '@/lib/types'

const STATUS_LABELS: Record<AttemptStatus, string> = {
  in_progress: 'In progress',
  submitted: 'Submitted',
  timed_out: 'Ran out of time',
  integrity_stopped: 'Stopped for integrity',
}

const EVENT_LABELS: Record<IntegrityEventKind, string> = {
  tab_hidden: 'Switched tab or app',
  window_blur: 'Window lost focus',
  copy: 'Tried to copy',
  paste: 'Tried to paste',
  context_menu: 'Right-click menu',
}

export type ResultsAttemptRow = {
  id: string
  status: AttemptStatus
  started_at: string
  submitted_at: string | null
  correct_count: number | null
  question_count: number | null
  warning_count: number
  studentName: string
  studentEmail: string
  events: Array<{
    id: string
    kind: IntegrityEventKind
    questionPosition: number | null
    question_warning_number: number | null
    occurred_at: string
  }>
}

export type ResultsQuestionRow = {
  questionId: string
  stem: string
  difficulty: QuestionDifficulty
  answered: number
  correct: number
}

type TabId = 'attempts' | 'questions'
type AttemptFilter = 'all' | 'flagged' | 'low'
type AttemptSort = 'name' | 'score' | 'recent'
type QuestionSort = 'order' | 'hardest' | 'easiest'

function minutesTaken(startedAt: string, submittedAt: string | null) {
  if (!submittedAt) return null
  const ms = new Date(submittedAt).getTime() - new Date(startedAt).getTime()
  return Math.max(1, Math.round(ms / 60000))
}

function scoreOf(row: ResultsAttemptRow) {
  if (row.status === 'in_progress' || !row.question_count) return null
  return (row.correct_count ?? 0) / row.question_count
}

function isFlagged(row: ResultsAttemptRow) {
  return (
    row.status === 'integrity_stopped' ||
    row.warning_count > 0 ||
    row.events.some((e) => (e.question_warning_number ?? 0) >= 3)
  )
}

/**
 * Admin results report: header → equal KPIs → tabs → toolbar → table.
 * Integrity details open in a slide-over, not inline in the cell.
 */
export function ResultsExplorer({
  title,
  initialTab = 'attempts',
  attempts,
  questions,
}: {
  title: string
  initialTab?: TabId
  attempts: ResultsAttemptRow[]
  questions: ResultsQuestionRow[]
}) {
  const [tab, setTab] = useState<TabId>(
    initialTab === 'questions' ? 'questions' : 'attempts'
  )
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<AttemptFilter>('all')
  const [attemptSort, setAttemptSort] = useState<AttemptSort>('recent')
  const [questionSort, setQuestionSort] = useState<QuestionSort>('hardest')
  const [expandedStem, setExpandedStem] = useState<string | null>(null)
  const [integrityAttemptId, setIntegrityAttemptId] = useState<string | null>(
    null
  )

  const marked = attempts.filter(
    (a) => a.status !== 'in_progress' && a.question_count
  )
  const inProgress = attempts.filter((a) => a.status === 'in_progress').length
  const average =
    marked.length === 0
      ? null
      : Math.round(
          (marked.reduce((sum, a) => sum + (scoreOf(a) ?? 0), 0) /
            marked.length) *
            100
        )
  const flaggedCount = attempts.filter(isFlagged).length
  const lowCount = attempts.filter((a) => {
    const s = scoreOf(a)
    return s !== null && s < 0.6
  }).length

  const integrityAttempt =
    integrityAttemptId == null
      ? null
      : (attempts.find((a) => a.id === integrityAttemptId) ?? null)

  const filteredAttempts = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = attempts.filter((row) => {
      if (filter === 'flagged' && !isFlagged(row)) return false
      if (filter === 'low') {
        const s = scoreOf(row)
        if (s === null || s >= 0.6) return false
      }
      if (!q) return true
      return (
        row.studentName.toLowerCase().includes(q) ||
        row.studentEmail.toLowerCase().includes(q)
      )
    })

    list = [...list].sort((a, b) => {
      if (attemptSort === 'name') {
        return a.studentName.localeCompare(b.studentName, undefined, {
          sensitivity: 'base',
        })
      }
      if (attemptSort === 'score') {
        const sa = scoreOf(a)
        const sb = scoreOf(b)
        if (sa === null && sb === null) return 0
        if (sa === null) return 1
        if (sb === null) return -1
        return sb - sa
      }
      const ta = new Date(a.submitted_at ?? a.started_at).getTime()
      const tb = new Date(b.submitted_at ?? b.started_at).getTime()
      return tb - ta
    })

    return list
  }, [attempts, query, filter, attemptSort])

  const sortedQuestions = useMemo(() => {
    const withRate = questions.map((stat, index) => ({
      ...stat,
      index,
      rate:
        stat.answered === 0
          ? null
          : Math.round((stat.correct / stat.answered) * 100),
    }))

    return [...withRate].sort((a, b) => {
      if (questionSort === 'order') return a.index - b.index
      const ra = a.rate ?? (questionSort === 'hardest' ? 101 : -1)
      const rb = b.rate ?? (questionSort === 'hardest' ? 101 : -1)
      return questionSort === 'hardest' ? ra - rb : rb - ra
    })
  }, [questions, questionSort])

  const tabs: { id: TabId; label: string }[] = [
    { id: 'attempts', label: `Students (${attempts.length})` },
    { id: 'questions', label: `Questions (${questions.length})` },
  ]

  return (
    <div className="space-y-5">
      <AdminSectionHeader
        eyebrow="Results"
        title={title}
        description="Class scores and integrity for this paper."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Submitted" value={String(marked.length)} />
        <KpiCard label="In progress" value={String(inProgress)} />
        <KpiCard
          label="Class average"
          value={average === null ? '—' : `${average}%`}
        />
        <KpiCard
          label="Flagged"
          value={String(flaggedCount)}
          warn={flaggedCount > 0}
        />
      </div>

      <nav
        aria-label="Results sections"
        className="scroll-x flex gap-1 border-b border-line"
      >
        {tabs.map((item) => {
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => setTab(item.id)}
              className={cx(
                'shrink-0 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors',
                active
                  ? 'border-teal-600 text-teal-800'
                  : 'border-transparent text-ink-soft hover:text-navy-800'
              )}
            >
              {item.label}
            </button>
          )
        })}
      </nav>

      {tab === 'attempts' ? (
        <Panel>
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
            <label className="block w-full sm:max-w-[240px] sm:flex-1">
              <span className="sr-only">Search students</span>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or email"
                autoComplete="off"
              />
            </label>

            <div
              role="group"
              aria-label="Filter students"
              className="flex flex-wrap items-center gap-1.5"
            >
              {(
                [
                  { id: 'all', label: `All (${attempts.length})` },
                  { id: 'flagged', label: `Flagged (${flaggedCount})` },
                  { id: 'low', label: `Below 60% (${lowCount})` },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilter(chip.id)}
                  className={cx(
                    'rounded-sm border px-2.5 py-1.5 text-[12px] font-medium transition-colors',
                    filter === chip.id
                      ? 'border-teal-600 bg-teal-50 text-teal-900'
                      : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-navy-800'
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-1.5 text-[12px] text-ink-soft sm:ms-auto">
              Sort
              <select
                value={attemptSort}
                onChange={(e) =>
                  setAttemptSort(e.target.value as AttemptSort)
                }
                className="rounded-sm border border-line bg-surface px-2 py-1.5 text-[12px] text-navy-900"
              >
                <option value="recent">Most recent</option>
                <option value="name">Name A–Z</option>
                <option value="score">Score high → low</option>
              </select>
            </label>
          </div>

          {attempts.length === 0 ? (
            <EmptyState
              title="Nobody has sat this yet"
              description="Publish and unlock it, and results will appear here as students finish."
            />
          ) : filteredAttempts.length === 0 ? (
            <EmptyState
              title="No matching students"
              description="Clear the search or switch the filter."
            />
          ) : (
            <div
              className={cx(
                'scroll-x overflow-x-auto',
                filteredAttempts.length > 12 && 'max-h-[min(70vh,720px)] overflow-y-auto'
              )}
            >
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-line bg-navy-50">
                    {['Student', 'Score', 'Status', 'Duration', 'Flags'].map(
                      (heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-ink-soft uppercase sm:px-4"
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredAttempts.map((attempt) => {
                    const total = attempt.question_count ?? 0
                    const correct = attempt.correct_count ?? 0
                    const stopped = attempt.status === 'integrity_stopped'
                    const taken = minutesTaken(
                      attempt.started_at,
                      attempt.submitted_at
                    )
                    const pct =
                      attempt.status !== 'in_progress' && total > 0
                        ? Math.round((correct / total) * 100)
                        : null
                    const eventCount = attempt.events.length
                    const hot = isFlagged(attempt)

                    return (
                      <tr
                        key={attempt.id}
                        className={cx(
                          'align-middle transition-colors',
                          hot ? 'bg-danger-50/30' : 'hover:bg-navy-50/50'
                        )}
                      >
                        <td className="px-3 py-3 sm:px-4">
                          <span className="block text-[13px] font-medium text-navy-900">
                            {attempt.studentName || '—'}
                          </span>
                          <span className="block truncate text-[11px] text-ink-faint">
                            {attempt.studentEmail}
                          </span>
                        </td>

                        <td className="px-3 py-3 sm:px-4">
                          {attempt.status === 'in_progress' ? (
                            <span className="text-[13px] text-ink-faint">—</span>
                          ) : (
                            <span className="inline-flex items-baseline gap-1.5">
                              <span
                                className={cx(
                                  'text-[13px] font-medium tabular-nums',
                                  hot ? 'text-danger-600' : 'text-navy-900'
                                )}
                              >
                                {correct}/{total}
                              </span>
                              {pct !== null ? (
                                <span className="text-[11px] tabular-nums text-ink-faint">
                                  {pct}%
                                </span>
                              ) : null}
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-3 sm:px-4">
                          <Badge
                            tone={
                              stopped
                                ? 'danger'
                                : attempt.status === 'timed_out'
                                  ? 'amber'
                                  : attempt.status === 'submitted'
                                    ? 'teal'
                                    : 'neutral'
                            }
                          >
                            {STATUS_LABELS[attempt.status]}
                          </Badge>
                        </td>

                        <td className="px-3 py-3 sm:px-4">
                          <span className="block text-[13px] text-navy-800">
                            {taken === null ? 'Open' : `${taken} min`}
                          </span>
                          <span className="block text-[11px] text-ink-faint">
                            {formatDate(
                              attempt.submitted_at ?? attempt.started_at
                            )}
                          </span>
                        </td>

                        <td className="px-3 py-3 sm:px-4">
                          {eventCount === 0 ? (
                            <span className="text-[12px] text-ink-faint">
                              Clean
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setIntegrityAttemptId(attempt.id)}
                              className={cx(
                                'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[12px] font-medium transition-colors',
                                hot
                                  ? 'border-danger-500/30 bg-danger-50 text-danger-600 hover:bg-danger-50'
                                  : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50'
                              )}
                            >
                              <AlertIcon width={12} height={12} />
                              {eventCount}{' '}
                              {eventCount === 1 ? 'event' : 'events'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : (
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
            <p className="text-[13px] text-ink-soft">
              Low % often means a poorly worded item — not a hard topic.
            </p>
            <label className="flex items-center gap-1.5 text-[12px] text-ink-soft">
              Sort
              <select
                value={questionSort}
                onChange={(e) =>
                  setQuestionSort(e.target.value as QuestionSort)
                }
                className="rounded-sm border border-line bg-surface px-2 py-1.5 text-[12px] text-navy-900"
              >
                <option value="hardest">Hardest first</option>
                <option value="easiest">Easiest first</option>
                <option value="order">Question order</option>
              </select>
            </label>
          </div>

          {questions.length === 0 ? (
            <EmptyState title="No questions in this assessment" />
          ) : (
            <div
              className={cx(
                questions.length > 12 &&
                  'max-h-[min(70vh,720px)] overflow-y-auto'
              )}
            >
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-line bg-navy-50">
                    <th
                      scope="col"
                      className="w-12 px-3 py-2.5 text-[11px] font-semibold tracking-wide text-ink-soft uppercase sm:px-4"
                    >
                      #
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-ink-soft uppercase sm:px-4"
                    >
                      Question
                    </th>
                    <th
                      scope="col"
                      className="w-28 px-3 py-2.5 text-right text-[11px] font-semibold tracking-wide text-ink-soft uppercase sm:px-4"
                    >
                      Correct %
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sortedQuestions.map((stat) => {
                    const open = expandedStem === stat.questionId
                    const stemShort =
                      stat.stem.length > 120
                        ? `${stat.stem.slice(0, 120).trim()}…`
                        : stat.stem

                    return (
                      <tr
                        key={stat.questionId}
                        className="align-top hover:bg-navy-50/50"
                      >
                        <td className="px-3 py-3 sm:px-4">
                          <span className="grid size-7 place-items-center rounded-sm border border-line bg-navy-50 text-[12px] font-semibold text-navy-700">
                            {stat.index + 1}
                          </span>
                        </td>
                        <td className="px-3 py-3 sm:px-4">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedStem(open ? null : stat.questionId)
                            }
                            className="w-full text-left text-[13px] text-navy-900 hover:text-teal-900"
                          >
                            {open ? stat.stem : stemShort}
                            {stat.stem.length > 120 ? (
                              <span className="ms-1 text-[11px] font-medium text-teal-800">
                                {open ? 'Less' : 'More'}
                              </span>
                            ) : null}
                          </button>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <Badge tone={DIFFICULTY_TONES[stat.difficulty]}>
                              {DIFFICULTY_LABELS[stat.difficulty]}
                            </Badge>
                            <span className="text-[11px] text-ink-faint">
                              {stat.answered} answered
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right sm:px-4">
                          {stat.rate === null ? (
                            <span className="text-[13px] text-ink-faint">—</span>
                          ) : (
                            <div className="inline-flex w-24 flex-col items-end gap-1">
                              <span
                                className={cx(
                                  'text-[14px] font-medium tabular-nums',
                                  stat.rate < 30
                                    ? 'text-danger-600'
                                    : stat.rate > 95
                                      ? 'text-amber-700'
                                      : 'text-navy-900'
                                )}
                              >
                                {stat.rate}%
                              </span>
                              <span className="h-1.5 w-full overflow-hidden rounded-full bg-navy-100">
                                <span
                                  className={cx(
                                    'block h-full rounded-full',
                                    stat.rate < 30
                                      ? 'bg-danger-500'
                                      : stat.rate > 95
                                        ? 'bg-amber-500'
                                        : 'bg-teal-600'
                                  )}
                                  style={{ width: `${stat.rate}%` }}
                                />
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {integrityAttempt ? (
        <IntegrityDrawer
          attempt={integrityAttempt}
          onClose={() => setIntegrityAttemptId(null)}
        />
      ) : null}
    </div>
  )
}

function KpiCard({
  label,
  value,
  warn,
}: {
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div
      className={cx(
        'rounded-md border px-4 py-3.5',
        warn
          ? 'border-amber-200 bg-amber-50/60'
          : 'border-line bg-navy-50/40'
      )}
    >
      <p className="text-[10px] font-semibold tracking-[0.14em] text-ink-faint uppercase">
        {label}
      </p>
      <p
        className={cx(
          'mt-1.5 text-[22px] font-semibold leading-none tabular-nums',
          warn ? 'text-amber-900' : 'text-navy-900'
        )}
      >
        {value}
      </p>
    </div>
  )
}

function IntegrityDrawer({
  attempt,
  onClose,
}: {
  attempt: ResultsAttemptRow
  onClose: () => void
}) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    closeRef.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  function requestClose() {
    setVisible(false)
    window.setTimeout(onClose, 180)
  }

  const stopped = attempt.status === 'integrity_stopped'

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label="Close integrity panel"
        className={cx(
          'absolute inset-0 bg-navy-950/40 transition-opacity duration-200 ease-out',
          visible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={requestClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'absolute inset-y-0 end-0 flex w-full max-w-md flex-col border-s border-line bg-surface shadow-2xl',
          'transition-[opacity,transform] duration-200 ease-out',
          visible ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <p
              id={titleId}
              className="text-[15px] font-semibold text-navy-900"
            >
              Integrity log
            </p>
            <p className="mt-0.5 truncate text-[13px] text-ink-soft">
              {attempt.studentName || 'Student'}
            </p>
            {attempt.studentEmail ? (
              <p className="truncate text-[12px] text-ink-faint">
                {attempt.studentEmail}
              </p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={requestClose}
            className="rounded-sm px-2 py-1 text-[12px] font-medium text-ink-soft hover:bg-navy-50 hover:text-navy-900"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge tone={stopped ? 'danger' : 'amber'}>
              {STATUS_LABELS[attempt.status]}
            </Badge>
            <span className="text-[12px] text-ink-soft">
              {attempt.events.length}{' '}
              {attempt.events.length === 1 ? 'event' : 'events'}
            </span>
          </div>

          {attempt.events.length === 0 ? (
            <p className="text-[13px] text-ink-soft">No events recorded.</p>
          ) : (
            <ul className="space-y-2">
              {attempt.events.map((event) => (
                <li
                  key={event.id}
                  className="rounded-md border border-line bg-navy-50/40 px-3 py-2.5"
                >
                  <p className="text-[13px] font-medium text-navy-900">
                    {EVENT_LABELS[event.kind]}
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-soft">
                    {event.questionPosition !== null
                      ? `Question ${event.questionPosition + 1}`
                      : 'No question tagged'}
                    {event.question_warning_number
                      ? ` · warning ${event.question_warning_number}/3`
                      : ''}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-faint">
                    {formatDate(event.occurred_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}
