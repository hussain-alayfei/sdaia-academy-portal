# SDAIA Academy Portal — project context

Read this first in every new chat. It describes the codebase **as it is now**.

> **Last verified:** 5 August 2026 evening (Asia/Riyadh). Password-reset SSR
> flow, Day 4 quiz + 20-question post-assessment, domain aliases, and results
> UI refresh are live. See **Verified handoff snapshot** below before making
> changes.

Course portal for SDAIA Academy. Instructors publish slides, labs and **in-app
assessments** day by day. Students see only courses they are enrolled in.

Built for **تطوير حلول الذكاء الاصطناعي** (Developing Generative AI Solutions),
multi-course from the ground up.

| | |
| --- | --- |
| Live (primary) | https://sdaia-genai-portal.vercel.app |
| Also aliased | https://sdaia-academy.vercel.app (backup) |
| Do **not** share | `sdaia-academy-portal.vercel.app` — ISP WireFilter / TLS block; removed from production domains |
| Repo root | **`portal/` only** |
| Never commit | Parent folder `_backups/` (real student PII) |
| Supabase | Project `gfoajqlifmmofswvibzs` (`sdaia-academy-portal`) |
| Main course | `SDAIA-GENAI-01` id `2cc6a89e-bf95-484c-8009-8e68a605e7f5` |
| Second cohort | `SDAIA-GENAI-02` (owner is `instructor`, not admin) |

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16.2 (App Router, Turbopack, React 19.2) |
| Language | TypeScript |
| Styling | Tailwind CSS v4, tokens in `src/app/globals.css` |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Hosting | Vercel functions in **`bom1` (Mumbai)** next to Supabase `ap-south-1` |
| Types | `src/lib/types.ts` from the live schema |

Next.js 16: auth edge is `src/proxy.ts` (not `middleware.ts`). `cookies()`,
`params`, and `searchParams` are async.

---

## Verified handoff snapshot

Operational notes through **5 August 2026 evening**. Re-run checks when code,
env, migrations, or production config change.

| Area | Verified result |
| --- | --- |
| TypeScript | `npx tsc --noEmit` passed on recent deploys |
| Unit tests | `npm test` → `tsx --test src/lib/course-files.test.ts` (12 cases) |
| Production build | Vercel prod builds on Next.js 16.2.12 succeed |
| Live | https://sdaia-genai-portal.vercel.app — after `vercel --prod`, re-alias this host if CLI only updates `sdaia-academy.vercel.app` |
| Supabase | Project `gfoajqlifmmofswvibzs`; Storage bucket `course-files` MIME list includes ZIP aliases |
| Auth emails | Send Email Hook Edge Function `auth-send-email` (Gmail SMTP); links go to portal `/auth/callback?token_hash=…` (not Supabase `/auth/v1/verify`) |

### 5 August 2026 evening — auth + assessments (current)

**Password reset / email auth (critical)**

Root cause of “expired link / no reset page”: the email hook used to link to
Supabase `/auth/v1/verify`, which puts tokens in the **URL hash**. The Next.js
server never sees hash fragments, so `exchangeCodeForSession` failed and users
saw an expired-link error.

Fixed flow (live):

1. Hook builds `https://sdaia-genai-portal.vercel.app/auth/callback?token_hash=…&type=recovery&next=/reset-password`
2. `src/app/auth/callback/route.ts` calls `verifyOtp({ token_hash, type })` **or**
   `exchangeCodeForSession(code)`, and writes session cookies onto the redirect
   response
3. Recovery sessions are detected via JWT `amr` containing `recovery` in
   `src/proxy.ts` — user is kept on `/reset-password` (not bounced `/login` →
   `/home`)
4. Saving a new password signs out, then redirects to `/login` with a success
   notice; Cancel signs out to `/login`
5. `siteOrigin()` prefers the live request host so reset mail never bakes
   `localhost` from a local `.env`

Ops helpers:

- `scripts/send-recovery-link.mjs` — generate / send recovery for an email
- `scripts/fix-user-email.mjs` — admin email rename (profile still needs SQL
  trigger bypass for `profiles_guard_email`)

