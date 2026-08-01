'use client'

import { useActionState, useEffect, useRef } from 'react'

import { createDay, type FormState } from '@/app/actions/admin'
import { Alert, Button, Field, Input, Textarea } from '@/components/ui'

export function AddDayForm({
  courseId,
  nextDayNumber,
}: {
  courseId: string
  nextDayNumber: number
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createDay,
    undefined
  )
  const formRef = useRef<HTMLFormElement>(null)

  const val = (key: string, fallback = '') => state?.values?.[key] ?? fallback

  // Clear the fields after a successful add so the next day can be typed
  // straight away.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      <input type="hidden" name="course_id" value={courseId} />

      {state?.message ? <Alert>{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-[110px_minmax(0,1fr)]">
        <Field
          label="Day"
          htmlFor="day_number"
          error={state?.errors?.day_number}
        >
          <Input
            id="day_number"
            name="day_number"
            type="number"
            min={1}
            max={60}
            required
            defaultValue={val('day_number', String(nextDayNumber))}
          />
        </Field>

        <Field label="Title" htmlFor="title" error={state?.errors?.title}>
          <Input
            id="title"
            name="title"
            required
            defaultValue={val('title')}
          placeholder="From language model to software solution"
          />
        </Field>
      </div>

      <Field
        label="Arabic title"
        htmlFor="title_ar"
        error={state?.errors?.title_ar}
      >
        <Input
          id="title_ar"
          name="title_ar"
          dir="rtl"
          lang="ar"
          className="font-arabic"
          defaultValue={val('title_ar')}
          placeholder="من النموذج اللغوي إلى حل برمجي"
        />
      </Field>

      <Field
        label="Summary"
        htmlFor="summary"
        hint="Optional. A sentence describing what the day covers."
        error={state?.errors?.summary}
      >
        <Textarea id="summary" name="summary" rows={2} defaultValue={val('summary')} />
      </Field>

      <Field
        label="Date"
        htmlFor="scheduled_date"
        error={state?.errors?.scheduled_date}
      >
        <Input
          id="scheduled_date"
          name="scheduled_date"
          type="date"
          defaultValue={val('scheduled_date')}
          className="max-w-56"
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add day'}
      </Button>
    </form>
  )
}
