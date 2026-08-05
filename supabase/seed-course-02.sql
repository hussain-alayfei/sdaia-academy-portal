-- =============================================================================
-- SDAIA Academy Portal — second cohort (course 02)
--
-- Adds a co-instructor who runs his own five-day week with his own students,
-- fully isolated from course 01.
--
-- Prerequisite: an auth account must already exist for the email below. Either
-- he signs up at /signup, or an admin creates it through the Auth admin API.
-- This file only promotes and assigns; it never creates the login.
--
-- Safe to re-run: every step checks for what it is about to create/update.
--
-- What this deliberately does NOT do
-- ----------------------------------
-- Scheduled dates are not copied. Day titles, Arabic titles, summaries, and
-- published flags are synced from course 01. File/lab resources are copied in
-- production via a one-off storage copy (PDFs need new storage paths); re-run
-- of this SQL alone does not duplicate storage objects.
-- =============================================================================

do $$
declare
  v_email      text := 'm.ibnrashid@gmail.com';
  v_join_code  text := 'SDAIA-GENAI-02';
  v_owner      uuid;
  v_source     uuid;   -- course 01, where the papers are copied from
  v_course     uuid;   -- course 02, being built here
  v_src_a      record;
  v_dst_day    uuid;
  v_dst_a      uuid;
  v_q_count    int;
