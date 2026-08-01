# Publish to GitHub + Vercel

**Vercel is done and live:** <https://sdaia-academy-portal.vercel.app>

What is left is GitHub (step 1) and one Supabase setting (step 3).

## 1. GitHub — needs your login

`gh` is installed but not on the PATH of every shell. Use the full path if
`gh` is not recognised.

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

## 2. Vercel — already done

Project `hussain-alyafeis-projects/sdaia-academy-portal`, deployed to
production and aliased to <https://sdaia-academy-portal.vercel.app>.

All three environment variables are set for Production, Preview and
Development. Verified after deploy: `/` and `/login` return 200, `/admin` and
`/home` redirect to `/login` for signed-out visitors, and there are no runtime
errors.

Vercel Authentication was on by default, which would have shown students a
Vercel login wall. It is now scoped to **preview deployments only**, so
production is public while previews stay private to your team. Change it under
**Project → Settings → Deployment Protection**.

Access to course content is enforced by Supabase auth and Postgres row-level
security, not by hiding the URL.

## 3. One Supabase setting — needs your login

Auth configuration has no API, so this is dashboard-only.

**Authentication → URL Configuration**

- **Site URL** → `https://sdaia-academy-portal.vercel.app`
- **Redirect URLs** → add `https://sdaia-academy-portal.vercel.app/**`

Without this, confirmation and password-reset links point at `localhost:3000`.

Also still outstanding, and also dashboard-only — **Authentication → Providers
→ Email → switch off "Confirm email"**. Until then the built-in mailer caps
signups at roughly 2–3 per hour, which is what causes the rate-limit error.

## Afterwards

The first deploy went out through the CLI, which does **not** create a Git
connection. Until you link the repo, `git push` will not deploy anything — ship
with:

```bash
vercel --prod
```

To get automatic deploys on push, do step 1, then in Vercel open
**Project → Settings → Git** and connect the `sdaia-academy-portal` repo. After
that:

```bash
git add -A
git commit -m "..."
git push
```

Neither key here is secret. The publishable key is designed to sit in the
browser — Row Level Security in Postgres is what actually enforces access, not
key secrecy.
