import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/types'

/**
 * A Supabase client with no user attached, for cached reads only.
 *
 * ## Why this exists
 *
 * Everything else in this app reads through the cookie-bound client in
 * `server.ts`, so Postgres RLS decides what comes back. That is the right
 * default, but it cannot be cached across requests: the result depends on who
 * asked, and a cache keyed only by course id would hand one person's view to
 * somebody else.
 *
 * So cached content is read with no user at all, and the queries themselves
 * carry the restriction — every reader in `published.ts` filters
 * `is_published` and scopes to a single course id. The result is identical for
 * every student, which is exactly what makes it safe to share.
 *
 * ## Rules
 *
 * 1. Only `published.ts` may import this. It bypasses RLS, so any query written
 *    against it must be provably safe on its own.
 * 2. Never use it to read anything student-specific. Scores, enrolments and
 *    profiles stay on the user-scoped client.
 * 3. Never use it to write.
 * 4. Authorisation happens before the cache is consulted: the caller must
 *    already have proved, through RLS, that this person may see this course.
 *
 * The key is server-only and deliberately not prefixed `NEXT_PUBLIC_`, so it
 * cannot be inlined into the browser bundle.
 */
export function createCacheReader() {
  const secret = process.env.SUPABASE_SECRET_KEY

  if (!secret) {
    // Fail loudly. Falling back to an anonymous client would silently return
    // empty content and look like "the course has no materials yet".
    throw new Error(
      'SUPABASE_SECRET_KEY is not set. Cached course content cannot be read.'
    )
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
