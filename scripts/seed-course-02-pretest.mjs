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

const file = JSON.parse(
  readFileSync(
    resolve('docs/assessment-content/course-02-pretest.json'),
    'utf8'
  )
)

const targets = [
  { id: 'b13c9218-ade6-49cc-9dcd-5dd9dc9a6a8c', name: 'Pre-test' },
  { id: '5b2c6bd0-2710-4049-a415-d0cabfbeef52', name: 'Post-test' },
]

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function seedAssessment(assessmentId, name) {
  const { data: assessment, error: aErr } = await supabase
    .from('assessments')
    .select('id, course_id')
    .eq('id', assessmentId)
    .single()

  if (aErr || !assessment) {
    throw new Error(`${name}: ${aErr?.message ?? 'missing'}`)
  }

  const { count, error: countErr } = await supabase
    .from('assessment_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('assessment_id', assessmentId)

  if (countErr) throw new Error(`${name} attempts: ${countErr.message}`)
  if ((count ?? 0) > 0) {
    throw new Error(`${name} has ${count} attempts; refuse to replace`)
  }

  const { error: delErr } = await supabase
    .from('assessment_questions')
    .delete()
    .eq('assessment_id', assessmentId)

  if (delErr) throw new Error(`${name} delete: ${delErr.message}`)

  let inserted = 0
  for (const [position, q] of file.questions.entries()) {
    const { data: question, error: qErr } = await supabase
      .from('assessment_questions')
      .insert({
        assessment_id: assessmentId,
        course_id: assessment.course_id,
        position,
        difficulty: q.difficulty,
        topic: q.topic,
        stem: q.stem,
        format: 'multiple_choice',
      })
      .select('id')
      .single()

    if (qErr || !question) {
      throw new Error(`${name} Q${position}: ${qErr?.message}`)
    }

    const optionRows = ['A', 'B', 'C', 'D'].map((label, i) => ({
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
      throw new Error(`${name} options ${position}: ${oErr?.message}`)
    }

    const correct = options.find((o) => o.label === q.correct)
    if (!correct) throw new Error(`${name} missing key ${position}`)

    const { error: kErr } = await supabase.from('assessment_answer_keys').insert({
      question_id: question.id,
      option_id: correct.id,
      course_id: assessment.course_id,
      rationale: q.rationale,
    })

    if (kErr) throw new Error(`${name} key ${position}: ${kErr.message}`)
    inserted += 1
  }

  console.log(name, 'inserted', inserted)
  return inserted
}

for (const t of targets) {
  await seedAssessment(t.id, t.name)
}

const site = env.NEXT_PUBLIC_SITE_URL || 'https://sdaia-genai-portal.vercel.app'
const secret = env.REVALIDATE_SECRET
if (secret) {
  const res = await fetch(`${site}/api/revalidate-course`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      courseId: 'b774a21a-53c4-4eee-b24e-1d82598ccce8',
    }),
  })
  console.log('revalidate', res.status, await res.text())
} else {
  console.log('no REVALIDATE_SECRET')
}
