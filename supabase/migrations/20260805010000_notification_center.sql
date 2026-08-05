-- Student notification center: course activity events + per-student read state.
-- Action-needed (incomplete assessments) is computed in app code, not stored here.

create type public.notification_event_kind as enum (
  'resource_added',
  'day_published',
  'assessment_published',
  'assessment_unlocked'
);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  day_id uuid references public.course_days (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  kind public.notification_event_kind not null,
  entity_type text not null,
  entity_id uuid not null,
  title text not null,
  body text not null,
  href text not null,
  created_at timestamptz not null default now()
);

create index notification_events_course_created_idx
  on public.notification_events (course_id, created_at desc);

create index notification_events_created_idx
  on public.notification_events (created_at desc);

create table public.notification_reads (
  student_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.notification_events (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (student_id, event_id)
);

create index notification_reads_student_idx
  on public.notification_reads (student_id);

alter table public.notification_events enable row level security;
alter table public.notification_reads enable row level security;

-- Enrolled students in a published course may read events for that course.
create policy notification_events_select_enrolled
  on public.notification_events for select to authenticated
  using (
    (select app_private.is_enrolled(course_id))
    and exists (
      select 1
      from public.courses c
      where c.id = course_id
        and c.is_published
    )
  );

-- Course managers may insert activity events (admin actions use the user client).
create policy notification_events_insert_manager
  on public.notification_events for insert to authenticated
  with check ((select app_private.manages_course(course_id)));

-- Managers may also read their own course events (preview / debug).
create policy notification_events_select_manager
  on public.notification_events for select to authenticated
  using ((select app_private.manages_course(course_id)));

create policy notification_reads_select_own
  on public.notification_reads for select to authenticated
  using (student_id = (select auth.uid()));

create policy notification_reads_insert_own
  on public.notification_reads for insert to authenticated
  with check (student_id = (select auth.uid()));

create policy notification_reads_update_own
  on public.notification_reads for update to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

grant select, insert on public.notification_events to authenticated;
revoke update, delete on public.notification_events from authenticated;

grant select, insert, update on public.notification_reads to authenticated;
revoke delete on public.notification_reads from authenticated;
