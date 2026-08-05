'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import type { RedeemResult } from '@/lib/types'

/**
 * React 19 resets an uncontrolled form once its action completes, so a
 * validation error would otherwise wipe everything the user typed. Every
 * failure path echoes the submitted fields back in `values`, and the forms
 * feed them to `defaultValue`. Passwords are deliberately never echoed.
 */
export type AuthState =
  | {
      errors?: Record<string, string[]>
      message?: string
      notice?: string
      values?: Record<string, string>
    }
  | undefined

const JOIN_CODE = /^[A-Za-z0-9-]{4,32}$/

const SignupSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .max(72, 'Passwords are limited to 72 characters.'),
  // Optional on purpose. Students normally have a code, but instructors (and
  // anyone whose code is not ready yet) can register and join from /home.
  join_code: z
    .string()
    .trim()
    .regex(JOIN_CODE, 'Course codes look like SDAIA-GENAI-01.')
    .optional()
    .or(z.literal('')),
})

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})

const ForgotSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
})

const ResetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Use at least 8 characters.')
      .max(72, 'Passwords are limited to 72 characters.'),
    confirm: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((value) => value.password === value.confirm, {
    message: 'Passwords do not match.',
    path: ['confirm'],
  })

const JoinSchema = z.object({
  join_code: z
    .string()
    .trim()
    .regex(JOIN_CODE, 'Course codes look like SDAIA-GENAI-01.'),
})

async function siteOrigin() {
  // Prefer the live request host so reset links never bake in localhost from
  // a local .env that was copied into a production build.
  try {
    const h = await headers()
    const host = (h.get('x-forwarded-host') || h.get('host') || '')
      .split(',')[0]
      ?.trim()
      .toLowerCase()
    const proto = (
      h.get('x-forwarded-proto') ||
      (host.includes('localhost') ? 'http' : 'https')
    )
      .split(',')[0]
      ?.trim()
    if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
      return `${proto}://${host}`
    }
  } catch {
    // headers() unavailable outside a request — fall through.
  }

  if (process.env.VERCEL_ENV === 'production') {
    return 'https://sdaia-genai-portal.vercel.app'
  }

  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'https://sdaia-genai-portal.vercel.app'
  )
}

/**
 * Where to send someone after a successful sign in.
 *
 * `?next=` is attacker-controllable: anyone can send a student a link to
 * /login?next=<somewhere>. Checking only `startsWith('/')` is not enough,
 * because `//evil.com` and `/\evil.com` both pass that test and browsers read
 * them as protocol-relative URLs, so the victim lands on another site still
 * believing they are signing in to the portal. Require a single leading
 * slash, and reject anything that tries to specify a host.
 */
function safeNext(raw: FormDataEntryValue | null): string {
  if (typeof raw !== 'string') return '/home'
  if (!raw.startsWith('/')) return '/home'
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/home'
  // Percent-encoded slashes are rejected outright. Whether `/%2f%2fevil.com`
  // is treated as one path segment or as `//evil.com` depends on who decodes
  // it first (browser, proxy, framework), and no real route here contains an
  // encoded slash, so there is nothing to lose by refusing them.
  if (/%2f|%5c/i.test(raw)) return '/home'
  // Belt and braces: resolving against a dummy origin catches anything
  // exotic (embedded credentials, odd schemes) that slips the above.
  try {
    const url = new URL(raw, 'https://portal.invalid')
    if (url.origin !== 'https://portal.invalid') return '/home'
    return url.pathname + url.search
  } catch {
    return '/home'
  }
}

const REDEEM_MESSAGES: Record<string, string> = {
  invalid_code: 'That course code was not recognised. Check it and try again.',
  course_not_open: 'That course is not open for enrolment yet.',
  not_a_student: 'Instructor accounts do not need a course code.',
  not_authenticated: 'Your session expired. Please sign in again.',
}

/**
 * Supabase's raw auth errors are aimed at developers. Translate the ones a
 * student or instructor can actually hit into something they can act on.
 */
