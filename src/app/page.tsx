import Image from 'next/image'
import { redirect } from 'next/navigation'

import { ButtonLink } from '@/components/ui'
import { getSessionUser } from '@/lib/dal'

export default async function LandingPage() {
  // Signed-in visitors have no reason to see the marketing shell.
  if (await getSessionUser()) redirect('/home')

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-20 max-w-5xl items-center px-5 sm:px-6">
          <Image
            src="/sdaia-academy.png"
            alt="SDAIA Academy, Saudi Data &amp; AI Authority"
            width={1046}
            height={166}
            priority
            className="h-9 w-auto sm:h-12"
          />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-5 py-16 sm:px-6 sm:py-20">
        <div className="animate-page max-w-3xl">
          <p className="mb-4 text-[12px] font-medium tracking-[0.12em] text-teal-700 uppercase">
            SDAIA Academy
          </p>

          {/* Set tight and large. `text-balance` stops the last line dropping a
              single orphaned word once it wraps on a laptop. */}
          <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.02em] text-balance text-navy-900 sm:text-[58px] lg:text-[70px]">
            Advance your practice with{' '}
            <span className="animate-brand">purpose</span>.
          </h1>

          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-ink-soft sm:text-[18px]">
            Lectures, laboratories and assessments, structured for each day of
            the programme.
          </p>

          <div className="mt-9">
            <ButtonLink href="/login">Sign in</ButtonLink>
          </div>
        </div>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-5xl px-5 py-5 text-[12px] text-ink-faint sm:px-6">
          SDAIA Academy · Training Portal
        </div>
      </footer>
    </div>
  )
}
