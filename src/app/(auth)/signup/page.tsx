import type { Metadata } from 'next'

import { BackLink } from '@/components/ui'

import { SignupForm } from './signup-form'

export const metadata: Metadata = { title: 'Create account' }

export default function SignupPage() {
  return (
    <>
      <div className="mb-6">
        <BackLink href="/login">Sign in</BackLink>
      </div>
      <h1 className="text-[26px] font-semibold text-navy-900">
        Create your account
      </h1>
      <p className="mt-1.5 mb-7 text-sm text-ink-soft">
        Your course code decides which course you join, so make sure it matches
        the one your instructor gave you. No code yet? You can add it later.
      </p>
      <SignupForm />
    </>
  )
}
