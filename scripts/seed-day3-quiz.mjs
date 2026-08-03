import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('Missing Supabase env')
  process.exit(1)
}

const assessmentId = 'd6310d15-8fc8-4713-9d8f-cbd24829170c'
const questions = JSON.parse(
  readFileSync('docs/assessment-content/day-3-quiz.json', 'utf8')
).questions

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: assessment, error: aErr } = await supabase
  .from('assessments')
  .select('id, course_id')
  .eq('id', assessmentId)
  .single()

if (aErr || !assessment) {
  console.error('assessment', aErr)
  process.exit(1)
}

const { error: updErr } = await supabase
  .from('assessments')
  .update({
    required_question_count: 17,
    is_published: true,
    is_locked: true,
  })
  .eq('id', assessmentId)

if (updErr) {
  console.error('update assessment', updErr)
  process.exit(1)
}

const { error: delErr } = await supabase
  .from('assessment_questions')
  .delete()
  .eq('assessment_id', assessmentId)

if (delErr) {
  console.error('delete questions', delErr)
  process.exit(1)
}

let inserted = 0
for (const [position, q] of questions.entries()) {
  const format = q.format ?? 'multiple_choice'
  const labels = format === 'true_false' ? ['A', 'B'] : ['A', 'B', 'C', 'D']

  const { data: question, error: qErr } = await supabase
    .from('assessment_questions')
    .insert({
      assessment_id: assessmentId,
      course_id: assessment.course_id,
      position,
      difficulty: q.difficulty,
      topic: q.topic,
      stem: q.stem,
      format,
    })
    .select('id')
    .single()

  if (qErr || !question) {
    console.error('question', position, qErr)
    process.exit(1)
  }

  const optionRows = labels.map((label, i) => ({
    question_id: question.id,
    course_id: assessment.course_id,
    label,
    body: q.options[label],
    position: i,
  }))

  const { data: options, error: oErr } = await supabase
    .from('assessment_options')
    .insert(optionRows)
    .select('id, label')

  if (oErr || !options) {
    console.error('options', position, oErr)
    process.exit(1)
  }

  const correct = options.find((o) => o.label === q.correct)
  if (!correct) {
    console.error('missing key', position, q.correct)
    process.exit(1)
  }

  const { error: kErr } = await supabase.from('assessment_answer_keys').insert({
    question_id: question.id,
    option_id: correct.id,
    course_id: assessment.course_id,
    rationale: q.rationale,
  })

  if (kErr) {
    console.error('key', position, kErr)
    process.exit(1)
  }

  inserted += 1
}

console.log(
  JSON.stringify({
    ok: true,
    inserted,
    assessmentId,
    courseId: assessment.course_id,
  })
)