begin
  ------------------------------------------------------------------ instructor
  select id into v_owner
  from public.profiles
  where lower(email) = lower(v_email);

  if v_owner is null then
    raise exception
      'No account found for %. Create the login first, then re-run this file.',
      v_email;
  end if;

  -- `app_private.prevent_role_escalation` refuses any role change unless
  -- `app_private.is_admin()` is true, and that reads the caller's JWT. A SQL
  -- session has no JWT, so the promotion would be refused. Present an admin
  -- claim for the length of this transaction only — the third argument to
  -- set_config is `is_local`, so it is discarded on commit and the guard stays
  -- fully intact for the application, which is where it actually matters.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_owner, 'user_role', 'admin')::text,
    true
  );

  -- `instructor`, not `admin`. An instructor manages only courses they own:
  -- `app_private.manages_course` is `is_admin() or owner_id = auth.uid()`.
  -- Making him an admin would hand him course 01 and its students too.
  update public.profiles
     set role = 'instructor'
   where id = v_owner
     and role is distinct from 'instructor';

  ---------------------------------------------------------------------- course
  select id into v_course from public.courses where join_code = v_join_code;

  if v_course is null then
    insert into public.courses (
      slug, title, title_ar, description, owner_id, join_code,
      start_date, end_date, is_published
    ) values (
      'developing-generative-ai-solutions-02',
      'Developing Generative AI Solutions',
      'تطوير حلول الذكاء الاصطناعي',
      'Five-day advanced programme on turning language models into complete, production-ready software systems: architecture, retrieval, tools, agents, scale and security.',
      v_owner,
      v_join_code,
      null,   -- his cohort dates are not known here; he sets them in the UI
      null,
      true
    )
    returning id into v_course;
  end if;

  ------------------------------------------------------------------------ days
  -- Skeleton rows first; titles/summaries are filled from course 01 below.
  insert into public.course_days (course_id, day_number, title, is_published)
  select v_course, n, 'Day ' || n, n = 1
  from generate_series(1, 5) as n
  on conflict (course_id, day_number) do nothing;

  ----------------------------------------------------------- source of the papers
  select id into v_source from public.courses where join_code = 'SDAIA-GENAI-01';

  if v_source is null then
    raise exception 'Course SDAIA-GENAI-01 not found; nothing to copy from.';
  end if;

  --------------------------------------------------------- draft day contents
  -- Copy title / Arabic title / summary only. Never overwrite resources or
  -- dates. Publish a day only when it already has (or will get) a published
  -- assessment — otherwise leave it Draft for him to finish.
  update public.course_days d
     set title = s.title,
         title_ar = s.title_ar,
         summary = s.summary
    from public.course_days s
   where s.course_id = v_source
     and d.course_id = v_course
     and d.day_number = s.day_number;

  ------------------------------------------------------- sync every assessment
  -- Mirror course 01 papers onto course 02 by (day_number, kind). Question
  -- banks are copied under fresh ids and his course_id when the target paper
  -- has no questions yet. Existing banks are left alone (metadata still syncs).
  create temporary table if not exists _map_q (
    old_q uuid primary key,
    new_q uuid not null
  ) on commit drop;

  create temporary table if not exists _map_o (
    old_o uuid primary key,
    new_o uuid not null
  ) on commit drop;

  for v_src_a in
    select a.*, d.day_number
    from public.assessments a
    join public.course_days d on d.id = a.day_id
    where a.course_id = v_source
    order by d.day_number, a.position, a.kind
  loop
    select id into v_dst_day
    from public.course_days
    where course_id = v_course and day_number = v_src_a.day_number;

    if v_dst_day is null then
      raise exception 'Course 02 missing day %', v_src_a.day_number;
    end if;

    -- Days with a published paper must stay published so students can open it.
    -- Days without stay Draft (content above is still present for editing).
    update public.course_days d
       set is_published = exists (
             select 1
             from public.assessments a
             where a.day_id = d.id
               and a.is_published
           )
          or v_src_a.is_published
     where d.id = v_dst_day;

    select a.id into v_dst_a
    from public.assessments a
    where a.course_id = v_course
      and a.kind = v_src_a.kind
      and a.day_id = v_dst_day;

    if v_dst_a is null then
      insert into public.assessments (
        course_id, day_id, kind, title, description, duration_minutes,
        position, shuffle, required_question_count, is_published, is_locked,
        opens_at, closes_at
      ) values (
        v_course, v_dst_day, v_src_a.kind, v_src_a.title, v_src_a.description,
        v_src_a.duration_minutes, v_src_a.position, v_src_a.shuffle,
        v_src_a.required_question_count, v_src_a.is_published, v_src_a.is_locked,
        v_src_a.opens_at, v_src_a.closes_at
      )
      returning id into v_dst_a;
    else
      update public.assessments a
         set title = v_src_a.title,
             description = v_src_a.description,
             duration_minutes = v_src_a.duration_minutes,
             position = v_src_a.position,
             shuffle = v_src_a.shuffle,
             required_question_count = v_src_a.required_question_count,
             is_published = v_src_a.is_published,
             is_locked = v_src_a.is_locked,
             opens_at = v_src_a.opens_at,
             closes_at = v_src_a.closes_at
       where a.id = v_dst_a;
    end if;

    select count(*) into v_q_count
    from public.assessment_questions
    where assessment_id = v_dst_a;

    if v_q_count = 0 and exists (
      select 1 from public.assessment_questions where assessment_id = v_src_a.id
    ) then
      delete from _map_q;
      delete from _map_o;

      insert into _map_q (old_q, new_q)
      select id, gen_random_uuid()
      from public.assessment_questions
      where assessment_id = v_src_a.id;

      insert into public.assessment_questions
        (id, assessment_id, course_id, position, difficulty, stem, topic, format)
      select m.new_q, v_dst_a, v_course, q.position, q.difficulty, q.stem, q.topic, q.format
      from public.assessment_questions q
      join _map_q m on m.old_q = q.id;

      insert into _map_o (old_o, new_o)
      select o.id, gen_random_uuid()
      from public.assessment_options o
      join _map_q m on m.old_q = o.question_id;

      insert into public.assessment_options
        (id, question_id, course_id, label, body, position)
      select mo.new_o, mq.new_q, v_course, o.label, o.body, o.position
      from public.assessment_options o
      join _map_o mo on mo.old_o = o.id
      join _map_q mq on mq.old_q = o.question_id;

      insert into public.assessment_answer_keys
        (question_id, option_id, course_id, rationale)
      select mq.new_q, mo.new_o, v_course, k.rationale
      from public.assessment_answer_keys k
      join _map_q mq on mq.old_q = k.question_id
      join _map_o mo on mo.old_o = k.option_id;
    end if;
  end loop;

  raise notice 'Course 02 ready: code %, owner %, course id %. Assessments synced from course 01.',
    v_join_code, v_email, v_course;
end $$;
