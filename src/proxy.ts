import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next.js 16 renamed `middleware` to `proxy`. Runs on every request to:
 *   1. refresh the Supabase auth token and write the rotated cookies, and
 *   2. do a cheap *optimistic* signed-in / signed-out redirect.
 *
 * Role and ownership checks deliberately do NOT live here — they run in the
 * data access layer and in Postgres RLS, close to the data. See
 * `src/lib/dal.ts`.
 */

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth',
  // Bearer-token protected; must not require a browser session.
  '/api/revalidate-course',
]

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || (p !== '/' && pathname.startsWith(`${p}/`))
  )
}

function isPasswordRecovery(claims: Record<string, unknown> | undefined) {
  const amr = claims?.amr
  if (!Array.isArray(amr)) return false
  return amr.some((entry) => {
    if (typeof entry === 'string') return entry === 'recovery'
    if (entry && typeof entry === 'object' && 'method' in entry) {
      return (entry as { method?: string }).method === 'recovery'
    }
    return false
  })
}

const CANONICAL_HOST = 'sdaia-genai-portal.vercel.app'
const LEGACY_HOSTS = new Set([
  'sdaia-academy-portal.vercel.app',
  'www.sdaia-academy-portal.vercel.app',
])

export async function proxy(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase()
  if (host && LEGACY_HOSTS.has(host)) {
    const url = request.nextUrl.clone()
    url.hostname = CANONICAL_HOST
    url.protocol = 'https:'
    url.port = ''
    return NextResponse.redirect(url, 308)
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
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
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  // Do not insert logic between client creation and this call: it refreshes the
  // session, and skipping it causes hard-to-debug random logouts.
  //
  // getClaims() rather than getUser(): the project signs tokens with ES256, so
  // the signature is verified in-process against a cached JWKS instead of
  // costing a round trip to the auth server on every single request. It still
  // reads the session first, so expired tokens are refreshed as before.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims as Record<string, unknown> | undefined
  const signedIn = Boolean(claims?.sub)
  const recovering = isPasswordRecovery(claims)

  const { pathname } = request.nextUrl

  // Password-recovery sessions must finish on /reset-password. Sending them
  // to /home (or bouncing /login → /home) is what made "Back" feel broken.
  if (recovering && pathname !== '/reset-password' && !pathname.startsWith('/auth')) {
    const url = request.nextUrl.clone()
    url.pathname = '/reset-password'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (!signedIn && !isPublic(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (signedIn && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = recovering ? '/reset-password' : '/home'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    // Everything except static assets and image files. `.md` is here for the
    // authoring prompt in `public/`: it is a blank template with no course
    // content in it, and running the auth proxy over a static file only meant
    // the download broke whenever the session cookie was mid-refresh.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|md)$).*)',
  ],
}
