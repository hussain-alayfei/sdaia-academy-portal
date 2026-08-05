'use server'

import { revalidatePath } from 'next/cache'

import { markEventsRead } from '@/lib/notifications'

export async function markNotificationsRead(eventIds: string[]) {
  const ids = eventIds.filter((id) => typeof id === 'string' && id.length > 0)
  if (ids.length === 0) return
  await markEventsRead(ids)
  revalidatePath('/', 'layout')
}
