import Link from 'next/link'
import { notFound } from 'next/navigation'

import { removeStudent } from '@/app/actions/admin'
import { LocalTabs } from '@/components/admin/local-tabs'
import { TrashIcon } from '@/components/icons'
import {
  BackLink,
  Badge,
  Button,
  EmptyState,
  Panel,
  PanelHeader,
} from '@/components/ui'
import { canManageCourse, getCourseById } from '@/lib/dal'
import { ASSESSMENT_LABELS, formatDate } from '@/lib/format'
import { getAssessments, getCourseDays, getRoster } from '@/lib/queries'
import { ATTEMPT_STATUS_LABELS, getCourseAttempts } from '@/lib/quiz'
import type { AssessmentAttempt } from '@/lib/types'

function isFinished(attempt: AssessmentAttempt | undefined) {
  return Boolean(attempt && attempt.status !== 'in_progress')
}

function scorePercent(attempt: AssessmentAttempt | undefined) {
  if (!attempt?.question_count || attempt.correct_count === null) return null
  return Math.round((attempt.correct_count / attempt.question_count) * 100)
}

function elapsedLabel(attempt: AssessmentAttempt) {
  if (!attempt.submitted_at) return null
  const elapsed =
    new Date(attempt.submitted_at).getTime() -
    new Date(attempt.started_at).getTime()
  if (!Number.isFinite(elapsed) || elapsed < 0) return null
  const minutes = Math.max(1, Math.round(elapsed / 60_000))
  return `${minutes} min`
}