**GENAI-01 assessment inventory (live)**

| Paper | Day | Count | Minutes | Status |
| --- | --- | --- | --- | --- |
| Pre-assessment | 1 | 20 | 20 | published, unlocked |
| Day 1 quiz | 1 | 10 | 10 | published, unlocked |
| Day 2 quiz | 2 | 15 | 10 | published, unlocked |
| Day 3 quiz | 3 | 10 | 10 | published, unlocked |
| Day 4 quiz | 4 | 10 | 10 | published, unlocked |
| Post-assessment | 4 | **20** | **20** | published, unlocked (override; not the 30/30 default) |
| Final exam | 5 | **30** | 30 | **published, locked, results hidden** — see below |

JSON sources under `docs/assessment-content/`:

- `day-4-quiz.json` — 10 MCQ, mix 3/5/2
- `post-assessment-days-1-4.json` — 15 MCQ + 5 T/F, mix 6/9/5, 20 min
- `day-4-assessment-context.md` — Day 4 scope from corrected slides
- Seed: `scripts/seed-day4-quiz-and-post.mjs`

Schema note: global defaults remain `post` = 30 Q / 30 min. This course’s post
uses `required_question_count = 20`. `difficultyMixFor('post', 20)` returns
6/9/5; duration `20` is allowed when the file has exactly 20 post questions.

### Final exam (GENAI-01, Day 5) — current

Assessment `4c23ed42-7287-49ef-9e85-02cff925bd92`. 30 questions, **50 minutes**,
**published + locked**, `results_released = false`, `integrity_warning_limit = 3`.
Full plan and exam-day runbook: [`FINAL-EXAM-PLAN.md`](FINAL-EXAM-PLAN.md);
v2 notes: [`FINAL-EXAM-V2-PLAN.md`](FINAL-EXAM-V2-PLAN.md).

Source of truth is the approved paper at
`final_exam/developing_generative_ai_solutions_final_approved_exam.md` (sibling
of `portal/`). Transcribed verbatim into
`docs/assessment-content/final-exam.json` and seeded by
`scripts/seed-final-exam.mjs` **with the service key, bypassing the importer** —
the approved paper deliberately breaks several house authoring rules.
`src/lib/final-exam-content.test.ts` re-parses the approved `.md` and asserts
every stem, option, answer key, difficulty and day still matches.

### Final exam (GENAI-02, Day 5) — current

Assessment `f3ec2af7-d5c8-4f4a-96b2-536be25bbf13` on course
`b774a21a-53c4-4eee-b24e-1d82598ccce8`. Same exam engine as GENAI-01 (50 minutes,
3 warnings, lockdown, hidden results, bilingual, published + locked).

Source of truth is `FinalCourse-02.md` at the workspace root (**do not edit**).
JSON: `docs/assessment-content/course-02-final-exam.json` +
`course-02-final-exam-ar.json`. Seed:
`scripts/seed-course-02-final-exam.mjs` then
`scripts/seed-course-02-final-exam-arabic.mjs`. Drift guard:
`src/lib/course-02-final-exam-content.test.ts`.

| Section | Q | Format | Layout |
| --- | --- | --- | --- |
| A — Multiple choice | 25 | MCQ | one per screen |
| B — Shared scenario (KFUPM) | 5 | MCQ | **single page**, scenario pinned above |

### Final exam sections (GENAI-01)

**Sections.** `assessment_questions.section` (1/2/3) and `assessments.sections`
(jsonb: title, brief, layout, use case). `start_attempt` shuffles **within** a
section, so the paper always reads A → B → C:

| Section | Q | Format | Layout |
| --- | --- | --- | --- |
| A — Multiple choice | 20 | MCQ | one per screen |
| B — True or false | 5 | T/F | one per screen |
| C — Shared use case | 5 | MCQ | **single page**, use case pinned above |

True/false options keep their authored order (True, False). Only MCQ options
shuffle.

