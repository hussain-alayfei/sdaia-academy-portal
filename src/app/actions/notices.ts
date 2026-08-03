'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

export async function dismissAccountNotice(formData: FormData) {
  const noticeId = String(formData.get('notice_id') ?? '')
  const user = await getSessionUser()
  if (!user || !noticeId) return

  const supabase = await createClient()
  await supabase
    .from('account_notices')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', noticeId)
    .eq('student_id', user.id)
    .is('dismissed_at', null)

  revalidatePath('/', 'layout')
}
