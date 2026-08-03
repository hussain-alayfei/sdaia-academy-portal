---
name: sdaia-academy-portal
description: >-
  Project map for the SDAIA Academy Portal (Next.js 16, Supabase, Vercel bom1).
  Use when starting a new chat in this repo, exploring architecture, auth
  redirects, day tiles, loading/motion, courses/resources, caching, or deploy.
---

# SDAIA Academy Portal

## First actions in a new chat

1. Read `docs/CONTEXT.md` (source of truth for current behaviour).
2. Quizzes → also `docs/ASSESSMENTS.md` and the `sdaia-assessments` skill.
3. Deploy / region / cache → `DEPLOY.md` and `docs/ARCHITECTURE.md`.

## Product in one paragraph

Multi-course training portal. Instructors own courses; students enrol with a
join code. Content is day-scoped (max 5 days). Assessments are in-app MCQs on
the day page. Production: https://sdaia-academy-portal.vercel.app

## Layout cheat sheet

| Need | Path |
| --- | --- |
| Session / roles | `src/lib/dal.ts` |
| Login `next` sanitiser | `safeNext` in `src/app/actions/auth.ts` |
| Student cache | `src/lib/published.ts` |
| Instructor reads | `src/lib/queries.ts` |
| Admin actions | `src/app/actions/admin.ts` |
| Auth proxy | `src/proxy.ts` |
| Day tiles | `src/app/(app)/c/[slug]/page.tsx` |
| Loading UI | `LoadingPanel` in `src/components/ui.tsx` + route `loading.tsx` |
| Seed | `supabase/seed.sql` |
| Types | `src/lib/types.ts` |

## Non-negotiables

- Repo root = `portal/`. Parent `_backups/` is PII.
- RLS owns authorization.
- `safeNext` for redirects — open redirect if you only check `startsWith('/')`.
- `revalidateCourseContent(courseId)` after content writes.
- Page fade = `animate-page`; day tiles content-height (no `aspect-square`).
- Vercel `bom1`. `'use server'` → async exports only.
- `vercel --prod` does not `git push`.

## Further reading

- [docs/CONTEXT.md](../../../docs/CONTEXT.md)
- [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md)
- [docs/DATA-MODEL.md](../../../docs/DATA-MODEL.md)
- [reference.md](reference.md)
