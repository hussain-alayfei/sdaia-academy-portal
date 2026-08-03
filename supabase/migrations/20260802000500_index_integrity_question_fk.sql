-- Cover the question foreign key independently. The grading lookup uses the
-- attempt-first composite index; deletes and FK maintenance need question_id
-- as the leading column.
create index assessment_integrity_events_question_idx
  on public.assessment_integrity_events(question_id);
