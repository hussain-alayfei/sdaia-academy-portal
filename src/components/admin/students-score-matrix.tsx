'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { Button, Input, Panel, Select, cx } from '@/components/ui'
import type { AssessmentKind, AttemptStatus } from '@/lib/types'

export type AssessmentCol = {
  id: string
  shortLabel: string
  dayNumber: number | null
  title: string
  kind: AssessmentKind
  isFinal: boolean
  position: number
}

export type CellScore = {
  status: 'none' | AttemptStatus
  percent: number | null
  correct: number | null
  total: number | null
}

export type MatrixStudent = {
  id: string
  fullName: string | null
  email: string
  done: number
  total: number
  avg: number | null
  finalPercent: number | null
  scores: Record<string, CellScore>
}

type SortKey =
  | 'name-asc'
  | 'name-desc'
  | 'avg-desc'
  | 'avg-asc'
  | 'done-desc'
  | 'final-desc'
  | 'final-asc'

const KIND_HINT: Record<AssessmentKind, string> = {
  pre: 'Start',
  post: 'End',
  quiz: 'Quiz',
}

function nullsLast(a: number | null, b: number | null, dir: 1 | -1) {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return (a - b) * dir
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function cellLabel(score: CellScore | undefined) {
  if (!score || score.status === 'none') return '—'
  if (score.status === 'in_progress') return 'Open'
  if (score.percent !== null) return `${score.percent}%`
  if (score.correct !== null && score.total !== null) {
    return `${score.correct}/${score.total}`
  }
  return '—'
}

function scoreCellClass(tone: 'empty' | 'open' | 'ok' | 'bad') {
  return cx(
    'inline-flex min-w-[2.75rem] justify-center rounded-sm px-1.5 py-1 text-[12px] font-semibold tabular-nums',
    tone === 'empty' && 'font-normal text-ink-faint hover:bg-navy-50',
    tone === 'open' &&
      'bg-amber-50 text-[11px] text-amber-800 hover:bg-amber-100',
    tone === 'ok' && 'bg-teal-50 text-teal-900 hover:bg-teal-100',
    tone === 'bad' && 'bg-danger-50 text-danger-600 hover:bg-danger-50'
  )
}

/**
 * Searchable score matrix with Avg excluding Final, sort, and CSV export.
 */
export function StudentsScoreMatrix({
  courseId,
  courseSlug,
  assessments,
  students,
}: {
  courseId: string
  courseSlug?: string
  assessments: AssessmentCol[]
  students: MatrixStudent[]
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('name-asc')

  const regularAssessments = useMemo(
    () => assessments.filter((a) => !a.isFinal),
    [assessments]
  )
  const finalAssessment = useMemo(
    () => assessments.find((a) => a.isFinal) ?? null,
    [assessments]
  )

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase()
    let rows = students
    if (q) {
      rows = rows.filter(
        (s) =>
          (s.fullName || '').toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q)
      )
    }

    const copy = [...rows]
    copy.sort((a, b) => {
      switch (sort) {
        case 'name-asc':
          return (a.fullName || a.email).localeCompare(
            b.fullName || b.email,
            undefined,
            { sensitivity: 'base' }
          )
        case 'name-desc':
          return (b.fullName || b.email).localeCompare(
            a.fullName || a.email,
            undefined,
            { sensitivity: 'base' }
          )
        case 'avg-desc':
          return nullsLast(a.avg, b.avg, -1)
        case 'avg-asc':
          return nullsLast(a.avg, b.avg, 1)
        case 'done-desc':
          return b.done - a.done || (a.fullName || '').localeCompare(b.fullName || '')
        case 'final-desc':
          return nullsLast(a.finalPercent, b.finalPercent, -1)
        case 'final-asc':
          return nullsLast(a.finalPercent, b.finalPercent, 1)
        default:
          return 0
      }
    })
    return copy
  }, [students, query, sort])

  function exportCsv() {
    const headers = [
      'Name',
      'Email',
      ...regularAssessments.map((a) => a.shortLabel),
      'Avg (ex Final)',
      ...(finalAssessment ? ['Final'] : []),
      'Done',
      'Total papers',
    ]

    const lines = filteredSorted.map((s) => {
      const cols = [
        csvEscape(s.fullName || ''),
        csvEscape(s.email),
        ...regularAssessments.map((a) => {
          const cell = s.scores[a.id]
          return cell?.percent !== null && cell?.percent !== undefined
            ? String(cell.percent)
            : cellLabel(cell)
        }),
        s.avg !== null ? String(s.avg) : '',
        ...(finalAssessment
          ? [
              s.finalPercent !== null
                ? String(s.finalPercent)
                : cellLabel(s.scores[finalAssessment.id]),
            ]
          : []),
        String(s.done),
        String(s.total),
      ]
      return cols.join(',')
    })

    const blob = new Blob([[headers.join(','), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${courseSlug || 'course'}-students-scores.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Panel>
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-[13px] text-ink-soft">
            <span className="font-semibold text-navy-900">{students.length}</span>{' '}
            students
            {query.trim() ? ` · showing ${filteredSorted.length}` : null}
            <span className="ms-1 text-ink-faint">· Avg excludes Final</span>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="block w-full sm:w-[180px]">
              <span className="sr-only">Sort</span>
              <Select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort students"
              >
                <option value="name-asc">Name A → Z</option>
                <option value="name-desc">Name Z → A</option>
                <option value="avg-desc">Avg high → low</option>
                <option value="avg-asc">Avg low → high</option>
                <option value="done-desc">Done high → low</option>
                <option value="final-desc">Final high → low</option>
                <option value="final-asc">Final low → high</option>
              </Select>
            </label>
            <label className="block w-full sm:w-[220px]">
              <span className="sr-only">Search students</span>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or email"
                autoComplete="off"
              />
            </label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={exportCsv}
              disabled={filteredSorted.length === 0}
            >
              Export CSV
            </Button>
          </div>
        </div>
        <p className="text-[12px] text-ink-faint">
          Header opens class results · score opens results · name or Details opens
          the student.
        </p>
      </div>

      {filteredSorted.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-ink-soft sm:px-5">
          No students match “{query.trim()}”.
        </p>
      ) : (
        <div className="scroll-x max-h-[min(75vh,800px)] overflow-auto">
          <table className="w-full min-w-max border-collapse text-left">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-line bg-navy-50">
                <th
                  scope="col"
                  className="sticky start-0 z-30 bg-navy-50 px-3 py-2.5 text-[11px] font-semibold tracking-wide text-ink-soft uppercase sm:px-4"
                >
                  Student
                </th>
                {regularAssessments.map((assessment) => (
                  <th
                    key={assessment.id}
                    scope="col"
                    title={assessment.title}
                    className="px-1.5 py-2.5 text-center text-[11px] font-semibold tracking-wide text-ink-soft uppercase"
                  >
                    <Link
                      href={`/admin/courses/${courseId}/assessments/${assessment.id}/results`}
                      className="block hover:text-teal-800"
                    >
                      <span className="block">{assessment.shortLabel}</span>
                      <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-ink-faint">
                        {assessment.dayNumber
                          ? `Day ${assessment.dayNumber}`
                          : KIND_HINT[assessment.kind]}
                      </span>
                    </Link>
                  </th>
                ))}
                <th
                  scope="col"
                  className="border-s border-line-strong bg-navy-50 px-3 py-2.5 text-center text-[11px] font-semibold tracking-wide text-ink-soft uppercase"
                  title="Average of finished papers excluding Final"
                >
                  <span className="block">Avg</span>
                  <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-ink-faint">
                    ex Final
                  </span>
                </th>
                {finalAssessment ? (
                  <th
                    scope="col"
                    title={`${finalAssessment.title} · excluded from Avg`}
                    className="border-s border-navy-200 bg-navy-100/80 px-2 py-2.5 text-center text-[11px] font-semibold tracking-wide text-navy-800 uppercase"
                  >
                    <Link
                      href={`/admin/courses/${courseId}/assessments/${finalAssessment.id}/results`}
                      className="block hover:text-teal-800"
                    >
                      <span className="block">Final</span>
                      <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-navy-700/70">
                        excluded from Avg
                      </span>
                    </Link>
                  </th>
                ) : null}
                <th scope="col" className="px-3 py-2.5">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredSorted.map((student) => (
                <tr
                  key={student.id}
                  className="transition-colors hover:bg-navy-50/50"
                >
                  <th
                    scope="row"
                    className="sticky start-0 z-10 bg-surface px-3 py-2 text-left font-normal sm:px-4"
                  >
                    <Link
                      href={`/admin/courses/${courseId}/students/${student.id}`}
                      className="block hover:text-teal-800"
                    >
                      <span className="block text-[13px] font-semibold text-navy-900">
                        {student.fullName || '—'}
                      </span>
                      <span className="mt-0.5 block text-[11px] font-normal text-ink-faint">
                        {student.done}/{student.total} done
                      </span>
                    </Link>
                  </th>
                  {regularAssessments.map((assessment) => (
                    <td key={assessment.id} className="px-1 py-1.5 text-center">
                      <ScoreCell
                        courseId={courseId}
                        assessmentId={assessment.id}
                        studentId={student.id}
                        score={student.scores[assessment.id]}
                      />
                    </td>
                  ))}
                  <td className="border-s border-line-strong px-3 py-2 text-center">
                    {student.avg === null ? (
                      <span className="text-[12px] text-ink-faint">—</span>
                    ) : (
                      <span className="text-[13px] font-semibold tabular-nums text-navy-900">
                        {student.avg}%
                      </span>
                    )}
                  </td>
                  {finalAssessment ? (
                    <td className="border-s border-navy-200 bg-navy-50/40 px-1 py-1.5 text-center">
                      <ScoreCell
                        courseId={courseId}
                        assessmentId={finalAssessment.id}
                        studentId={student.id}
                        score={student.scores[finalAssessment.id]}
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/courses/${courseId}/students/${student.id}`}
                      className="inline-flex rounded-sm border border-line bg-surface px-2 py-1 text-[11px] font-medium text-teal-800 hover:border-teal-600"
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="border-t border-line px-4 py-2.5 sm:px-5">
        <summary className="cursor-pointer list-none text-[12px] font-medium text-ink-soft [&::-webkit-details-marker]:hidden">
          Legend
          <span className="ms-2 font-normal text-ink-faint">
            Green % · In progress · — · Timed out · Avg ignores Final
          </span>
        </summary>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-faint">
          <li>
            <span className="font-semibold text-teal-800">Green %</span> =
            submitted
          </li>
          <li>
            <span className="font-semibold text-amber-700">In progress</span> =
            still open
          </li>
          <li>
            <span className="font-semibold text-ink-soft">—</span> = not started
          </li>
          <li>
            <span className="font-semibold text-danger-600">Timed out</span> =
            clock ended
          </li>
          <li>
            <span className="font-semibold text-navy-800">Avg</span> = mean of
            finished papers except Final (blank Final does not pull Avg down)
          </li>
        </ul>
      </details>
    </Panel>
  )
}

function ScoreCell({
  courseId,
  assessmentId,
  studentId,
  score,
}: {
  courseId: string
  assessmentId: string
  studentId: string
  score: CellScore | undefined
}) {
  const detailHref = `/admin/courses/${courseId}/students/${studentId}`
  const resultsHref = `/admin/courses/${courseId}/assessments/${assessmentId}/results`

  if (!score || score.status === 'none') {
    return (
      <Link
        href={detailHref}
        className={scoreCellClass('empty')}
        title="Not started — open student"
      >
        —
      </Link>
    )
  }

  if (score.status === 'in_progress') {
    return (
      <Link href={detailHref} className={scoreCellClass('open')}>
        Open
      </Link>
    )
  }

  const label = cellLabel(score)

  return (
    <Link
      href={resultsHref}
      title={
        score.correct !== null && score.total !== null
          ? `${score.correct}/${score.total} · open class results`
          : 'Open class results'
      }
      className={scoreCellClass(
        score.status === 'timed_out' ? 'bad' : 'ok'
      )}
    >
      {label}
    </Link>
  )
}
