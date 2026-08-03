# Data model

Types: `src/lib/types.ts`. Migrations for the quiz engine:
`supabase/migrations/20260802000000` … `00300`. Seed: `supabase/seed.sql`.

## Core content

```
profiles ──< enrollments >── courses
                               │
                    course_days ──< resources
                               │
                          assessments
```

- `courses.owner_id`, `join_code`
- `course_days.day_number` (UI capped at 5), `is_published`, `is_current`
  (at most one current day per course; drives the student journey highlight)
- `resources.kind` (`slides|pdf|notebook|lab|dataset|link|file`), `is_published`
- `assessments.kind` (`pre|post|quiz`), `day_id`, `duration_minutes`, `shuffle`,
  `required_question_count`, `is_published`, `is_locked`, `position` (pre=0,
  quiz=1, post=2)

Dropped from assessments: `max_score`, `external_url` (replaced by in-app engine).

## Quiz engine

```
assessments
  └── assessment_questions  (position, difficulty, stem, topic)
        ├── assessment_options  (A–D body only — no correctness column)
        └── assessment_answer_keys  (option_id + rationale)

assessment_attempts  UNIQUE (assessment_id, student_id)
  ├── assessment_responses  UNIQUE (attempt_id, question_id)
  └── assessment_integrity_events  (question_id + per-question warning number)

assessment_scores  written by submit_attempt (legacy table kept for roster)
```

### Attempt status

`in_progress` | `submitted` | `timed_out` | `integrity_stopped`

### Integrity kinds

`tab_hidden` | `window_blur` | `copy` | `paste` | `context_menu`

`context_menu` remains in the enum for historical log compatibility. The client
no longer records right-clicks as integrity events.

### Difficulty

`easy` | `medium` | `hard`

## RLS pattern

Writes: `app_private.manages_course(course_id)`.  
Student reads: published + enrolled, with assessment-specific exceptions:

- Questions/options: readable once the student has an attempt on that assessment
- Answer keys: only after `submitted_at is not null`
- Attempts/responses/events: own rows only; no student write policies (RPCs only)

## Security-definer RPCs

| Function | Purpose |
| --- | --- |
| `start_attempt(assessment)` | Enrolment + published + unlocked + questions exist; resume or create; set `expires_at`; snapshot shuffled order |
| `save_response(attempt, question, option, flagged)` | Own in-progress attempt; before expiry; option belongs to question |
| `submit_attempt(attempt, reason)` | Grade; write scores; idempotent |
| `record_integrity_event(attempt, question, kind)` | Increment total + per-question warnings; at 3 mark that question for a zero-point grading penalty without ending the attempt |
| `import_assessment_questions(assessment, jsonb)` | Manager; replace questions atomically; blocked if attempts exist |
| `save_assessment_question(assessment, question_id, jsonb)` | Manager add/edit one item; same attempt lock |
| `redeem_join_code(code)` | Enrolment (defined outside the 20260802 quiz migrations; still live) |

Quiz-engine RPCs live in `supabase/migrations/20260802000200_*.sql` and
`20260802000300_*.sql`. All are security definer and enforce their own auth
checks (enrolment / manages_course / attempt ownership). Granted to
`authenticated` only (not `anon` / `public`).

`start_attempt` specifically rejects: not signed in, not enrolled, unpublished
or locked assessment, or a bank whose size differs from the assessment's exact
`required_question_count`. A second call resumes the same row.

## Regenerating types

After applying migrations on the remote project, regenerate `src/lib/types.ts`
from Supabase (MCP `generate_typescript_types` or CLI). Keep the hand-tuned
nullable args on `save_response` / `save_assessment_question` if the generator
marks them non-null incorrectly.
