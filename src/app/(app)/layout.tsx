import { Suspense } from 'react'

import { AccountNoticeBanner } from '@/components/account-notice-banner'
import { SiteHeader } from '@/components/site-header'
import { getSessionUser } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

async function PendingAccountNotice() {
  const user = await getSessionUser()
  if (!user) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('account_notices')
    .select('id, title, body')
    .eq('student_id', user.id)
    .is('dismissed_at', null)
    .lte('show_after', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  return (
    <AccountNoticeBanner
      noticeId={data.id}
      title={data.title}
      body={data.body}
    />
  )
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-6 sm:py-9">
        <Suspense fallback={null}>
          <PendingAccountNotice />
        </Suspense>
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
