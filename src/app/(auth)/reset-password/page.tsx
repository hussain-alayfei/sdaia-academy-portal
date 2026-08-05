import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { cancelPasswordReset } from '@/app/actions/auth'
import { ArrowLeftIcon } from '@/components/icons'
import { getSessionUser } from '@/lib/dal'

import { ResetPasswordForm } from './reset-form'

export const metadata: Metadata = { title: 'Choose a new password' }

export default async function ResetPasswordPage() {
  const user = await getSessionUser()
  if (!user) {
    redirect(
      '/forgot-password?notice=' +
        encodeURIComponent(
          'Open the reset link from your email first, or request a new one.'
        )
    )
  }

  return (
    <>
      <div className="mb-6">
        <form action={cancelPasswordReset}>
          <button
            type="submit"
            className="group inline-flex items-center gap-2.5 text-[13px] font-medium text-ink-soft transition-colors duration-200 ease-out hover:text-teal-800"
          >
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-full bg-navy-50 text-navy-700 transition-colors duration-200 ease-out group-hover:bg-teal-50 group-hover:text-teal-800"
            >
              <ArrowLeftIcon width={15} height={15} strokeWidth={1.7} />
            </span>
            Cancel and sign in
          </button>
        </form>
      </div>
      <h1 className="text-[26px] font-semibold text-navy-900">
        Choose a new password
      </h1>
      <p className="mt-1.5 mb-7 text-sm text-ink-soft">
        Signed in as {user.email}. Pick a password you have not used here
        before.
      </p>
      <ResetPasswordForm />
    </>
  )
}
