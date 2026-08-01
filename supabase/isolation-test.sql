-- =============================================================================
-- Multi-tenant isolation test
--
-- Proves the core rule: a student enrolled with instructor A can never read
-- instructor B's course, and neither can read the other's drafts.
--
-- Run AFTER at least two courses (different owners) and one student exist.
-- Everything happens inside a transaction that is rolled back, so it changes
-- nothing.
--
-- Paste into the Supabase SQL editor and read the `verdict` column.
-- =============================================================================

do $$
declare
  v_student   uuid;
  v_course_a  uuid;
  v_course_b  uuid;
  v_seen      int;
  v_claims    text;
begin
  -- Pick a student who is enrolled in exactly one course.
  select e.student_id, e.course_id into v_student, v_course_a
  from public.enrollments e
  join public.profiles p on p.id = e.student_id
  where p.role = 'student'
  limit 1;

  if v_student is null then
    raise notice 'SKIPPED — no enrolled student yet. Sign a student up first.';
    return;
  end if;

  -- Pick any course they are NOT enrolled in.
  select c.id into v_course_b
  from public.courses c
  where c.id <> v_course_a
    and not exists (
      select 1 from public.enrollments e
      where e.course_id = c.id and e.student_id = v_student
    )
  limit 1;

  if v_course_b is null then
    raise notice 'SKIPPED — only one course exists. Create a second course (ideally owned by the other instructor) and re-run.';
    return;
  end if;

  v_claims := json_build_object(
    'sub', v_student::text,
    'role', 'authenticated',
    'user_role', 'student'
  )::text;

  -- Impersonate the student for the checks below.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', v_claims, true);

  ------------------------------------------------------------------ course B
  select count(*) into v_seen from public.courses where id = v_course_b;
  raise notice 'Other instructor''s course visible to student: % (expected 0) => %',
    v_seen, case when v_seen = 0 then 'PASS' else 'FAIL' end;

  select count(*) into v_seen from public.course_days where course_id = v_course_b;
  raise notice 'Other course''s days visible: % (expected 0) => %',
    v_seen, case when v_seen = 0 then 'PASS' else 'FAIL' end;

  select count(*) into v_seen from public.resources where course_id = v_course_b;
  raise notice 'Other course''s resources visible: % (expected 0) => %',
    v_seen, case when v_seen = 0 then 'PASS' else 'FAIL' end;

  ------------------------------------------------- drafts in their OWN course
  select count(*) into v_seen
  from public.course_days
  where course_id = v_course_a and is_published = false;
  raise notice 'Unpublished days in own course visible: % (expected 0) => %',
    v_seen, case when v_seen = 0 then 'PASS' else 'FAIL' end;

  select count(*) into v_seen
  from public.resources
  where course_id = v_course_a and is_published = false;
  raise notice 'Draft resources in own course visible: % (expected 0) => %',
    v_seen, case when v_seen = 0 then 'PASS' else 'FAIL' end;

  --------------------------------------------------------- other people's scores
  select count(*) into v_seen
  from public.assessment_scores
  where student_id <> v_student;
  raise notice 'Other students'' scores visible: % (expected 0) => %',
    v_seen, case when v_seen = 0 then 'PASS' else 'FAIL' end;

  ----------------------------------------------------------- privilege checks
  raise notice 'Student believes it is admin: % (expected false) => %',
    app_private.is_admin(),
    case when app_private.is_admin() = false then 'PASS' else 'FAIL' end;

  raise notice 'Student can manage other course: % (expected false) => %',
    app_private.manages_course(v_course_b),
    case when app_private.manages_course(v_course_b) = false then 'PASS' else 'FAIL' end;

  perform set_config('role', 'postgres', true);
end $$;

-- Separately: a student must not be able to promote themselves.
-- Expect: ERROR "Only an admin may change a user role".
--
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<student-uuid>","role":"authenticated","user_role":"student"}';
--   update public.profiles set role = 'admin' where id = '<student-uuid>';
--   rollback;
