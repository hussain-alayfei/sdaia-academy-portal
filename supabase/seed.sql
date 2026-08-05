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
     'From Language Model to Software Solution',
     'مدخل إلى هندسة حلول الذكاء الاصطناعي التوليدي',
     'This session introduces generative artificial intelligence and large language models as components of complete software solutions. It covers tokens, context windows, and hallucination; distinguishes a model from an end-to-end system; presents the principal layers of a generative AI architecture and the development lifecycle; and concludes with a first practical API call.',
     date '2026-08-02', true),

    (v_course, 2,
     'Architecture Design: RAG Versus Agents',
     'تصميم البنية (RAG مقابل Agents) وتنفيذ خط استرجاع البيانات',
     'This session distinguishes retrieval-augmented generation from agent architectures and develops criteria for selecting between them. Learners examine the retrieval pipeline end to end, including ingestion, chunking, embedding, vector storage, and retrieval.',
     date '2026-08-03', true),

    (v_course, 3,
     'Tool Use and Controlled Agent Patterns',
     'استخدام الأدوات (Function Calling) وأنماط الوكلاء الموجهة',
     'This session examines how language models invoke external capabilities through function calling, and how the surrounding application retains control. Topics include tool definition and API integration, the tool-calling lifecycle, core agent patterns such as ReAct, and the guardrails that keep agent behaviour predictable.',
     date '2026-08-04', true),

    (v_course, 4,
     'Production Systems, Then Security and Governance',
     'أنظمة الإنتاج ثم الأمان والحوكمة',
     'This session addresses the requirements of production generative AI systems and the governance controls that accompany them. The morning focuses on scale, latency, cost, user experience, and observability. The afternoon covers security, reliability, and compliance, including threat models, prompt injection, and privacy. The day concludes with the post-assessment.',
     date '2026-08-05', true),

    (v_course, 5,
     'Certification Day: Capstone Presentation and Final Exam',
     'يوم الشهادة: عرض المشروع الختامي والاختبار النهائي',
     'This session is devoted to certification. Learners submit and present the group capstone project and sit the final theory examination. The overall pass mark is 60 percent. No new lecture content is introduced.',
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
