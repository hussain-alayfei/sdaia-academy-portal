-- Instructor-facing attempt scores, aggregated in the database.
--
-- ## The bug this fixes
--
-- The Students matrix counted marks in JavaScript: it selected one row per
-- correct answer for the whole course and tallied them client-side. On this
-- course that query needed 1,073 rows, and PostgREST caps a response at 1,000.
-- The overflow was dropped silently — no error, just a short array — so the
-- matrix under-reported scores while the per-assessment Results page (257 rows,
-- under the cap) stayed correct. Same attempt, two different numbers.
--
-- Counting here returns one row per attempt instead of one per answer: ~13 rows
-- rather than ~1,073. The cap stops being something to stay under and becomes
-- something the query cannot reach, however many students or papers are added.
--
-- ## Why `answered` is returned too
--
-- Callers need to tell "genuinely scored zero" apart from "not marked yet".
-- A finished attempt that appears here with `correct = 0` really did score
-- nothing; an attempt missing from these rows has no responses at all. Without
-- that distinction a screen has to guess, which is how one screen came to show
-- `0/30` while another showed an em dash for the very same attempt.
--
-- ## Access
--
-- `security definer`, but every row is gated on `app_private.manages_course`,
-- so a student calling this gets an empty set rather than anyone's marks. It
-- deliberately reads `is_correct` directly and ignores `results_released`:
-- withholding results hides them from *students*, never from the instructor.

create or replace function public.manager_attempt_scores(p_course uuid)
returns table (
  attempt_id uuid,
  correct    int,
  answered   int
)
language sql
security definer
stable
set search_path = ''
as $$
  select r.attempt_id,
         count(*) filter (where r.is_correct)::int as correct,
         count(*) filter (where r.selected_option_id is not null)::int as answered
  from public.assessment_responses r
  join public.assessment_attempts a on a.id = r.attempt_id
  where a.course_id = p_course
    and app_private.manages_course(p_course)
  group by r.attempt_id;
$$;

comment on function public.manager_attempt_scores(uuid) is
  'Per-attempt correct/answered counts for one course, aggregated server-side so the row cap cannot truncate them. Manager-only; returns nothing to a student.';

revoke execute on function public.manager_attempt_scores(uuid) from public, anon;
grant execute on function public.manager_attempt_scores(uuid) to authenticated;
