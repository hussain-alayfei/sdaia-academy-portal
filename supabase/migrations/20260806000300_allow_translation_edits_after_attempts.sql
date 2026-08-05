-- Let translations be added to a paper students have already sat.
--
-- The guard exists so nobody can move the ground under an attempt that is
-- already graded or in flight. Adding an Arabic string cannot do that: grading
-- compares `selected_option_id` against the answer key, never text, and the
-- attempt's own question order is a frozen snapshot of ids. So a change that
-- touches *only* the `_ar` columns is safe, while every column the paper is
-- actually made of stays locked exactly as before.
--
-- The comparison is a jsonb diff with the translation key subtracted from both
-- sides. An earlier attempt at this compared whole composite row variables with
-- `IS NOT DISTINCT FROM`; that evaluated true for every update and silently
-- exempted the entire guard. The jsonb form is also allow-listed by
-- construction: a column added to these tables later is included in the
-- comparison automatically and therefore blocked, which is the safe direction
-- to fail.
--
-- Verified against a paper with live attempts: English stem, English option,
-- reorder, difficulty, answer-key move, English rationale, delete, insert and
-- any mixed Arabic+English edit are all still blocked; Arabic-only edits pass.

create or replace function app_private.guard_assessment_content_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assessment     uuid;
  v_old_assessment uuid;
begin
  if tg_op = 'UPDATE' then
    if tg_table_name = 'assessment_questions' then
      if (to_jsonb(new) - 'stem_ar' - 'updated_at')
         = (to_jsonb(old) - 'stem_ar' - 'updated_at') then
        return new;
      end if;

    elsif tg_table_name = 'assessment_options' then
      if (to_jsonb(new) - 'body_ar') = (to_jsonb(old) - 'body_ar') then
        return new;
      end if;

    elsif tg_table_name = 'assessment_answer_keys' then
      if (to_jsonb(new) - 'rationale_ar' - 'updated_at')
         = (to_jsonb(old) - 'rationale_ar' - 'updated_at') then
        return new;
      end if;
    end if;
  end if;

  if tg_table_name = 'assessment_questions' then
    v_assessment := case
      when tg_op = 'DELETE' then old.assessment_id
      else new.assessment_id
    end;
    if tg_op = 'UPDATE' then
      v_old_assessment := old.assessment_id;
    end if;
  else
    select assessment_id into v_assessment
    from public.assessment_questions
    where id = case
      when tg_op = 'DELETE' then old.question_id
      else new.question_id
    end;

    if tg_op = 'UPDATE' then
      select assessment_id into v_old_assessment
      from public.assessment_questions
      where id = old.question_id;
    end if;
  end if;

  if exists (
    select 1
    from public.assessment_attempts
    where assessment_id = v_assessment
       or assessment_id = v_old_assessment
  ) then
    raise exception
      'Students have already sat this assessment. Reset attempts before editing its questions.'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
