# Assessment engine reference

## RPC contracts (authenticated)

```
start_attempt(p_assessment uuid) → uuid
save_response(p_attempt, p_question, p_option, p_flagged) → void
submit_attempt(p_attempt, p_reason text default 'submitted') → jsonb
record_integrity_event(p_attempt, p_kind text) → jsonb
import_assessment_questions(p_assessment, p_questions jsonb) → int
save_assessment_question(p_assessment, p_question_id, p_payload jsonb) → uuid
```

`p_reason`: `submitted` | `timed_out` | `integrity_stopped`

## Attempt row fields that matter

- `expires_at` — server clock; client only displays countdown
- `warning_count` — source of truth across refreshes
- `question_order` — jsonb `[{ q, o: [optionIds...] }, ...]`
- `correct_count` / `question_count` — set on submit

## Import payload shape (abbreviated)

```json
{
  "schema": "sdaia-assessment/v1",
  "assessment": { "kind": "quiz", "day": 2, "title": "...", "duration_minutes": 10 },
  "questions": [
    {
      "difficulty": "medium",
      "topic": "...",
      "stem": "...",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correct": "A",
      "rationale": "..."
    }
  ]
}
```

Hard errors block import (counts, exact difficulty mix, duration/day match,
length cues, banned phrasing, negatives, answer-key ranges, etc.). Warnings are
reserved for subjective heuristics such as possible word cues.

## Verified behaviours (as of engine ship)

Impersonation tests against live DB confirmed: keys hidden mid-attempt; one
attempt resume; timer gate; integrity 1→2→3 stop; import blocked after sit;
students cannot call authoring RPCs. Prefer re-checking after any RLS/RPC edit.
