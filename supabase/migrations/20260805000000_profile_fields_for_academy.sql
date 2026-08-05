-- Essential learner/instructor profile fields for the SDAIA Academy portal.
alter table public.profiles
  add column if not exists bio text,
  add column if not exists organization text,
  add column if not exists job_title text,
  add column if not exists education text,
  add column if not exists city text,
  add column if not exists linkedin_url text;

comment on column public.profiles.bio is 'Short professional bio shown on the learner profile.';
comment on column public.profiles.organization is 'Employer, university, or affiliation.';
comment on column public.profiles.job_title is 'Current role or job title.';
comment on column public.profiles.education is 'Highest education or field of study.';
comment on column public.profiles.city is 'City / region.';
comment on column public.profiles.linkedin_url is 'Optional LinkedIn profile URL.';

create or replace function app_private.prevent_profile_identity_tamper()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email
     and not app_private.is_admin() then
    raise exception 'Email is managed by your sign-in account.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_email on public.profiles;
create trigger profiles_guard_email
  before update on public.profiles
  for each row
  execute function app_private.prevent_profile_identity_tamper();
