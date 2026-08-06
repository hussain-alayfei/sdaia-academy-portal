-- Final exam control centre support.
--
-- 1. assessment_access_grants — let named students start a locked paper
--    (optionally inside a time window) without unlocking the whole class.
-- 2. assessment_attempts.is_practice — instructor dry runs that never score.
-- 3. start_attempt honours an active grant when the paper is locked.
-- 4. start_practice_attempt — managers sit the real runner with is_practice.
-- 5. submit_attempt never writes scores for practice; deletes the attempt.
-- 6. set_assessment_results_released ignores practice rows.

/* ============================================================ grants == */

create table if not exists public.assessment_access_grants (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  opens_at timestamptz not null default now(),
  closes_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (assessment_id, student_id),
  check (closes_at is null or closes_at > opens_at)
);

comment on table public.assessment_access_grants is
  'Named students who may start a locked assessment. Optional closes_at ends the window.';

create index if not exists assessment_access_grants_assessment_idx
  on public.assessment_access_grants (assessment_id);

create index if not exists assessment_access_grants_student_idx
  on public.assessment_access_grants (student_id);

alter table public.assessment_access_grants enable row level security;

create policy "managers read grants"
  on public.assessment_access_grants for select to authenticated
  using ((select app_private.manages_course(course_id)));

create policy "managers insert grants"
  on public.assessment_access_grants for insert to authenticated
  with check ((select app_private.manages_course(course_id)));

create policy "managers update grants"
  on public.assessment_access_grants for update to authenticated
  using ((select app_private.manages_course(course_id)))
  with check ((select app_private.manages_course(course_id)));

create policy "managers delete grants"
  on public.assessment_access_grants for delete to authenticated
  using ((select app_private.manages_course(course_id)));

-- A student may see their own grant (so the rules screen can explain why
-- they can start while the class paper is locked).
create policy "students read own grants"
  on public.assessment_access_grants for select to authenticated
  using (student_id = (select auth.uid()));

/* ========================================================= is_practice == */

alter table public.assessment_attempts
  add column if not exists is_practice boolean not null default false;

comment on column public.assessment_attempts.is_practice is
  'Instructor dry run. Never writes assessment_scores; deleted on submit. Excluded from results boards.';

create index if not exists assessment_attempts_practice_idx
  on public.assessment_attempts (assessment_id)
  where is_practice = false;

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
  v_granted   boolean := false;
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

  -- Resume a real attempt if one exists.
  select id into v_attempt
  from public.assessment_attempts
  where assessment_id = p_assessment
    and student_id = v_student
    and is_practice = false;

  if v_attempt is not null then
    return v_attempt;
  end if;

  -- Drop a leftover dry run so a real sit can begin cleanly.
  delete from public.assessment_attempts
  where assessment_id = p_assessment
    and student_id = v_student
    and is_practice = true;

  if not v_published then
    raise exception 'This assessment is not open yet' using errcode = '42501';
  end if;

  if v_locked then
    select exists (
      select 1
      from public.assessment_access_grants g
      where g.assessment_id = p_assessment
        and g.student_id = v_student
        and g.opens_at <= now()
        and (g.closes_at is null or g.closes_at > now())
    ) into v_granted;

    if not v_granted then
      raise exception 'This assessment is not open yet' using errcode = '42501';
    end if;
  end if;

  select count(*) into v_count
  from public.assessment_questions q
  where q.assessment_id = p_assessment;

  if v_count = 0 then
    raise exception 'This assessment has no questions yet' using errcode = '42501';
  end if;

  select jsonb_agg(jsonb_build_object('q', x.id, 'o', x.options)
                   order by x.section, x.rank)
    into v_order
  from (
    select q.id,
           q.section,
           case when v_shuffle then random() else q.position::float8 end as rank,
           (
             select jsonb_agg(o.id order by
                      case
                        when v_shuffle and q.format <> 'true_false' then random()
                        else o.position::float8
                      end)
             from public.assessment_options o
             where o.question_id = q.id
           ) as options
    from public.assessment_questions q
    where q.assessment_id = p_assessment
  ) x;

  insert into public.assessment_attempts
    (assessment_id, course_id, student_id, expires_at, question_order,
     question_count, is_practice)
  values
    (p_assessment, v_course, v_student,
     now() + make_interval(mins => v_duration), v_order, v_count, false)
  returning id into v_attempt;

  return v_attempt;
end;
$$;

/* ============================================== start_practice_attempt == */

