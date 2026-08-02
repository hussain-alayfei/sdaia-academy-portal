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
- `course_days.day_number` (UI capped at 5), `is_published`
- `resources.kind` (`slides|pdf|notebook|lab|dataset|link|file`), `is_published`
- `assessments.kind` (`pre|post|quiz`), `day_id`, `duration_minutes`, `shuffle`,
  `is_published`, `is_locked`, `position` (pre=0, quiz=1, post=2)

Dropped from assessments: `max_score`, `external_url` (replaced by in-app engine).

## Quiz engine

```
assessments
  └── assessment_questions  (position, difficulty, stem, topic)
        ├── assessment_options  (A–D body only — no correctness column)
        └── assessment_answer_keys  (option_id + rationale)

assessment_attempts  UNIQUE (assessment_id, student_id)
  ├── assessment_responses  UNIQUE (attempt_id, question_id)
  └── assessment_integrity_events

assessment_scores  written by submit_attempt (legacy table kept for roster)
```

### Attempt status

`in_progress` | `submitted` | `timed_out` | `integrity_stopped`

### Integrity kinds

`tab_hidden` | `window_blur` | `copy` | `paste` | `context_menu`

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
| `record_integrity_event(attempt, kind)` | Increment warnings; at 3 call submit with `integrity_stopped` |
| `import_assessment_questions(assessment, jsonb)` | Manager; replace questions atomically; blocked if attempts exist |
| `save_assessment_question(assessment, question_id, jsonb)` | Manager add/edit one item; same attempt lock |
| `redeem_join_code(code)` | Enrolment |

Granted to `authenticated` only (not `anon` / `public`).

## Regenerating types

After applying migrations on the remote project, regenerate `src/lib/types.ts`
from Supabase (MCP `generate_typescript_types` or CLI). Keep the hand-tuned
nullable args on `save_response` / `save_assessment_question` if the generator
marks them non-null incorrectly.
