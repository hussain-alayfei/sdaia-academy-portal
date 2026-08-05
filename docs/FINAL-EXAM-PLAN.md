# Final exam — implementation plan

Target: **SDAIA-GENAI-01 Final exam**, `4c23ed42-7287-49ef-9e85-02cff925bd92`
(Day 5, 30 minutes, `required_question_count = 30`, currently empty,
**0 attempts**). Source of truth for content:
`../../final_exam/developing_generative_ai_solutions_final_approved_exam.md`.

Sat by students the day after this plan was written, so every step is chosen for
low blast radius on the four assessments that already carry live attempts.

## Confirmed decisions

| Decision | Choice |
| --- | --- |
| Release state on deploy | **Published + locked** — card shows "Opens soon"; one Unlock toggle at exam time |
| Section pacing | Sections A and B one question per screen; **Section C is a single page** carrying the use case + Q26–30 |
| True/false option order | **Fixed** (True, False). Only the 25 MCQs shuffle their options |
| Results | **Hidden by default.** Nothing scoreable reaches the student until an instructor releases them |

## Content rules (do not deviate)

- All 30 stems, all option bodies, and all correct answers are copied
  **verbatim** from the approved `.md`. No rewording, no reordering of the
  authored option letters, no difficulty re-grading.
- Difficulty, topic, day and rationale come from the Instructor Answer Key
  tables in the same file.
- The importer's authoring validator (`assessment-schema.ts`) is **bypassed**:
  the approved paper deliberately breaks several house rules (negative pivots,
  option-length ratios, letter distribution across a mixed MCQ/TF set). Seeding
  goes through a service-key script that writes rows directly, so the paper is
  preserved exactly as approved.
- A test asserts the seeded JSON still matches the source `.md`, so drift is
  caught rather than assumed away.

## Section model

| Section | Questions | Format | Layout |
| --- | --- | --- | --- |
| A — Multiple choice | 1–20 (source Q1–20) | `multiple_choice` | one per screen |
| B — True or false | 21–25 (source Q21–25) | `true_false` | one per screen |
| C — Shared use case | 26–30 (source Q26–30) | `multiple_choice` | **single page**, use case pinned above |

Randomisation is **within a section only**. Section A never mixes with B or C,
so the paper always reads A → B → C while no two students see the same order
inside a section.

## Phase 1 — Schema

Migration `20260805020000_final_exam_sections_and_hidden_results.sql`.

1. `assessment_questions.section smallint not null default 1` — 1/2/3.
2. `assessments.sections jsonb` — per-section title, brief, and layout. Holds
   the Section C use-case text. Null on every existing assessment, so they keep
   today's single-section behaviour.
3. `assessments.instructions text` — the large pre-exam briefing. Null elsewhere.
4. `assessments.results_released boolean not null default true` — **false** for
   the final exam. Default `true` keeps all six live papers behaving exactly as
   they do now.
5. `start_attempt` — order the frozen snapshot by `section`, then random within
   the section. Skip option shuffling for `true_false` items.
6. `submit_attempt` — always grade `assessment_responses.is_correct` (managers
   need it). When `results_released = false`, **do not** write
   `assessment_attempts.correct_count` and **do not** insert into
   `assessment_scores`.
7. RLS `assessment_answer_keys` SELECT — student branch gains
   `and results_released`.
8. RLS `assessment_responses` SELECT — student branch gains
   `and (attempt is in_progress or results_released)`.
9. New RPC `set_assessment_results_released(p_assessment uuid, p_released boolean)`
   — manager-only. On release it backfills `correct_count` and `assessment_scores`
   from the already-graded responses, so the normal review screen simply works
   afterwards. Reversible.

### Why the leak is closed at the database, not the component

A student can call PostgREST directly. Four rows could otherwise reveal the
result before release, and all four are shut:

| Vector | Closed by |
| --- | --- |
| `assessment_attempts.correct_count` | never written while hidden (step 6) |
| `assessment_responses.is_correct` | RLS denies the row post-submit while hidden (step 8) |
| `assessment_answer_keys` | RLS denies while hidden (step 7) |
| `assessment_scores` | no row written while hidden (step 6) |

Questions and options stay readable to a student who holds an attempt — they
sat the paper, and the review screen needs them after release.

## Phase 2 — Application

| File | Change |
| --- | --- |
| `src/lib/types.ts` | regenerate from live schema |
| `src/lib/quiz.ts` | `PaperQuestion` gains `section` + `format`; new section reader; admin score falls back to counting graded responses when `correct_count` is null |
| `src/components/quiz-runner.tsx` | section-aware paging, Section C single page, use-case panel, large timer, red under 5 minutes |
| `src/components/exam-lockdown.tsx` (new) | blocks selection, copy/cut, right-click, drag, and the copy/save/print keyboard shortcuts, while leaving options and buttons fully operable |
| `src/app/(quiz)/quiz/[assessmentId]/page.tsx` | large instructions block; hidden-results branch to a neutral "answers received" screen instead of the review |
| `src/components/assessment-cards.tsx` | while hidden, show "Submitted" with no score and no "See your answers" link |
| `src/components/admin/results-explorer.tsx` | show scores pre-release + a Release/Hide results control |

## Phase 3 — Tests

`npm test` (`tsx --test`):

1. `final-exam-content.test.ts` — parses the source `.md` and asserts the seeded
   JSON matches it: 30 questions, stems and options identical, 25 MCQ + 5 T/F,
   answer spread A=6 B=7 C=6 D=6, True=3 False=2, sections 20/5/5, and the
   Day 1–4 blueprint 7/8/7/8.
2. `exam-order.test.ts` — the ordering invariant: sections never interleave,
   order within a section varies across runs, every question appears exactly
   once, and true/false options stay in their authored order.

## Phase 4 — Ship

1. `npx tsc --noEmit`
2. `npm test`
3. Apply the migration to `gfoajqlifmmofswvibzs`
4. `node scripts/seed-final-exam.mjs` — writes the 30 questions, sets
   `results_released = false`, `is_published = true`, `is_locked = true`
5. `vercel --prod`, then re-alias `sdaia-genai-portal.vercel.app`
6. Verify by SQL: 30 questions, 20/5/5 across sections, keys present, published,
   locked, results hidden
7. Update `CONTEXT.md` and `ASSESSMENTS.md`

## Exam-day runbook (for the instructor)

1. Open **Instructor → the course → Assessments → Day 5 → Final exam**.
2. Press **Unlock** when the room is ready. Nothing else needs changing.
3. Students see the instructions screen, press begin, and get 30 minutes.
4. After the exam, results stay hidden automatically.
5. When you want the class to see marks and explanations, open the assessment's
   **Results** page and press **Release results to students**. That single
   action reveals the score, the correct answers, and the rationale for every
   question, for every student at once. It can be undone.
