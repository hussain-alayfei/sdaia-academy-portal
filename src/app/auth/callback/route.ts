import { createServerClient } from '@supabase/ssr'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import type { Database } from '@/lib/types'

/**
 * Completes email-link auth (confirm, recovery, magic link).
 *
 * Supports both:
 * - PKCE `?code=` from Supabase-hosted verify redirects
 * - SSR `?token_hash=&type=` links built by our auth-send-email hook
 *
 * Cookies are written onto the redirect response so the next page sees the
 * new session (critical for password reset).
 */
function safeNext(raw: string | null, fallback = '/home'): string {
  if (!raw) return fallback

  let value = raw.trim()
  try {
    if (/%[0-9a-f]{2}/i.test(value)) {
      value = decodeURIComponent(value)
    }
  } catch {
    return fallback
  }

  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback
  if (value.includes('..')) return fallback

  try {
    const url = new URL(value, 'https://portal.invalid')
    if (url.origin !== 'https://portal.invalid') return fallback
    return url.pathname + url.search
  } catch {
    return fallback
  }
}

function defaultNextForType(type: string | null): string {
  return type === 'recovery' ? '/reset-password' : '/home'
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = safeNext(
    searchParams.get('next'),
    defaultNextForType(type)
  )

  const successUrl = new URL(next, origin)
  let successResponse = NextResponse.redirect(successUrl)

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          successResponse = NextResponse.redirect(successUrl)
          for (const { name, value, options } of cookiesToSet) {
            successResponse.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  let verified = false

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    })
    verified = !error
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    verified = !error
  }

  if (verified) {
    return successResponse
  }

  const login = new URL('/login', origin)
  login.searchParams.set(
    'error',
    'That link is invalid or has expired. Sign in, or request a new password reset.'
  )
  return NextResponse.redirect(login)
}
