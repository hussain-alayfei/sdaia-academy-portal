'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { signup } from '@/app/actions/auth'
import { Alert, Button, Field, Input } from '@/components/ui'

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined)

  if (state?.notice) {
    return (
      <Alert tone="teal" title="Almost there">
        {state.notice}{' '}
        <Link href="/login" className="font-medium underline underline-offset-2">
          Go to sign in
        </Link>
      </Alert>
    )
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {state?.message ? <Alert>{state.message}</Alert> : null}

      <Field label="Full name" htmlFor="full_name" error={state?.errors?.full_name}>
        <Input
          id="full_name"
          name="full_name"
          autoComplete="name"
          required
          defaultValue={state?.values?.full_name ?? ''}
          aria-invalid={Boolean(state?.errors?.full_name)}
          placeholder="As it should appear on your certificate"
        />
      </Field>

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

      <Field
        label="Password"
        htmlFor="password"
        hint="At least 8 characters."
        error={state?.errors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-invalid={Boolean(state?.errors?.password)}
        />
      </Field>

      <Field
        label="Course code"
        htmlFor="join_code"
        hint="Given to you by your instructor. Leave empty if you do not have one yet — you can enter it after signing in."
        error={state?.errors?.join_code}
      >
        <Input
          id="join_code"
          name="join_code"
          autoCapitalize="characters"
          spellCheck={false}
          defaultValue={state?.values?.join_code ?? ''}
          aria-invalid={Boolean(state?.errors?.join_code)}
          placeholder="SDAIA-GENAI-01"
          className="font-mono tracking-wide uppercase"
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="text-[13px] text-ink-soft">
        Already registered?{' '}
        <Link
          href="/login"
          className="font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800"
        >
          Sign in
        </Link>
      </p>
    </form>
  )
}
