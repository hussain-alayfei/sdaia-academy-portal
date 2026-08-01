import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import type { Database } from '@/lib/types'

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Every query made through it runs as the signed-in user, so Row Level
 * Security in Postgres — not application code — decides what comes back.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Components cannot write cookies. Safe to ignore: proxy.ts
            // refreshes the session on every request, so tokens stay current.
          }
        },
      },
    }
  )
}
