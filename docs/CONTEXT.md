# SDAIA Academy Portal — project context

Read this first in every new chat. It describes the codebase **as it is now**.

> **Last verified:** 3 August 2026 (Asia/Riyadh). The production build, public
> deployment, Supabase connectivity, and agent service connections were checked
> directly. See **Verified handoff snapshot** below before making changes.

Course portal for SDAIA Academy. Instructors publish slides, labs and **in-app
assessments** day by day. Students see only courses they are enrolled in.

Built for **تطوير حلول الذكاء الاصطناعي** (Developing Generative AI Solutions),
multi-course from the ground up.

| | |
| --- | --- |
| Live | https://sdaia-academy-portal.vercel.app |
| Repo root | **`portal/` only** |
| Never commit | Parent folder `_backups/` (real student PII) |

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16.2 (App Router, Turbopack, React 19.2) |
| Language | TypeScript |
| Styling | Tailwind CSS v4, tokens in `src/app/globals.css` |
| Backend | Supabase (Postgres, Auth, Storage) |
| Hosting | Vercel functions in **`bom1` (Mumbai)** next to Supabase `ap-south-1` |
| Types | `src/lib/types.ts` from the live schema |

Next.js 16: auth edge is `src/proxy.ts` (not `middleware.ts`). `cookies()`,
`params`, and `searchParams` are async.

---

## Verified handoff snapshot

This is the operational state observed through 3 August 2026. Re-run the checks when
code, environment variables, migrations, or production configuration change.

| Area | Verified result |
| --- | --- |
| Local quality | `npm run lint` passed |
| TypeScript | `npx tsc --noEmit` passed |
| Production build | `npm run build` passed on Next.js 16.2.12; all routes compiled |
| Live public routes | `/`, `/login`, and `/signup` returned HTTP 200 |
| Browser smoke test | Landing, login, and signup rendered their expected headings/forms; no browser warnings or errors were captured |
| Supabase | Auth settings and anonymous REST request reachable; `mailer_autoconfirm` is `true` |
| Vercel | Local checkout linked to project `sdaia-academy-portal`; production URL reachable |
| Codex MCP | Vercel and Supabase are enabled with OAuth |
| Dependency audit | `npm audit --omit=dev` reports 3 high-severity transitive advisories through Next.js (`postcss` and `sharp`); see warning below |

### 2 August 2026 integrity and student-view release

- Production deployment `dpl_EvtvpWcPRq7u16grVkNVTSEaUcb6` is READY and
  aliased to `https://sdaia-academy-portal.vercel.app`.
- Supabase migrations `per_question_integrity_and_hardening` and
  `index_integrity_question_fk` are applied to project
  `gfoajqlifmmofswvibzs`.
- Integrity events are counted per question. The third event on one question
  makes only that question worth zero; the attempt never auto-submits and the
  student continues with the remaining questions.
- Admins and instructors have a manager-only **Student view** entry from the
  course editor. It uses published-only course readers and never starts an
  attempt or writes a score.
- Student materials are grouped into clearly labelled Slides, PDFs, Notebooks,
  Labs, Datasets, Links, and Files sections.
- The release also enforces parent course/day publication in RLS and Storage,
  exact assessment question counts at publish/start, immutable question banks
  after attempts exist, automatic-only scores, and course/day ownership checks
  for resource creation.
- Post-migration verification found 33 attempts, 33 scores, 19 historical
  integrity events, zero malformed new question events, and zero frozen-paper
  count mismatches. Existing production rows were not changed.

### 3 August 2026 assessment controls and Day 2 quiz release

- Production deployment `dpl_FCfdMvm2PNvCmvbqtZotDUM1WWF1` is READY and
  aliased to `https://sdaia-academy-portal.vercel.app`.
- Right-clicking during a quiz is allowed and creates no integrity warning. The
  `context_menu` database enum value remains only for historical log
  compatibility.
- The assessment editor now places **Details and timing** and **Student access**
  at the top. Release is separate from metadata saving, with explicit
  `Publish as locked`, `Unlock for students`, `Lock for students`, and
  `Hide from students` actions.
- Unlocking is refused unless the assessment is published and has the exact
  required question count. Saving title/day/time/shuffle no longer changes
  release state as a side effect.
- Production assessment `3ead3fa6-8bcf-452f-a402-b546cda49373` (`Day 2 quiz`)
  now contains ten source-aligned questions on RAG, retrieval pipelines, and
  RAG-versus-agent architecture. The portal validator reports zero errors and
  zero warnings. The mix is 3 easy, 5 medium, 2 hard; answer keys are A3, B3,
  C2, D2.
- Quiz 2 is **published and locked**, 10 minutes, shuffled, and had zero
  attempts at release. The reviewed source file is
  `docs/assessment-content/day-2-quiz.json`.