create or replace function public.start_practice_attempt(p_assessment uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := auth.uid();
  v_course    uuid;
  v_duration  int;
  v_shuffle   boolean;
  v_published boolean;
  v_attempt   uuid;
  v_order     jsonb;
  v_count     int;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select a.course_id, a.duration_minutes, a.shuffle, a.is_published
    into v_course, v_duration, v_shuffle, v_published
  from public.assessments a
  where a.id = p_assessment;

  if v_course is null then
    raise exception 'Assessment not found' using errcode = 'P0002';
  end if;

  if not app_private.manages_course(v_course) then
    raise exception 'You do not manage this course' using errcode = '42501';
  end if;

  if not v_published then
    raise exception 'Publish the assessment before a dry run' using errcode = '42501';
  end if;

  -- Never let a dry run sit on top of a real graded attempt for the same person.
  if exists (
    select 1 from public.assessment_attempts
    where assessment_id = p_assessment
      and student_id = v_user
      and is_practice = false
  ) then
    raise exception 'A real attempt already exists for this account' using errcode = '42501';
  end if;

  -- Resume an in-progress dry run; otherwise replace any finished one.
  select id into v_attempt
  from public.assessment_attempts
  where assessment_id = p_assessment
    and student_id = v_user
    and is_practice = true
    and status = 'in_progress';

  if v_attempt is not null then
    return v_attempt;
  end if;

  delete from public.assessment_attempts
  where assessment_id = p_assessment
    and student_id = v_user
    and is_practice = true;

  select count(*) into v_count
  from public.assessment_questions q
  where q.assessment_id = p_assessment;

  if v_count = 0 then
    raise exception 'This assessment has no questions yet' using errcode = '42501';
  end if;

  select jsonb_agg(jsonb_build_object('q', x.id, 'o', x.options)
                   order by x.section, x.rank)
    into v_order
  from (
    select q.id,
           q.section,
           case when v_shuffle then random() else q.position::float8 end as rank,
           (
             select jsonb_agg(o.id order by
                      case
                        when v_shuffle and q.format <> 'true_false' then random()
                        else o.position::float8
                      end)
             from public.assessment_options o
             where o.question_id = q.id
           ) as options
    from public.assessment_questions q
    where q.assessment_id = p_assessment
  ) x;

  insert into public.assessment_attempts
    (assessment_id, course_id, student_id, expires_at, question_order,
     question_count, is_practice)
  values
    (p_assessment, v_course, v_user,
     now() + make_interval(mins => v_duration), v_order, v_count, true)
  returning id into v_attempt;

  return v_attempt;
end;
$$;

revoke execute on function public.start_practice_attempt(uuid) from public, anon;
grant execute on function public.start_practice_attempt(uuid) to authenticated;

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
  v_student  uuid := auth.uid();
  v_attempt  public.assessment_attempts;
  v_status   public.attempt_status;
  v_correct  int;
  v_total    int;
  v_released boolean;
  v_limit    smallint;
  v_practice boolean;
begin
  select * into v_attempt
  from public.assessment_attempts
  where id = p_attempt and student_id = v_student
  for update;

  if v_attempt.id is null then
    raise exception 'Attempt not found' using errcode = '42501';
  end if;

  v_practice := coalesce(v_attempt.is_practice, false);

  if v_attempt.status <> 'in_progress' then
    return jsonb_build_object(
      'correct_count', v_attempt.correct_count,
      'question_count', v_attempt.question_count,
      'status', v_attempt.status,
      'practice', v_practice
    );
  end if;

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

  v_total := coalesce(
    nullif(jsonb_array_length(v_attempt.question_order), 0),
    (select count(*) from public.assessment_questions q
      where q.assessment_id = v_attempt.assessment_id)
  );

  select count(*) into v_correct
  from public.assessment_responses r
  where r.attempt_id = p_attempt and r.is_correct;

  -- Dry runs: grade for the response payload, then wipe. Nothing is kept.
  if v_practice then
    delete from public.assessment_attempts where id = p_attempt;

    return jsonb_build_object(
      'correct_count', v_correct,
      'question_count', v_total,
      'status', v_status,
      'results_released', true,
      'practice', true
    );
  end if;

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
    'results_released', v_released,
    'practice', false
  );
end;
$$;

/* ================================ set_assessment_results_released == */

create or replace function public.set_assessment_results_released(
  p_assessment uuid,
  p_released   boolean
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course   uuid;
  v_affected int := 0;
begin
  select course_id into v_course
  from public.assessments
  where id = p_assessment;

  if v_course is null then
    raise exception 'Assessment not found' using errcode = 'P0002';
  end if;

  if not app_private.manages_course(v_course) then
    raise exception 'You do not manage this course' using errcode = '42501';
  end if;

  update public.assessments
     set results_released = p_released,
         updated_at       = now()
   where id = p_assessment;

  if p_released then
    update public.assessment_attempts a
       set correct_count = (
             select count(*)
             from public.assessment_responses r
             where r.attempt_id = a.id and r.is_correct
           )
     where a.assessment_id = p_assessment
       and a.is_practice = false
       and a.status <> 'in_progress';

    get diagnostics v_affected = row_count;

    insert into public.assessment_scores
      (assessment_id, student_id, course_id, score, max_score, recorded_at)
    select a.assessment_id,
           a.student_id,
           a.course_id,
           coalesce(a.correct_count, 0),
           greatest(coalesce(a.question_count, 1), 1),
           now()
    from public.assessment_attempts a
    where a.assessment_id = p_assessment
      and a.is_practice = false
      and a.status <> 'in_progress'
    on conflict (assessment_id, student_id) do update
      set score       = excluded.score,
          max_score   = excluded.max_score,
          recorded_at = excluded.recorded_at;
  else
    update public.assessment_attempts
       set correct_count = null
     where assessment_id = p_assessment
       and is_practice = false;

    get diagnostics v_affected = row_count;

    delete from public.assessment_scores
    where assessment_id = p_assessment;
  end if;

  return v_affected;
end;
$$;

/* ============================================== discard_practice_attempt == */

create or replace function public.discard_practice_attempt(p_attempt uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row  public.assessment_attempts;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into v_row
  from public.assessment_attempts
  where id = p_attempt;

  if v_row.id is null then
    return false;
  end if;

  if not v_row.is_practice then
    raise exception 'Not a practice attempt' using errcode = '42501';
  end if;

  if v_row.student_id <> v_user
     and not app_private.manages_course(v_row.course_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  delete from public.assessment_attempts where id = p_attempt;
  return true;
end;
$$;

revoke execute on function public.discard_practice_attempt(uuid) from public, anon;
grant execute on function public.discard_practice_attempt(uuid) to authenticated;
