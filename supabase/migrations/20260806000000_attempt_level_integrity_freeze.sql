-- Attempt-level integrity warnings, with a freeze the instructor releases.
--
-- Replaces the per-question zero penalty for any assessment that opts in via
-- `integrity_warning_limit`. The old behaviour stays for assessments that leave
-- it null, so the six live day quizzes are untouched.
--
-- The model: N warnings, then the attempt freezes. Frozen is deliberately *not*
-- a terminal status — it is a flag on a still-live `in_progress` attempt, so
-- unlocking resumes the same paper with the same answers rather than starting
-- anything over. That also avoids adding an enum value, which cannot be used in
-- the transaction that creates it.
--
-- The clock pauses while frozen. `frozen_at` marks the moment it stopped;
-- unlocking pushes `expires_at` forward by however long the student waited, so
-- being frozen never eats exam time. `frozen_seconds` keeps the running total
-- for the record.
--
-- Unlocking resets `warning_count` to zero. Without that, the student returns
-- on their limit and the very next event re-freezes them immediately. The event
-- log keeps the full history regardless, so nothing is lost to the instructor.

alter table public.assessment_attempts
  add column if not exists frozen_at timestamptz,
  add column if not exists frozen_seconds int not null default 0
    check (frozen_seconds >= 0);

comment on column public.assessment_attempts.frozen_at is
  'Set when the attempt hit its integrity warning limit. Non-null means frozen: answers are rejected and the clock is paused until an instructor unlocks it.';

comment on column public.assessment_attempts.frozen_seconds is
  'Total seconds this attempt has spent frozen, added back to expires_at on unlock.';

alter table public.assessments
  add column if not exists integrity_warning_limit smallint
    check (integrity_warning_limit is null or integrity_warning_limit between 1 and 20);

comment on column public.assessments.integrity_warning_limit is
  'Warnings allowed before the attempt freezes and needs an instructor unlock. Null keeps the legacy per-question zero-point penalty instead.';

/* ================================================ record_integrity_event == */

