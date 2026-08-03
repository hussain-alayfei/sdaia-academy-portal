# In-app assessment engine

## Product rules (confirmed)

| Topic | Behaviour |
| --- | --- |
| Attempts | One per student per assessment |
| Scoring | Auto from quiz only — no manual score entry |
| Anti-cheat | Counted per question. A large warning appears for every event; the third event on the same question makes that question worth zero points. The attempt continues. |
| After submit | Full review: chosen answer, correct answer, rationale |
| Placement | Full cards on the **day page**. Course overview shows a chip only: one assessment → its kind label (`Pre-assessment` / `Quiz` / `Post-assessment`); several → `"N assessments"`. Never say “1 quiz” for a pre/post. |
| Course length | 5 days; day picker offers remaining numbers in 1–5 |

## Instructor workflow

Before generating questions for a new day, also follow
[`CONTENT-AUTHORING.md`](CONTENT-AUTHORING.md). It records the preferred
source-first explanation style, research rules, Day 2 quality example, and the
required alignment between slides, practical work, and assessment coverage.

1. **Assessments** tab — list grouped by day; Publish / Unlock toggles.
2. Open an assessment → import JSON (or paste) / edit questions.
3. Download authoring brief: `/assessment-authoring-prompt.md`.
4. Feed that file + course content to an LLM with web search → get one JSON block.
5. Import preview shows hard errors (block) and soft warnings (allow).
6. Publish when the paper is ready; Unlock when the class may start.
7. **Results** page: scores, time, integrity event log, per-question % correct.
8. **Students** tab: read-only scores linking into results.

Editing / re-import is blocked once any attempt exists. Use **Reset attempts**
first (deletes attempts, responses, integrity events and scores for that
assessment).

## Student flow

Route: `/quiz/[assessmentId]` (quiz layout).

1. **Rules** — duration, question count, one attempt, integrity policy.
2. **Runner** — one question at a time, numbered navigator, flag-for-later,
   autosave, server countdown from `expires_at`, pre-submit summary.
3. **Review** — score + full answer key after submit / timeout, with any zero-point integrity penalties marked per question.

## Authoring JSON contract

Schema tag: `sdaia-assessment/v1`. Validated by `src/lib/assessment-schema.ts`
(`parseAssessmentFile` + `inspectQuestions`). Canonical prompt:
`public/assessment-authoring-prompt.md`.

**Hard errors (block import):** exact assessment-specific question count
(defaults: pre 20 / quiz 10 / post 30); exact difficulty mix; duration must match kind defaults and the selected
assessment’s settings; day must match the assessment’s day; plain text only
(no Markdown/HTML/newlines); topic required, 2–4 words; rationale required;
duplicate stems/options; for multiple choice, option length ratio > 1.35 or
correct = longest; banned combinations; negative stem pivots (`not`/`except`/…)
except on true/false items; context references; vague/absolute phrases; numeric
options must share a unit and ascend; answer-key letter ranges measured on
multiple-choice items (quiz 2–3, pre 4–6, post 7–8 when the set is all MCQ at
the standard count); statement-style stems over 1/5 of the set; file `kind`
must match the portal assessment. True/false items use `format: "true_false"`
with options `A: "True"`, `B: "False"` only.

**Warnings (allow import):** possible stem→key word cues; stem not ending in
`?` / completion form.

## Anti-cheat

Client: `integrity-guard.tsx` — `visibilitychange`, blur, copy and paste;
debounced. Right-clicking is allowed and does not create a warning. Server:
`record_integrity_event` increments the total
attempt count and a count tied to the active `question_id` (both survive a
refresh). At three events on one question, grading forces that question to zero
points. It never submits the attempt; students continue every other question.

Browser detection is a deterrent. Shuffled `question_order` per attempt is the
stronger measure.

`assessments.required_question_count` is the exact bank size enforced by the
importer, publish/unlock actions, student rules screen, and database attempt
trigger. New assessments receive the standard count for their kind. An explicit
per-assessment override can support a deliberately larger paper without
weakening any other assessment.

## Key files

| Area | Files |
| --- | --- |
| Schema / RLS / RPCs | `supabase/migrations/20260802000*.sql` |
| Validation | `src/lib/assessment-schema.ts` |
| Data reads | `src/lib/quiz.ts` |
| Actions | `src/app/actions/questions.ts`, `quiz.ts` |
| UI | `question-import.tsx`, `question-editor.tsx`, `quiz-runner.tsx`, `quiz-review.tsx`, `integrity-guard.tsx`, `assessment-cards.tsx` |
| Admin pages | `admin/.../assessments/**` |
| Student day cards | `c/[slug]/day/[dayNumber]/page.tsx` |

## Security checklist (re-verify after schema changes)

- [ ] Mid-attempt: questions/options readable, answer keys **not**
- [ ] Post-submit: keys readable for that student
- [ ] Student cannot UPDATE attempt / `is_correct` / delete integrity events
- [ ] Second `start_attempt` resumes same row
- [ ] Past `expires_at`: saves/events rejected; submit becomes `timed_out`
- [ ] Three integrity events on one question make only that question worth zero; attempt continues
- [ ] Unpublished or locked: `start_attempt` rejected
- [ ] Import/edit blocked when attempts exist; students cannot call authoring RPCs