- Quiz 2 was subsequently expanded to an assessment-specific target of **15**
  questions at the user's request. It now has 8 easy, 5 medium, and 2 hard
  questions with answer keys A4, B3, C4, D4. It remains published, locked,
  shuffled, and had zero attempts after the update.
- Migration `assessment_specific_question_count` adds
  `assessments.required_question_count`. Existing defaults remain pre 20,
  quiz 10, and post 30; only Quiz 2 is configured for 15. The database attempt
  gate and the portal publish/unlock/import checks enforce the per-assessment
  target exactly.
- The 15-question release was deployed successfully through Vercel production
  and the main alias was updated to the new READY build (inspector release
  `27YFPs5SwLTrVgYX5SVFLNB7gnKM`).
- Live database verification found 19 enrollments, 30 attempts, and 30 scores
  after the previously authorized duplicate-account cleanup and retake resets.

### 3 August 2026 preview, schedule, and motion release

- Vercel production inspector release `ASz9cvAp3rKwp6PEjXKrqTESwqf7` built
  successfully and is aliased to `https://sdaia-academy-portal.vercel.app`.
- A course with all five days no longer renders the redundant **Add a day**
  panel. Courses with an available day number still show the form normally.
- Manager **Student view** assessments now have an unlimited, client-memory-only
  preview runner. It shuffles questions/options, supports navigation and flags,
  and shows an instructor answer-key review. It never calls `start_attempt`,
  `save_response`, `record_integrity_event`, or `submit_attempt`, so it creates
  no attempt, integrity event, or score. It also has no preview timer.
- The student course schedule is a responsive connected five-stop journey
  instead of a tile grid. Mobile uses a vertical path; desktop uses a horizontal
  path. Day colours, content counts, assessment chips, Arabic titles, summaries,
  and draft visibility for manager preview are preserved.
- Nested templates now restart the existing opacity-only `animate-page` motion
  when changing admin course tabs, moving between a course and its days, and
  entering quiz routes. Reduced-motion preferences remain respected.
- Migration `drop_legacy_integrity_rpc` removed the obsolete
  `record_integrity_event(uuid, text)` overload. Only the current
  `(attempt, question, kind)` RPC remains exposed.
- Verification: lint, TypeScript (non-incremental), local production build, and
  Vercel production build passed. Live landing, login, and signup rendered the
  expected content. The latest 100 Supabase API log entries were all HTTP 200;
  sampled API/Postgres/Auth logs contained no server errors. Eight Auth HTTP 400
  entries were normal invalid-login/expired-refresh-token client failures.

### 3 August 2026 second cohort (course 02)

- The portal now runs **two courses**. Do not assume a single course anywhere.
- `SDAIA-GENAI-02` (`developing-generative-ai-solutions-02`, id
  `b774a21a-53c4-4eee-b24e-1d82598ccce8`) is owned by `m.ibnrashid@gmail.com`,
  whose profile role is **`instructor`**, not `admin`. That is deliberate:
  `manages_course` is `is_admin() or owner_id = auth.uid()`, so he manages his
  own course and nothing else, and `profiles` reads stay filtered by
  `shares_course_with`. Promoting him to admin would hand him course 01.
- His syllabus differs from course 01's, so his five days are bare: titles
  `Day 1` … `Day 5`, no Arabic titles, summaries or resources. Day 1 is
  published because a student cannot reach an assessment on an unpublished day;
  Days 2–5 are drafts he publishes as he fills them. His course has no
  start/end dates yet.
- Course 01's Day 1 **Pre-assessment (20 Q)** and **Day 1 quiz (10 Q)** were
  copied into his Day 1 under fresh row ids and his `course_id` — identical
  stems, options, answer keys and rationales, **zero shared question or option
  ids**. The two banks are independent: resetting or editing his paper cannot
  touch course 01's, and his students are graded against his own copy. Both
  arrive published and locked.
- Reproducible in `supabase/seed-course-02.sql` (idempotent). It creates no
  login; the auth account must exist first. Role promotion needs the same
  `set_config('request.jwt.claims', …, true)` trick as `seed.sql`, because
  `app_private.jwt_role()` returns null when `auth.uid()` is null — so the
  service key alone cannot change a role.

### Latest live database refresh

Read-only Supabase verification on 3 August 2026 found the following current
production totals. Treat these as a snapshot, not permanent constants:

| Entity | Current total |
| --- | ---: |
| Courses | 2 |
| Course days | 10 |
| Resources | 4 |
| Assessments | 9 |
| Assessment questions | 75 |
| Enrollments | 36 |
| Attempts | 64 |
| Scores | 63 |
| Integrity events | 33 |

Attempt status is 1 `in_progress`, 57 `submitted`, and 6 `timed_out`.

Course-level snapshot:

- Course 01 (`SDAIA-GENAI-01`, owned by `huhulhussein3@gmail.com`, admin):
  5 days, 7 assessments, 4 resources, published.
