'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import {
  saveQuestion,
  type QuestionFormState,
} from '@/app/actions/questions'
import { PlusIcon } from '@/components/icons'
import {
  Alert,
  Button,
  Field,
  Input,
  Select,
  Textarea,
  cx,
} from '@/components/ui'
import { OPTION_LABELS, type OptionLabel } from '@/lib/assessment-schema'
import type { QuestionForEditing } from '@/lib/quiz'

/**
 * Add or edit one question.
 *
 * Deliberately not a modal: an instructor rewriting a stem wants the rest of the
 * paper still on screen for context. Editing expands in place instead.
 */
function QuestionForm({
  courseId,
  assessmentId,
  question,
  onDone,
}: {
  courseId: string
  assessmentId: string
  question?: QuestionForEditing
  onDone?: () => void
}) {
  const [state, action, pending] = useActionState<QuestionFormState, FormData>(
    saveQuestion,
    undefined
  )
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!state?.ok) return
    if (question) {
      onDone?.()
    } else {
      formRef.current?.reset()
    }
  }, [state, question, onDone])

  const uid = question?.id ?? 'new'

  // The stored key is an option id; the form works in labels, so map across.
  const currentCorrect =
    question?.options.find((o) => o.id === question.correctOptionId)?.label ?? 'A'

  const bodyFor = (label: OptionLabel) =>
    question?.options.find((o) => o.label === label)?.body ?? ''

  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="assessment_id" value={assessmentId} />
      {question ? (
        <input type="hidden" name="question_id" value={question.id} />
      ) : null}

      {state?.message ? <Alert>{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
        <Field
          label="Difficulty"
          htmlFor={`difficulty-${uid}`}
          error={state?.errors?.difficulty}
        >
          <Select
            id={`difficulty-${uid}`}
            name="difficulty"
            defaultValue={question?.difficulty ?? 'medium'}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </Select>
        </Field>

        <Field
          label="Topic"
          htmlFor={`topic-${uid}`}
          hint="Optional. Two or three words, used in your reports."
          error={state?.errors?.topic}
        >
          <Input
            id={`topic-${uid}`}
            name="topic"
            defaultValue={question?.topic ?? ''}
            placeholder="Retrieval pipeline"
          />
        </Field>
      </div>

      <Field
        label="Question"
        htmlFor={`stem-${uid}`}
        hint="It must stand on its own: no references to the slides or the room."
        error={state?.errors?.stem}
      >
        <Textarea
          id={`stem-${uid}`}
          name="stem"
          rows={3}
          required
          defaultValue={question?.stem ?? ''}
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-[13px] font-medium text-navy-800">
          Options · select the correct one
        </legend>

        {OPTION_LABELS.map((label) => (
          <div key={label} className="flex items-start gap-2.5">
            <label
              className="mt-2.5 flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-navy-800"
              title={`Mark ${label} as the correct answer`}
            >
              <input
                type="radio"
                name="correct"
                value={label}
                defaultChecked={currentCorrect === label}
                className="size-4 border-line-strong accent-teal-600"
              />
              {label}
            </label>

            <div className="min-w-0 flex-1">
              <Textarea
                name={label}
                rows={1}
                required
                defaultValue={bodyFor(label)}
                aria-label={`Option ${label}`}
                className="min-h-10"
              />
              {state?.errors?.[label] ? (
                <p className="mt-1 text-[12px] text-danger-600">
                  {state.errors[label]?.[0]}
                </p>
              ) : null}
            </div>
          </div>
        ))}

        {state?.errors?.correct ? (
          <p className="text-[12px] text-danger-600">
            {state.errors.correct[0]}
          </p>
        ) : null}

        <p className="text-[12px] text-ink-faint">
          Keep all four a similar length. If the correct answer is the longest,
          students can find it without knowing the material.
        </p>
      </fieldset>

      <Field
        label="Rationale"
        htmlFor={`rationale-${uid}`}
        hint="Shown to students on their review screen after they submit."
        error={state?.errors?.rationale}
      >
        <Textarea
          id={`rationale-${uid}`}
          name="rationale"
          rows={2}
          defaultValue={question?.rationale ?? ''}
        />
      </Field>

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Saving…' : question ? 'Save question' : 'Add question'}
        </Button>
        {question && onDone ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  )
}

/** Editing toggle for an existing question, so the list stays compact. */
export function EditQuestion({
  courseId,
  assessmentId,
  question,
  disabled,
}: {
  courseId: string
  assessmentId: string
  question: QuestionForEditing
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Edit
      </Button>
    )
  }

  return (
    <div
      className={cx(
        'mt-3 w-full rounded-sm border border-teal-200 bg-teal-50/40 p-4',
        'animate-rise'
      )}
    >
      <QuestionForm
        courseId={courseId}
        assessmentId={assessmentId}
        question={question}
        onDone={() => setOpen(false)}
      />
    </div>
  )
}

/** Collapsed "add a question" panel, expanded on demand. */
export function AddQuestion({
  courseId,
  assessmentId,
  disabled,
}: {
  courseId: string
  assessmentId: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <PlusIcon width={15} height={15} />
        Write a question by hand
      </Button>
    )
  }

  return (
    <div className="animate-rise rounded-md border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-navy-900">
          New question
        </h3>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
      <QuestionForm courseId={courseId} assessmentId={assessmentId} />
    </div>
  )
}
