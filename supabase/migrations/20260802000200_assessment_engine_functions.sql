-- Assessment engine, part 3 of 3: the four functions that own a student attempt.
--
-- Why these are functions and not application code: each one enforces a rule
-- that must not be negotiable from a browser. The timer, the single attempt,
-- the grading, and the warning count all live here, run as the definer, and
-- start by confirming the caller owns the attempt. RLS gives students no write
-- policies on any attempt table, so this is the only way in.

/* ======================================================== start_attempt == */

create or replace function public.start_attempt(p_assessment uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student   uuid := auth.uid();
  v_course    uuid;
  v_duration  int;
  v_shuffle   boolean;
  v_locked    boolean;
  v_published boolean;
  v_attempt   uuid;
  v_order     jsonb;
  v_count     int;
begin
  if v_student is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select a.course_id, a.duration_minutes, a.shuffle, a.is_locked, a.is_published
    into v_course, v_duration, v_shuffle, v_locked, v_published
  from public.assessments a
  where a.id = p_assessment;

  if v_course is null then
    raise exception 'Assessment not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.enrollments e
    where e.course_id = v_course and e.student_id = v_student
  ) then
    raise exception 'You are not enrolled in this course' using errcode = '42501';
  end if;

  -- Resuming, not restarting. A closed laptop, a dead battery or a stray reload
  -- all land here and get the same attempt back, with the original deadline
  -- still ticking.
  select id into v_attempt
  from public.assessment_attempts
  where assessment_id = p_assessment and student_id = v_student;

  if v_attempt is not null then
    return v_attempt;
  end if;

  if not v_published or v_locked then
    raise exception 'This assessment is not open yet' using errcode = '42501';
  end if;

  select count(*) into v_count
  from public.assessment_questions q
  where q.assessment_id = p_assessment;

  if v_count = 0 then
    raise exception 'This assessment has no questions yet' using errcode = '42501';
  end if;

  -- Freeze the running order now. Shuffling per attempt is the one anti-cheat
  -- measure a browser cannot defeat: two students side by side are answering
  -- question 4 of different papers.
  select jsonb_agg(jsonb_build_object('q', x.id, 'o', x.options) order by x.rank)
    into v_order
  from (
    select q.id,
           case when v_shuffle then random() else q.position::float8 end as rank,
           (
             select jsonb_agg(o.id order by
                      case when v_shuffle then random() else o.position::float8 end)
             from public.assessment_options o
             where o.question_id = q.id
           ) as options
    from public.assessment_questions q
    where q.assessment_id = p_assessment
  ) x;

  insert into public.assessment_attempts
    (assessment_id, course_id, student_id, expires_at, question_order, question_count)
  values
    (p_assessment, v_course, v_student,
     now() + make_interval(mins => v_duration), v_order, v_count)
  returning id into v_attempt;

  return v_attempt;
end;
$$;

/* ======================================================== save_response == */

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
begin
  select course_id, assessment_id, status, expires_at
    into v_course, v_assessment, v_status, v_expires
  from public.assessment_attempts
  where id = p_attempt and student_id = v_student;

  if v_course is null then
    raise exception 'Attempt not found' using errcode = '42501';
  end if;

  if v_status <> 'in_progress' then
    raise exception 'This attempt is already finished' using errcode = '42501';
  end if;

  if v_expires <= now() then
    raise exception 'Time is up' using errcode = '42501';
  end if;

  -- Both of these would be impossible through the UI and trivial with a crafted
  -- request, which is exactly why they are checked here.
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
  v_student uuid := auth.uid();
  v_attempt public.assessment_attempts;
  v_status  public.attempt_status;
  v_correct int;
  v_total   int;
