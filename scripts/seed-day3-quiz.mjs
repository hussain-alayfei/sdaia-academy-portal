import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('Missing Supabase env')
  process.exit(1)
}

const assessmentIds = [
  'd6310d15-8fc8-4713-9d8f-cbd24829170c', // course 01
  'dc9a8313-99fd-426a-a41f-61b561348b79', // course 02
]

const questions = JSON.parse(
  readFileSync('docs/assessment-content/day-3-quiz.json', 'utf8')
).questions

if (questions.length !== 10) {
  console.error(`Expected 10 questions, got ${questions.length}`)
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function seedAssessment(assessmentId) {
  const { data: assessment, error: aErr } = await supabase
    .from('assessments')
    .select('id, course_id')
    .eq('id', assessmentId)
    .single()

  if (aErr || !assessment) {
    throw new Error(`assessment ${assessmentId}: ${aErr?.message ?? 'missing'}`)
  }

  const { count: attemptCount, error: attErr } = await supabase
    .from('assessment_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('assessment_id', assessmentId)

  if (attErr) {
    throw new Error(`attempts ${assessmentId}: ${attErr.message}`)
  }
  if ((attemptCount ?? 0) > 0) {
    throw new Error(
      `assessment ${assessmentId} has ${attemptCount} attempts; reset first`
    )
  }

  const { error: updErr } = await supabase
    .from('assessments')
    .update({
      required_question_count: 10,
      duration_minutes: 10,
      is_published: true,
      is_locked: true,
    })
    .eq('id', assessmentId)

  if (updErr) {
    throw new Error(`update ${assessmentId}: ${updErr.message}`)
  }

  const { error: delErr } = await supabase
    .from('assessment_questions')
    .delete()
    .eq('assessment_id', assessmentId)

  if (delErr) {
    throw new Error(`delete ${assessmentId}: ${delErr.message}`)
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
      throw new Error(`question ${position} ${assessmentId}: ${qErr?.message}`)
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
      throw new Error(`options ${position} ${assessmentId}: ${oErr?.message}`)
    }

    const correct = options.find((o) => o.label === q.correct)
    if (!correct) {
      throw new Error(`missing key ${position} ${assessmentId}: ${q.correct}`)
    }

    const { error: kErr } = await supabase.from('assessment_answer_keys').insert({
      question_id: question.id,
      option_id: correct.id,
      course_id: assessment.course_id,
      rationale: q.rationale,
    })

    if (kErr) {
      throw new Error(`key ${position} ${assessmentId}: ${kErr.message}`)
    }

    inserted += 1
  }

  return {
    assessmentId,
    courseId: assessment.course_id,
    inserted,
    published: true,
    locked: true,
  }
}

const results = []
for (const id of assessmentIds) {
  results.push(await seedAssessment(id))
}

console.log(JSON.stringify({ ok: true, results }, null, 2))
