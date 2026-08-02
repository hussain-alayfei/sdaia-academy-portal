---
name: sdaia-assessments
description: >-
  In-app quiz engine for the SDAIA Academy Portal: question import, editor,
  runner, integrity anti-cheat, grading, RLS and Postgres RPCs. Use when the
  user mentions assessments, quizzes, pre/post tests, MCQs, answer keys,
  integrity warnings, timer, question import, authoring prompt, or results.
---

# SDAIA assessments

## Read first

- `docs/ASSESSMENTS.md` — product rules and checklist
- `docs/DATA-MODEL.md` — tables and RPCs
- Optional depth: [reference.md](reference.md)

## Confirmed product decisions

- One attempt; auto scores only (no manual entry)
- Integrity: warn ×2, then auto-submit as `integrity_stopped`
- After submit: full review with correct answers + rationale
- Assessments on day pages; course is 5 days
- Counts: pre 20, daily quiz 10, post 30

## Implementation map

| Task | Touch |
| --- | --- |
| Validate LLM JSON | `src/lib/assessment-schema.ts` |
| Import / edit / reset | `src/app/actions/questions.ts` |
| Start / save / finish / integrity | `src/app/actions/quiz.ts` |
| Student paper / review reads | `src/lib/quiz.ts` |
| Runner UI | `src/components/quiz-runner.tsx` |
| Anti-cheat UI | `src/components/integrity-guard.tsx` |
| Day cards | `src/components/assessment-cards.tsx` |
| SQL | `supabase/migrations/20260802000*.sql` |
| Authoring brief | `public/assessment-authoring-prompt.md` |

## Rules when changing this area

1. Never put `is_correct` / answer key on `assessment_options`.
2. Keep grading / timer / warning count in RPCs.
3. Block question edits when attempts exist (RPC already does).
4. Always `revalidateCourseContent` after question mutations.
5. After migration changes: regenerate `src/lib/types.ts` and re-run the
   security checklist in `docs/ASSESSMENTS.md`.

## Authoring flow (instructor)

Prompt → LLM + course content → JSON (`schema: sdaia-assessment/v1`) → import
preview → confirm → Publish → Unlock.
