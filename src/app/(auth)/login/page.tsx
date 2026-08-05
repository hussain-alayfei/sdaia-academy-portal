import type { Metadata } from 'next'

import { Alert, BackLink } from '@/components/ui'

import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; notice?: string }>
}) {
  const { next, error, notice } = await searchParams

  return (
    <>
      <div className="mb-6">
        <BackLink href="/">SDAIA Academy</BackLink>
      </div>
      <h1 className="text-[26px] font-semibold text-navy-900">Sign in</h1>
      <p className="mt-1.5 mb-7 text-sm text-ink-soft">
        Use the email address you registered with.
      </p>
      {error ? (
        <div className="mb-5">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      {notice ? (
        <div className="mb-5">
          <Alert tone="teal">{notice}</Alert>
        </div>
      ) : null}
      <LoginForm next={next} />
    </>
  )
}
