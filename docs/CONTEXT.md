# SDAIA Academy Portal — project context

Course portal for SDAIA Academy training. Instructors publish slides, labs and
**in-app assessments** day by day. Students see only their instructor's course.

Built for **تطوير حلول الذكاء الاصطناعي** (Developing Generative AI Solutions),
but multi-course from the ground up.

**Live:** https://sdaia-academy-portal.vercel.app  
**Repo root:** `portal/` only. Never commit the parent folder — it contains
`_backups/` with real student names, emails and exam scores.

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16.2 (App Router, Turbopack, React 19.2) |
| Language | TypeScript |
| Styling | Tailwind CSS v4, tokens in `src/app/globals.css` |
| Backend | Supabase — Postgres, Auth, Storage |
| Hosting | Vercel, functions pinned to **`bom1` (Mumbai)** next to Supabase `ap-south-1` |
| Types | `src/lib/types.ts` generated from the live schema |

Next.js 16 specifics already handled here: `src/proxy.ts` (not `middleware.ts`);
`cookies()`, `params` and `searchParams` are async.

---

## Roles

| Role | Sees |
| --- | --- |
| `admin` | Every course |
| `instructor` | Only courses they own |
| `student` | Published content of enrolled courses only |

Everyone signs up as `student`. Promote via seed or:

```sql
update public.profiles set role = 'admin'
where lower(email) = lower('their.email@example.com');
```

A trigger blocks role changes unless the actor is already an admin.

---

## Course shape (current programme)

- **5 days only** (`MAX_COURSE_DAYS = 5` in `src/lib/course.ts`)
- Seven assessments per course:
  - Day 1: **Pre-assessment** (20 MCQs) + Day 1 quiz (10)
  - Days 2–4: daily quiz (10 each)
  - Day 5: Day 5 quiz (10) + **Post-assessment** (30)
- Assessments appear on their **day page**, never as a side panel on the course overview
- One attempt per assessment; scores come only from the quiz engine (no manual entry)

---

## Hard invariants (do not break)

1. **RLS is the security boundary.** App code must not be the only filter for
   published/enrolled/managed. Content tables carry `course_id` and reuse
   `app_private.manages_course` / `app_private.is_enrolled`.
2. **Answer keys never ride with the paper.** Correctness lives in
   `assessment_answer_keys`, not on `assessment_options`. Students read keys
   only after submit.
3. **Timer, one-attempt, grading, integrity** live in Postgres security-definer
   RPCs (`start_attempt`, `save_response`, `submit_attempt`,
   `record_integrity_event`). Do not reimplement that trust in the browser.
4. **Published content is cached** for students (`src/lib/published.ts`). Every
   content mutation must call `revalidateCourseContent(courseId)`. Instructors
   always read live.
5. **`SUPABASE_SECRET_KEY`** is server-only and only for the cache reader. Never
   expose it as `NEXT_PUBLIC_*`.
6. **Vercel region is `bom1`.** Changing it without moving Supabase makes every
   page ~8× slower.
7. **Email confirmation must stay off** for live cohorts (rate limits + signup
   friction). See README.

---

## Where to look

| Concern | Path |
| --- | --- |
| Auth / role gate | `src/lib/dal.ts`, `src/proxy.ts`, `src/app/actions/auth.ts` |
| Student published reads | `src/lib/published.ts` |
| Live / instructor reads | `src/lib/queries.ts`, `src/lib/quiz.ts` |
| Admin mutations | `src/app/actions/admin.ts` |
| Question import/edit | `src/app/actions/questions.ts` |
| Student quiz actions | `src/app/actions/quiz.ts` |
| JSON authoring contract | `src/lib/assessment-schema.ts`, `public/assessment-authoring-prompt.md` |
| Schema + RPCs | `supabase/migrations/`, `supabase/seed.sql` |
| Design tokens / motion | `src/app/globals.css` |

---

## Design language

SDAIA deck palette: deep navy, teal as the interactive accent, amber for draft /
locked. IBM Plex Sans + IBM Plex Sans Arabic. Avoid gradient headers, heavy
shadows, pill buttons, emoji. Surfaces use 1px borders; radii stay ~4–6px.