- Course 02 (`SDAIA-GENAI-02`, owned by `m.ibnrashid@gmail.com`, instructor):
  5 days, 2 assessments, no resources yet, published. Its Days 2–5 remain
  drafts until the instructor prepares them.
- Course 01 Day 2 currently has no notebook, lab, dataset, or link resource;
  the recommended practical addition is documented in
  [`CONTENT-AUTHORING.md`](CONTENT-AUTHORING.md).

### Known dependency advisory

The 2 August 2026 production dependency audit reports three high-severity
advisories in the `postcss` and `sharp` versions installed transitively by
Next.js 16.2.12. npm offers only `npm audit fix --force`, which proposes a
breaking downgrade to Next.js 9.3.3. **Do not run that forced fix.** No package
change was made during verification. Re-check for a compatible patched Next.js
release before changing dependencies, then run the full build and smoke tests.

### External service access from Codex

- **Vercel MCP:** `https://mcp.vercel.com`, OAuth enabled.
- **Supabase MCP:** project-scoped to `gfoajqlifmmofswvibzs`, OAuth enabled,
  `read_only=true`, with `docs`, `database`, and `debugging` features. Do not
  remove read-only mode or mutate production data unless the user explicitly
  authorizes that exact change.
- The installed Supabase app connection can apply migrations when the user has
  explicitly authorized a production schema release. Prefer the read-only MCP
  for ordinary inspection.
- MCP configuration is global. After adding or changing a server, restart Codex
  and begin a new chat before expecting its tools to appear.
- **GitHub:** the GitHub app is installed for `hussain-alayfei`, but this portal
  repository was not found in the app's accessible repositories and this local
  checkout currently has **no Git remote configured**. Do not say GitHub is in
  sync and do not expect `git push` to work until the correct repository URL is
  confirmed and a remote is deliberately added.

### Working tree at handoff

- Branch: `main`.
- Latest local commit at verification: `b13d197` (`Close open redirect, fix day
  tile clipping and assessment labels, add loading states`).
- There are existing uncommitted documentation and agent-guidance changes.
  Always run `git status` and inspect the relevant diff before editing; preserve
  this work and never reset or discard it as cleanup.

### What was not tested

No student or instructor credentials were supplied, so authenticated student,
instructor, live quiz-attempt, upload, and admin workflows were not exercised in
the browser. Production data changes were explicitly authorized: the duplicate
Adel account cleanup and legacy retake resets from the roster task, plus the Day
2 quiz import and published-locked release described above. No deployment test
started a Quiz 2 attempt. Passing build, database checks, and public smoke tests
must not be described as a complete authenticated end-to-end browser test. The
project currently defines no unit-test or
end-to-end-test script in `package.json`; lint, TypeScript, build, metadata/data
consistency checks, HTTP checks, and public browser smoke tests are the
available checks.

### New-chat start sequence

1. Work from `C:\Users\hussa\Desktop\SDAIA Academy Website\portal`.
2. Read this file end to end, then read the task-specific docs linked below.
3. For slides, notebooks, labs, datasets, or assessments, read
   `docs/CONTENT-AUTHORING.md` before proposing or creating content.
4. Run `git status --short --branch` and preserve the existing working tree.
5. Use Supabase MCP only for read-only inspection unless explicit write
   authorization is given.
6. After code changes, run lint, TypeScript, and the production build.

---

## Roles

| Role | Access |
| --- | --- |
| `admin` | Every course |
| `instructor` | Courses they own |
| `student` | Published content of enrolled courses only |

Everyone signs up as `student`. Promote with seed or SQL. A trigger blocks role
changes unless the actor is already an admin.

**Instructor area** in the header appears only when `role` is `admin` or
`instructor`. If you see it while browsing student pages, you are logged in as
a manager — not a student.

---

## Course shape

- **5 days** (`MAX_COURSE_DAYS` in `src/lib/course.ts`)
- **Seven assessments:** Day 1 pre (20) + quiz (10); Day 2 quiz (15); Days 3–4
  quiz (10 each); Day 5 quiz (10) + post (30)
- Assessment **cards live on the day page**; course overview only shows a chip
  naming the kind (or `"N assessments"` if several)
- **One attempt** per assessment; scores come only from the quiz engine

### Instructor preference for future day content

Use Day 2 as the quality and explanation model for Days 3–5. Start from the
actual supplied material, inspect existing live resources and assessment
coverage, identify the missing practical skill, and recommend one coherent
notebook/lab with concrete steps, experiments, deliverables, and a reasoned
architecture or safety reflection. Keep verified facts separate from proposals.
Use current web research when requested or materially useful, cite primary
sources, and never claim web research was used when it was not. Full workflow
and the canonical Day 2 RAG lab are in
[`CONTENT-AUTHORING.md`](CONTENT-AUTHORING.md).