function friendlyAuthError(code: string | undefined, fallback: string): string {
  switch (code) {
    case 'email_address_invalid':
      return 'Supabase rejected that address. Use a real inbox you can open — made-up test addresses are refused.'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Email sending is temporarily rate-limited on this project (Free plan allows only a few Auth emails per hour). Wait about an hour, or ask an admin to connect a verified custom email domain.'
    case 'user_already_exists':
    case 'email_exists':
      return 'An account already exists for this email. Sign in instead.'
    case 'weak_password':
      return 'That password is too easy to guess. Try a longer one.'
    case 'signup_disabled':
      return 'Sign-ups are currently disabled for this project.'
    case 'email_not_confirmed':
      return 'This account still needs to be confirmed. Check your inbox for the confirmation link.'
    default:
      return fallback
  }
}

export async function signup(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = {
    full_name: String(formData.get('full_name') ?? ''),
    email: String(formData.get('email') ?? ''),
    join_code: String(formData.get('join_code') ?? ''),
  }

  const parsed = SignupSchema.safeParse({
    ...raw,
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values: raw }
  }

  const { full_name, email, password, join_code } = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Never trust this for role — the DB trigger always writes 'student'.
      data: { full_name, pending_join_code: join_code || null },
    },
  })

  if (error) {
    return {
      message: friendlyAuthError(error.code, error.message),
      values: raw,
    }
  }

  // Email confirmation on => no session yet. The student finishes joining
  // from /home after their first sign-in.
  if (!data.session) {
    return {
      notice:
        'Account created. Check your email to confirm it, then sign in to enter your course code.',
    }
  }

  // No code given (instructors, or a student whose code is not ready): land on
  // /home, which prompts for one.
  if (!join_code) redirect('/home')

  const { data: result } = await supabase.rpc('redeem_join_code', {
    code: join_code,
  })
  const redeem = result as RedeemResult | null

  if (!redeem?.ok) {
    // The account exists and they are signed in; they just are not enrolled.
    // /home will prompt for the code, so send them there with a reason.
    redirect(
      `/home?join_error=${encodeURIComponent(redeem?.error ?? 'invalid_code')}`
    )
  }

  redirect('/home')
}

export async function login(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = { email: String(formData.get('email') ?? '') }

  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values: raw }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return {
      message: friendlyAuthError(
        error.code,
        'Email or password is incorrect.'
      ),
      values: raw,
    }
  }

  redirect(safeNext(formData.get('next')))
}

/** Enrol the signed-in student into a course using its join code. */
export async function joinCourse(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = { join_code: String(formData.get('join_code') ?? '') }
  const parsed = JoinSchema.safeParse(raw)

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values: raw }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('redeem_join_code', {
    code: parsed.data.join_code,
  })

  if (error) {
    return {
      message: 'Could not join right now. Please try again.',
      values: raw,
    }
  }

  const redeem = data as RedeemResult | null
  if (!redeem?.ok) {
    return {
      message: REDEEM_MESSAGES[redeem?.error ?? ''] ?? 'Could not join course.',
      values: raw,
    }
  }

  redirect(`/c/${redeem.course_slug}`)
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/** Leave a password-recovery session without changing the password. */
export async function cancelPasswordReset() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/** Send a password-reset email. Always returns a calm success message. */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = { email: String(formData.get('email') ?? '') }
  const parsed = ForgotSchema.safeParse(raw)

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values: raw }
  }

  const supabase = await createClient()
  // redirectTo is advisory for our email hook; the hook builds a portal
  // /auth/callback?token_hash=…&type=recovery&next=/reset-password link.
  const redirectTo = `${await siteOrigin()}/reset-password`

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo,
  })

  if (error) {
    return {
      message: friendlyAuthError(
        error.code,
        'Could not send a reset email right now. Please try again shortly.'
      ),
      values: raw,
    }
  }

  return {
    notice:
      'If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.',
    values: raw,
  }
}

/** Set a new password after the recovery link established a session. */
export async function updatePassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = ResetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  })

  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors }
  }

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims?.claims?.sub) {
    return {
      message:
        'Your reset session has expired. Request a new password reset email.',
    }
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    return {
      message: friendlyAuthError(
        error.code,
        'Could not update your password. Request a new reset link and try again.'
      ),
    }
  }

  // End the recovery session cleanly, then send them to sign in with the new
  // password. Avoids landing on /home still tagged as a recovery login.
  await supabase.auth.signOut()
  redirect(
    '/login?notice=' +
      encodeURIComponent('Password updated. Sign in with your new password.')
  )
}