function statusTone(
  attempt: AssessmentAttempt | undefined
): 'neutral' | 'teal' | 'amber' | 'danger' {
  if (!attempt) return 'neutral'
  if (attempt.status === 'submitted') return 'teal'
  if (attempt.status === 'in_progress') return 'amber'
  return 'danger'
}

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; studentId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const [{ id, studentId }, { tab: tabParam }] = await Promise.all([
    params,
    searchParams,
  ])
  const course = await getCourseById(id)
  if (!course || !(await canManageCourse(course))) notFound()

  const [roster, rawAssessments, days, attempts] = await Promise.all([
    getRoster(course.id),
    getAssessments(course.id),
    getCourseDays(course.id),
    getCourseAttempts(course.id),
  ])

  const student = roster.find((row) => row.id === studentId)
  if (!student) notFound()

  const dayNumbers = new Map(days.map((day) => [day.id, day.day_number]))
  const assessments = rawAssessments
    .map((assessment) => ({
      ...assessment,
      dayNumber: assessment.day_id
        ? (dayNumbers.get(assessment.day_id) ?? null)
        : null,
    }))
    .sort(
      (a, b) =>
        (a.dayNumber ?? 999) - (b.dayNumber ?? 999) || a.position - b.position
    )

  const ownAttempts = attempts.filter((a) => a.student_id === student.id)
  const attemptByAssessment = new Map(
    ownAttempts.map((attempt) => [attempt.assessment_id, attempt])
  )

  const finished = ownAttempts.filter((attempt) => isFinished(attempt))
  const scored = finished
    .map(scorePercent)
    .filter((score): score is number => score !== null)
  const average =
    scored.length > 0
      ? Math.round(scored.reduce((sum, score) => sum + score, 0) / scored.length)
      : null
  const warnings = ownAttempts.reduce(
    (sum, attempt) => sum + attempt.warning_count,
    0
  )

  const initialTab =
    tabParam === 'scores' || tabParam === 'danger' || tabParam === 'overview'
      ? tabParam
      : 'scores'

  return (
    <div className="space-y-5">
      <BackLink href={`/admin/courses/${course.id}/students`}>
        All student scores
      </BackLink>

      <div>
        <p className="text-[10px] font-semibold tracking-[0.16em] text-teal-700 uppercase">
          Student detail
        </p>
        <h2 className="mt-1 text-[22px] font-semibold text-navy-900">
          {student.full_name || '—'}
        </h2>
        <p className="mt-0.5 text-[14px] text-ink-soft">{student.email}</p>
        <p className="mt-1 text-[12px] text-ink-faint">
          Joined {formatDate(student.enrolled_at)}
        </p>
      </div>

      <LocalTabs
        ariaLabel="Student sections"
        initialTab={initialTab}
        tabs={[
          {
            id: 'overview',
            label: 'Overview',
            hint: 'Progress summary',
          },
          {
            id: 'scores',
            label: `Scores (${finished.length}/${assessments.length})`,
            hint: 'Every assessment',
          },
          {
            id: 'danger',
            label: 'Danger',
            hint: 'Remove from course',
          },
        ]}
        panels={{
          overview: (
            <section
              aria-label="Summary"
              className="grid gap-3 sm:grid-cols-3"
            >
              <SummaryCard
                label="Progress"
                value={`${finished.length}/${assessments.length}`}
                detail="Assessments finished"
              />
              <SummaryCard
                label="Average score"
                value={average === null ? '—' : `${average}%`}
                detail={
                  scored.length === 0
                    ? 'No scores yet'
                    : `Across ${scored.length} scored attempt${scored.length === 1 ? '' : 's'}`
                }
              />
              <SummaryCard
                label="Warnings"
                value={String(warnings)}
                detail="Tab-switch and leave events"
              />
            </section>
          ),
          scores: (
            <Panel>
              <PanelHeader
                title="All assessments"
                description="Every assessment for this student, in day order."
              />

              {assessments.length === 0 ? (
                <EmptyState
                  title="No assessments yet"
                  description="Add them on the Assessments tab."
                />
              ) : (
                <div className="scroll-x">
                  <table className="w-full min-w-[720px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-line bg-navy-50/60">
                        {[
                          'Assessment',
                          'Status',
                          'Score',
                          'Time',
                          'Warnings',
                          '',
                        ].map((label) => (
                          <th
                            key={label || 'action'}
                            scope="col"
                            className="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-ink-soft uppercase first:sm:px-5"
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {assessments.map((assessment) => {
                        const attempt = attemptByAssessment.get(assessment.id)
                        const percent = scorePercent(attempt)
                        const elapsed = attempt ? elapsedLabel(attempt) : null
                        const status = attempt
                          ? ATTEMPT_STATUS_LABELS[attempt.status]
                          : 'Not started'

                        return (
                          <tr
                            key={assessment.id}
                            className="hover:bg-navy-50/40"
                          >
                            <th
                              scope="row"
                              className="px-4 py-3.5 text-left font-normal sm:px-5"
                            >
                              <span className="block text-[14px] font-semibold text-navy-900">
                                {assessment.title}
                              </span>
                              <span className="mt-0.5 block text-[12px] text-ink-faint">
                                {assessment.dayNumber
                                  ? `Day ${assessment.dayNumber} · `
                                  : ''}
                                {ASSESSMENT_LABELS[assessment.kind]}
                              </span>
                            </th>
                            <td className="px-4 py-3.5">
                              <Badge tone={statusTone(attempt)}>
                                {status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3.5">
                              {percent === null ||
                              !attempt ||
                              !isFinished(attempt) ? (
                                <span className="text-[13px] text-ink-faint">
                                  —
                                </span>
                              ) : (
                                <div>
                                  <p className="text-[16px] font-semibold tabular-nums text-navy-900">
                                    {percent}%
                                  </p>
                                  <p className="text-[12px] text-ink-faint">
                                    {attempt.correct_count}/
                                    {attempt.question_count} correct
                                  </p>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-[13px] text-ink-soft">
                              {elapsed ?? '—'}
                            </td>
                            <td className="px-4 py-3.5 text-[13px] tabular-nums text-ink-soft">
                              {attempt ? attempt.warning_count : '—'}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <Link
                                href={`/admin/courses/${course.id}/assessments/${assessment.id}/results`}
                                className="text-[12px] font-medium text-teal-800 hover:underline"
                              >
                                Class results
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          ),
          danger: (
            <Panel className="border-danger-500/25 p-5 sm:p-6">
              <h3 className="text-[15px] font-semibold text-navy-900">
                Remove from course
              </h3>
              <p className="mt-1 mb-4 max-w-lg text-[13px] text-ink-soft">
                Unenrolls {student.full_name || 'this student'} from the course.
                Their attempt history stays in the database for audit, but they
                lose access to materials and assessments.
              </p>
              <form action={removeStudent}>
                <input type="hidden" name="course_id" value={course.id} />
                <input type="hidden" name="student_id" value={student.id} />
                <Button type="submit" variant="danger" size="sm">
                  <TrashIcon width={14} height={14} />
                  Remove from course
                </Button>
              </form>
            </Panel>
          ),
        }}
      />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <p className="text-[12px] font-medium tracking-wide text-ink-soft uppercase">
        {label}
      </p>
      <p className="mt-2 text-[24px] font-semibold tabular-nums text-navy-900">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-ink-faint">{detail}</p>
    </div>
  )
}
