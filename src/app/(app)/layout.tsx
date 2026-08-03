import { AccountNoticeBanner } from '@/components/account-notice-banner'
import { SiteHeader } from '@/components/site-header'
import { getSessionUser } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  let notice: { id: string; title: string; body: string } | null = null

  if (user) {
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

    notice = data
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-6 sm:py-9">
        {notice ? (
          <AccountNoticeBanner
            noticeId={notice.id}
            title={notice.title}
            body={notice.body}
          />
        ) : null}
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
