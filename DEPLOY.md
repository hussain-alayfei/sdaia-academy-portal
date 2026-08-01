# Publish to GitHub + Vercel

The repo is already initialised and committed locally. Both CLIs are installed;
each needs you to log in once through the browser — that part cannot be
automated.

## 1. GitHub

```bash
cd "C:\Users\hussa\Desktop\SDAIA Academy Website\portal"

gh auth login          # choose: GitHub.com -> HTTPS -> login with browser
gh repo create sdaia-academy-portal --private --source=. --remote=origin --push
```

Private is the right default — this is internal SDAIA course infrastructure.
Switch it later with `gh repo edit --visibility public` if you want it in your
teaching portfolio.

> The repo root is `portal/`, deliberately. The parent folder holds the course
> PDFs and `_backups/` with real student names, emails and exam scores — none of
> that should ever reach GitHub.

## 2. Vercel

```bash
vercel login
vercel link            # accept creating a new project
```

Add the three environment variables (Production, Preview and Development):

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
# paste: https://gfoajqlifmmofswvibzs.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# paste: sb_publishable_SP4lFNBaDC5SbJGfff5vmg_OBH3ur72

vercel env add NEXT_PUBLIC_SITE_URL
# paste your real domain once you know it, e.g. https://sdaia-academy-portal.vercel.app
```

Then ship it:

```bash
vercel --prod
```

## 3. One setting after the first deploy

Copy the URL Vercel prints, then in Supabase:

**Authentication → URL Configuration → Site URL** — set it to that URL, and add
`https://<your-domain>/**` under **Redirect URLs**.

Update `NEXT_PUBLIC_SITE_URL` to match and redeploy:

```bash
vercel env rm NEXT_PUBLIC_SITE_URL production
vercel env add NEXT_PUBLIC_SITE_URL production
vercel --prod
```

## Afterwards

Pushing to `main` triggers a deploy automatically.

```bash
git add -A
git commit -m "..."
git push
```

Neither key here is secret. The publishable key is designed to sit in the
browser — Row Level Security in Postgres is what actually enforces access, not
key secrecy.
