# Architecture

## Route groups

```
src/app/
  page.tsx                 landing (signed-out); animate-page on hero
  icon.png / apple-icon.png  mosaic favicon (Academy emblem)
  (auth)/                  login, signup, forgot, reset — navy brand rail + form
    template.tsx           animate-page on the form column (rail stays put)
  (app)/                   portal chrome (SiteHeader + footer)
    template.tsx           animate-page on in-app navigation
    profile/               Edit info (from AccountMenu)
    notifications/         Full feed
    home/                  join course; managers redirect to /admin
    c/[slug]/              student course schedule (journey)
      template.tsx         animate-page
      day/[dayNumber]/      materials + AssessmentCards
    admin/                 instructor console (requireManager)
      courses/[id]/
        template.tsx       passthrough — no fade between Days/Assessments/…
  (quiz)/                  quiz-only layout (no portal chrome)
    quiz/[assessmentId]/   rules → runner → review
  api/files/[id]/          permission check + short-lived signed URL
  api/revalidate-course/   bust student content cache after SQL edits
```

Public paths in `src/proxy.ts`: `/`, `/login`, `/signup`, `/forgot-password`,
`/reset-password`, `/auth/*`. Static `.md` under `public/` skips the matcher.

## Chrome and navigation

- `SiteHeader`: light bar, mosaic underline, actions left / logo right
- Order: Profile (`AccountMenu`) → Notifications → Instructor
- `BackLink`: soft parent link on nested / auth / quiz screens
- Brand asset: `/sdaia-academy-logo.jpg`
- Domains: primary `sdaia-genai-portal.vercel.app`; backup `sdaia-academy.vercel.app`.
  Do not use `sdaia-academy-portal.vercel.app` (WireFilter-blocked).

## Auth and redirects

1. `proxy.ts` refreshes the session with `getClaims()` (local JWKS for ES256).
2. Unauthenticated users hitting a private path go to `/login?next=<pathname>`.
3. After login, **`safeNext`** in `src/app/actions/auth.ts` sanitises `next`
   before `redirect()`. Never accept a value that is only “starts with `/`”.
4. Pages use `requireProfile()` / `requireManager()` from `dal.ts`.
5. Postgres RLS still decides which rows return.
6. Branded auth mail: Edge Function `supabase/functions/auth-send-email/`
   (`verify_jwt` **false** — Auth webhook signature). Confirmation links must
   hit portal `/auth/callback?token_hash=&type=` (SSR `verifyOtp`). Do **not**
   send users only to Supabase `/auth/v1/verify` (hash tokens are invisible to
   the server and look like “expired” links).
7. Password-recovery sessions (`amr` includes `recovery`) stay on
   `/reset-password` until password update or cancel (sign-out). Do not send
   them `/login` → `/home`.
8. Callback route sets session cookies on the redirect response
   (`src/app/auth/callback/route.ts`).

## Data access layers

| Module | Client | Audience | Cached? |
| --- | --- | --- | --- |
| `dal.ts` | user JWT | session, profile, enrollment, can-manage | request `cache()` |
| `queries.ts` | user JWT | instructor live content | request-scoped |
| `published.ts` | secret key | student published content | `unstable_cache` + tag `course-content:<id>` |
| `quiz.ts` | user JWT | attempts, paper, review, results | request-scoped |
| `course-files.ts` | — | upload MIME / kind helpers | pure |

**Rules:** never put per-student data in `published.ts`. Never serve instructors
from the published cache. After content mutations:

```ts
revalidatePath(...)
revalidateCourseContent(courseId)
```

## Enrolment and storage

- Students have **no insert** on `enrollments`. Join runs `redeem_join_code`.
- Private storage bucket `course-files`; path `{course_id}/{day_id}/{file}`.
  Downloads via `/api/files/[id]` (permission + 60s signed URL).
- Client must send a **resolved** MIME from `course-files.ts` (empty browser
  MIME / ZIP aliases are normalized). Size limit 200 MB. Run `npm test` when
  changing the allowlist.

## Caching and region

- `vercel.json` → `"regions": ["bom1"]` (must match Supabase Mumbai).
- Student content cache tagged per course; invalidated only by app mutations.
- SQL-editor edits do not bust the cache — use `/api/revalidate-course`.

## Server Actions vs RPCs

Thin actions in `src/app/actions/*` validate input, call Supabase, revalidate.
Anything atomic or unforgeable (attempts, grading, integrity, question import)
is a Postgres security-definer RPC.

## Motion cheat sheet

| Class | Meaning |
| --- | --- |
| `animate-page` | Full-page / template fade (no slide). Not used on admin course tab template |
| `animate-rise` | Small panel entrance with slight Y travel |
| `animate-brand` | Mosaic colour cycle on hero “purpose” |
| `animate-dot` | LoadingDots pulse |

Assessments day `LocalTabs`: instant visibility toggle only — no panel fade.

Loading: `LoadingDots` / `LoadingPanel` in `src/components/ui.tsx`.
