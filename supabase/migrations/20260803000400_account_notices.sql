-- One-shot notices shown to a student on next eligible login (e.g. tomorrow).

create table public.account_notices (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  show_after timestamptz not null default now(),
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index account_notices_student_pending_idx
  on public.account_notices (student_id)
  where dismissed_at is null;

alter table public.account_notices enable row level security;

create policy account_notices_select_own
  on public.account_notices for select to authenticated
  using (student_id = (select auth.uid()));

create policy account_notices_update_own
  on public.account_notices for update to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

-- Students may dismiss; only service role / SQL inserts notices.
revoke insert, delete on public.account_notices from authenticated;
grant select, update on public.account_notices to authenticated;
