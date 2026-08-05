'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { login } from '@/app/actions/auth'
import { Alert, Button, Field, Input } from '@/components/ui'

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <form action={action} className="space-y-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state?.message ? <Alert>{state.message}</Alert> : null}

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

      <Field label="Password" htmlFor="password" error={state?.errors?.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state?.errors?.password)}
        />
      </Field>

      <p className="-mt-2 text-end text-[13px]">
        <Link
          href="/forgot-password"
          className="font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800"
        >
          Forgot password?
        </Link>
      </p>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>

      <p className="text-[13px] text-ink-soft">
        First time here?{' '}
        <Link
          href="/signup"
          className="font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800"
        >
          Create your account
        </Link>
      </p>
    </form>
  )
}
