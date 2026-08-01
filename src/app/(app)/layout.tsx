import { SiteHeader } from '@/components/site-header'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-6 sm:py-9">
        {children}
      </main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-4 text-[12px] text-ink-faint sm:px-6">
          SDAIA Academy · Training Portal
        </div>
      </footer>
    </div>
  )
}
