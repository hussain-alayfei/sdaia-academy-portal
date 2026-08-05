-- Arabic alongside English, for papers that need to be sat in either language.
--
-- English stays the source of truth. Every Arabic column is nullable and the
-- application falls back to English when one is missing, so a half-translated
-- paper degrades to a readable English paper rather than to blank questions.
--
-- The language a student picks is deliberately NOT stored here. It lives in the
-- browser, so switching mid-exam is instant and can never fail against the
-- database while the clock is running.

alter table public.assessment_questions
  add column if not exists stem_ar text;

alter table public.assessment_options
  add column if not exists body_ar text;

alter table public.assessment_answer_keys
  add column if not exists rationale_ar text;

alter table public.assessments
  add column if not exists instructions_ar text;

comment on column public.assessment_questions.stem_ar is
  'Arabic stem. Null falls back to the English stem.';
comment on column public.assessment_options.body_ar is
  'Arabic option body. Null falls back to the English body.';
comment on column public.assessment_answer_keys.rationale_ar is
  'Arabic explanation, shown on the review screen once results are released.';
comment on column public.assessments.instructions_ar is
  'Arabic briefing, one point per line, mirroring instructions.';
