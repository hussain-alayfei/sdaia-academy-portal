import { notFound } from 'next/navigation'

import { AdminSectionHeader } from '@/components/admin/section-header'
import {
  StudentsScoreMatrix,
  type AssessmentCol,
  type CellScore,
  type MatrixStudent,
} from '@/components/admin/students-score-matrix'
import { EmptyState } from '@/components/ui'
import { canManageCourse, getCourseById } from '@/lib/dal'
import { getAssessments, getCourseDays, getRoster } from '@/lib/queries'
import { getCourseAttempts } from '@/lib/quiz'
import type { Assessment, AssessmentAttempt } from '@/lib/types'

function isFinalAssessment(assessment: Assessment) {
  return assessment.title.toLowerCase().includes('final')
}

function isFinished(attempt: AssessmentAttempt | undefined) {
  return Boolean(attempt && attempt.status !== 'in_progress')
}

function scorePercent(attempt: AssessmentAttempt | undefined) {
  if (!attempt?.question_count || attempt.correct_count === null) return null
  return Math.round((attempt.correct_count / attempt.question_count) * 100)
}

function shortLabel(assessment: Assessment, dayNumber: number | null) {
  if (assessment.kind === 'pre') return 'Pre'
  if (assessment.kind === 'post') return 'Post'
  if (isFinalAssessment(assessment)) return 'Final'
  if (dayNumber != null) return `D${dayNumber}`
  return assessment.title.slice(0, 10)
}

function toCellScore(attempt: AssessmentAttempt | undefined): CellScore {
  if (!attempt) {
    return { status: 'none', percent: null, correct: null, total: null }
  }
  return {
    status: attempt.status,
    percent: scorePercent(attempt),
    correct: attempt.correct_count,
    total: attempt.question_count,
  }
}

export default async function StudentsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const course = await getCourseById(id)
  if (!course || !(await canManageCourse(course))) notFound()

  const [roster, rawAssessments, days, attempts] = await Promise.all([
    getRoster(course.id),
    getAssessments(course.id),
    getCourseDays(course.id),
    getCourseAttempts(course.id),
  ])

  const dayNumbers = new Map(days.map((day) => [day.id, day.day_number]))
  const assessments: AssessmentCol[] = rawAssessments
    .map((assessment) => {
      const dayNumber = assessment.day_id
        ? (dayNumbers.get(assessment.day_id) ?? null)
        : null
      return {
        id: assessment.id,
        shortLabel: shortLabel(assessment, dayNumber),
        dayNumber,
        title: assessment.title,
        kind: assessment.kind,
        isFinal: isFinalAssessment(assessment),
        position: assessment.position,
      }
    })
    .sort((a, b) => {
      // Final always last among columns; others by day then position.
      if (a.isFinal !== b.isFinal) return a.isFinal ? 1 : -1
      return (a.dayNumber ?? 999) - (b.dayNumber ?? 999) || a.position - b.position
    })

  const regularAssessments = assessments.filter((a) => !a.isFinal)
  const finalAssessment = assessments.find((a) => a.isFinal) ?? null

  const byStudent = new Map<string, Map<string, AssessmentAttempt>>()
  for (const attempt of attempts) {
    let map = byStudent.get(attempt.student_id)
    if (!map) {
      map = new Map()
      byStudent.set(attempt.student_id, map)
    }
    map.set(attempt.assessment_id, attempt)
  }

  const students: MatrixStudent[] = roster.map((student) => {
    const own = byStudent.get(student.id) ?? new Map()
    const scores: Record<string, CellScore> = {}
    for (const assessment of assessments) {
      scores[assessment.id] = toCellScore(own.get(assessment.id))
    }

    const avgPercents: number[] = []
    for (const assessment of regularAssessments) {
      const attempt = own.get(assessment.id)
      if (!isFinished(attempt)) continue
      const pct = scorePercent(attempt)
      if (pct !== null) avgPercents.push(pct)
    }

    const avg =
      avgPercents.length > 0
        ? Math.round(
            avgPercents.reduce((sum, n) => sum + n, 0) / avgPercents.length
          )
        : null

    const done = regularAssessments.filter((a) =>
      isFinished(own.get(a.id))
    ).length

    const finalAttempt = finalAssessment
      ? own.get(finalAssessment.id)
      : undefined
    const finalPercent = isFinished(finalAttempt)
      ? scorePercent(finalAttempt)
      : null

    return {
      id: student.id,
      fullName: student.full_name,
      email: student.email,
      done,
      total: regularAssessments.length,
      avg,
      finalPercent,
      scores,
    }
  })

  return (
    <div className="space-y-4">
      <AdminSectionHeader
        title="Students"
        meta={
          roster.length > 0
            ? `${roster.length} enrolled · ${assessments.length} assessments`
            : undefined
        }
        description="Avg excludes Final. Sort, search, or export the roster."
      />

      {roster.length === 0 ? (
        <EmptyState
          title="No students yet"
          description={`Share course code ${course.join_code} so they can join.`}
        />
      ) : assessments.length === 0 ? (
        <EmptyState
          title="No assessments yet"
          description="Add assessments on the Assessments tab. Scores will appear here."
        />
      ) : (
        <StudentsScoreMatrix
          courseId={course.id}
          courseSlug={course.slug}
          assessments={assessments}
          students={students}
        />
      )}
    </div>
  )
}
