# Publish to GitHub + Vercel

**Vercel is done and live:** <https://sdaia-academy-portal.vercel.app>

Supabase auth is configured (step 3). The only thing still needing you is the
GitHub push (step 1), because `gh` requires an interactive browser login.

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

## Region — do not change this casually

`vercel.json` pins Serverless Functions to **`bom1` (Mumbai)** because the
Supabase project lives in **`ap-south-1` (Mumbai)**.

This is the single most important performance setting in the project. A page
render makes several database round trips but only one trip back to the browser,
so compute must sit next to the database, not next to the user. Vercel's default
is `iad1` (Washington DC), which put every query ~12,000 km from the data and
cost roughly 250 ms each:

| Route | `iad1` (default) | `bom1` (co-located) |
| --- | --- | --- |
| `/c/[slug]` | 1617 ms | 196 ms |
| `/c/[slug]/day/1` | 1328 ms | 180 ms |
| `/home` | 1103 ms | 182 ms |

Mumbai also happens to be closer to Riyadh than any US region, so users win
twice. If you ever move the Supabase project to another region, change `bom1` to
match it — leaving them mismatched silently makes every page roughly eight times
slower.

## Caching of course content

Students share one cached copy of each course's published days, resources and
assessments, so a whole cohort opening Day 1 at once costs the database one read
instead of one per student. Three things make this safe:

- **Only published rows, only per course.** The readers in `src/lib/published.ts`
  filter `is_published` and scope to a single course id, so the answer is
  identical for every student and there is no per-viewer data in it. Scores stay
  out of the cache entirely.
- **Instructors are never served it.** They read live, or drafts would disappear
  from their own editing screens.
- **Authorisation happens first.** The page still loads the course through the
  user-scoped client, so RLS decides whether this person may see the course at
  all before any cached content is read.

Cached reads use `SUPABASE_SECRET_KEY` (already set on Vercel for all three
environments). It bypasses RLS, which is exactly why it is confined to
`src/lib/supabase/cache-reader.ts` and must only ever be imported by
`published.ts`. It is deliberately not prefixed `NEXT_PUBLIC_`.

Every content mutation calls `revalidateCourseContent`, so an instructor's edit
reaches students on their next load rather than after a timeout. One caveat worth
knowing: **editing rows directly in the SQL editor will not invalidate the
cache**, because invalidation is wired into the app's own mutations. Content
changed that way can take up to an hour to appear for students. Change content
through the instructor UI.

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

## 3. Supabase auth config — already done

Applied through the Management API, not the dashboard:

| Setting | Value | Why |
| --- | --- | --- |
| `mailer_autoconfirm` | `true` | No confirmation email is sent, so the mailer rate limit can never be hit. Signup returns a session immediately. |
| `site_url` | `https://sdaia-academy-portal.vercel.app` | Was `http://localhost:3000`. |
| `uri_allow_list` | production `/**` and `localhost:3000/**` | Was empty, which blocks every redirect target. |

The project's `rate_limit_email_sent` is **2 per hour** — that was the cause of
the "too many sign-up emails" error. It is now moot because no signup email is
sent at all.

Verified with a real signup against the live project: session returned,
`email_confirmed_at` set, `confirmation_sent_at` null (proving no email was
attempted), profile row created with role `student`. Test user then deleted.

If you ever re-enable **Confirm email**, that 2/hour limit comes straight back.
Raise it by configuring custom SMTP rather than relying on the built-in mailer.

To change any of this without the dashboard:

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/gfoajqlifmmofswvibzs/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mailer_autoconfirm": true}'
```

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
