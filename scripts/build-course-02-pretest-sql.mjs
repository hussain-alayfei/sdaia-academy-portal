import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const file = JSON.parse(
  readFileSync(
    resolve('docs/assessment-content/course-02-pretest.json'),
    'utf8'
  )
)

const payload = file.questions.map((q) => ({
  format: q.format || 'multiple_choice',
  difficulty: q.difficulty,
  topic: q.topic ?? null,
  stem: q.stem,
  options: q.options,
  correct: q.correct,
  rationale: q.rationale ?? null,
}))

const jsonLiteral = JSON.stringify(payload).replace(/'/g, "''")

const sql = `do $$
declare
  v_admin uuid;
  v_payload jsonb := '${jsonLiteral}'::jsonb;
  v_n int;
begin
  select id into v_admin
  from public.profiles
  where role = 'admin'
  order by created_at
  limit 1;

  if v_admin is null then
    raise exception 'No admin profile found';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_admin,
      'role', 'authenticated',
      'user_role', 'admin'
    )::text,
    true
  );

  select public.import_assessment_questions(
    'b13c9218-ade6-49cc-9dcd-5dd9dc9a6a8c'::uuid,
    v_payload
  ) into v_n;

  select public.import_assessment_questions(
    '5b2c6bd0-2710-4049-a415-d0cabfbeef52'::uuid,
    v_payload
  ) into v_n;
end;
$$;

select a.title,
       (select count(*)::int from assessment_questions q where q.assessment_id = a.id) as questions
from assessments a
where a.id in (
  'b13c9218-ade6-49cc-9dcd-5dd9dc9a6a8c',
  '5b2c6bd0-2710-4049-a415-d0cabfbeef52'
);
`

writeFileSync(resolve('scripts/_import-course-02-pretest.sql'), sql)
console.log('wrote SQL', sql.length, 'chars')
