-- =============================================================================
-- SDAIA Academy Portal — seed
--
-- Run this ONCE, after the instructor has signed up through /signup.
-- It promotes that account to admin and creates the five-day GenAI course
-- with its assessments. Safe to re-run: every step is idempotent.
--
-- Change the email on the next line if you registered with a different one.
-- =============================================================================

do $$
declare
  v_instructor_email text := 'huhulhussein3@gmail.com';
  v_owner  uuid;
  v_course uuid;
  v_day1   uuid;
  v_day5   uuid;
begin
  ------------------------------------------------------------------ instructor
  select id into v_owner
  from public.profiles
  where lower(email) = lower(v_instructor_email);

  if v_owner is null then
    raise exception
      'No account found for %. Sign up at /signup first, then re-run this file.',
      v_instructor_email;
  end if;

  -- Bootstrap the very first admin.
  --
  -- `app_private.prevent_role_escalation` rejects any role change unless
  -- `app_private.is_admin()` is true, and that reads the caller's JWT. The SQL
  -- editor has no JWT, so `is_admin()` is false and the promotion is refused —
  -- which would make the first admin impossible to create.
  --
  -- So present an admin claim for the length of this transaction. The third
  -- argument to set_config is `is_local`, meaning it is discarded on commit; it
  -- grants nothing beyond this file and leaves the guard fully intact for the
  -- application, where it is what actually stops a student self-promoting.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_owner, 'user_role', 'admin')::text,
    true
  );

  update public.profiles set role = 'admin' where id = v_owner;

  ---------------------------------------------------------------------- course
  select id into v_course from public.courses where join_code = 'SDAIA-GENAI-01';

  if v_course is null then
    insert into public.courses (
      slug, title, title_ar, description, owner_id, join_code,
      start_date, end_date, is_published
    ) values (
      'developing-generative-ai-solutions',
      'Developing Generative AI Solutions',
      'تطوير حلول الذكاء الاصطناعي',
      'Five-day advanced programme on turning language models into complete, production-ready software systems: architecture, retrieval, tools, agents, scale and security.',
      v_owner,
      'SDAIA-GENAI-01',
      date '2026-08-02',
      date '2026-08-06',
      true
    )
    returning id into v_course;
  end if;

  ------------------------------------------------------------------------ days
  insert into public.course_days
    (course_id, day_number, title, title_ar, summary, scheduled_date, is_published)
  values
    (v_course, 1,
     'From language model to software solution',
     'مدخل إلى هندسة حلول الذكاء الاصطناعي التوليدي',
     'What generative AI and LLMs actually are; tokens, context window and hallucination; the gap between a model and a complete solution; the six layers of a GenAI system; the development lifecycle; and your first hands-on API call.',
     date '2026-08-02', true),

    (v_course, 2,
     'Architecture design: RAG versus agents',
     'تصميم البنية (RAG مقابل Agents) وتنفيذ خط استرجاع البيانات',
     'Telling RAG and agent architectures apart and choosing between them; how RAG works step by step; and building the retrieval pipeline end to end — ingestion, chunking, embedding, vector storage and retrieval.',
     date '2026-08-03', true),

    (v_course, 3,
     'Tool use and controlled agent patterns',
     'استخدام الأدوات (Function Calling) وأنماط الوكلاء الموجهة',
     'Why and how models call functions; defining tools and wiring external APIs; the tool-call cycle step by step; core agent patterns such as ReAct; and the guardrails that keep an agent predictable.',
     date '2026-08-04', true),

    (v_course, 4,
     'Building production-ready applications',
     'بناء تطبيقات مستقرة وقابلة للتوسّع وجاهزة للإنتاج',
     'The real gap between a prototype and production; designing for scale; cutting latency and cost; user experience in generative applications; and setting up observability.',
     date '2026-08-05', true),

    (v_course, 5,
     'Security, reliability, governance and the capstone',
     'مبادئ الأمان والموثوقية والحوكمة والمشروع الختامي',
     'The threat landscape for GenAI solutions; defending against prompt injection; grounding outputs and protecting privacy; governance and compliance; and delivering the integrated capstone project.',
     date '2026-08-06', true)
  on conflict (course_id, day_number) do nothing;

  select id into v_day1 from public.course_days
   where course_id = v_course and day_number = 1;
  select id into v_day5 from public.course_days
   where course_id = v_course and day_number = 5;

  ----------------------------------------------------------------- assessments
  -- Seven in total: the pre-assessment on day 1, a quiz on each of the five
  -- days, and the post-assessment on day 5. Each one is attached to a day, which
  -- is what puts it on that day's page rather than on the course overview.
  --
  -- They arrive empty, unpublished and locked. The order of operations is:
  -- import the questions on the Assessments tab, publish so the card appears,
  -- then unlock when the class should begin. `position` orders them within a
  -- day, so on day 1 the pre-assessment sits above the quiz.
  if not exists (select 1 from public.assessments where course_id = v_course) then
    insert into public.assessments
      (course_id, day_id, kind, title, description,
       duration_minutes, position, is_published, is_locked)
    select
      v_course, d.id, 'quiz',
      'Day ' || d.day_number || ' quiz',
      'Ten questions on the ground covered today.',
      10, 1, false, true
    from public.course_days d
    where d.course_id = v_course;

    insert into public.assessments
      (course_id, day_id, kind, title, description,
       duration_minutes, position, is_published, is_locked)
    values
      (v_course, v_day1, 'pre',
       'Pre-assessment',
       'Twenty questions, no pass mark. It shows where the class is starting from.',
       20, 0, false, true),

      (v_course, v_day5, 'post',
       'Post-assessment',
       'Thirty questions over the same ground as the pre-assessment, so the week''s improvement is measurable.',
       30, 2, false, true);
  end if;

  raise notice 'Seed complete. Course code SDAIA-GENAI-01, owner %.', v_instructor_email;
end $$;
