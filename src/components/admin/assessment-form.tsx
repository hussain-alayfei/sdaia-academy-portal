'use client'

import { useActionState, useEffect, useRef } from 'react'

import { saveAssessment, type FormState } from '@/app/actions/admin'
import { Alert, Button, Field, Input, Select, Textarea } from '@/components/ui'
import { DEFAULT_DURATIONS, QUESTION_COUNTS } from '@/lib/assessment-schema'
import type { Assessment, CourseDay } from '@/lib/types'

export function AssessmentForm({
  courseId,
  days,
  assessment,
}: {
  courseId: string
  days: CourseDay[]
  assessment?: Assessment
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveAssessment,
    undefined
  )
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.ok && !assessment) formRef.current?.reset()
  }, [state, assessment])

  const uid = assessment?.id ?? 'new'
  const kind = assessment?.kind ?? 'quiz'

  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      <input type="hidden" name="course_id" value={courseId} />
      {assessment ? (
        <input type="hidden" name="assessment_id" value={assessment.id} />
      ) : null}

      {state?.message ? <Alert>{state.message}</Alert> : null}
      {state?.ok ? <Alert tone="teal">Saved.</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Type" htmlFor={`kind-${uid}`} error={state?.errors?.kind}>
          <Select id={`kind-${uid}`} name="kind" defaultValue={kind}>
            <option value="pre">
              Pre-assessment · {QUESTION_COUNTS.pre} questions
            </option>
            <option value="quiz">
              Day quiz · {QUESTION_COUNTS.quiz} questions
            </option>
            <option value="post">
              Post-assessment · {QUESTION_COUNTS.post} questions
            </option>
          </Select>
        </Field>

        <Field
          label="Appears on"
          htmlFor={`day_id-${uid}`}
          hint="Students find it on that day's page."
          error={state?.errors?.day_id}
        >
          <Select
            id={`day_id-${uid}`}
            name="day_id"
            defaultValue={assessment?.day_id ?? ''}
            required
          >
            <option value="" disabled>
              Choose a day
            </option>
            {days.map((day) => (
              <option key={day.id} value={day.id}>
                Day {day.day_number} · {day.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Minutes"
          htmlFor={`duration_minutes-${uid}`}
          hint="The clock runs on the server."
          error={state?.errors?.duration_minutes}
        >
          <Input
            id={`duration_minutes-${uid}`}
            name="duration_minutes"
            type="number"
            min={1}
            max={300}
            required
            defaultValue={assessment?.duration_minutes ?? DEFAULT_DURATIONS[kind]}
          />
        </Field>
      </div>

      <Field label="Title" htmlFor={`title-${uid}`} error={state?.errors?.title}>
        <Input
          id={`title-${uid}`}
          name="title"
          required
          defaultValue={assessment?.title}
          placeholder="Day 2 quiz"
        />
      </Field>

      <Field
        label="Description"
        htmlFor={`description-${uid}`}
        hint="Optional. One line, shown under the title."
        error={state?.errors?.description}
      >
        <Textarea
          id={`description-${uid}`}
          name="description"
          rows={2}
          defaultValue={assessment?.description ?? ''}
          placeholder="Ten questions on the ground covered today."
        />
      </Field>

      <fieldset className="space-y-2.5">
        <legend className="mb-1 text-[13px] font-medium text-navy-800">
          Release
        </legend>

        <label className="flex items-start gap-2.5 text-[13px] text-navy-800">
          <input
            type="checkbox"
            name="is_published"
            defaultChecked={assessment?.is_published ?? false}
            className="mt-0.5 size-4 rounded-xs border-line-strong accent-teal-600"
          />
          <span>
            Published
            <span className="block text-[12px] text-ink-faint">
              The card appears on the day page. Needs at least one question.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2.5 text-[13px] text-navy-800">
          <input
            type="checkbox"
            name="is_locked"
            defaultChecked={assessment?.is_locked ?? true}
            className="mt-0.5 size-4 rounded-xs border-line-strong accent-teal-600"
          />
          <span>
            Keep locked
            <span className="block text-[12px] text-ink-faint">
              Students see it but cannot start. Untick when the class is ready.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2.5 text-[13px] text-navy-800">
          <input
            type="checkbox"
            name="shuffle"
            defaultChecked={assessment?.shuffle ?? true}
            className="mt-0.5 size-4 rounded-xs border-line-strong accent-teal-600"
          />
          <span>
            Shuffle questions and options
            <span className="block text-[12px] text-ink-faint">
              Each student gets a different order, fixed for their whole attempt.
            </span>
          </span>
        </label>
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : assessment ? 'Save changes' : 'Add assessment'}
      </Button>
    </form>
  )
}
