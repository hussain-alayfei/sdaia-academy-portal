-- =============================================================================
-- SDAIA-GENAI-02 content sync from Musa Ibn Rashid's course site
-- https://mibnrashid.github.io/SDAIA_AppliedGenerativeAI/
--
-- Updates titles, Arabic (genai-02.txt), summaries, dates, and all day materials
-- (slides, Colab labs, activities, project). Safe to re-run: deletes course-02
-- resources then re-inserts the canonical set.
--
-- Does NOT touch Day 1–3 quiz question banks that already have student attempts.
-- Pre-test / Post-test banks are loaded separately via
-- scripts/seed-course-02-pretest.mjs from docs/assessment-content/course-02-pretest.json
-- =============================================================================

begin;

update public.courses
set title = 'Applied Generative AI',
    title_ar = 'الذكاء الاصطناعي التوليدي التطبيقي',
    description = 'From a prompt to a system. Five days building generative AI that ships: retrieval you can measure, tools that do real work, production numbers, and security. Slides, Colab labs, and scored activities from the instructor site.',
    start_date = '2026-08-02',
    end_date = '2026-08-06',
    is_published = true
where join_code = 'SDAIA-GENAI-02';

-- Day rows (ids stable from seed-course-02.sql)
update public.course_days d set
  title = v.title,
  title_ar = v.title_ar,
  summary = v.summary,
  scheduled_date = v.scheduled_date::date,
  is_published = true,
  is_current = v.is_current
from (values
  (1, 'From token to typed output',
   'مدخل إلى هندسة حلول الذكاء الاصطناعي التوليدي',
   'How the model works — tokens, context window, temperature, hallucination — and how to make it return schema-validated JSON your code can trust. Pre-test, Tokenizer Race activity, and Notebook 1 (first calls).',
   '2026-08-02', false),
  (2, 'Retrieval you can measure',
   'تصميم بنية التطبيقات (RAG مقابل Agents) وتنفيذ خط استرجاع البيانات',
   'RAG versus agents, then the retrieval pipeline end to end: ingestion (including scanned Arabic pages), chunking, embeddings, hybrid search, and a golden set so you can prove it works. Chunk Lab activity and Notebook 2.',
   '2026-08-03', false),
  (3, 'Tools and agents',
   'استخدام الأدوات (Function Calling) وأنماط الوكلاء الموجهة',
   'Give the model hands with function calling, keep the leash short with guardrails, and turn yesterday’s retriever into a tool. Be the Agent activity, Notebook 3, then project build time.',
   '2026-08-04', false),
  (4, 'Production systems, then security and governance',
   'أنظمة الإنتاج ثم الأمان والحوكمة',
   'Two lecture blocks in one day. Morning: building production-ready GenAI apps (scale, latency, cost, UX, observability). Afternoon: security, reliability and governance (threats, prompt injection, privacy, compliance). Closes with the Post-assessment before certification day.',
   '2026-08-05', true),
  (5, 'Certification day: Capstone presentation and Final exam',
   'يوم الشهادة: عرض المشروع الختامي والاختبار النهائي',
   'No new lecture. Certification Pass day: submit and present your group capstone project, then sit the Final theory exam. Use the Capstone Project Guide on this page. Overall pass mark: 60%.',
   '2026-08-06', false)
) as v(day_number, title, title_ar, summary, scheduled_date, is_current)
join public.courses c on c.join_code = 'SDAIA-GENAI-02'
where d.course_id = c.id
  and d.day_number = v.day_number;

-- Materials: wipe + reload from the public course site
delete from public.resources r
using public.courses c
where r.course_id = c.id
  and c.join_code = 'SDAIA-GENAI-02';

insert into public.resources (
  course_id, day_id, title, description, kind, external_url, position, is_published
)
select
  c.id,
  d.id,
  v.title,
  v.description,
  v.kind::public.resource_kind,
  v.external_url,
  v.position,
  true