create or replace function public.record_integrity_event(
  p_attempt  uuid,
  p_question uuid,
  p_kind     text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student        uuid := auth.uid();
  v_attempt        public.assessment_attempts;
  v_kind           public.integrity_event_kind;
  v_limit          smallint;
  v_total          int;
  v_question_count int;
  v_frozen         boolean := false;
begin
  begin
    v_kind := p_kind::public.integrity_event_kind;
  exception when others then
    raise exception 'Unknown integrity event' using errcode = '22023';
  end;

  select * into v_attempt
  from public.assessment_attempts
  where id = p_attempt and student_id = v_student;

  if v_attempt.id is null then
    raise exception 'Attempt not found' using errcode = '42501';
  end if;

  select a.integrity_warning_limit into v_limit
  from public.assessments a
  where a.id = v_attempt.assessment_id;

  if v_attempt.status <> 'in_progress' then
    return jsonb_build_object(
      'active', false,
      'warning_count', v_attempt.warning_count,
      'warning_limit', v_limit,
      'frozen', false,
      'question_warning_count', 0,
      'question_invalidated', false
    );
  end if;

  -- Already frozen. Do not stack further warnings while the student is sitting
  -- there waiting for an instructor: they cannot answer anything, so there is
  -- nothing left to deter, and a growing count would only make the unlock
  -- harsher for no reason.
  if v_attempt.frozen_at is not null then
    return jsonb_build_object(
      'active', true,
      'warning_count', v_attempt.warning_count,
      'warning_limit', v_limit,
      'frozen', true,
      'question_warning_count', 0,
      'question_invalidated', false
    );
  end if;

  if v_attempt.expires_at <= now() then
    raise exception 'Time is up' using errcode = '42501';
  end if;

  select count(*) + 1 into v_question_count
  from public.assessment_integrity_events e
  where e.attempt_id = p_attempt and e.question_id = p_question;

  update public.assessment_attempts
     set warning_count = warning_count + 1
   where id = p_attempt
  returning warning_count into v_total;

  insert into public.assessment_integrity_events
    (attempt_id, course_id, student_id, question_id, kind,
     warning_number, question_warning_number)
  values
    (p_attempt, v_attempt.course_id, v_student, p_question, v_kind,
     v_total, v_question_count);

  if v_limit is not null and v_total >= v_limit then
    update public.assessment_attempts
       set frozen_at = now()
     where id = p_attempt;
    v_frozen := true;
  end if;

  return jsonb_build_object(
    'active', true,
    'warning_count', v_total,
    'warning_limit', v_limit,
    'frozen', v_frozen,
    'question_warning_count', v_question_count,
    -- The per-question penalty only still applies to papers with no limit set.
    'question_invalidated', (v_limit is null and v_question_count >= 3)
  );
end;
$$;

/* ========================================================== save_response == */

-- Same as before, plus: a frozen attempt cannot record answers. This is the
-- half of the freeze that matters, because the UI can be bypassed.

create or replace function public.save_response(
  p_attempt  uuid,
  p_question uuid,
  p_option   uuid,
  p_flagged  boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student    uuid := auth.uid();
  v_course     uuid;
  v_assessment uuid;
  v_status     public.attempt_status;
  v_expires    timestamptz;
  v_frozen     timestamptz;
begin
  select course_id, assessment_id, status, expires_at, frozen_at
    into v_course, v_assessment, v_status, v_expires, v_frozen
  from public.assessment_attempts
  where id = p_attempt and student_id = v_student;

  if v_course is null then
    raise exception 'Attempt not found' using errcode = '42501';
  end if;

  if v_status <> 'in_progress' then
    raise exception 'This attempt is already finished' using errcode = '42501';
  end if;

  if v_frozen is not null then
    raise exception 'This attempt is frozen. Ask your instructor to unlock it.'
      using errcode = '42501';
  end if;

  if v_expires <= now() then
    raise exception 'Time is up' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.assessment_questions q
    where q.id = p_question and q.assessment_id = v_assessment
  ) then
    raise exception 'That question is not part of this attempt' using errcode = '42501';
  end if;

  if p_option is not null and not exists (
    select 1 from public.assessment_options o
    where o.id = p_option and o.question_id = p_question
  ) then
    raise exception 'That option does not belong to that question' using errcode = '42501';
  end if;

  insert into public.assessment_responses
    (attempt_id, question_id, course_id, selected_option_id, flagged, answered_at)
  values
    (p_attempt, p_question, v_course, p_option, coalesce(p_flagged, false),
     case when p_option is null then null else now() end)
  on conflict (attempt_id, question_id) do update
    set selected_option_id = excluded.selected_option_id,
        flagged            = excluded.flagged,
        answered_at        = case
                               when excluded.selected_option_id is null then null
                               else now()
                             end;
end;
$$;

/* ======================================================= submit_attempt == */

-- Restores two things that were lost when this function was last replaced:
--
--   * the frozen denominator. The paper size comes from the snapshot taken when
--     the attempt began, not from the live question table, so an attempt can
--     never be regraded against a bank that changed underneath it.
--   * the per-question zero penalty, now applied only to assessments with no
--     `integrity_warning_limit`. Papers on the freeze model handle integrity at
--     the attempt level instead, so zeroing a question as well would punish the
--     same event twice.
--
-- Keeps the withheld-results behaviour: while `results_released` is false, no
-- `correct_count` and no score row, because a student can read both.

create or replace function public.submit_attempt(
  p_attempt uuid,
  p_reason  text default 'submitted'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student  uuid := auth.uid();
  v_attempt  public.assessment_attempts;
  v_status   public.attempt_status;
  v_correct  int;
  v_total    int;
  v_released boolean;
  v_limit    smallint;
begin
  select * into v_attempt
  from public.assessment_attempts
  where id = p_attempt and student_id = v_student
  for update;

  if v_attempt.id is null then
    raise exception 'Attempt not found' using errcode = '42501';
  end if;

  if v_attempt.status <> 'in_progress' then
    return jsonb_build_object(
      'correct_count', v_attempt.correct_count,
      'question_count', v_attempt.question_count,
      'status', v_attempt.status
    );
  end if;

  -- A frozen attempt is mid-exam, not finished. Letting it submit would hand a
  -- student a way to end the exam on their own terms after being stopped.
  if v_attempt.frozen_at is not null then
    raise exception 'This attempt is frozen. Ask your instructor to unlock it.'
      using errcode = '42501';
  end if;

  select coalesce(a.results_released, true), a.integrity_warning_limit
    into v_released, v_limit
  from public.assessments a
  where a.id = v_attempt.assessment_id;

  v_status := (
    case
      when p_reason = 'integrity_stopped' then 'integrity_stopped'
      when p_reason = 'timed_out' then 'timed_out'
      when v_attempt.expires_at <= now() then 'timed_out'
      else 'submitted'
    end
  )::public.attempt_status;

  update public.assessment_responses r
     set is_correct = coalesce(r.selected_option_id = k.option_id, false)
                      and (
                        v_limit is not null
                        or not exists (
                          select 1
                          from public.assessment_integrity_events e
                          where e.attempt_id = p_attempt
                            and e.question_id = r.question_id
                            and e.question_warning_number >= 3
                        )
                      )
    from public.assessment_answer_keys k
   where k.question_id = r.question_id
     and r.attempt_id = p_attempt;

  -- The frozen paper size, not the live table.
  v_total := coalesce(
    nullif(jsonb_array_length(v_attempt.question_order), 0),
    (select count(*) from public.assessment_questions q
      where q.assessment_id = v_attempt.assessment_id)
  );

  select count(*) into v_correct
  from public.assessment_responses r
  where r.attempt_id = p_attempt and r.is_correct;

  update public.assessment_attempts
     set status         = v_status,
         submitted_at   = now(),
         correct_count  = case when v_released then v_correct else null end,
         question_count = v_total
   where id = p_attempt;

  if v_released then
    insert into public.assessment_scores
      (assessment_id, student_id, course_id, score, max_score, recorded_at)
    values
      (v_attempt.assessment_id, v_student, v_attempt.course_id,
       v_correct, greatest(v_total, 1), now())
    on conflict (assessment_id, student_id) do update
      set score       = excluded.score,
          max_score   = excluded.max_score,
          recorded_at = excluded.recorded_at;
  end if;

  return jsonb_build_object(
    'correct_count', case when v_released then v_correct else null end,
    'question_count', v_total,
    'status', v_status,
    'results_released', v_released
  );
end;
$$;

/* ========================================================= unlock_attempt == */

-- The instructor's release. Gives back the time spent frozen, optionally adds
-- more, and hands the student a fresh set of warnings so a single event does
-- not re-freeze them the moment they resume.

create or replace function public.unlock_attempt(
  p_attempt       uuid,
  p_extra_minutes int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.assessment_attempts;
  v_paused  int := 0;
  v_extra   int := greatest(coalesce(p_extra_minutes, 0), 0);
begin
  select * into v_attempt
  from public.assessment_attempts
  where id = p_attempt
  for update;

  if v_attempt.id is null then
    raise exception 'Attempt not found' using errcode = 'P0002';
  end if;

  if not app_private.manages_course(v_attempt.course_id) then
    raise exception 'You do not manage this course' using errcode = '42501';
  end if;

  if v_attempt.status <> 'in_progress' then
    raise exception 'That attempt is already finished' using errcode = '42501';
  end if;

  if v_attempt.frozen_at is not null then
    v_paused := greatest(0, extract(epoch from (now() - v_attempt.frozen_at))::int);
  end if;

  update public.assessment_attempts
     set frozen_at      = null,
         frozen_seconds = frozen_seconds + v_paused,
         warning_count  = 0,
         expires_at     = expires_at
                          + make_interval(secs => v_paused)
                          + make_interval(mins => v_extra)
   where id = p_attempt;

  return jsonb_build_object(
    'paused_seconds', v_paused,
    'extra_minutes', v_extra,
    'warning_count', 0
  );
end;
$$;

revoke execute on function public.unlock_attempt(uuid, int) from public, anon;
grant execute on function public.unlock_attempt(uuid, int) to authenticated;

/* ============================================================ final exam == */

update public.assessments
   set integrity_warning_limit = 5
 where id = '4c23ed42-7287-49ef-9e85-02cff925bd92';
