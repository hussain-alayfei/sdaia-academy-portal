import Image from 'next/image'
import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,7fr)_minmax(0,9fr)]">
      {/* Brand rail. Collapses to a slim band on mobile rather than being
          hidden entirely, so the logo is always present. */}
      <aside className="flex flex-col justify-between bg-navy-900 px-6 py-6 text-navy-100 lg:px-10 lg:py-12">
        <Link href="/" className="inline-flex w-fit rounded-sm bg-white p-3">
          <Image
            src="/sdaia-academy.png"
            alt="SDAIA Academy, Saudi Data &amp; AI Authority"
            width={1046}
            height={166}
            priority
            className="h-8 w-auto lg:h-11"
          />
        </Link>

        <div className="hidden lg:block">
          <h2 className="max-w-sm text-2xl font-semibold text-white">
            Advance your practice with{' '}
            <span className="animate-brand">purpose</span>.
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-navy-200">
            Lectures, laboratories and assessments, structured for each day of
            the programme.
          </p>
        </div>

        <p className="hidden text-xs text-navy-300 lg:block">
          SDAIA Academy · Training Portal
        </p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-14">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