from public.courses c
join public.course_days d on d.course_id = c.id
join (values
  (1, 0, 'Day 1 slides — From token to typed output', 'Lecture slides for Day 1 (HTML deck).', 'slides',
   'https://mibnrashid.github.io/SDAIA_AppliedGenerativeAI/slides/day1.html#1'),
  (1, 1, 'Day 1 lab — From token to typed output',
   'From a four-line request to schema-validated JSON your code can branch on. Add GEMINI_API_KEY in Colab Secrets.',
   'notebook', 'https://colab.research.google.com/drive/1Fc5SZc8HUu9BFwlW93yVrsnj84Uh0ssn?usp=sharing'),
  (1, 2, 'Activity 1 — Tokenizer Race',
   'Guess how many tokens a sentence costs. Eight rounds, English and Arabic.',
   'link', 'https://mibnrashid.github.io/SDAIA_AppliedGenerativeAI/activities/tokenizer-race.html'),
  (1, 3, 'Google AI Studio — get your API key',
   'Free tier. Create a key, then paste it into Colab Secrets as GEMINI_API_KEY.',
   'link', 'https://aistudio.google.com/'),

  (2, 0, 'Day 2 slides — Retrieval you can measure', 'Lecture slides for Day 2 (HTML deck).', 'slides',
   'https://mibnrashid.github.io/SDAIA_AppliedGenerativeAI/slides/day2.html#1'),
  (2, 1, 'Day 2 lab — Retrieval you can measure',
   'Ingest, vision-read a scanned page, chunk, embed, retrieve — then score it against a golden set.',
   'notebook', 'https://colab.research.google.com/drive/1p_6S_y86gIee2P43_KWKCOJDIbVz9w1b?usp=sharing'),
  (2, 2, 'Activity 2 — Chunk Lab',
   'Place chunk boundaries in a real policy document, then see which questions your chunking can answer.',
   'link', 'https://mibnrashid.github.io/SDAIA_AppliedGenerativeAI/activities/chunk-lab.html'),

  (3, 0, 'Day 3 slides — Tools and agents', 'Lecture slides for Day 3 (HTML deck).', 'slides',
   'https://mibnrashid.github.io/SDAIA_AppliedGenerativeAI/slides/day3.html#1'),
  (3, 1, 'Day 3 lab — Tools and agents',
   'Tool schemas, the round trip by hand, the agent loop, and yesterday’s retriever as a tool.',
   'notebook', 'https://colab.research.google.com/drive/1nLFlmgjZpJrGfe_ppxVYvZST2KI18C0t?usp=sharing'),
  (3, 2, 'Activity 3 — Be the Agent',
   'You play the model. Choose the tool calls, recover from an error, reach the answer.',
   'link', 'https://mibnrashid.github.io/SDAIA_AppliedGenerativeAI/activities/be-the-agent.html'),

  (4, 0, 'Day 4 slides — Production systems',
   'Lecture slides for Day 4 morning: production, cost, latency and observability.',
   'slides', 'https://mibnrashid.github.io/SDAIA_AppliedGenerativeAI/slides/day4.html#1'),
  (4, 1, 'Day 4 lab — Production systems',
   'Hands-on Colab notebook for Day 4 morning: retries, streaming, caching and a numbers table.',
   'notebook', 'https://colab.research.google.com/drive/1zOfbxNJu0zI21AZ-hnUQuAikkb1FvYBU?usp=sharing'),
  (4, 2, 'Activity — Cost Auction',
   'Five deployments in plain language. Estimate the monthly bill, then see the arithmetic.',
   'link', 'https://mibnrashid.github.io/SDAIA_AppliedGenerativeAI/activities/cost-auction.html'),
  (4, 3, 'Day 4 slides — Security and governance',
   'Lecture slides for Day 4 afternoon: prompt injection, red teaming, privacy and governance.',
   'slides', 'https://mibnrashid.github.io/SDAIA_AppliedGenerativeAI/slides/day5.html#1'),
  (4, 4, 'Day 4 lab — Security and governance',
   'Hands-on Colab notebook for Day 4 afternoon: attacks, layered defences, before/after table.',
   'notebook', 'https://colab.research.google.com/drive/1Bc1FRjRYhOdWLwpb_ZcaPnupauEgABfL?usp=sharing'),
  (4, 5, 'Activity — Red Team',
   'Break a document assistant five ways, then turn the defences on and try again.',
   'link', 'https://mibnrashid.github.io/SDAIA_AppliedGenerativeAI/activities/red-team.html'),

  (5, 1, 'Capstone Project Guide',
   'capstone-project · Full project brief and rubric: requirements, scoring (100 points), submission and presentation. Due Thursday 6 August.',
   'link', 'https://mibnrashid.github.io/SDAIA_AppliedGenerativeAI/project/index.html'),
  (5, 2, 'Optional — Project scaffold notebook',
   'capstone-project · Optional reference notebook for the project shape. Build a repository for submission.',
   'notebook', 'https://colab.research.google.com/drive/1YR3LDrZAnftOV1Q04c8B9m1-aiFJNkMV?usp=sharing')
) as v(day_number, position, title, description, kind, external_url)
  on d.day_number = v.day_number
where c.join_code = 'SDAIA-GENAI-02';

update public.assessments a
set title = 'Pre-test',
    description = 'Twenty questions covering the week. Measures the course, not you — zero is a fine score on day one.',
    duration_minutes = 20,
    required_question_count = 20,
    is_published = true
from public.courses c
where a.course_id = c.id
  and c.join_code = 'SDAIA-GENAI-02'
  and a.kind = 'pre';

-- Post-assessment on Day 4 (same placement as course 01)
update public.assessments a
set title = 'Post-assessment',
    description = 'Progress check after the combined Day 4 lectures (production + security). Taken before certification day.',
    duration_minutes = 20,
    required_question_count = 20,
    is_published = true,
    is_locked = true,
    day_id = (
      select d.id from public.course_days d
      where d.course_id = c.id and d.day_number = 4
    )
from public.courses c
where a.course_id = c.id
  and c.join_code = 'SDAIA-GENAI-02'
  and a.kind = 'post';

-- Day 5 quiz renamed to Final exam (certification day)
update public.assessments a
set title = 'Final exam',
    description = 'Final theory exam for the Certification Pass. Sit this on certification day after your capstone presentation and submission. Covers lecture content from the whole week.',
    day_id = (
      select d.id from public.course_days d
      where d.course_id = c.id and d.day_number = 5
    ),
    is_published = false,
    is_locked = true
from public.courses c
where a.course_id = c.id
  and c.join_code = 'SDAIA-GENAI-02'
  and a.kind = 'quiz'
  and a.title in ('Day 5 quiz', 'Final exam');

commit;
