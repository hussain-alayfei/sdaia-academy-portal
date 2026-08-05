import type { Metadata } from 'next'

import { Alert, BackLink } from '@/components/ui'

import { ForgotPasswordForm } from './forgot-form'

export const metadata: Metadata = { title: 'Forgot password' }

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const { notice } = await searchParams

  return (
    <>
      <div className="mb-6">
        <BackLink href="/login">Sign in</BackLink>
      </div>
      <h1 className="text-[26px] font-semibold text-navy-900">
        Forgot password
      </h1>
      <p className="mt-1.5 mb-7 text-sm text-ink-soft">
        Enter the email on your account. We will send a secure link to choose a
        new password.
      </p>
      {notice ? (
        <div className="mb-5">
          <Alert tone="teal">{notice}</Alert>
        </div>
      ) : null}
      <ForgotPasswordForm />
    </>
  )
}
