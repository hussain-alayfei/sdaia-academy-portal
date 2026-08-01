# SDAIA Academy Portal

Course portal for SDAIA Academy training programmes. Instructors publish slides,
lab notebooks and assessments day by day; students see only their own
instructor's course.

Built for the **تطوير حلول الذكاء الاصطناعي** (Developing Generative AI
Solutions) programme, but multi-course from the ground up.

---

## Stack

| Layer     | Choice                                              |
| --------- | --------------------------------------------------- |
| Framework | Next.js 16.2 (App Router, Turbopack, React 19.2)     |
| Language  | TypeScript                                          |
| Styling   | Tailwind CSS v4, design tokens in `globals.css`      |
| Backend   | Supabase — Postgres, Auth, Storage                   |
| Types     | `Database` types generated from the live schema      |

> **Next.js 16 note:** `middleware.ts` is now `proxy.ts`, and `cookies()`,
> `params` and `searchParams` are async-only. Both are already handled here.

---

## First-time setup (about five minutes)

### 1. Turn off email confirmation — do this before anything else

**Dashboard → Authentication → Sign In / Providers → Email → turn off "Confirm
email" → Save.**

Until this is off, `mailer_autoconfirm` is `false` and **every signup fails**,
in one of three ways:

| What you see | What actually happened |
| ------------ | ---------------------- |
| `Email address "x@gmail.com" is invalid` | Supabase refuses addresses whose mailbox it cannot verify. Invented test addresses are rejected. |
| `email rate limit exceeded` | The built-in mailer allows only ~2–3 messages per hour. Thirty students at 9am is hopeless. |
| `Invalid login credentials` right after signing up | The account exists but is unconfirmed, so it cannot sign in. |

With confirmation off, signup returns a session immediately and none of the
above can happen. The app handles both settings correctly, but a live cohort
needs it off.

Check it took effect:

```bash
curl -s "https://gfoajqlifmmofswvibzs.supabase.co/auth/v1/settings" \
  -H "apikey: <your publishable key>" | grep autoconfirm
# want: "mailer_autoconfirm": true
```

### 2. Create your instructor account

```bash
npm run dev
```

Open <http://localhost:3000/signup> and register with your real email. **Leave
the course code empty** — no course exists yet.

Everyone starts as a `student`; the next step promotes you.

### 3. Run the seed

Open the Supabase SQL editor for project `gfoajqlifmmofswvibzs` and run
[`supabase/seed.sql`](supabase/seed.sql). It will:

- promote your account to `admin`,
- create the five-day course with real Day 1–5 titles and dates, and
- add the pre-assessment, post-assessment and final quiz — all **locked**.

If you registered with a different email, change the one on line 11 first.

### 4. Optional: enable the JWT role hook

Roles are resolved from a JWT claim, falling back to a table lookup if the claim
is absent — so everything works right now without this step. Enabling it removes
one query per request:

**Dashboard → Authentication → Hooks → Customize Access Token → select
`public.custom_access_token_hook`.**

---

## Adding your co-instructor

1. They sign up at `/signup` (course code optional).
2. Promote them:

```sql
update public.profiles set role = 'admin'
where lower(email) = lower('their.email@example.com');
```

3. They sign out and back in, then create their own course from **Instructor →
   New course**.

**Roles**

| Role         | Sees                                                  |
| ------------ | ----------------------------------------------------- |
| `admin`      | Every course. Use this for both of you.                |
| `instructor` | Only courses they own. For a future third instructor.  |
| `student`    | Only published content of courses they enrolled in.    |

---

## How the isolation works

Each course has an `owner_id` and a `join_code`. Students self-enrol by typing
the code, which runs `redeem_join_code()` — a `SECURITY DEFINER` function that
validates the code and inserts the enrolment. Students have **no insert rights
on `enrollments` at all**, so they cannot enrol themselves into an arbitrary
course by guessing a UUID.

Everything else is Postgres Row Level Security. Every content table carries a
`course_id`, and every read policy has the same shape:

```sql
manages_course(course_id)                     -- admin, or the owning instructor
or (is_published and is_enrolled(course_id))  -- enrolled student, published rows only
```

This matters more than it looks: the application never filters by
`is_published` or by instructor. Forgetting a `WHERE` clause in a query cannot
leak another instructor's material, because the database refuses to return the
rows in the first place.

Helper functions live in the `app_private` schema, which PostgREST does not
expose — callable from policies, but with no HTTP endpoint.

**Guards worth knowing about**

- A trigger blocks any role change unless the actor is an admin, so a student
  cannot promote themselves even though they can edit their own profile row.
- Uploaded files live in a **private** bucket, served only through
  `/api/files/[id]`, which checks permission and mints a 60-second signed URL.
  A leaked storage path is useless on its own.
- Storage policies parse the course ID out of the object path
  (`{course_id}/{day_id}/{file}`), so upload rights follow course ownership.

Verify it yourself with
[`supabase/isolation-test.sql`](supabase/isolation-test.sql) once two courses
and a student exist.

---

## Day-to-day use

**Publishing has two levels.** A day has its own published flag, and so does
each item inside it. Students see an item only when the course, the day *and*
the item are all published — so you can stage Day 3 while teaching Day 2.

- **Instructor → course → Schedule** — add days, publish or unpublish them.
- **A day → Upload a file / Add a link** — slides and PDFs upload; Colab
  notebooks are links. Files go browser-to-Supabase directly, so a 100 MB deck
  never runs through the Next.js server.
- **Assessments** — paste the external quiz URL and untick "Keep locked" when
  the class is ready. With no URL it stays locked, and students see it greyed
  out with "Opens when your instructor releases it."
- **Students** — the roster, plus a score box per assessment per student.
  Scores save when you leave the box; clearing one deletes it.

---

## Design

The palette comes from the official SDAIA deck: deep navy, teal as the single
interactive accent, amber only for locked and draft states. Typography is IBM
Plex Sans, with IBM Plex Sans Arabic for the Arabic titles that sit inline in
the otherwise-English interface.

Deliberately avoided: gradient headers, drop shadows on cards, pill-shaped
buttons, and emoji. Surfaces are separated by 1px borders and radii stay at
4–6px, which reads as a working tool rather than a landing page.

---

## Not built yet

The **built-in quiz engine** is intentionally out of scope for now. Assessments
currently hold an external link plus a manually entered score.

The schema is already shaped for it: `assessments` owns `max_score`,
`is_locked`, `opens_at` and `closes_at`, and `assessment_scores` is where an
engine would write results — the student-facing score display needs no changes.
Adding `assessment_questions` and `assessment_attempts` tables is the remaining
work.

Worth reusing when you build it: the previous exam app already solved
per-attempt question shuffling, choice permutation, and integrity logging
(`window_blur` / `tab_hidden` with timestamps). That data is preserved in the
paused `applied-genai-exam` project and summarised in
`../_backups/applied-genai-exam-results-2026-07.md`.

---

## Deploying

Works on Vercel with no changes. Set these environment variables:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL      # your real domain
```

Then add that domain under **Supabase → Authentication → URL Configuration →
Redirect URLs**.

`.env.local` is git-ignored and holds no secret key — the publishable key is
safe in the browser precisely because RLS does the enforcing.

---

## Commands

```bash
npm run dev     # dev server
npm run build   # production build
npm run lint    # eslint
npx tsc --noEmit
```
