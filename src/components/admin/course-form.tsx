'use client'

import { useActionState } from 'react'

import { createCourse, updateCourse, type FormState } from '@/app/actions/admin'
import { Alert, Button, Field, Input, Textarea } from '@/components/ui'
import type { Course } from '@/lib/types'

export function CourseForm({ course }: { course?: Course }) {
  const action = course ? updateCourse : createCourse
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    undefined
  )

  // Prefer what was just submitted (so a rejected save keeps the typing),
  // then the saved record, then empty.
  const val = (key: string, saved?: string | null) =>
    state?.values?.[key] ?? saved ?? ''

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {course ? (
        <input type="hidden" name="course_id" value={course.id} />
      ) : null}

      {state?.message ? <Alert>{state.message}</Alert> : null}
      {state?.ok ? <Alert tone="teal">Saved.</Alert> : null}

      <Field label="Course title" htmlFor="title" error={state?.errors?.title}>
        <Input
          id="title"
          name="title"
          required
          defaultValue={val('title', course?.title)}
          placeholder="Developing Generative AI Solutions"
        />
      </Field>

      <Field
        label="Arabic title"
        htmlFor="title_ar"
        hint="Optional. Shown alongside the English title."
        error={state?.errors?.title_ar}
      >
        <Input
          id="title_ar"
          name="title_ar"
          dir="rtl"
          lang="ar"
          className="font-arabic"
          defaultValue={val('title_ar', course?.title_ar)}
          placeholder="تطوير حلول الذكاء الاصطناعي"
        />
      </Field>

      <Field
        label="Description"
        htmlFor="description"
        hint="One or two sentences students see on the course page."
        error={state?.errors?.description}
      >
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={val('description', course?.description)}
        />
      </Field>

      <Field
        label="Course code"
        htmlFor="join_code"
        hint="Students type this when signing up. Keep it short and easy to read aloud."
        error={state?.errors?.join_code}
      >
        <Input
          id="join_code"
          name="join_code"
          required
          defaultValue={val('join_code', course?.join_code)}
          placeholder="SDAIA-GENAI-01"
          className="font-mono tracking-wide uppercase"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Start date"
          htmlFor="start_date"
          error={state?.errors?.start_date}
        >
          <Input
            id="start_date"
            name="start_date"
            type="date"
            defaultValue={val('start_date', course?.start_date)}
          />
        </Field>
        <Field
          label="End date"
          htmlFor="end_date"
          error={state?.errors?.end_date}
        >
          <Input
            id="end_date"
            name="end_date"
            type="date"
            defaultValue={val('end_date', course?.end_date)}
          />
        </Field>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : course ? 'Save changes' : 'Create course'}
      </Button>
    </form>
  )
}