begin
  select * into v_attempt
  from public.assessment_attempts
  where id = p_attempt and student_id = v_student
  for update;

  if v_attempt.id is null then
    raise exception 'Attempt not found' using errcode = '42501';
  end if;

  -- Idempotent on purpose. A double-tapped submit button, or the countdown
  -- firing at the same moment the student clicks, must not regrade or overwrite
  -- the reason the attempt ended.
  if v_attempt.status <> 'in_progress' then
    return jsonb_build_object(
      'correct_count', v_attempt.correct_count,
      'question_count', v_attempt.question_count,
      'status', v_attempt.status
    );
  end if;

  v_status := (
    case
      when p_reason = 'integrity_stopped' then 'integrity_stopped'
      when p_reason = 'timed_out' then 'timed_out'
      when v_attempt.expires_at <= now() then 'timed_out'
      else 'submitted'
    end
  )::public.attempt_status;

  -- Grade what was saved. An unanswered question has no response row and simply
  -- does not count towards the correct total, so running out of time grades the
  -- work actually done rather than throwing it away.
  update public.assessment_responses r
     set is_correct = coalesce(r.selected_option_id = k.option_id, false)
    from public.assessment_answer_keys k
   where k.question_id = r.question_id
     and r.attempt_id = p_attempt;

  select count(*) into v_total
  from public.assessment_questions q
  where q.assessment_id = v_attempt.assessment_id;

  select count(*) into v_correct
  from public.assessment_responses r
  where r.attempt_id = p_attempt and r.is_correct;

  update public.assessment_attempts
     set status         = v_status,
         submitted_at   = now(),
         correct_count  = v_correct,
         question_count = v_total
   where id = p_attempt;

  insert into public.assessment_scores
    (assessment_id, student_id, course_id, score, max_score, recorded_at)
  values
    (v_attempt.assessment_id, v_student, v_attempt.course_id,
     v_correct, greatest(v_total, 1), now())
  on conflict (assessment_id, student_id) do update
    set score       = excluded.score,
        max_score   = excluded.max_score,
        recorded_at = excluded.recorded_at;

  return jsonb_build_object(
    'correct_count', v_correct,
    'question_count', v_total,
    'status', v_status
  );
end;
$$;

/* ================================================ record_integrity_event == */

create or replace function public.record_integrity_event(
  p_attempt uuid,
  p_kind    text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid := auth.uid();
  v_course  uuid;
  v_status  public.attempt_status;
  v_kind    public.integrity_event_kind;
  v_count   int;
begin
  begin
    v_kind := p_kind::public.integrity_event_kind;
  exception when others then
    raise exception 'Unknown integrity event' using errcode = '22023';
  end;

  select course_id, status into v_course, v_status
  from public.assessment_attempts
  where id = p_attempt and student_id = v_student;

  if v_course is null then
    raise exception 'Attempt not found' using errcode = '42501';
  end if;

  if v_status <> 'in_progress' then
    return jsonb_build_object('warning_count', 0, 'stopped', true);
  end if;

  update public.assessment_attempts
     set warning_count = warning_count + 1
   where id = p_attempt
  returning warning_count into v_count;

  insert into public.assessment_integrity_events
    (attempt_id, course_id, student_id, kind, warning_number)
  values (p_attempt, v_course, v_student, v_kind, v_count);

  -- Two warnings to make the point, then the attempt is taken away. The count
  -- lives on the row, so reloading the page does not buy a fresh set of lives.
  if v_count >= 3 then
    perform public.submit_attempt(p_attempt, 'integrity_stopped');
    return jsonb_build_object('warning_count', v_count, 'stopped', true);
  end if;

  return jsonb_build_object('warning_count', v_count, 'stopped', false);
end;
$$;

/* =============================================================== grants == */

-- Same treatment as redeem_join_code: signed-in users only, never anon.
revoke execute on function public.start_attempt(uuid) from public, anon;
revoke execute on function public.save_response(uuid, uuid, uuid, boolean) from public, anon;
revoke execute on function public.submit_attempt(uuid, text) from public, anon;
revoke execute on function public.record_integrity_event(uuid, text) from public, anon;

grant execute on function public.start_attempt(uuid) to authenticated;
grant execute on function public.save_response(uuid, uuid, uuid, boolean) to authenticated;
grant execute on function public.submit_attempt(uuid, text) to authenticated;
grant execute on function public.record_integrity_event(uuid, text) to authenticated;
