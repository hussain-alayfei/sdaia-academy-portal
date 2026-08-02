-- Assessment engine, part 1 of 3: enums, tables, indexes, triggers.
--
-- Quizzes used to be a link to an external form plus a hand-typed score. This
-- moves the whole thing in-house: questions, one attempt per student, a
-- server-owned timer, automatic grading and an integrity log.
--
-- The one structural decision worth reading twice is that correctness does NOT
-- live on assessment_options. A student has to be able to read the options
-- while sitting the quiz, so anything on that row travels to their browser.
-- The key sits in assessment_answer_keys instead, which RLS keeps shut until
-- they have submitted (part 2).

/* ================================================================ enums == */

create type public.question_difficulty as enum ('easy', 'medium', 'hard');

create type public.attempt_status as enum (
  'in_progress',
  'submitted',
  'timed_out',
  'integrity_stopped'
);

create type public.integrity_event_kind as enum (
  'tab_hidden',
  'window_blur',
  'copy',
  'paste',
  'context_menu'
);

/* ========================================================== assessments == */

-- max_score goes: every question is worth one point, so the denominator is
-- just the question count. external_url goes with the off-site quizzes it
-- pointed at. Neither held real data (zero scores, zero URLs) when this ran.
alter table public.assessments
  drop column max_score,
  drop column external_url,
  add column duration_minutes int not null default 20
    check (duration_minutes between 1 and 300),
  add column shuffle boolean not null default true,
  add column is_published boolean not null default false;

comment on column public.assessments.is_locked is
  'Published makes the card visible; unlocked lets a student begin. Two steps '
  'on purpose, so an instructor can set a quiz up in front of the class and '
  'release it when everyone is ready.';

/* ============================================================ questions == */

create table public.assessment_questions (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  course_id     uuid not null references public.courses(id) on delete cascade,
  position      int not null default 0,
  difficulty    public.question_difficulty not null default 'medium',
  topic         text,
  stem          text not null check (length(btrim(stem)) > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index assessment_questions_assessment_idx
  on public.assessment_questions(assessment_id, position);
create index assessment_questions_course_idx
  on public.assessment_questions(course_id);

create trigger assessment_questions_touch
  before update on public.assessment_questions
  for each row execute function public.touch_updated_at();

/* ============================================================== options == */

create table public.assessment_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.assessment_questions(id) on delete cascade,
  course_id   uuid not null references public.courses(id) on delete cascade,
  label       text not null check (label in ('A', 'B', 'C', 'D')),
  body        text not null check (length(btrim(body)) > 0),
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  unique (question_id, label)
);

create index assessment_options_question_idx
  on public.assessment_options(question_id, position);
create index assessment_options_course_idx
  on public.assessment_options(course_id);

/* ========================================================= answer keys == */

-- question_id as the primary key is the constraint that matters: exactly one
-- correct option per question, enforced by Postgres rather than by hope.
create table public.assessment_answer_keys (
  question_id uuid primary key references public.assessment_questions(id) on delete cascade,
  option_id   uuid not null references public.assessment_options(id) on delete cascade,
  course_id   uuid not null references public.courses(id) on delete cascade,
  rationale   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index assessment_answer_keys_course_idx
  on public.assessment_answer_keys(course_id);
create index assessment_answer_keys_option_idx
  on public.assessment_answer_keys(option_id);

create trigger assessment_answer_keys_touch
  before update on public.assessment_answer_keys
  for each row execute function public.touch_updated_at();

/* ============================================================= attempts == */

create table public.assessment_attempts (
  id             uuid primary key default gen_random_uuid(),
  assessment_id  uuid not null references public.assessments(id) on delete cascade,
  course_id      uuid not null references public.courses(id) on delete cascade,
  student_id     uuid not null references public.profiles(id) on delete cascade,
  status         public.attempt_status not null default 'in_progress',
  started_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  submitted_at   timestamptz,
  warning_count  int not null default 0 check (warning_count >= 0),
  -- [{"q": <question uuid>, "o": [<option uuid>, ...]}, ...] — the paper this
  -- student was given, frozen at start so a reload shows the same order and
  -- two neighbours see different ones.
  question_order jsonb not null default '[]'::jsonb,
  correct_count  int check (correct_count >= 0),
  question_count int check (question_count >= 0),
  -- One attempt per student per assessment. This is the whole "one time only"
  -- rule; it is a unique index, not an application check.
  unique (assessment_id, student_id)
);

create index assessment_attempts_student_idx
  on public.assessment_attempts(student_id);
create index assessment_attempts_course_idx
  on public.assessment_attempts(course_id);
create index assessment_attempts_assessment_idx
  on public.assessment_attempts(assessment_id);

/* ============================================================ responses == */

create table public.assessment_responses (
  id                 uuid primary key default gen_random_uuid(),
  attempt_id         uuid not null references public.assessment_attempts(id) on delete cascade,
  question_id        uuid not null references public.assessment_questions(id) on delete cascade,
  course_id          uuid not null references public.courses(id) on delete cascade,
  selected_option_id uuid references public.assessment_options(id) on delete set null,
  flagged            boolean not null default false,
  is_correct         boolean,
  answered_at        timestamptz,
  created_at         timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index assessment_responses_attempt_idx
  on public.assessment_responses(attempt_id);
create index assessment_responses_question_idx
  on public.assessment_responses(question_id);
create index assessment_responses_course_idx
  on public.assessment_responses(course_id);
create index assessment_responses_option_idx
  on public.assessment_responses(selected_option_id);

/* ===================================================== integrity events == */

create table public.assessment_integrity_events (
  id             uuid primary key default gen_random_uuid(),
  attempt_id     uuid not null references public.assessment_attempts(id) on delete cascade,
  course_id      uuid not null references public.courses(id) on delete cascade,
  student_id     uuid not null references public.profiles(id) on delete cascade,
  kind           public.integrity_event_kind not null,
  warning_number int not null,
  occurred_at    timestamptz not null default now()
);

create index assessment_integrity_events_attempt_idx
  on public.assessment_integrity_events(attempt_id, occurred_at);
create index assessment_integrity_events_course_idx
  on public.assessment_integrity_events(course_id);
create index assessment_integrity_events_student_idx
  on public.assessment_integrity_events(student_id);
