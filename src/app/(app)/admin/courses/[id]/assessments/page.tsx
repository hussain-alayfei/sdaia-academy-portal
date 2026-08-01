import { notFound } from 'next/navigation'

import { deleteAssessment } from '@/app/actions/admin'
import { AssessmentForm } from '@/components/admin/assessment-form'
import { PlusIcon, TrashIcon } from '@/components/icons'
import { Alert, Button, Panel, PanelHeader } from '@/components/ui'
import { canManageCourse, getCourseById } from '@/lib/dal'
import { ASSESSMENT_LABELS } from '@/lib/format'
import { getAssessments } from '@/lib/queries'

export default async function AssessmentsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const course = await getCourseById(id)
  if (!course || !(await canManageCourse(course))) notFound()

  const assessments = await getAssessments(course.id)

  return (
    <div className="space-y-6">
      <Alert tone="teal" title="Quizzes run off-site for now">
        Paste a link to your external quiz and unlock it when the class is ready.
        Scores are entered by hand on the Students tab. When the built-in quiz
        engine lands, these same assessments will host the questions directly.
      </Alert>

      {assessments.map((assessment) => (
        <Panel key={assessment.id}>
          <PanelHeader
            title={assessment.title}
            description={ASSESSMENT_LABELS[assessment.kind]}
            action={
              <form action={deleteAssessment}>
                <input type="hidden" name="course_id" value={course.id} />
                <input
                  type="hidden"
                  name="assessment_id"
                  value={assessment.id}
                />
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${assessment.title}`}
                >
                  <TrashIcon width={15} height={15} />
                </Button>
              </form>
            }
          />
          <div className="p-5 sm:p-6">
            <AssessmentForm courseId={course.id} assessment={assessment} />
          </div>
        </Panel>
      ))}

      <Panel className="p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <PlusIcon width={16} height={16} className="text-teal-700" />
          <h2 className="text-[15px] font-semibold text-navy-900">
            Add an assessment
          </h2>
        </div>
        <AssessmentForm courseId={course.id} />
      </Panel>
    </div>
  )
}
