import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=')
      const key = line.slice(0, i).trim()
      let value = line.slice(i + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      return [key, value]
    })
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing Supabase URL or secret key in .env.local')
  process.exit(1)
}

const targets = [
  {
    id: '55b9b82d-4167-420c-a7d4-8cac50c23b93',
    name: 'Day 4 quiz',
    file: 'docs/assessment-content/day-4-quiz.json',
    required_question_count: 10,
    duration_minutes: 10,
  },
  {
    id: 'e296ee95-0458-4d9a-8870-58160021e8a4',
    name: 'Post-assessment',
    file: 'docs/assessment-content/post-assessment-days-1-4.json',
    required_question_count: 20,
    duration_minutes: 20,
  },
]

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function seedAssessment(target) {
  const file = JSON.parse(readFileSync(resolve(target.file), 'utf8'))
  const questions = file.questions

  if (questions.length !== target.required_question_count) {
    throw new Error(
      `${target.name}: expected ${target.required_question_count} questions, got ${questions.length}`
    )
  }

  const { data: assessment, error: aErr } = await supabase
    .from('assessments')
    .select('id, course_id')
    .eq('id', target.id)
    .single()

  if (aErr || !assessment) {
    throw new Error(`${target.name}: ${aErr?.message ?? 'missing'}`)
  }

  const { count: attemptCount, error: attErr } = await supabase
    .from('assessment_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('assessment_id', target.id)

  if (attErr) throw new Error(`${target.name} attempts: ${attErr.message}`)
  if ((attemptCount ?? 0) > 0) {
    throw new Error(
      `${target.name} has ${attemptCount} attempts; refuse to replace`
    )
  }

  const { error: updErr } = await supabase
    .from('assessments')
    .update({
      required_question_count: target.required_question_count,
      duration_minutes: target.duration_minutes,
      is_published: true,
      is_locked: true,
    })
    .eq('id', target.id)

  if (updErr) throw new Error(`${target.name} update: ${updErr.message}`)

  const { error: delErr } = await supabase
    .from('assessment_questions')
    .delete()
    .eq('assessment_id', target.id)

  if (delErr) throw new Error(`${target.name} delete: ${delErr.message}`)

  let inserted = 0
  for (const [position, q] of questions.entries()) {
    const format = q.format ?? 'multiple_choice'
    const labels = format === 'true_false' ? ['A', 'B'] : ['A', 'B', 'C', 'D']

    const { data: question, error: qErr } = await supabase
      .from('assessment_questions')
      .insert({
        assessment_id: target.id,
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
      throw new Error(`${target.name} Q${position}: ${qErr?.message}`)
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
      throw new Error(`${target.name} options ${position}: ${oErr?.message}`)
    }

    const correct = options.find((o) => o.label === q.correct)
    if (!correct) {
      throw new Error(`${target.name} missing key ${position}: ${q.correct}`)
    }

    const { error: kErr } = await supabase.from('assessment_answer_keys').insert({
      question_id: question.id,
      option_id: correct.id,
      course_id: assessment.course_id,
      rationale: q.rationale,
    })

    if (kErr) throw new Error(`${target.name} key ${position}: ${kErr.message}`)
    inserted += 1
  }

  return {
    assessmentId: target.id,
    name: target.name,
    courseId: assessment.course_id,
    inserted,
    published: true,
    locked: true,
  }
}

const results = []
for (const target of targets) {
  results.push(await seedAssessment(target))
}

const site = env.NEXT_PUBLIC_SITE_URL || 'https://sdaia-genai-portal.vercel.app'
const secret = env.REVALIDATE_SECRET
let revalidate = null
if (secret) {
  const courseId = results[0]?.courseId
  const res = await fetch(`${site}/api/revalidate-course`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ courseId }),
  })
  revalidate = { status: res.status, body: await res.text() }
}

console.log(JSON.stringify({ ok: true, results, revalidate }, null, 2))
