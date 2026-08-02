import Link from 'next/link'
import { notFound } from 'next/navigation'

import { removeStudent } from '@/app/actions/admin'
import { AlertIcon, TrashIcon } from '@/components/icons'
import { Button, EmptyState, Panel, PanelHeader, cx } from '@/components/ui'
import { canManageCourse, getCourseById } from '@/lib/dal'
import { ASSESSMENT_LABELS } from '@/lib/format'
import { getAssessments, getRoster } from '@/lib/queries'
import { getCourseAttempts } from '@/lib/quiz'

export default async function StudentsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const course = await getCourseById(id)
  if (!course || !(await canManageCourse(course))) notFound()

  const [roster, assessments, attempts] = await Promise.all([
    getRoster(course.id),
    getAssessments(course.id),
    getCourseAttempts(course.id),
  ])

  // student -> assessment -> attempt
  const byStudent = new Map(
    attempts.map((a) => [`${a.student_id}:${a.assessment_id}`, a])
  )

  const averages = assessments.map((assessment) => {
    const marked = attempts.filter(
      (a) =>
        a.assessment_id === assessment.id &&
        a.status !== 'in_progress' &&
        a.question_count
    )
    if (marked.length === 0) return null

    const total = marked.reduce(
      (sum, a) => sum + (a.correct_count ?? 0) / (a.question_count || 1),
      0
    )
    return Math.round((total / marked.length) * 100)
  })

  return (
    <Panel>
      <PanelHeader
        title="Students"
        description={
          roster.length === 0
            ? undefined
            : `${roster.length} enrolled · scores come from the quizzes they sit`
        }
      />

      {roster.length === 0 ? (
        <EmptyState
          title="No students yet"
          description={`Share the course code ${course.join_code} so they can sign up and join.`}
        />
      ) : (
        <div className="scroll-x">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-navy-50/60">
                <th
                  scope="col"
                  className="px-4 py-2.5 text-[12px] font-semibold tracking-wide text-ink-soft uppercase sm:px-5"
                >
                  Student
                </th>
                {assessments.map((a, i) => (
                  <th
                    key={a.id}
                    scope="col"
                    className="px-3 py-2.5 text-[12px] font-semibold tracking-wide text-ink-soft uppercase"
                  >
                    <Link
                      href={`/admin/courses/${course.id}/assessments/${a.id}/results`}
                      className="block hover:text-teal-800"
                    >
                      <span className="block">{a.title}</span>
                      <span className="block text-[11px] font-normal normal-case">
                        {ASSESSMENT_LABELS[a.kind]}
                        {averages[i] !== null ? ` · avg ${averages[i]}%` : ''}
                      </span>
                    </Link>
                  </th>
                ))}
                <th scope="col" className="px-3 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {roster.map((student) => (
                <tr key={student.id} className="transition-colors hover:bg-navy-50/50">
                  <th
                    scope="row"
                    className="px-4 py-2.5 text-left font-normal sm:px-5"
                  >
                    <span className="block text-[14px] font-medium text-navy-900">
                      {student.full_name || '—'}
                    </span>
                    <span className="block text-[12px] text-ink-faint">
                      {student.email}
                    </span>
                  </th>

                  {assessments.map((assessment) => {
                    const attempt = byStudent.get(
                      `${student.id}:${assessment.id}`
                    )

                    return (
                      <td key={assessment.id} className="px-3 py-2.5">
                        <ScoreReadout
                          courseId={course.id}
                          assessmentId={assessment.id}
                          attempt={attempt}
                        />
                      </td>
                    )
                  })}

                  <td className="px-3 py-2.5 text-right">
                    <form action={removeStudent}>
                      <input type="hidden" name="course_id" value={course.id} />
                      <input
                        type="hidden"
                        name="student_id"
                        value={student.id}
                      />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${student.full_name} from this course`}
                      >
                        <TrashIcon width={15} height={15} />
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {roster.length > 0 && assessments.length === 0 ? (
        <p className="border-t border-line px-4 py-3 text-[13px] text-ink-soft sm:px-5">
          Add assessments on the Assessments tab. Scores appear here as students
          sit them.
        </p>
      ) : null}
    </Panel>
  )
}

/**
 * One cell of the grid.
 *
 * Read-only by design. Scores are written by `submit_attempt` when a student
 * finishes, so there is nothing here to type into and no way for a typed number
 * to disagree with the answers on record.
 */
function ScoreReadout({
  courseId,
  assessmentId,
  attempt,
}: {
  courseId: string
  assessmentId: string
  attempt?: {
    id: string
    status: string
    correct_count: number | null
    question_count: number | null
    warning_count: number
  }
}) {
  if (!attempt) {
    return <span className="text-[13px] text-ink-faint">Not started</span>
  }

  if (attempt.status === 'in_progress') {
    return (
      <span className="text-[13px] text-amber-700">Sitting it now</span>
    )
  }

  const total = attempt.question_count ?? 0
  const correct = attempt.correct_count ?? 0
  const flagged = attempt.status === 'integrity_stopped'

  return (
    <Link
      href={`/admin/courses/${courseId}/assessments/${assessmentId}/results`}
      className="inline-flex items-center gap-1.5 hover:underline"
    >
      <span
        className={cx(
          'text-[14px] font-medium tabular-nums',
          flagged ? 'text-danger-600' : 'text-navy-900'
        )}
      >
        {correct}/{total}
      </span>
      {flagged || attempt.warning_count > 0 ? (
        <AlertIcon
          width={14}
          height={14}
          className={flagged ? 'text-danger-600' : 'text-amber-600'}
          aria-label={
            flagged
              ? 'Stopped for switching away'
              : `${attempt.warning_count} warning(s)`
          }
        />
      ) : null}
    </Link>
  )
}
