import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { revalidateCourseContent } from '@/lib/published'

/**
 * Bust the student content cache for one or both cohorts after an out-of-band
 * database edit (SQL / scripts) that never went through admin Server Actions.
 *
 * POST /api/revalidate-course
 * Header: Authorization: Bearer <CRON_SECRET or SUPABASE_SECRET_KEY>
 * Body: { "courseId": "<uuid>" } or { "all": true }
 */
export async function POST(request: Request) {
  const expected =
    process.env.CRON_SECRET ?? process.env.SUPABASE_SECRET_KEY ?? ''
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''

  if (!expected || token !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { courseId?: string; all?: boolean } = {}
  try {
    body = (await request.json()) as { courseId?: string; all?: boolean }
  } catch {
    body = {}
  }

  const ids = body.all
    ? [
        '2cc6a89e-bf95-484c-8009-8e68a605e7f5', // SDAIA-GENAI-01
        'b774a21a-53c4-4eee-b24e-1d82598ccce8', // SDAIA-GENAI-02
      ]
    : body.courseId
      ? [body.courseId]
      : []

  if (ids.length === 0) {
    return NextResponse.json(
      { error: 'Provide courseId or { "all": true }' },
      { status: 400 }
    )
  }

  for (const id of ids) {
    revalidateCourseContent(id)
    revalidatePath(`/c/developing-generative-ai-solutions`)
    revalidatePath(`/c/developing-generative-ai-solutions-02`)
    revalidatePath(`/c/developing-generative-ai-solutions/day/[dayNumber]`, 'page')
    revalidatePath(
      `/c/developing-generative-ai-solutions-02/day/[dayNumber]`,
      'page'
    )
  }

  return NextResponse.json({ ok: true, revalidated: ids })
}
