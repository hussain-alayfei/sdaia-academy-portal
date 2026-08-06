-- Students may only read assessment_scores after results are released.
-- Managers still see every score in their course (Students tab / Results).
-- Until release, submit_attempt writes no score row; this closes the residual
-- PostgREST path if a row ever exists while results are withheld.

drop policy if exists "students read own scores; managers read course scores"
  on public.assessment_scores;

create policy "students read own scores; managers read course scores"
  on public.assessment_scores
  for select
  to authenticated
  using (
    (select app_private.manages_course(assessment_scores.course_id))
    or (
      student_id = (select auth.uid())
      and exists (
        select 1
        from public.assessments a
        where a.id = assessment_scores.assessment_id
          and a.results_released
      )
    )
  );