---

## Hard invariants (do not break)

1. **RLS is the security boundary.** Tables carry `course_id` and use
   `app_private.manages_course` / `app_private.is_enrolled`.
2. **Answer keys are a separate table** (`assessment_answer_keys`). Options have
   no correctness column. Students read keys only after submit.
3. **Timer, one-attempt, grading, integrity** are Postgres security-definer RPCs:
   `start_attempt`, `save_response`, `submit_attempt`, `record_integrity_event`.
   Integrity is per question: event 3 makes that question zero and never ends
   the attempt. Authoring: `import_assessment_questions`,
   `save_assessment_question`.
4. **Student published content is cached** in `src/lib/published.ts`. Every
   content mutation must call `revalidateCourseContent(courseId)`. Instructors
   always read live (`queries.ts` / `quiz.ts`).
5. **`SUPABASE_SECRET_KEY`** is server-only (cache reader). Never `NEXT_PUBLIC_*`.
6. **Vercel region is `bom1`.** Mismatch with Supabase ≈ 8× slower pages.
7. **Email confirmation off** for live cohorts (rate limits). See README.
8. **Post-login `next` must go through `safeNext`** in `src/app/actions/auth.ts`.
   A bare `startsWith('/')` check is an **open redirect** (`//evil.com` is
   protocol-relative). Reject `//`, `/\`, `%2f` / `%5c`, and cross-origin
   resolutions. Auth is cookie-only; URLs must not carry secrets, but they must
   not bounce users off-site after sign-in either.

---

## Student course schedule (five-stop journey)

File: `src/app/(app)/c/[slug]/page.tsx`

- Semantic ordered list with a connected vertical path on mobile and a
  five-column horizontal path from `md` upward.
- Cards remain content-sized (never `aspect-square`) so English and Arabic
  titles do not clip.
- Chip: one assessment → `Pre-assessment` / `Quiz` / `Post-assessment`; several
  → `"N assessments"`
- Hover: per-day SDAIA mosaic colour (teal / green / blue / violet / orange),
  border + soft fill only — no lift, no drop shadow

---

## Motion and loading

| Class | Use |
| --- | --- |
| `animate-page` | Page / template entrance — **opacity only**, 260ms ease-out. Used in group templates plus nested course/admin/quiz templates so tab and day navigation remounts it |
| `animate-rise` | Small in-place panels only (e.g. question editor) — a few px of travel |
| `animate-brand` | Hero word “purpose” cycles mosaic colours (12s loop) |
| `animate-dot` | Loading dots |

Loading UI: `LoadingDots` / `LoadingPanel` in `src/components/ui.tsx`. Wired via
`loading.tsx` under `(app)`, course, day, admin, and quiz routes. Three dots in
mosaic colours (teal → blue → orange), sequential pulse.

`prefers-reduced-motion` in `globals.css` neutralises animations.

---

## Where to look

| Concern | Path |
| --- | --- |
| Auth, `safeNext`, signup/login | `src/app/actions/auth.ts`, `src/proxy.ts`, `src/lib/dal.ts` |
| Student cached reads | `src/lib/published.ts` |
| Instructor / live reads | `src/lib/queries.ts`, `src/lib/quiz.ts` |
| Admin mutations | `src/app/actions/admin.ts` |
| Question import / edit | `src/app/actions/questions.ts`, `src/lib/assessment-schema.ts` |
| Student quiz | `src/app/actions/quiz.ts`, `src/components/quiz-*.tsx` |
| Authoring prompt | `public/assessment-authoring-prompt.md` |
| Course content style | `docs/CONTENT-AUTHORING.md` |
| Schema + RPCs | `supabase/migrations/`, `supabase/seed.sql` |
| Design / motion | `src/app/globals.css` |
| Deploy / region / cache ops | `DEPLOY.md` |

More detail: [ARCHITECTURE.md](ARCHITECTURE.md), [ASSESSMENTS.md](ASSESSMENTS.md),
[DATA-MODEL.md](DATA-MODEL.md).

---

## Design language

SDAIA deck: deep navy, teal accent, amber for draft/locked. IBM Plex Sans +
IBM Plex Sans Arabic. Working-tool UI: **1px borders**, small radii (~4–6px),
no gradient headers, no drop shadows on interactive rows, no pill chrome, no
emoji. Prefer plain punctuation in user-facing copy (avoid em dashes in prose;
empty table cells may still use `—`).

---

## Ops notes for agents

- `vercel --prod` deploys the working tree; it does **not** push git. After local
  commits, someone still needs `git push` if GitHub should stay in sync.
- Editing rows in the Supabase SQL editor does **not** call
  `revalidateCourseContent` — student cache can stay stale up to an hour.
- Leaked-password protection on Supabase Auth needs Pro (HTTP 402 on Free).
