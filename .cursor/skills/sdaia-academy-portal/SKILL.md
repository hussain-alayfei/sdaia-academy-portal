---
name: sdaia-academy-portal
description: >-
  Project map for the SDAIA Academy Portal (Next.js 16, Supabase, Vercel bom1).
  Use when starting a new chat in this repo, exploring architecture, auth,
  header branding, day materials uploads, back navigation, caching, or deploy.
---

# SDAIA Academy Portal

## First actions in a new chat

1. Read `docs/CONTEXT.md` (source of truth for current behaviour — incl. 5 Aug 2026 UX).
2. Quizzes → also `docs/ASSESSMENTS.md` and the `sdaia-assessments` skill.
3. Deploy / region / cache → `DEPLOY.md` and `docs/ARCHITECTURE.md`.
4. Day file uploads → `src/lib/course-files.ts` + `npm test`.

## Product in one paragraph

Multi-course training portal. Instructors own courses; students enrol with a
join code. Content is day-scoped (max 5 days). Assessments are in-app MCQs on
the day page. Production: https://sdaia-genai-portal.vercel.app

## Layout cheat sheet

| Need | Path |
| --- | --- |
| Session / roles | `src/lib/dal.ts` |
| Login `next` sanitiser | `safeNext` in `src/app/actions/auth.ts` |
| Header / account menu | `site-header.tsx`, `account-menu.tsx`, `brand-home-link.tsx` |
| Back links | `BackLink` in `src/components/ui.tsx` |
| Student cache | `src/lib/published.ts` |
| Instructor reads | `src/lib/queries.ts` |
| Admin actions | `src/app/actions/admin.ts` |
| Day materials MIME | `src/lib/course-files.ts`, `resource-forms.tsx` |
| Auth proxy | `src/proxy.ts` |
| Course schedule | `src/app/(app)/c/[slug]/page.tsx` |
| Loading UI | `LoadingPanel` in `src/components/ui.tsx` |
| Seed | `supabase/seed.sql` |
| Types | `src/lib/types.ts` |

## Non-negotiables

- Repo root = `portal/`. Parent `_backups/` is PII.
- RLS owns authorization.
- `safeNext` for redirects — open redirect if you only check `startsWith('/')`.
- `revalidateCourseContent(courseId)` after content writes.
- Header: logo right; Profile → Notifications → Instructor; soft `BackLink` on nested pages.
- No fade on Assessments `LocalTabs` / admin course template.
- Uploads go through `course-files.ts` (MIME + accept); run `npm test` when changing it.
- Vercel `bom1`. `'use server'` → async exports only.
- Alias `sdaia-genai-portal.vercel.app` after prod deploy. `vercel --prod` ≠ `git push`.

## Further reading

- [docs/CONTEXT.md](../../../docs/CONTEXT.md)
- [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md)
- [docs/DATA-MODEL.md](../../../docs/DATA-MODEL.md)
- [reference.md](reference.md)
