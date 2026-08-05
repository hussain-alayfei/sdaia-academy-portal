import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import nodemailer from 'npm:nodemailer@6.9.16'

const hookSecret = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? '').replace(
  'v1,whsec_',
  ''
)
const gmailUser = Deno.env.get('GMAIL_USER') ?? ''
const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD') ?? ''
const fromName = Deno.env.get('MAIL_FROM_NAME') ?? 'SDAIA Academy'
const portalSiteUrl =
  Deno.env.get('PORTAL_SITE_URL') ?? 'https://sdaia-genai-portal.vercel.app'

type EmailData = {
  token: string
  token_hash: string
  redirect_to: string
  email_action_type: string
  site_url: string
  token_new?: string
  token_hash_new?: string
  old_email?: string
}

type HookUser = {
  email: string
  new_email?: string
  email_new?: string
}

const SUBJECTS: Record<string, string> = {
  recovery: 'Reset your SDAIA Academy password',
  signup: 'Confirm your SDAIA Academy email',
  invite: 'You are invited to SDAIA Academy',
  magiclink: 'Your SDAIA Academy sign-in link',
  email_change: 'Confirm your new SDAIA Academy email',
  reauthentication: 'Verification code',
  password_changed_notification: 'Your SDAIA Academy password was changed',
  email_changed_notification: 'Your SDAIA Academy email was changed',
}

const FONT_BODY =
  "'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif"
const FONT_DISPLAY = "Georgia, 'Times New Roman', Times, serif"

