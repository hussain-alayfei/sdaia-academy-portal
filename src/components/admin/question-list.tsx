'use client'

import { useState } from 'react'

import {
  deleteQuestion,
  moveQuestion,
} from '@/app/actions/questions'
import { EditQuestion } from '@/components/admin/question-editor'
import { TrashIcon } from '@/components/icons'
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  PanelHeader,
  cx,
} from '@/components/ui'
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_TONES,
} from '@/lib/format'
import type { QuestionForEditing } from '@/lib/quiz'

/**
 * Compact accordion list: one row per question, expand to see options + edit.
 * Keeps a 20-question paper from becoming a wall of open MCQs.
 */
export function QuestionList({
  courseId,
  assessmentId,
  questions,
  hasAttempts,
}: {
  courseId: string
  assessmentId: string
  questions: QuestionForEditing[]
  hasAttempts: boolean
}) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <Panel>
      <PanelHeader
        title="Question bank"
        description={
          hasAttempts
            ? 'Locked for editing while attempts exist. Expand a row to review it.'
            : 'Expand a row to review options or edit. Only one stays open at a time.'
        }
      />

      {questions.length === 0 ? (
        <EmptyState
          title="No questions yet"
          description="Import a file below, or write one by hand."
        />
      ) : (
        <ol className="divide-y divide-line">
          {questions.map((question, index) => {
            const correct = question.options.find(
              (o) => o.id === question.correctOptionId
            )
            const isOpen = openId === question.id
            const stemPreview =
              question.stem.length > 110
                ? `${question.stem.slice(0, 110).trim()}…`
                : question.stem

            return (
              <li key={question.id} className="px-3 py-2.5 sm:px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setOpenId(isOpen ? null : question.id)
                    }
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-sm px-1 py-1.5 text-left hover:bg-navy-50"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-sm border border-line bg-navy-50 text-[12px] font-semibold text-navy-700">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="mb-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone={DIFFICULTY_TONES[question.difficulty]}>
                          {DIFFICULTY_LABELS[question.difficulty]}
                        </Badge>
                        {question.topic ? (
                          <Badge tone="neutral">{question.topic}</Badge>
                        ) : null}
                        {!correct ? (
                          <Badge tone="danger">No key</Badge>
                        ) : null}
                      </span>
                      <span className="block truncate text-[13px] font-medium text-navy-900">
                        {stemPreview}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] font-medium text-ink-faint">
                      {isOpen ? 'Hide' : 'Show'}
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <form action={moveQuestion}>
                      <input type="hidden" name="course_id" value={courseId} />
                      <input
                        type="hidden"
                        name="assessment_id"
                        value={assessmentId}
                      />
                      <input
                        type="hidden"
                        name="question_id"
                        value={question.id}
                      />
                      <input type="hidden" name="direction" value="up" />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        disabled={index === 0}
                        aria-label={`Move question ${index + 1} up`}
                      >
                        ↑
                      </Button>
                    </form>
                    <form action={moveQuestion}>
                      <input type="hidden" name="course_id" value={courseId} />
                      <input
                        type="hidden"
                        name="assessment_id"
                        value={assessmentId}
                      />
                      <input
                        type="hidden"
                        name="question_id"
                        value={question.id}
                      />
                      <input type="hidden" name="direction" value="down" />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        disabled={index === questions.length - 1}
                        aria-label={`Move question ${index + 1} down`}
                      >
                        ↓
                      </Button>
                    </form>
                    <form action={deleteQuestion}>
                      <input type="hidden" name="course_id" value={courseId} />
                      <input
                        type="hidden"
                        name="assessment_id"
                        value={assessmentId}
                      />
                      <input
                        type="hidden"
                        name="question_id"
                        value={question.id}
                      />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        disabled={hasAttempts}
                        aria-label={`Delete question ${index + 1}`}
                      >
                        <TrashIcon width={15} height={15} />
                      </Button>
                    </form>
                  </div>
                </div>

                {isOpen ? (
                  <div className="mt-2 mb-1 ms-10 space-y-3 border-s-2 border-teal-200 ps-4">
                    <p className="text-[14px] font-medium text-navy-900">
                      {question.stem}
                    </p>
                    <ul className="space-y-1">
                      {question.options.map((option) => {
                        const isKey = option.id === question.correctOptionId
                        return (
                          <li
                            key={option.id}
                            className={cx(
                              'flex gap-2 text-[13px]',
                              isKey
                                ? 'font-medium text-teal-800'
                                : 'text-ink-soft'
                            )}
                          >
                            <span className="w-4 shrink-0">{option.label}</span>
                            <span>{option.body}</span>
                          </li>
                        )
                      })}
                    </ul>
                    {question.rationale ? (
                      <p className="text-[12.5px] text-ink-faint">
                        {question.rationale}
                      </p>
                    ) : null}
                    <EditQuestion
                      courseId={courseId}
                      assessmentId={assessmentId}
                      question={question}
                      disabled={hasAttempts}
                    />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}