**Hidden results.** `assessments.results_released` defaults to **true**, so all
other papers are unaffected. While false, an attempt produces nothing a student
can read — enforced in the database, not React, because a student can query
PostgREST directly:

| Vector | Closed by |
| --- | --- |
| `assessment_attempts.correct_count` | not written by `submit_attempt` while hidden |
| `assessment_responses.is_correct` | RLS denies the row post-submit while hidden |
| `assessment_answer_keys` | RLS denies while hidden |
| `assessment_scores` | no row written while hidden |

Grading still runs, so the instructor sees marks immediately (the results page
rebuilds them from graded responses via `getGradedCounts`). **Release** with the
one-press control on the assessment's Results page →
`set_assessment_results_released(assessment, true)`, which backfills
`correct_count` and `assessment_scores` so the ordinary review screen works for
the whole class at once. Reversible.

**Exam-day:** open the course → **Final exam** tab
(`/admin/courses/{id}/final-exam`). That cockpit owns unlock / lock, release /
hide marks, reset all or one attempt, the live status board (polls every 5s),
the allowlist (named students can start while the paper stays locked for the
class), and **Sit as student (dry run)** — the real runner with a practice
attempt that is wiped on submit or exit and never appears on Results. Preview
on day quizzes is unchanged and is not a substitute for the dry run.

Keep the Final exam tab open during the sitting: frozen students show on the
board with Unfreeze (+ optional extra minutes). Granting one student does **not**
unlock the whole class.

**Sleep-ready defaults (both cohorts):** Final is **published + locked + results
hidden**, 50 minutes, 30 questions, 3-warning freeze. Students cannot start until
you press **Unlock paper for class** (or grant an allowlist seat).

**Marks visibility:** The admin **Students** tab is instructor-only. Students
never see Final (or any withheld paper) marks until **Release marks**. Instructors
still see graded scores on Students / Final exam board before release.

