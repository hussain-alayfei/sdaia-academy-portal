-- Assessment engine, part 2 of 3: row level security.
--
-- Same shape as the rest of the schema: app_private.manages_course(course_id)
-- for anything an instructor does, app_private.is_enrolled(course_id) for the
-- student side. Writes are split into INSERT / UPDATE / DELETE rather than
-- FOR ALL, matching the earlier split_manager_policies migration.
--
-- Students get no write policies at all on the new tables. Every student-side
-- write goes through a security-definer function in part 3, which is the only
-- place that knows how to check the timer and the ownership of an attempt.

/* ========================================================== assessments == */

-- Assessments used to be visible to every enrolled student the moment they
-- existed, which was fine when they were just a link. Now they carry a
-- question bank, so they follow course_days: drafts are the instructor's alone.
drop policy "view assessments of enrolled course, or any if manager"
  on public.assessments;

create policy "view published assessments of enrolled course, or any if manager"
  on public.assessments for select to authenticated
  using (
    (select app_private.manages_course(course_id))
    or (is_published and (select app_private.is_enrolled(course_id)))
  );

/* ============================================================ questions == */

alter table public.assessment_questions enable row level security;

-- A student may read the paper only once they hold an attempt on it. Being
-- enrolled is not enough: without this, the whole bank could be pulled from the
-- API before the quiz ever opened.
create policy "read questions of an attempt you hold, or any if manager"
  on public.assessment_questions for select to authenticated
  using (
    (select app_private.manages_course(course_id))
    or exists (
      select 1
      from public.assessment_attempts a
      where a.assessment_id = assessment_questions.assessment_id
        and a.student_id = (select auth.uid())
    )
  );

create policy "managers insert questions" on public.assessment_questions
  for insert to authenticated
  with check ((select app_private.manages_course(course_id)));

create policy "managers update questions" on public.assessment_questions
  for update to authenticated
  using ((select app_private.manages_course(course_id)))
  with check ((select app_private.manages_course(course_id)));

create policy "managers delete questions" on public.assessment_questions
  for delete to authenticated
  using ((select app_private.manages_course(course_id)));

/* ============================================================== options == */

alter table public.assessment_options enable row level security;

create policy "read options of an attempt you hold, or any if manager"
  on public.assessment_options for select to authenticated
  using (
    (select app_private.manages_course(course_id))
    or exists (
      select 1
      from public.assessment_questions q
      join public.assessment_attempts a on a.assessment_id = q.assessment_id
      where q.id = assessment_options.question_id
        and a.student_id = (select auth.uid())
    )
  );

create policy "managers insert options" on public.assessment_options
  for insert to authenticated
  with check ((select app_private.manages_course(course_id)));

create policy "managers update options" on public.assessment_options
  for update to authenticated
  using ((select app_private.manages_course(course_id)))
  with check ((select app_private.manages_course(course_id)));

create policy "managers delete options" on public.assessment_options
  for delete to authenticated
  using ((select app_private.manages_course(course_id)));

/* ========================================================= answer keys == */

alter table public.assessment_answer_keys enable row level security;

-- The line that makes the review screen possible without leaking the paper:
-- the key opens to a student only after their attempt is submitted, and only
-- for the assessment they actually sat.
create policy "read your own key after submitting, or any if manager"
  on public.assessment_answer_keys for select to authenticated
  using (
    (select app_private.manages_course(course_id))
    or exists (
      select 1
      from public.assessment_questions q
      join public.assessment_attempts a on a.assessment_id = q.assessment_id
      where q.id = assessment_answer_keys.question_id
        and a.student_id = (select auth.uid())
        and a.submitted_at is not null
    )
  );

create policy "managers insert answer keys" on public.assessment_answer_keys
  for insert to authenticated
  with check ((select app_private.manages_course(course_id)));

create policy "managers update answer keys" on public.assessment_answer_keys
  for update to authenticated
  using ((select app_private.manages_course(course_id)))
  with check ((select app_private.manages_course(course_id)));

create policy "managers delete answer keys" on public.assessment_answer_keys
  for delete to authenticated
  using ((select app_private.manages_course(course_id)));

/* ============================================================= attempts == */

alter table public.assessment_attempts enable row level security;

create policy "students read own attempts; managers read course attempts"
  on public.assessment_attempts for select to authenticated
  using (
    student_id = (select auth.uid())
    or (select app_private.manages_course(course_id))
  );

-- No student insert or update policy: start_attempt and submit_attempt own
-- those, so the timer and the one-attempt rule cannot be sidestepped by
-- writing to the table directly.
create policy "managers update attempts" on public.assessment_attempts
  for update to authenticated
  using ((select app_private.manages_course(course_id)))
  with check ((select app_private.manages_course(course_id)));

create policy "managers delete attempts" on public.assessment_attempts
  for delete to authenticated
  using ((select app_private.manages_course(course_id)));

/* ============================================================ responses == */

alter table public.assessment_responses enable row level security;

create policy "students read own responses; managers read course responses"
  on public.assessment_responses for select to authenticated
  using (
    (select app_private.manages_course(course_id))
    or exists (
      select 1
      from public.assessment_attempts a
      where a.id = assessment_responses.attempt_id
        and a.student_id = (select auth.uid())
    )
  );

-- Writes go through save_response, which checks the clock, the ownership of the
-- attempt, and that the chosen option really belongs to the question asked.
create policy "managers delete responses" on public.assessment_responses
  for delete to authenticated
  using ((select app_private.manages_course(course_id)));

/* ===================================================== integrity events == */

alter table public.assessment_integrity_events enable row level security;

-- Students can see their own record, which is deliberate: the warning modal is
-- honest about what was logged rather than accumulating a secret file.
create policy "students read own events; managers read course events"
  on public.assessment_integrity_events for select to authenticated
  using (
    student_id = (select auth.uid())
    or (select app_private.manages_course(course_id))
  );

create policy "managers delete events" on public.assessment_integrity_events
  for delete to authenticated
  using ((select app_private.manages_course(course_id)));
