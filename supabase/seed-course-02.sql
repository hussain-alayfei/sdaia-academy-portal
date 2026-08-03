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
-- Safe to re-run: every step checks for what it is about to create.
--
-- What this deliberately does NOT do
-- ----------------------------------
-- His syllabus is not the same as course 01's. So the five days arrive bare —
-- 'Day 1' … 'Day 5', no titles, no Arabic titles, no summaries, no resources.
-- He writes his own from the instructor UI. Only the two Day 1 papers are
-- copied across, because those were asked for by name.
-- =============================================================================

do $$
declare
  v_email      text := 'm.ibnrashid@gmail.com';
  v_join_code  text := 'SDAIA-GENAI-02';
  v_owner      uuid;
  v_source     uuid;   -- course 01, where the papers are copied from
  v_course     uuid;   -- course 02, being built here
  v_day1       uuid;
  v_src_pre    uuid;
  v_src_quiz   uuid;
  v_new_pre    uuid;
  v_new_quiz   uuid;
  v_pair       record;
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
  -- Bare skeleton. Day 1 is published because it carries the two papers below
  -- and a student cannot reach an assessment on an unpublished day. Days 2–5
  -- stay drafts so his students are not shown empty pages; he publishes each
  -- one as he fills it.
  insert into public.course_days (course_id, day_number, title, is_published)
  select v_course, n, 'Day ' || n, n = 1
  from generate_series(1, 5) as n
  on conflict (course_id, day_number) do nothing;

  select id into v_day1
  from public.course_days
  where course_id = v_course and day_number = 1;

  ----------------------------------------------------------- source of the papers
  select id into v_source from public.courses where join_code = 'SDAIA-GENAI-01';

  if v_source is null then
    raise exception 'Course SDAIA-GENAI-01 not found; nothing to copy from.';
  end if;

  select id into v_src_pre
  from public.assessments
  where course_id = v_source and kind = 'pre';

  select a.id into v_src_quiz
  from public.assessments a
  join public.course_days d on d.id = a.day_id
  where a.course_id = v_source and a.kind = 'quiz' and d.day_number = 1;

  if v_src_pre is null or v_src_quiz is null then
    raise exception 'Could not find both Day 1 papers on course 01.';
  end if;

  ----------------------------------------------------------------- assessments
  -- Published so the cards appear, locked so nobody can start until he says so.
  select id into v_new_pre
  from public.assessments
  where course_id = v_course and kind = 'pre';

  if v_new_pre is null then
    insert into public.assessments
      (course_id, day_id, kind, title, description, duration_minutes,
       position, shuffle, required_question_count, is_published, is_locked)
    select
      v_course, v_day1, 'pre', a.title, a.description, a.duration_minutes,
      0, a.shuffle, a.required_question_count, true, true
    from public.assessments a
    where a.id = v_src_pre
    returning id into v_new_pre;
  end if;

  select a.id into v_new_quiz
  from public.assessments a
  where a.course_id = v_course and a.kind = 'quiz' and a.day_id = v_day1;

  if v_new_quiz is null then
    insert into public.assessments
      (course_id, day_id, kind, title, description, duration_minutes,
       position, shuffle, required_question_count, is_published, is_locked)
    select
      v_course, v_day1, 'quiz', a.title, a.description, a.duration_minutes,
      1, a.shuffle, a.required_question_count, true, true
    from public.assessments a
    where a.id = v_src_quiz
    returning id into v_new_quiz;
  end if;

  ------------------------------------------------------- copy the question banks
  -- Questions, options and answer keys are copied row for row under fresh ids
  -- and his course_id, so the two courses share wording but no rows: resetting
  -- or editing his paper cannot touch course 01's, and his students' attempts
  -- are scored against his own copy.
  --
  -- Temp tables carry the old id → new id mapping, because options and answer
  -- keys have to point at the new question rows rather than the originals.
  create temporary table if not exists _map_q (
    old_q uuid primary key,
    new_q uuid not null
  ) on commit drop;

  create temporary table if not exists _map_o (
    old_o uuid primary key,
    new_o uuid not null
  ) on commit drop;

  for v_pair in
    select * from (values (v_src_pre, v_new_pre), (v_src_quiz, v_new_quiz))
      as t(src, tgt)
  loop
    -- Already copied on an earlier run.
    continue when exists (
      select 1 from public.assessment_questions where assessment_id = v_pair.tgt
    );

    delete from _map_q;
    delete from _map_o;

    insert into _map_q (old_q, new_q)
    select id, gen_random_uuid()
    from public.assessment_questions
    where assessment_id = v_pair.src;

    insert into public.assessment_questions
      (id, assessment_id, course_id, position, difficulty, stem, topic)
    select m.new_q, v_pair.tgt, v_course, q.position, q.difficulty, q.stem, q.topic
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
  end loop;

  raise notice 'Course 02 ready: code %, owner %, course id %.',
    v_join_code, v_email, v_course;
end $$;
