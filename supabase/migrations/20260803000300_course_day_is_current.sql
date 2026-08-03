-- Mark exactly one day per course as the "current" day on the student journey.
-- Instructors toggle this from the schedule; students see a filled circle and
-- a highlighted tile for that day.

alter table public.course_days
  add column is_current boolean not null default false;

comment on column public.course_days.is_current is
  'When true, the student course overview highlights this day as today. At most one day per course.';

create unique index course_days_one_current_per_course_idx
  on public.course_days (course_id)
  where is_current;

-- Point course 01 at today's scheduled day when one matches (Aug 2026 cohort).
update public.course_days d
   set is_current = true
  from public.courses c
 where d.course_id = c.id
   and c.join_code = 'SDAIA-GENAI-01'
   and d.scheduled_date = current_date
   and d.is_published;
