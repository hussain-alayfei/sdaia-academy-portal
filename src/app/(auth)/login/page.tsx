import type { Metadata } from 'next'

import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <>
      <h1 className="text-[26px] font-semibold text-navy-900">Sign in</h1>
      <p className="mt-1.5 mb-7 text-sm text-ink-soft">
        Use the email address you registered with.
      </p>
      <LoginForm next={next} />
    </>
  )
}
