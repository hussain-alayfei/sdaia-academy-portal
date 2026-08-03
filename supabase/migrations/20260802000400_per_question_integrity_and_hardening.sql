-- Per-question integrity penalties and adjacent backend hardening.
--
-- Integrity events no longer end an assessment. Three events recorded while a
-- student is on the same question make only that question worth zero points;
-- the attempt continues normally. The two-argument overload remains during a
-- rolling web deployment so an already-open old runner also stops auto-submit.

alter table public.assessment_integrity_events
  add column question_id uuid
    references public.assessment_questions(id) on delete set null,
  add column question_warning_number int
    check (question_warning_number is null or question_warning_number > 0);

create index assessment_integrity_events_attempt_question_idx
  on public.assessment_integrity_events(attempt_id, question_id, question_warning_number);

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
  v_student       uuid := auth.uid();
  v_attempt       public.assessment_attempts;
  v_kind          public.integrity_event_kind;
  v_total_count   int;
  v_question_count int;
begin
  begin
    v_kind := p_kind::public.integrity_event_kind;
  exception when others then
    raise exception 'Unknown integrity event' using errcode = '22023';
  end;

  select * into v_attempt
  from public.assessment_attempts
  where id = p_attempt and student_id = v_student
  for update;

  if v_attempt.id is null then
    raise exception 'Attempt not found' using errcode = '42501';
  end if;

  if v_attempt.status <> 'in_progress' then
    return jsonb_build_object(
      'warning_count', v_attempt.warning_count,
      'question_warning_count', 0,
      'question_invalidated', false,
      'active', false
    );
  end if;

  if v_attempt.expires_at <= now() then
    raise exception 'Time is up' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(v_attempt.question_order) item
    where item ->> 'q' = p_question::text
  ) then
    raise exception 'That question is not part of this attempt'
      using errcode = '42501';
  end if;

  select count(*) + 1 into v_question_count
  from public.assessment_integrity_events
  where attempt_id = p_attempt and question_id = p_question;

  update public.assessment_attempts
     set warning_count = warning_count + 1
   where id = p_attempt
  returning warning_count into v_total_count;

  insert into public.assessment_integrity_events
    (attempt_id, course_id, student_id, question_id, kind,
     warning_number, question_warning_number)
  values
    (p_attempt, v_attempt.course_id, v_student, p_question, v_kind,
     v_total_count, v_question_count);

  return jsonb_build_object(
    'warning_count', v_total_count,
    'question_warning_count', v_question_count,
    'question_invalidated', v_question_count >= 3,
    'active', true
  );
end;
$$;

-- Compatibility for runners loaded before this migration. These events remain
-- visible to the instructor but cannot be assigned to or invalidate a question.
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
  v_attempt public.assessment_attempts;
  v_kind    public.integrity_event_kind;
  v_count   int;
begin
  begin
    v_kind := p_kind::public.integrity_event_kind;
  exception when others then
    raise exception 'Unknown integrity event' using errcode = '22023';
  end;

  select * into v_attempt
  from public.assessment_attempts
  where id = p_attempt and student_id = v_student
  for update;

  if v_attempt.id is null then
    raise exception 'Attempt not found' using errcode = '42501';
  end if;

  if v_attempt.status <> 'in_progress' or v_attempt.expires_at <= now() then
    return jsonb_build_object(
      'warning_count', v_attempt.warning_count,
      'question_warning_count', 0,
      'question_invalidated', false,
      'active', false
    );
  end if;

  update public.assessment_attempts
     set warning_count = warning_count + 1
   where id = p_attempt
  returning warning_count into v_count;

  insert into public.assessment_integrity_events
    (attempt_id, course_id, student_id, kind, warning_number)
  values
    (p_attempt, v_attempt.course_id, v_student, v_kind, v_count);

  return jsonb_build_object(
    'warning_count', v_count,
    'question_warning_count', 0,
    'question_invalidated', false,
    'active', true
  );
end;
$$;

revoke execute on function public.record_integrity_event(uuid, uuid, text)
  from public, anon;
grant execute on function public.record_integrity_event(uuid, uuid, text)
  to authenticated;

-- Grade correct responses only when that question did not reach three recorded
-- integrity events. The denominator remains the full paper, so the penalty is
-- a real zero rather than silently removing the question from the assessment.
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

  if v_attempt.status <> 'in_progress' then
    return jsonb_build_object(
      'correct_count', v_attempt.correct_count,
      'question_count', v_attempt.question_count,
      'status', v_attempt.status
    );
  end if;

  v_status := (
    case
      when p_reason = 'timed_out' or v_attempt.expires_at <= now()
        then 'timed_out'
      else 'submitted'
    end
  )::public.attempt_status;

  update public.assessment_responses r
     set is_correct = coalesce(r.selected_option_id = k.option_id, false)
                      and not exists (
                        select 1
                        from public.assessment_integrity_events e
                        where e.attempt_id = p_attempt
                          and e.question_id = r.question_id
                          and e.question_warning_number >= 3
                      )
    from public.assessment_answer_keys k
   where k.question_id = r.question_id
     and r.attempt_id = p_attempt;

  -- The paper was frozen when the attempt began. Use that frozen size rather
  -- than the mutable question table so an older attempt can never be regraded
  -- against a different denominator.
  v_total := jsonb_array_length(v_attempt.question_order);

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

-- Editing a question bank after attempts exist can invalidate saved responses
-- and recorded scores. Enforce the existing product rule below the UI/RPC layer.
create or replace function app_private.guard_assessment_content_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assessment uuid;
  v_old_assessment uuid;
