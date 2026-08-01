import { notFound } from 'next/navigation'

import { removeStudent } from '@/app/actions/admin'
import { ScoreCell } from '@/components/admin/score-cell'
import { TrashIcon } from '@/components/icons'
import { Button, EmptyState, Panel, PanelHeader } from '@/components/ui'
import { canManageCourse, getCourseById } from '@/lib/dal'
import { ASSESSMENT_LABELS, percent } from '@/lib/format'
import { getAssessments, getCourseScores, getRoster } from '@/lib/queries'

export default async function StudentsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const course = await getCourseById(id)
  if (!course || !(await canManageCourse(course))) notFound()

  const [roster, assessments, scores] = await Promise.all([
    getRoster(course.id),
    getAssessments(course.id),
    getCourseScores(course.id),
  ])

  // student -> assessment -> score
  const byStudent = new Map<string, Map<string, number>>()
  for (const row of scores) {
    if (!byStudent.has(row.student_id)) byStudent.set(row.student_id, new Map())
    byStudent.get(row.student_id)!.set(row.assessment_id, row.score)
  }

  const averages = assessments.map((a) => {
    const values = scores
      .filter((s) => s.assessment_id === a.id)
      .map((s) => percent(s.score, s.max_score))
    if (values.length === 0) return null
    return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
  })

  return (
    <Panel>
      <PanelHeader
        title="Students"
        description={
          roster.length === 0
            ? undefined
            : `${roster.length} enrolled · scores save as you leave each box`
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
                    <span className="block">{ASSESSMENT_LABELS[a.kind]}</span>
                    <span className="block text-[11px] font-normal normal-case">
                      out of {a.max_score}
                      {averages[i] !== null ? ` · avg ${averages[i]}%` : ''}
                    </span>
                  </th>
                ))}
                <th scope="col" className="px-3 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {roster.map((student) => (
                <tr key={student.id} className="hover:bg-navy-50/50">
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

                  {assessments.map((a) => (
                    <td key={a.id} className="px-3 py-2.5">
                      <ScoreCell
                        courseId={course.id}
                        assessmentId={a.id}
                        studentId={student.id}
                        maxScore={a.max_score}
                        initial={byStudent.get(student.id)?.get(a.id) ?? null}
                      />
                    </td>
                  ))}

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
          Add assessments on the Assessments tab to start recording scores.
        </p>
      ) : null}
    </Panel>
  )
}
