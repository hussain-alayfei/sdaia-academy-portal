# Architecture

## Route groups

```
src/app/
  page.tsx                 landing (signed-out); animate-page on hero
  (auth)/                  login, signup — navy brand rail + form column
    template.tsx           animate-page on the form column (rail stays put)
  (app)/                   portal chrome (header + footer)
    template.tsx           animate-page on every in-app navigation
    loading.tsx            LoadingPanel
    home/                  join course; managers redirect to /admin
    c/[slug]/              student course schedule (day tiles)
      loading.tsx
      day/[dayNumber]/      materials + AssessmentCards
        loading.tsx
    admin/                 instructor console (requireManager)
      loading.tsx
  (quiz)/                  quiz-only layout (no portal chrome)
    quiz/[assessmentId]/   rules → runner → review
      loading.tsx
  api/files/[id]/          permission check + short-lived signed URL
```

Public paths in `src/proxy.ts`: `/`, `/login`, `/signup`, `/auth/*`.
Static `.md` under `public/` skips the matcher.

## Auth and redirects

1. `proxy.ts` refreshes the session with `getClaims()` (local JWKS for ES256).
2. Unauthenticated users hitting a private path go to `/login?next=<pathname>`.
3. After login, **`safeNext`** in `src/app/actions/auth.ts` sanitises `next`
   before `redirect()`. Never accept a value that is only “starts with `/`”.
4. Pages use `requireProfile()` / `requireManager()` from `dal.ts`.
5. Postgres RLS still decides which rows return.

## Data access layers

| Module | Client | Audience | Cached? |
| --- | --- | --- | --- |
| `dal.ts` | user JWT | session, profile, enrollment, can-manage | request `cache()` |
| `queries.ts` | user JWT | instructor live content | request-scoped |
| `published.ts` | secret key | student published content | `unstable_cache` + tag `course-content:<id>` |
| `quiz.ts` | user JWT | attempts, paper, review, results | request-scoped |

**Rules:** never put per-student data in `published.ts`. Never serve instructors
from the published cache. After content mutations:

```ts
revalidatePath(...)
revalidateCourseContent(courseId)
```

## Enrolment and storage

- Students have **no insert** on `enrollments`. Join runs `redeem_join_code`.
- Private storage bucket; path `{course_id}/{day_id}/{file}`. Downloads via
  `/api/files/[id]` (permission + 60s signed URL). Upload paths must start with
  that prefix and must not contain `..`.

## Caching and region

- `vercel.json` → `"regions": ["bom1"]` (must match Supabase Mumbai).
- Student content cache tagged per course; invalidated only by app mutations.
- SQL-editor edits do not bust the cache.

## Server Actions vs RPCs

Thin actions in `src/app/actions/*` validate input, call Supabase, revalidate.
Anything atomic or unforgeable (attempts, grading, integrity, question import)
is a Postgres security-definer RPC.

## Motion cheat sheet

| Class | Meaning |
| --- | --- |
| `animate-page` | Full-page / template fade (no slide) |
| `animate-rise` | Small panel entrance with slight Y travel |
| `animate-brand` | Mosaic colour cycle on hero “purpose” |
| `animate-dot` | LoadingDots pulse |

Loading: `LoadingDots` / `LoadingPanel` in `src/components/ui.tsx`.
