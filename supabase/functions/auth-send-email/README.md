# Auth send-email hook

Supabase Auth calls this Edge Function for every auth email. It renders SDAIA navy/teal HTML and sends via Gmail SMTP.

## Required secrets

- `SEND_EMAIL_HOOK_SECRET` — same value as Auth → Hooks → Send Email secret (`v1,whsec_…`)
- `GMAIL_USER` — sender Gmail address
- `GMAIL_APP_PASSWORD` — Google App Password (not the account password)
- `MAIL_FROM_NAME` — display name (default `SDAIA Academy`)
- `PORTAL_SITE_URL` — `https://sdaia-genai-portal.vercel.app`

## Auth config

- Hook URI: `https://gfoajqlifmmofswvibzs.supabase.co/functions/v1/auth-send-email`
- `verify_jwt` must stay **false** (Auth uses webhook signatures)

HTML copies also live in `../email-templates/` for reference.
