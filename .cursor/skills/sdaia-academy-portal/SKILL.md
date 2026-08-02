---
name: sdaia-academy-portal
description: >-
  Project map and working conventions for the SDAIA Academy Portal (Next.js 16,
  Supabase, Vercel bom1). Use when starting a new chat in this repo, exploring
  architecture, editing courses/days/resources/auth/caching/deploy, or when the
  user mentions the portal, SDAIA Academy, join codes, or instructor admin.
---

# SDAIA Academy Portal

## First actions in a new chat

1. Read `docs/CONTEXT.md`.
2. If the task touches quizzes/assessments, also read `docs/ASSESSMENTS.md` and
   use the `sdaia-assessments` skill.
3. If the task touches deploy/region/cache, read `DEPLOY.md` and
   `docs/ARCHITECTURE.md`.

## Product in one paragraph

Multi-course training portal. Instructors own courses; students enrol with a
join code. Content is day-scoped (max 5 days). Assessments are **in-app MCQs**
on the day page. Production: https://sdaia-academy-portal.vercel.app

## Layout cheat sheet

| Need | Path |
| --- | --- |
| Session / roles | `src/lib/dal.ts` |
| Student cache | `src/lib/published.ts` |
| Instructor reads | `src/lib/queries.ts` |
| Admin actions | `src/app/actions/admin.ts` |
| Auth proxy | `src/proxy.ts` |
| Seed | `supabase/seed.sql` |
| Types | `src/lib/types.ts` |

## Non-negotiables

- Repo root = `portal/`. Parent `_backups/` is PII — never commit.
- RLS owns authorization; app filters are not enough.
- `revalidateCourseContent(courseId)` after content writes.
- Vercel `bom1`; Supabase Mumbai. Do not silently change region.
- `'use server'` modules: export async functions only.

## Further reading

- Full invariants and roles → [docs/CONTEXT.md](../../../docs/CONTEXT.md)
- Routes / caching / auth → [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md)
- Schema / RPCs → [docs/DATA-MODEL.md](../../../docs/DATA-MODEL.md)
- Extra reference in this skill → [reference.md](reference.md)
