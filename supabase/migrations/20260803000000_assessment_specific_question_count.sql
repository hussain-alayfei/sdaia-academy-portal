-- Allow an individual assessment to deliberately use a larger question set
-- without weakening the exact-count gate for every other pre, quiz, or post.

alter table public.assessments
  add column required_question_count int;

update public.assessments
set required_question_count = case kind
  when 'pre' then 20
  when 'quiz' then 10
  when 'post' then 30
end;

alter table public.assessments
  alter column required_question_count set default 10,
  alter column required_question_count set not null,
  add constraint assessments_required_question_count_check
    check (required_question_count between 1 and 200);

comment on column public.assessments.required_question_count is
  'Exact question-bank size required before publishing, unlocking, or starting this assessment.';

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

  select a.required_question_count,
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
