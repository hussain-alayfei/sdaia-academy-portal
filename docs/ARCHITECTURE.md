# Architecture

## Route groups

```
src/app/
  (auth)/          login, signup — minimal chrome
  (app)/           portal chrome (header + footer)
    home/          join course + enrolled list
    c/[slug]/      student course + day pages
    admin/         instructor console
  (quiz)/          quiz-only layout (no portal chrome)
    quiz/[assessmentId]/   rules → runner → review
  api/files/[id]/  permission check + 60s signed storage URL
```

`(app)/template.tsx` remounts on navigation so `animate-rise` plays once per
page change without repeating the class on every page.

## Data access layers

| Module | Client | Audience | Cached? |
| --- | --- | --- | --- |
| `dal.ts` | user JWT | session, profile, enrollment, can-manage | request-scoped `cache()` |
| `queries.ts` | user JWT | instructor live content | request-scoped |
| `published.ts` | secret key | student published content | `unstable_cache` + tag `course-content:<id>` |
| `quiz.ts` | user JWT | attempts, paper, review, results | request-scoped |

**Rule:** never put per-student data (attempts, scores, integrity) in
`published.ts`. Never serve instructors from the published cache.

After any admin content mutation:

```ts
revalidatePath(...)
revalidateCourseContent(courseId)
```

## Auth flow

1. `proxy.ts` refreshes the session via `getClaims()` (local JWKS verify for ES256).
2. Public paths: `/`, `/login`, `/signup`, `/auth/*`. Static `.md` skips the matcher.
3. Pages call `requireProfile()` / `requireManager()` from `dal.ts`.
4. Postgres RLS still decides which rows return.

## Enrolment

Students have **no insert** on `enrollments`. Joining runs
`redeem_join_code(code)` (security definer): validates the join code, inserts
the enrolment. Guessing a course UUID is useless.

## Storage

Private bucket. Object path `{course_id}/{day_id}/{file}`. Browser uploads
directly to Supabase. Downloads go through `/api/files/[id]` which checks
permission and mints a short-lived signed URL.

## Caching & region

- Functions: `vercel.json` → `"regions": ["bom1"]` (must match Supabase Mumbai).
- Student content cache: tagged per course; invalidated on app mutations only.
- Editing rows in the SQL editor does **not** bust the cache (up to 1 hour).

## Server Actions vs RPCs

Thin actions in `src/app/actions/*` parse FormData / JSON, call Supabase, then
revalidate. Anything that must be atomic or unforgeable (start attempt, save
answer, submit, integrity, import questions) is a Postgres RPC.
