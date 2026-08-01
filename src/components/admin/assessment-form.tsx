'use client'

import { useActionState, useEffect, useRef } from 'react'

import { saveAssessment, type FormState } from '@/app/actions/admin'
import { Alert, Button, Field, Input, Select, Textarea } from '@/components/ui'
import type { Assessment } from '@/lib/types'

export function AssessmentForm({
  courseId,
  assessment,
}: {
  courseId: string
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

  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      <input type="hidden" name="course_id" value={courseId} />
      {assessment ? (
        <input type="hidden" name="assessment_id" value={assessment.id} />
      ) : null}

      {state?.message ? <Alert>{state.message}</Alert> : null}
      {state?.ok ? <Alert tone="teal">Saved.</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
        <Field
          label="Type"
          htmlFor={`kind-${assessment?.id ?? 'new'}`}
          error={state?.errors?.kind}
        >
          <Select
            id={`kind-${assessment?.id ?? 'new'}`}
            name="kind"
            defaultValue={assessment?.kind ?? 'pre'}
          >
            <option value="pre">Pre-assessment</option>
            <option value="post">Post-assessment</option>
            <option value="quiz">Final quiz</option>
          </Select>
        </Field>

        <Field
          label="Title"
          htmlFor={`title-${assessment?.id ?? 'new'}`}
          error={state?.errors?.title}
        >
          <Input
            id={`title-${assessment?.id ?? 'new'}`}
            name="title"
            required
            defaultValue={assessment?.title}
            placeholder="Day 1 pre-assessment"
          />
        </Field>
      </div>

      <Field
        label="Description"
        htmlFor={`description-${assessment?.id ?? 'new'}`}
        error={state?.errors?.description}
      >
        <Textarea
          id={`description-${assessment?.id ?? 'new'}`}
          name="description"
          rows={2}
          defaultValue={assessment?.description ?? ''}
          placeholder="10 minutes, no grade — it just tells me where the class stands."
        />
      </Field>

      <Field
        label="Quiz link"
        htmlFor={`external_url-${assessment?.id ?? 'new'}`}
        hint="Leave empty for now — it stays locked until you add a link."
        error={state?.errors?.external_url}
      >
        <Input
          id={`external_url-${assessment?.id ?? 'new'}`}
          name="external_url"
          type="url"
          inputMode="url"
          defaultValue={assessment?.external_url ?? ''}
          placeholder="https://…"
        />
      </Field>

      <div className="flex flex-wrap items-end gap-5">
        <Field
          label="Maximum score"
          htmlFor={`max_score-${assessment?.id ?? 'new'}`}
          error={state?.errors?.max_score}
        >
          <Input
            id={`max_score-${assessment?.id ?? 'new'}`}
            name="max_score"
            type="number"
            min={1}
            max={1000}
            className="w-32"
            defaultValue={assessment?.max_score ?? 100}
          />
        </Field>

        <label className="flex items-center gap-2 pb-2.5 text-[13px] text-navy-800">
          <input
            type="checkbox"
            name="is_locked"
            defaultChecked={assessment?.is_locked ?? true}
            className="size-4 rounded-xs border-line-strong accent-teal-600"
          />
          Keep locked
        </label>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : assessment ? 'Save changes' : 'Add assessment'}
      </Button>
    </form>
  )
}
