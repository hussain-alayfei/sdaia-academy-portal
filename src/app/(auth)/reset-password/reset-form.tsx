'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { updatePassword } from '@/app/actions/auth'
import { Alert, Button, Field, Input } from '@/components/ui'

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined)

  return (
    <form action={action} className="space-y-5" noValidate>
      {state?.message ? <Alert>{state.message}</Alert> : null}

      <Field
        label="New password"
        htmlFor="password"
        error={state?.errors?.password}
        hint="At least 8 characters."
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state?.errors?.password)}
        />
      </Field>

      <Field
        label="Confirm new password"
        htmlFor="confirm"
        error={state?.errors?.confirm}
      >
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state?.errors?.confirm)}
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Saving…' : 'Save new password'}
      </Button>

      <p className="text-[13px] text-ink-soft">
        Link expired?{' '}
        <Link
          href="/forgot-password"
          className="font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800"
        >
          Request another
        </Link>
      </p>
    </form>
  )
}