begin
  if tg_table_name = 'assessment_questions' then
    v_assessment := case
      when tg_op = 'DELETE' then old.assessment_id
      else new.assessment_id
    end;
    if tg_op = 'UPDATE' then
      v_old_assessment := old.assessment_id;
    end if;
  else
    select assessment_id into v_assessment
    from public.assessment_questions
    where id = case
      when tg_op = 'DELETE' then old.question_id
      else new.question_id
    end;

    if tg_op = 'UPDATE' then
      select assessment_id into v_old_assessment
      from public.assessment_questions
      where id = old.question_id;
    end if;
  end if;

  if exists (
    select 1
    from public.assessment_attempts
    where assessment_id = v_assessment
       or assessment_id = v_old_assessment
  ) then
    raise exception
      'Students have already sat this assessment. Reset attempts before editing its questions.'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function app_private.guard_assessment_content_mutation()
  from public, anon, authenticated;

drop trigger if exists assessment_questions_attempt_guard
  on public.assessment_questions;
create trigger assessment_questions_attempt_guard
  before insert or update or delete on public.assessment_questions
  for each row execute function app_private.guard_assessment_content_mutation();

drop trigger if exists assessment_options_attempt_guard
  on public.assessment_options;
create trigger assessment_options_attempt_guard
  before insert or update or delete on public.assessment_options
  for each row execute function app_private.guard_assessment_content_mutation();

drop trigger if exists assessment_answer_keys_attempt_guard
  on public.assessment_answer_keys;
create trigger assessment_answer_keys_attempt_guard
  before insert or update or delete on public.assessment_answer_keys
  for each row execute function app_private.guard_assessment_content_mutation();

-- Scores are automatic. Managers may read and reset them, but cannot invent or
-- overwrite scores through the REST API; submit_attempt bypasses RLS safely.
drop policy if exists "managers insert scores" on public.assessment_scores;
drop policy if exists "managers update scores" on public.assessment_scores;

-- Student-visible child rows must inherit publication from their course and
-- day. Without these parent checks, a known assessment/resource id could still
-- be read directly after the parent was unpublished.
drop policy if exists
  "view published assessments of enrolled course, or any if manager"
  on public.assessments;
create policy
  "view published assessments of enrolled published course and day, or manager"
  on public.assessments for select to authenticated
  using (
    (select app_private.manages_course(course_id))
    or (
      is_published
      and (select app_private.is_enrolled(course_id))
      and exists (
        select 1 from public.courses c
        where c.id = assessments.course_id and c.is_published
      )
      and exists (
        select 1 from public.course_days d
        where d.id = assessments.day_id
          and d.course_id = assessments.course_id
          and d.is_published
      )
    )
  );

drop policy if exists
  "view published resources of enrolled course, or any if manager"
  on public.resources;
create policy
  "view published resources of enrolled published course and day, or manager"
  on public.resources for select to authenticated
  using (
    (select app_private.manages_course(course_id))
    or (
      is_published
      and (select app_private.is_enrolled(course_id))
      and exists (
        select 1 from public.courses c
        where c.id = resources.course_id and c.is_published
      )
      and exists (
        select 1 from public.course_days d
        where d.id = resources.day_id
          and d.course_id = resources.course_id
          and d.is_published
      )
    )
  );

-- A manager may read drafts. Students may sign only the exact object attached
-- to a published resource on a published day in a published enrolled course.
create or replace function app_private.can_read_course_file(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.manages_course(app_private.storage_course_id(object_name))
      or exists (
        select 1
        from public.resources r
        join public.course_days d
          on d.id = r.day_id and d.course_id = r.course_id
        join public.courses c on c.id = r.course_id
        where r.storage_path = object_name
          and r.is_published
          and d.is_published
          and c.is_published
          and app_private.is_enrolled(r.course_id)
      );
$$;

revoke execute on function app_private.can_read_course_file(text)
  from public, anon;
grant execute on function app_private.can_read_course_file(text)
  to authenticated;

drop policy if exists "read course files you can access" on storage.objects;
create policy "read published course files you can access"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'course-files'
    and (select app_private.can_read_course_file(name))
  );

-- Final database gate for a new attempt. It covers direct RPC calls as well as
-- the web UI and makes the existing opens/closes fields effective.
create or replace function app_private.guard_attempt_open()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected int;
  v_actual   int;
begin
  if new.student_id is distinct from auth.uid() then
    raise exception 'An attempt can only be opened for the signed-in student'
      using errcode = '42501';
  end if;

  select case a.kind
           when 'pre' then 20
           when 'quiz' then 10
           when 'post' then 30
         end,
         (select count(*)::int
          from public.assessment_questions q
          where q.assessment_id = a.id)
    into v_expected, v_actual
  from public.assessments a
  join public.courses c
    on c.id = a.course_id and c.is_published
  join public.course_days d
    on d.id = a.day_id and d.course_id = a.course_id and d.is_published
  where a.id = new.assessment_id
    and a.course_id = new.course_id
    and a.is_published
    and not a.is_locked
    and (a.opens_at is null or a.opens_at <= now())
    and (a.closes_at is null or a.closes_at > now());

  if v_expected is null then
    raise exception 'This assessment is not open yet' using errcode = '42501';
  end if;

  if v_actual <> v_expected then
    raise exception 'This assessment does not have its required question count'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.enrollments e
    where e.course_id = new.course_id and e.student_id = new.student_id
  ) then
    raise exception 'You are not enrolled in this course' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function app_private.guard_attempt_open()
  from public, anon, authenticated;

drop trigger if exists assessment_attempts_open_guard
  on public.assessment_attempts;
create trigger assessment_attempts_open_guard
  before insert on public.assessment_attempts
  for each row execute function app_private.guard_attempt_open();
