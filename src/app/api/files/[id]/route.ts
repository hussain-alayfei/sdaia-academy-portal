import { NextResponse, type NextRequest } from 'next/server'

import { getSessionUser } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

/** Types a browser renders well inline; everything else is downloaded. */
const INLINE = /^(application\/pdf|image\/(png|jpeg|gif|webp|svg\+xml)|text\/plain)$/

/**
 * Hands out a short-lived signed URL for a stored course file.
 *
 * The bucket is private, so a leaked storage path is worthless on its own.
 * Access is checked twice over: selecting the `resources` row runs the table's
 * RLS policy, and minting the signed URL runs the storage policy — both as the
 * signed-in user, never with a service key.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new NextResponse('Not found', { status: 404 })
  }

  if (!(await getSessionUser())) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const supabase = await createClient()

  const { data: resource } = await supabase
    .from('resources')
    .select('storage_path, title, mime_type')
    .eq('id', id)
    .maybeSingle()

  // Either it does not exist or RLS hid it. Same answer either way — do not
  // leak which.
  if (!resource?.storage_path) {
    return new NextResponse('Not found', { status: 404 })
  }

  const inline = INLINE.test(resource.mime_type ?? '')
  const wantsDownload = request.nextUrl.searchParams.get('download') === '1'

  const { data: signed, error } = await supabase.storage
    .from('course-files')
    .createSignedUrl(resource.storage_path, 60, {
      download: !inline || wantsDownload ? resource.title : undefined,
    })

  if (error || !signed?.signedUrl) {
    return new NextResponse('File unavailable', { status: 404 })
  }

  return NextResponse.redirect(signed.signedUrl, {
    // The signed URL expires in 60s; never let a CDN or browser keep it.
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
