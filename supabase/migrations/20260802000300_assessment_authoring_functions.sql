-- Assessment engine, authoring side: import and edit questions atomically.
--
-- A question is three rows in three tables (the question, four options, one
-- answer key). Doing that over PostgREST means three round trips with no
-- transaction around them, so a network blip halfway through a 30-question
-- import would leave a paper with options missing and no key. These two
-- functions make each write all-or-nothing.
--
-- Both refuse to touch an assessment that students have already sat. Editing a
-- key underneath a recorded grade would silently invalidate it, so the
-- instructor is told to reset the attempts first and make that choice openly.

/* ============================================== import_assessment_questions */

create or replace function public.import_assessment_questions(
  p_assessment uuid,
  p_questions  jsonb
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course   uuid;
  v_item     jsonb;
  v_question uuid;
  v_option   uuid;
  v_correct  uuid;
  v_label    text;
  v_position int := 0;
begin
  select course_id into v_course
  from public.assessments
  where id = p_assessment;

  if v_course is null then
    raise exception 'Assessment not found' using errcode = 'P0002';
  end if;

  if not app_private.manages_course(v_course) then
    raise exception 'You do not manage this course' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.assessment_attempts where assessment_id = p_assessment
  ) then
    raise exception
      'Students have already sat this assessment. Reset the attempts before replacing its questions.'
      using errcode = '42501';
  end if;

  -- Import replaces rather than appends, so re-uploading a corrected file does
  -- not leave the old questions behind. Cascades clear the options and keys.
  delete from public.assessment_questions where assessment_id = p_assessment;

  for v_item in select * from jsonb_array_elements(p_questions)
  loop
    insert into public.assessment_questions
      (assessment_id, course_id, position, difficulty, topic, stem)
    values
      (p_assessment, v_course, v_position,
       (v_item ->> 'difficulty')::public.question_difficulty,
       nullif(btrim(coalesce(v_item ->> 'topic', '')), ''),
       v_item ->> 'stem')
    returning id into v_question;

    v_correct := null;

    foreach v_label in array array['A', 'B', 'C', 'D']
    loop
      insert into public.assessment_options
        (question_id, course_id, label, body, position)
      values
        (v_question, v_course, v_label,
         v_item -> 'options' ->> v_label,
         ascii(v_label) - ascii('A'))
      returning id into v_option;

      if v_label = (v_item ->> 'correct') then
        v_correct := v_option;
      end if;
    end loop;

    if v_correct is null then
      raise exception 'Question % does not name a correct option', v_position + 1
        using errcode = '22023';
    end if;

    insert into public.assessment_answer_keys
      (question_id, option_id, course_id, rationale)
    values
      (v_question, v_correct, v_course,
       nullif(btrim(coalesce(v_item ->> 'rationale', '')), ''));

    v_position := v_position + 1;
  end loop;

  return v_position;
end;
$$;

/* ================================================= save_assessment_question */

create or replace function public.save_assessment_question(
  p_assessment  uuid,
  p_question_id uuid,
  p_payload     jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course   uuid;
  v_question uuid := p_question_id;
  v_label    text;
  v_option   uuid;
  v_correct  uuid;
  v_next     int;
begin
  select course_id into v_course
  from public.assessments
  where id = p_assessment;

  if v_course is null then
    raise exception 'Assessment not found' using errcode = 'P0002';
  end if;

  if not app_private.manages_course(v_course) then
    raise exception 'You do not manage this course' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.assessment_attempts where assessment_id = p_assessment
  ) then
    raise exception
      'Students have already sat this assessment. Reset the attempts before editing it.'
      using errcode = '42501';
  end if;

  if v_question is null then
    select coalesce(max(position) + 1, 0) into v_next
    from public.assessment_questions
    where assessment_id = p_assessment;

    insert into public.assessment_questions
      (assessment_id, course_id, position, difficulty, topic, stem)
    values
      (p_assessment, v_course, v_next,
       (p_payload ->> 'difficulty')::public.question_difficulty,
       nullif(btrim(coalesce(p_payload ->> 'topic', '')), ''),
       p_payload ->> 'stem')
    returning id into v_question;
  else
    update public.assessment_questions
       set difficulty = (p_payload ->> 'difficulty')::public.question_difficulty,
           topic      = nullif(btrim(coalesce(p_payload ->> 'topic', '')), ''),
           stem       = p_payload ->> 'stem'
     where id = v_question and assessment_id = p_assessment;

    if not found then
      raise exception 'That question is not part of this assessment'
        using errcode = 'P0002';
    end if;
  end if;

  foreach v_label in array array['A', 'B', 'C', 'D']
  loop
    insert into public.assessment_options
      (question_id, course_id, label, body, position)
    values
      (v_question, v_course, v_label,
       p_payload -> 'options' ->> v_label,
       ascii(v_label) - ascii('A'))
    on conflict (question_id, label) do update
      set body = excluded.body
    returning id into v_option;

    if v_label = (p_payload ->> 'correct') then
      v_correct := v_option;
    end if;
  end loop;

  if v_correct is null then
    raise exception 'No correct option was given' using errcode = '22023';
  end if;

  insert into public.assessment_answer_keys
    (question_id, option_id, course_id, rationale)
  values
    (v_question, v_correct, v_course,
     nullif(btrim(coalesce(p_payload ->> 'rationale', '')), ''))
  on conflict (question_id) do update
    set option_id = excluded.option_id,
        rationale = excluded.rationale;

  return v_question;
end;
$$;

/* =============================================================== grants == */

revoke execute on function public.import_assessment_questions(uuid, jsonb)
  from public, anon;
revoke execute on function public.save_assessment_question(uuid, uuid, jsonb)
  from public, anon;

grant execute on function public.import_assessment_questions(uuid, jsonb)
  to authenticated;
grant execute on function public.save_assessment_question(uuid, uuid, jsonb)
  to authenticated;
