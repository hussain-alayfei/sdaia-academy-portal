'use client'

import { useActionState } from 'react'

import { requestPasswordReset } from '@/app/actions/auth'
import { Alert, Button, Field, Input } from '@/components/ui'

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    requestPasswordReset,
    undefined
  )

  return (
    <form action={action} className="space-y-5" noValidate>
      {state?.message ? <Alert>{state.message}</Alert> : null}
      {state?.notice ? <Alert tone="teal">{state.notice}</Alert> : null}

      <Field label="Email" htmlFor="email" error={state?.errors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state?.values?.email ?? ''}
          aria-invalid={Boolean(state?.errors?.email)}
          placeholder="you@example.com"
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>

      <p className="text-[13px] text-ink-soft">
        Remembered it? Use Sign in above.
      </p>
    </form>
  )
}
