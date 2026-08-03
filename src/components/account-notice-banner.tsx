'use client'

import { dismissAccountNotice } from '@/app/actions/notices'
import { AlertIcon } from '@/components/icons'
import { Button } from '@/components/ui'

export function AccountNoticeBanner({
  noticeId,
  title,
  body,
}: {
  noticeId: string
  title: string
  body: string
}) {
  return (
    <aside
      role="alert"
      className="mb-6 rounded-md border-2 border-danger-500 bg-danger-50 px-4 py-3 sm:px-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2.5">
          <AlertIcon
            width={18}
            height={18}
            className="mt-0.5 shrink-0 text-danger-700"
          />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-danger-900">{title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-danger-800">
              {body}
            </p>
          </div>
        </div>
        <form action={dismissAccountNotice}>
          <input type="hidden" name="notice_id" value={noticeId} />
          <Button type="submit" variant="secondary" size="sm">
            I understand
          </Button>
        </form>
      </div>
    </aside>
  )
}
