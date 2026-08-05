-- Final exam support: sectioned papers, and results that stay hidden from the
-- student until an instructor releases them.
--
-- Two independent features, shipped together because the final exam needs both.
--
-- 1. SECTIONS. A paper may now be split into ordered sections (A multiple
--    choice, B true/false, C shared use case). Shuffling happens *inside* a
--    section, so the paper always reads A then B then C while no two students
--    meet the questions in the same order. Every existing assessment has one
--    section and behaves exactly as before.
--
-- 2. HIDDEN RESULTS. `results_released` defaults to true, so the six live
--    papers are untouched. Set it false and the attempt produces nothing the
--    student can read: no score on the attempt, no score row, no answer keys,
--    and no access to their own graded responses. Grading still happens, so the
--    instructor sees everything immediately and releasing is instant.
--
--    The hiding is done in the database rather than the UI on purpose. A
--    student can query PostgREST directly, so hiding a number in React would
--    not be hiding it at all.

/* ==================================================== schema additions == */

alter table public.assessment_questions
  add column if not exists section smallint not null default 1;

comment on column public.assessment_questions.section is
  'Ordered section this question belongs to (1, 2, 3...). Shuffling is confined to a section, so sections always run in order.';

alter table public.assessments
  add column if not exists sections jsonb,
  add column if not exists instructions text,
  add column if not exists results_released boolean not null default true;

comment on column public.assessments.sections is
  'Optional array of {n, code, title, brief, layout, use_case} describing each section. Null means a single unsectioned paper.';

comment on column public.assessments.instructions is
  'Optional long-form briefing shown prominently on the rules screen before the student begins.';

comment on column public.assessments.results_released is
  'False hides every trace of the result from the student: no score, no answer keys, no graded responses. Grading still runs for the instructor.';

create index if not exists assessment_questions_section_idx
  on public.assessment_questions (assessment_id, section, position);

/* ======================================================== start_attempt == */

-- Changed from the original in exactly two ways: the frozen order is grouped by
-- section before it is shuffled, and true/false options keep their authored
-- order. Two options are not worth shuffling, and "B" meaning True for one
-- student and False for another is a reliable source of mis-clicks.

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
    (assessment_id, course_id, student_id, expires_at, question_order, question_count)
  values
    (p_assessment, v_course, v_student,
     now() + make_interval(mins => v_duration), v_order, v_count)
  returning id into v_attempt;

  return v_attempt;
end;
$$;

/* ======================================================= submit_attempt == */

-- Grading is unchanged. What changes is how much of it the student can reach.
--
-- `is_correct` is always written: managers need it for the results page and the
-- per-question breakdown, and RLS (below) stops a student reading their own
-- response rows once the attempt is over and results are hidden.
--
-- `correct_count` and the `assessment_scores` row are the two values a student
-- *can* always read, so while results are hidden they are simply not written.
-- Releasing backfills both.

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

  select coalesce(a.results_released, true) into v_released
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

/* ========================================== set_assessment_results_released */

-- The instructor's one-press reveal. Releasing backfills everything
-- `submit_attempt` withheld, so the ordinary review screen works immediately
-- afterwards with no special cases. Hiding again clears the same values.

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
    -- Backfill the score the student was not allowed to see.
    update public.assessment_attempts a
       set correct_count = (
             select count(*)
             from public.assessment_responses r
             where r.attempt_id = a.id and r.is_correct
           )
     where a.assessment_id = p_assessment
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
      and a.status <> 'in_progress'
    on conflict (assessment_id, student_id) do update
      set score       = excluded.score,
          max_score   = excluded.max_score,
          recorded_at = excluded.recorded_at;
  else
    update public.assessment_attempts
       set correct_count = null
     where assessment_id = p_assessment;

    get diagnostics v_affected = row_count;

    delete from public.assessment_scores
    where assessment_id = p_assessment;
  end if;

  return v_affected;
end;
$$;

revoke execute on function public.set_assessment_results_released(uuid, boolean)
  from public, anon;
grant execute on function public.set_assessment_results_released(uuid, boolean)
  to authenticated;

/* =================================================================== RLS == */

-- Answer keys: a student may read the key for a paper they have submitted, and
-- only once results are released.

drop policy if exists "read your own key after submitting, or any if manager"
  on public.assessment_answer_keys;

create policy "read your own key after submitting, or any if manager"
  on public.assessment_answer_keys
  for select
  using (
    (select app_private.manages_course(assessment_answer_keys.course_id))
    or exists (
      select 1
      from public.assessment_questions q
      join public.assessment_attempts a on a.assessment_id = q.assessment_id
      join public.assessments s on s.id = q.assessment_id
      where q.id = assessment_answer_keys.question_id
        and a.student_id = (select auth.uid())
        and a.submitted_at is not null
        and s.results_released
    )
  );

-- Responses: readable while the attempt is live (the runner restores answers
-- from these rows), and afterwards only once results are released. This is what
-- keeps `is_correct` out of reach while the exam is under wraps.

drop policy if exists "students read own responses; managers read course responses"
  on public.assessment_responses;

create policy "students read own responses; managers read course responses"
  on public.assessment_responses
  for select
  using (
    (select app_private.manages_course(assessment_responses.course_id))
    or exists (
      select 1
      from public.assessment_attempts a
      join public.assessments s on s.id = a.assessment_id
      where a.id = assessment_responses.attempt_id
        and a.student_id = (select auth.uid())
        and (a.status = 'in_progress' or s.results_released)
    )
  );
