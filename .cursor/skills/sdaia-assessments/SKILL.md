---
name: sdaia-assessments
description: >-
  In-app quiz engine for the SDAIA Academy Portal: import, editor, runner,
  integrity, grading, RLS and RPCs. Use for assessments, quizzes, pre/post
  tests, MCQs, answer keys, integrity warnings, timers, or results.
---

# SDAIA assessments

## Read first

- `docs/ASSESSMENTS.md`
- `docs/DATA-MODEL.md`
- Optional: [reference.md](reference.md)

## Confirmed product decisions

- One attempt; auto scores only
- Integrity: count per question; third event makes that question worth zero, attempt continues
- After submit: full review with correct answers + rationale
- Cards on day pages; course overview chip names the **kind**
- Standard counts: pre 20, daily quiz 10, post 30. An explicit
  `required_question_count` override applies only to that assessment.

## Implementation map

| Task | Touch |
| --- | --- |
| Validate LLM JSON | `src/lib/assessment-schema.ts` |
| Import / edit / reset | `src/app/actions/questions.ts` |
| Start / save / finish / integrity | `src/app/actions/quiz.ts` |
| Student paper / review | `src/lib/quiz.ts` |
| Runner / anti-cheat / review UI | `quiz-runner.tsx`, `integrity-guard.tsx`, `quiz-review.tsx` |
| Day page cards | `assessment-cards.tsx` |
| Instructor Assessments list | `assessments-by-day.tsx`, `local-tabs.tsx` (plain `Day N`, no fade) |
| Course overview chip | `c/[slug]/page.tsx` → `assessmentChipLabel` |
| SQL | `supabase/migrations/20260802000*.sql` |
| Authoring brief | `public/assessment-authoring-prompt.md` |

## Rules when changing this area

1. Never put correctness on `assessment_options`.
2. Keep grading / timer / warning count in RPCs.
3. Block question edits when attempts exist.
4. Always `revalidateCourseContent` after question mutations.
5. After migrations: regenerate `src/lib/types.ts` and re-check
   `docs/ASSESSMENTS.md` security checklist.
