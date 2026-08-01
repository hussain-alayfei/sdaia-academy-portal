'use client'

import { useActionState } from 'react'

import { joinCourse } from '@/app/actions/auth'
import { Alert, Button, Field, Input } from '@/components/ui'

export function JoinCourseForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState(joinCourse, undefined)
  const message = state?.message ?? initialError

  return (
    <form action={action} className="max-w-sm space-y-4" noValidate>
      {message ? <Alert>{message}</Alert> : null}

      <Field
        label="Course code"
        htmlFor="join_code"
        hint="Your instructor shares this at the start of the course."
        error={state?.errors?.join_code}
      >
        <Input
          id="join_code"
          name="join_code"
          required
          autoFocus
          autoCapitalize="characters"
          spellCheck={false}
          defaultValue={state?.values?.join_code ?? ''}
          placeholder="SDAIA-GENAI-01"
          aria-invalid={Boolean(state?.errors?.join_code)}
          className="font-mono tracking-wide uppercase"
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? 'Joining…' : 'Join course'}
      </Button>
    </form>
  )
}