function shell(opts: {
  eyebrow: string
  title: string
  bodyHtml: string
  buttonLabel?: string
  buttonHref?: string
}): string {
  const logoUrl = `${portalSiteUrl}/sdaia-academy-logo.jpg`
  const button =
    opts.buttonLabel && opts.buttonHref
      ? `<tr>
  <td style="padding:8px 0 18px 0;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="border-radius:6px;background-color:#0c8478;">
          <a href="${opts.buttonHref}" style="display:inline-block;background-color:#0c8478;color:#ffffff;font-family:${FONT_BODY};font-size:15px;font-weight:600;letter-spacing:0.02em;text-decoration:none;padding:13px 26px;border-radius:6px;">${opts.buttonLabel}</a>
        </td>
      </tr>
    </table>
  </td>
</tr>
<tr>
  <td style="padding:0 0 8px 0;font-family:${FONT_BODY};font-size:12px;line-height:1.55;color:#6b7280;">
    If the button does not work, copy and paste this link into your browser:<br/>
    <a href="${opts.buttonHref}" style="color:#0c8478;word-break:break-all;text-decoration:none;">${opts.buttonHref}</a>
  </td>
</tr>`
      : ''

  return `<html lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef1f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eef1f5;padding:32px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #dde3ea;border-radius:10px;overflow:hidden;box-shadow:0 1px 2px rgba(11,28,55,0.04);">
          <tr>
            <td style="background-color:#ffffff;padding:22px 28px 18px 28px;text-align:left;">
              <img src="${logoUrl}" alt="SDAIA Academy" width="220" style="display:block;width:220px;max-width:70%;height:auto;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>
          <tr>
            <td style="height:3px;background-color:#0c8478;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:30px 28px 10px 28px;">
              <p style="margin:0 0 10px 0;font-family:${FONT_BODY};font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#0c8478;">${opts.eyebrow}</p>
              <h1 style="margin:0 0 14px 0;font-family:${FONT_DISPLAY};font-size:26px;line-height:1.28;font-weight:600;color:#0b1c37;">${opts.title}</h1>
              <div style="font-family:${FONT_BODY};font-size:15px;line-height:1.65;color:#3f4b5a;">
                ${opts.bodyHtml}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 28px 8px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                ${button}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 28px 28px 28px;font-family:${FONT_BODY};font-size:12.5px;line-height:1.55;color:#6b7280;">
              This message was sent by the SDAIA Academy Training Portal.<br/>
              If you did not expect this email, you can ignore it.
            </td>
          </tr>
          <tr>
            <td style="background-color:#f7f9fb;border-top:1px solid #e6ebf0;padding:16px 28px;font-family:${FONT_BODY};font-size:11px;letter-spacing:0.02em;color:#94a3b8;">
              SDAIA Academy · Training Portal
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * Build a portal-owned confirmation URL for the SSR/PKCE app.
 *
 * Linking to Supabase `/auth/v1/verify` puts tokens in the URL hash, which the
 * Next.js server never sees — recovery then looks "expired". Instead we send
 * users to `/auth/callback` with `token_hash` + `type` so the route can call
 * `verifyOtp` and set session cookies.
 */
function resolveNextPath(emailData: EmailData): string {
  if (emailData.email_action_type === 'recovery') return '/reset-password'

  const redirectTo = (emailData.redirect_to || '').trim()
  if (!redirectTo) return '/home'

  try {
    if (redirectTo.startsWith('http://') || redirectTo.startsWith('https://')) {
      const parsed = new URL(redirectTo)
      const next = parsed.searchParams.get('next')
      if (next && next.startsWith('/') && !next.startsWith('//')) return next
      if (parsed.pathname && parsed.pathname !== '/') {
        return parsed.pathname + parsed.search
      }
      return '/home'
    }
  } catch {
    // fall through
  }

  if (redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
    return redirectTo.split('?')[0] || '/home'
  }

  return '/home'
}

function buildConfirmationUrl(siteUrl: string, emailData: EmailData): string {
  const url = new URL(`${siteUrl.replace(/\/$/, '')}/auth/callback`)
  url.searchParams.set('token_hash', emailData.token_hash)
  url.searchParams.set('type', emailData.email_action_type)
  url.searchParams.set('next', resolveNextPath(emailData))
  return url.toString()
}

function renderEmail(
  action: string,
  user: HookUser,
  emailData: EmailData,
  confirmationUrl: string,
  siteUrl: string
): { subject: string; html: string; text: string } {
  const email = escapeHtml(user.email ?? '')
  const newEmail = escapeHtml(
    user.new_email || user.email_new || emailData.old_email || ''
  )
  const token = escapeHtml(emailData.token || '')
  const oldEmail = escapeHtml(emailData.old_email || '')

  switch (action) {
    case 'recovery':
      return {
        subject: SUBJECTS.recovery,
        html: shell({
          eyebrow: 'Security',
          title: 'Reset your password',
          bodyHtml: `<p style="margin:0 0 12px 0;">We received a request to reset the password for <strong>${email}</strong>.</p><p style="margin:0;">Click the button below to choose a new password. This link expires after a short time.</p>`,
          buttonLabel: 'Reset password',
          buttonHref: confirmationUrl,
        }),
        text: `Reset your SDAIA Academy password\n\nOpen this link to choose a new password:\n${confirmationUrl}\n`,
      }
    case 'signup':
    case 'email':
      return {
        subject: SUBJECTS.signup,
        html: shell({
          eyebrow: 'Welcome',
          title: 'Confirm your email address',
          bodyHtml: `<p style="margin:0 0 12px 0;">Welcome to SDAIA Academy.</p><p style="margin:0;">Please confirm <strong>${email}</strong> to finish setting up your account.</p>`,
          buttonLabel: 'Confirm email',
          buttonHref: confirmationUrl,
        }),
        text: `Confirm your SDAIA Academy email\n\n${confirmationUrl}\n`,
      }
    case 'invite':
      return {
        subject: SUBJECTS.invite,
        html: shell({
          eyebrow: 'Invitation',
          title: 'You are invited to SDAIA Academy',
          bodyHtml: `<p style="margin:0 0 12px 0;">You have been invited to create an account on the SDAIA Academy Training Portal.</p><p style="margin:0;">Accept the invitation to continue.</p>`,
          buttonLabel: 'Accept invitation',
          buttonHref: confirmationUrl,
        }),
        text: `You are invited to SDAIA Academy\n\n${confirmationUrl}\n`,
      }
    case 'magiclink':
      return {
        subject: SUBJECTS.magiclink,
        html: shell({
          eyebrow: 'Sign in',
          title: 'Your sign-in link',
          bodyHtml: `<p style="margin:0 0 12px 0;">Use the secure link below to sign in to the SDAIA Academy Training Portal.</p><p style="margin:0;">This link can be used once and expires shortly.</p>`,
          buttonLabel: 'Sign in to portal',
          buttonHref: confirmationUrl,
        }),
        text: `Your SDAIA Academy sign-in link\n\n${confirmationUrl}\n`,
      }
    case 'email_change':
      return {
        subject: SUBJECTS.email_change,
        html: shell({
          eyebrow: 'Account update',
          title: 'Confirm your new email address',
          bodyHtml: `<p style="margin:0 0 12px 0;">Please confirm <strong>${newEmail || email}</strong> as the new email for your SDAIA Academy account.</p><p style="margin:0;">If you did not request this change, ignore this message.</p>`,
          buttonLabel: 'Confirm new email',
          buttonHref: confirmationUrl,
        }),
        text: `Confirm your new SDAIA Academy email\n\n${confirmationUrl}\n`,
      }
    case 'reauthentication':
      return {
        subject: SUBJECTS.reauthentication,
        html: shell({
          eyebrow: 'Verification',
          title: 'Your verification code',
          bodyHtml: `<p style="margin:0 0 16px 0;">Use this code to verify your identity on SDAIA Academy. It expires shortly.</p><p style="margin:0;font-size:28px;font-weight:700;letter-spacing:0.2em;color:#0b1c37;">${token}</p>`,
        }),
        text: `Your SDAIA Academy verification code: ${emailData.token}\n`,
      }
    case 'password_changed_notification':
      return {
        subject: SUBJECTS.password_changed_notification,
        html: shell({
          eyebrow: 'Security notice',
          title: 'Your password was changed',
          bodyHtml: `<p style="margin:0 0 12px 0;">The password for <strong>${email}</strong> was recently changed.</p><p style="margin:0;">If you did not make this change, reset your password immediately and contact your instructor.</p>`,
          buttonLabel: 'Reset password',
          buttonHref: `${siteUrl}/forgot-password`,
        }),
        text: `Your SDAIA Academy password was changed. If this was not you, reset at ${siteUrl}/forgot-password\n`,
      }
    case 'email_changed_notification':
      return {
        subject: SUBJECTS.email_changed_notification,
        html: shell({
          eyebrow: 'Security notice',
          title: 'Your email address was changed',
          bodyHtml: `<p style="margin:0;">The email on your SDAIA Academy account was changed from <strong>${oldEmail}</strong> to <strong>${email}</strong>.</p><p style="margin:12px 0 0 0;">If you did not make this change, contact support immediately.</p>`,
        }),
        text: `Your SDAIA Academy email was changed from ${emailData.old_email} to ${user.email}.\n`,
      }
    default:
      return {
        subject: 'SDAIA Academy notification',
        html: shell({
          eyebrow: 'Notice',
          title: 'SDAIA Academy',
          bodyHtml: `<p style="margin:0;">A security or account notice for <strong>${email}</strong>.</p>`,
          buttonLabel: confirmationUrl ? 'Continue' : undefined,
          buttonHref: confirmationUrl || undefined,
        }),
        text: confirmationUrl
          ? `SDAIA Academy notice\n\n${confirmationUrl}\n`
          : `SDAIA Academy notice for ${user.email}\n`,
      }
  }
}

async function sendMail(to: string, subject: string, html: string, text: string) {
  if (!gmailUser || !gmailPass) {
    throw new Error('Gmail SMTP secrets are not configured')
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  })

  await transporter.sendMail({
    from: `"${fromName}" <${gmailUser}>`,
    to,
    subject,
    html,
    text,
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 400 })
  }

  if (!hookSecret) {
    return new Response(
      JSON.stringify({ error: { message: 'Hook secret missing' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)
  const wh = new Webhook(hookSecret)

  try {
    const { user, email_data } = wh.verify(payload, headers) as {
      user: HookUser
      email_data: EmailData
    }

    const action = email_data.email_action_type
    const siteUrl = portalSiteUrl || email_data.site_url || ''
    const confirmationUrl = email_data.token_hash
      ? buildConfirmationUrl(siteUrl, email_data)
      : ''

    const rendered = renderEmail(
      action,
      user,
      email_data,
      confirmationUrl,
      siteUrl
    )

    await sendMail(user.email, rendered.subject, rendered.html, rendered.text)

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('auth-send-email failed:', message)
    return new Response(
      JSON.stringify({
        error: {
          http_code: 500,
          message,
        },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