**Anti-cheat: 3 warnings, then freeze (final exam only).**
`assessments.integrity_warning_limit = 3`. Day quizzes leave it null and keep the
legacy per-question zeroing. Full detail in
[`ASSESSMENTS.md`](ASSESSMENTS.md#anti-cheat).

Counted: leaving the page (`visibilitychange` → hidden), staying out of
fullscreen past a **10 second grace** (desktop/laptop only), and blocked
copy/paste. **Not** counted: `window blur` (address bar, notifications, second
monitors — too noisy), and right-click / double-click / selection / drag /
**window resize**, which are blocked silently and never warn. **Phones and
tablets skip the fullscreen gate** (`examSupportsFullscreen`) so students can
sit on mobile; leaving the browser/app still counts as a warning.

At 5 warnings the attempt sets `frozen_at`: answering and submitting are refused
in the RPCs, and **the clock pauses**. Unlock from the red banner on the
assessment's Results page — `unlock_attempt` returns the frozen time, adds any
bonus minutes, and resets `warning_count` to 0 so the student is not re-frozen
instantly.

**Lockdown + clock (all attempts, not just the final).** `exam-lockdown.tsx`
blocks selection, right-click, cut, drag and the copy/save/print shortcuts;
options and buttons stay operable. Copy/paste stay owned by `integrity-guard`
so the warning count stays honest. The countdown is much larger and turns **red
for the last five minutes**. `assessments.instructions` (one point per line)
renders as a large numbered briefing on the rules screen.

**Day materials / slides**

- Corrected Day 4 deck uploaded (production + security)
- Capstone guide PDF replaced on Day 5 resource as needed
- Extracted text: `slides/_extracted/` (sibling of `portal/`, not deployed)

**Results UI**

- `src/components/admin/results-explorer.tsx` — equal KPI tiles, integrity
  drawer, cleaner table (redeployed earlier on 5 Aug)

### 5 August 2026 UX / branding release (still current)

**Brand assets**

- Canonical UI logo: `/sdaia-academy-logo.jpg` (official bilingual Academy mark)
- Favicon / tab icon: mosaic emblem only — `src/app/icon.png`, `apple-icon.png`, `public/favicon.ico`
- Mosaic CSS vars in `globals.css`: `--brand-cyan`, `--brand-indigo`, `--brand-orange`, `--brand-red`, `--brand-lime`
- Email templates / hook still reference `/sdaia-academy-logo.jpg` on the live site

**Site header** (`src/components/site-header.tsx`)

- Light bar (`bg-surface`) + 3px mosaic gradient underline (not flat navy)
- English LTR: **actions left, Academy logo right**
- Order: **Profile → Notifications → Instructor** (managers only)
- Profile is `AccountMenu` (`src/components/account-menu.tsx`): click opens preview
  (name/email) with **Edit info** → `/profile` and **Sign out**. Avatar does **not**
  navigate directly to edit
- Instructor + Notifications are icon-first; labels expand on hover (~500ms ease-in-out)
  via `HeaderExpandLink` / bell chrome — no filled “Instructor area” pill
- Logo link prefetches `/admin` for managers and `/home` for students (`BrandHomeLink`)
- Live badge: simple label (no status-dot treatment)

**Assessments day tabs**

- Labels are plain `Day N` (no `(count)` badges); count still picks the initial tab
- `LocalTabs` switches instantly — **no opacity fade** on day panels
- Admin course template `admin/courses/[id]/template.tsx` is a **passthrough**
  (no `animate-page`) so Assessments / Days / Students / Settings do not fade on tab change
- Instructor nav label is **Assessments** (not “Quizzes”)

**Back navigation**

- Shared `BackLink` in `src/components/ui.tsx`: soft circular arrow + label
- Present on profile, notifications, student course overview, quiz/review, auth pages
- Reset-password uses **Cancel and sign in** (signs out) — do not use a plain
  `BackLink` to `/login` during recovery (proxy would send recovery users to home)

**Day materials upload** (`src/lib/course-files.ts` + `resource-forms.tsx`)

- Single allowlist: extension → canonical MIME; normalizes empty / `octet-stream` /
  Windows `application/x-zip-compressed` before Storage upload
- Bucket `course-files` allowlist includes ZIP aliases; size still **200 MB**
- After SQL/editor content edits, call `revalidateCourseContent` (or
  `/api/revalidate-course`) — app uploads already revalidate

**Copy / title case**

- `toTitleCaseEnglish` in `src/lib/format.ts` used for course/day titles in admin UI

### Earlier releases (still in force)

Keep integrity, Student view preview, published RLS, `required_question_count`,
second cohort (`SDAIA-GENAI-02`), and assessment editor release controls as
documented in `docs/ASSESSMENTS.md`. Highlights:

- Integrity: third event on one question zeros **that question only**; attempt continues
- Manager **Student view** + unlimited client-only quiz preview (no attempt/score)
- `assessments.required_question_count` for per-paper targets (overrides kind defaults)
- Two live courses: `SDAIA-GENAI-01` and `SDAIA-GENAI-02`

### Resource naming (instructor preference)

Slides and labs — see [`CONTENT-AUTHORING.md`](CONTENT-AUTHORING.md)#resource-naming-slides--labs:

`Day {n} slides — {Topic}` / `Day {n} lab — {Topic}`.
HTML slide links open at `#1` unless asked otherwise.

### Known dependency advisory

`npm audit --omit=dev` may report high-severity transitive advisories through
Next.js (`postcss` / `sharp`). **Do not** run `npm audit fix --force` (proposes
a breaking Next downgrade). Wait for a compatible patched Next.js.

### External service access

- **Vercel:** CLI + MCP; after `vercel --prod`, alias
  `sdaia-genai-portal.vercel.app` if the CLI only updates the secondary domain.
- **Supabase MCP:** project `gfoajqlifmmofswvibzs`. Prefer read-only inspection;
  mutate production only with explicit user authorization.
- **GitHub:** do not assume a remote is configured or in sync; check `git remote -v`.

### Working tree

Always run `git status` before editing. Prefer preserving uncommitted work;
never reset/discard as “cleanup” unless the user asks.

### What was not fully browser-tested

Authenticated end-to-end (every upload type in a real browser session, live quiz
attempt under integrity) may not have been re-run after every UX deploy. Password
reset was fixed from production failure reports and redeployed; re-smoke with a
fresh recovery email after any auth-hook or callback change.

### New-chat start sequence

1. Work from `C:\Users\hussa\Desktop\SDAIA Academy Website\portal`.
2. Read this file, then task-specific docs linked below.
3. For slides/labs/datasets/assessments, read `docs/CONTENT-AUTHORING.md`.
4. Run `git status --short --branch` and preserve the working tree.
5. Use Supabase MCP carefully; authorize writes explicitly.
6. After code changes: `npx tsc --noEmit`, `npm test` when touching uploads,
   and deploy with `vercel --prod` + alias when the user wants production.
7. After auth-email hook changes: `npx supabase functions deploy auth-send-email
   --project-ref gfoajqlifmmofswvibzs --no-verify-jwt`.

---

## Roles

| Role | Access |
| --- | --- |
| `admin` | Every course |
| `instructor` | Courses they own |
| `student` | Published content of enrolled courses only |

Everyone signs up as `student`. Promote with seed or SQL. A trigger blocks role
changes unless the actor is already an admin.

**Instructor** header control appears only when `role` is `admin` or
`instructor`. If you see it while browsing student pages, you are logged in as
a manager — not a student.

---

## Course shape

- **5 days** (`MAX_COURSE_DAYS` in `src/lib/course.ts`)
- Assessments: Day 1 pre + quiz; Days 2–4 quiz (targets vary —
  `required_question_count`); post currently on **Day 4** for GENAI-01 (20 Q);
  Day 5 Final exam seeded for both cohorts (GENAI-01 and GENAI-02)
- Assessment **cards live on the day page**; course overview chips name the kind
- **One attempt** per assessment; scores come only from the quiz engine

### Instructor preference for future day content

Use Day 2 as the quality model for later days. Full workflow in
[`CONTENT-AUTHORING.md`](CONTENT-AUTHORING.md).

---

## Hard invariants (do not break)

1. **RLS is the security boundary.** Tables carry `course_id` and use
   `app_private.manages_course` / `app_private.is_enrolled`.
2. **Answer keys are a separate table** (`assessment_answer_keys`). Options have
   no correctness column. Students read keys only after submit.
3. **Timer, one-attempt, grading, integrity** are Postgres security-definer RPCs:
   `start_attempt`, `save_response`, `submit_attempt`, `record_integrity_event`.
   Integrity is per question: event 3 zeros that question only; attempt continues.
4. **Student published content is cached** in `src/lib/published.ts`. Every
   content mutation must call `revalidateCourseContent(courseId)`. Instructors
   always read live (`queries.ts` / `quiz.ts`).
5. **`SUPABASE_SECRET_KEY`** is server-only. Never `NEXT_PUBLIC_*` for secrets.
6. **Vercel region is `bom1`.**
7. **Auth email links** for SSR must use portal `/auth/callback` with
   `token_hash` + `type` (or PKCE `code`). Do not revert the hook to
   `/auth/v1/verify` alone.
8. **Post-login / callback `next` must go through `safeNext`**
   (`src/app/actions/auth.ts` and `src/app/auth/callback/route.ts`).
9. **Password-recovery sessions** must finish on `/reset-password` until the
   password is updated or the user cancels (signs out).
10. **Hidden results are hidden in the database.** When
    `assessments.results_released` is false, never write `correct_count` or an
    `assessment_scores` row, and never relax the RLS on
    `assessment_answer_keys` / `assessment_responses`. Hiding a score only in a
    component is not hiding it — students can query PostgREST directly.
11. **Section shuffling stays inside a section.** `start_attempt` orders by
    `section` before `random()`. Shuffling across the whole paper would break
    the A → B → C reading order and detach the use case from its questions.

---

## Student course schedule (five-stop journey)

File: `src/app/(app)/c/[slug]/page.tsx`

- Connected five-stop journey (vertical mobile / horizontal `md+`)
- Cards content-sized (never `aspect-square`)
- Chip: kind name or `"N assessments"`
- Hover: mosaic day colours (border + soft fill)

---

## Motion and loading

| Class | Use |
| --- | --- |
| `animate-page` | Soft page entrance (opacity). Used on `(app)` / auth / quiz / student course templates. **Not** on `admin/courses/[id]/template.tsx` (instant tab content) |
| `animate-rise` | Small in-place panels (e.g. question editor) |
| `animate-brand` | Hero word “purpose” cycles mosaic colours |
| `animate-dot` | Loading dots |

Loading UI: `LoadingDots` / `LoadingPanel`. Prefer light loaders; avoid stacking
full-page loaders on logo → home redirects (managers go straight to `/admin`).

`prefers-reduced-motion` in `globals.css` neutralises animations.

**Do not** add fade transitions to Assessments day `LocalTabs` unless the user
explicitly asks.

---

## Where to look

| Concern | Path |
| --- | --- |
| Auth, `safeNext`, signup/login/reset | `src/app/actions/auth.ts`, `src/proxy.ts`, `src/lib/dal.ts` |
| Auth email callback | `src/app/auth/callback/route.ts` |
| Auth email hook | `supabase/functions/auth-send-email/` |
| Site header / account menu | `src/components/site-header.tsx`, `account-menu.tsx`, `brand-home-link.tsx` |
| Back links | `BackLink` in `src/components/ui.tsx` |
| Student cached reads | `src/lib/published.ts` |
| Instructor / live reads | `src/lib/queries.ts`, `src/lib/quiz.ts` |
| Admin mutations | `src/app/actions/admin.ts` |
| Day materials upload MIME | `src/lib/course-files.ts`, `resource-forms.tsx` |
| Assessments by day tabs | `src/components/admin/assessments-by-day.tsx`, `local-tabs.tsx` |
| Question import / edit | `src/app/actions/questions.ts`, `src/lib/assessment-schema.ts` |
| Assessment JSON sources | `docs/assessment-content/` |
| Sections / paging | `src/lib/exam-sections.ts` (+ `.test.ts`) |
| Exam lockdown | `src/components/exam-lockdown.tsx` |
| Hidden-results submit screen | `src/components/quiz-submitted.tsx` |
| Release results | `setAssessmentResultsReleased` in `src/app/actions/admin.ts` |
| Results explorer | `src/components/admin/results-explorer.tsx` |
| Student quiz | `src/app/actions/quiz.ts`, `src/components/quiz-*.tsx` |
| Design / motion / brand tokens | `src/app/globals.css` |
| Deploy / region / cache ops | `DEPLOY.md` |

More detail: [ARCHITECTURE.md](ARCHITECTURE.md), [ASSESSMENTS.md](ASSESSMENTS.md),
[DATA-MODEL.md](DATA-MODEL.md), [CONTENT-AUTHORING.md](CONTENT-AUTHORING.md).

---

## Design language

SDAIA Academy: deep navy text, teal interactive accent, amber for draft/locked.
IBM Plex Sans + IBM Plex Sans Arabic. Working-tool UI: **1px borders**, small
radii (~4–6px), no drop shadows on interactive rows, no pill chrome, no emoji.

**Header chrome:** light surface + mosaic gradient strip drawn from the Academy
emblem (cyan → indigo → orange → red → lime). Prefer the official logo asset
over inventing purple/cream marketing looks.

Prefer plain punctuation in user-facing copy (avoid em dashes in prose;
empty table cells may still use `—`).

---

## Ops notes for agents

- `vercel --prod` deploys the working tree; it does **not** push git. After
  deploy, ensure alias `sdaia-genai-portal.vercel.app` points at the new build.
- Editing rows in the Supabase SQL editor does **not** call
  `revalidateCourseContent` — student cache can stay stale up to an hour.
  Use `node scripts/revalidate-course-01.mjs` (or the API) after SQL content
  edits for GENAI-01.
- Auth hook deploy:
  `npx supabase functions deploy auth-send-email --project-ref gfoajqlifmmofswvibzs --no-verify-jwt`
- Prefer updating these docs in the same change when behaviour drifts.
