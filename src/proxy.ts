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

const PUBLIC_PATHS = ['/', '/login', '/signup', '/auth']

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || (p !== '/' && pathname.startsWith(`${p}/`))
  )
}

export async function proxy(request: NextRequest) {
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
  const signedIn = Boolean(data?.claims?.sub)

  const { pathname } = request.nextUrl

  if (!signedIn && !isPublic(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (signedIn && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
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
