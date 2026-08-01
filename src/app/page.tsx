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
            alt="SDAIA Academy — Saudi Data & AI Authority"
            width={1046}
            height={166}
            priority
            className="h-9 w-auto sm:h-12"
          />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-5 py-16 sm:px-6">
        <div className="max-w-xl">
          <p className="mb-3 text-[12px] font-medium tracking-wide text-teal-700 uppercase">
            SDAIA Academy
          </p>
          <h1 className="text-[32px] leading-tight font-semibold text-navy-900 sm:text-[40px]">
            Your training materials, day by day.
          </h1>
          <p className="mt-4 text-[15px] text-ink-soft">
            Slides, labs and assessments for your course.
          </p>

          <div className="mt-8">
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
