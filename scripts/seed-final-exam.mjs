/**
 * Seeds the GENAI-01 Final exam from the approved paper.
 *
 * Deliberately writes rows directly with the service key rather than going
 * through `import_assessment_questions`. The importer enforces the house
 * authoring rules (difficulty mix, option-length ratios, answer-letter spread,
 * no negative pivots), and the approved paper breaks several of them on
 * purpose. The instructor signed off on that paper, so it is preserved exactly;
 * `final-exam-content.test.ts` is what guards it against drift instead.
 *
 * Safe to re-run *until the first attempt exists*, at which point it refuses.
 */

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

const ASSESSMENT_ID = '4c23ed42-7287-49ef-9e85-02cff925bd92'
const FILE = 'docs/assessment-content/final-exam.json'
const DURATION_MINUTES = 30

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const file = JSON.parse(readFileSync(resolve(FILE), 'utf8'))
const questions = file.questions

if (questions.length !== 30) {
  throw new Error(`Expected 30 questions, found ${questions.length}`)
}

const { data: assessment, error: aErr } = await supabase
  .from('assessments')
  .select('id, course_id, title')
  .eq('id', ASSESSMENT_ID)
  .single()

if (aErr || !assessment) {
  throw new Error(`Final exam not found: ${aErr?.message ?? 'missing'}`)
}

const { count: attemptCount, error: attErr } = await supabase
  .from('assessment_attempts')
  .select('id', { count: 'exact', head: true })
  .eq('assessment_id', ASSESSMENT_ID)

if (attErr) throw new Error(`Attempt check failed: ${attErr.message}`)
if ((attemptCount ?? 0) > 0) {
  throw new Error(
    `Final exam already has ${attemptCount} attempts; refusing to replace the paper.`
  )
}

/* ------------------------------------------------------------- assessment -- */

const { error: updErr } = await supabase
  .from('assessments')
  .update({
    required_question_count: 30,
    duration_minutes: DURATION_MINUTES,
    shuffle: true,
    sections: file.sections,
    instructions: file.instructions.points.join('\n'),
    // Visible on Day 5 so the class can see it exists, but not startable until
    // the instructor unlocks it in the room.
    is_published: true,
    is_locked: true,
    // Nothing scoreable reaches a student until this is flipped from the
    // Results page.
    results_released: false,
  })
  .eq('id', ASSESSMENT_ID)

if (updErr) throw new Error(`Assessment update failed: ${updErr.message}`)

/* -------------------------------------------------------------- questions -- */

const { error: delErr } = await supabase
  .from('assessment_questions')
  .delete()
  .eq('assessment_id', ASSESSMENT_ID)

if (delErr) throw new Error(`Clearing old questions failed: ${delErr.message}`)

let inserted = 0
for (const [position, q] of questions.entries()) {
  const format = q.format ?? 'multiple_choice'
  const labels = format === 'true_false' ? ['A', 'B'] : ['A', 'B', 'C', 'D']

  const { data: question, error: qErr } = await supabase
    .from('assessment_questions')
    .insert({
      assessment_id: ASSESSMENT_ID,
      course_id: assessment.course_id,
      position,
      section: q.section,
      difficulty: q.difficulty,
      topic: q.topic,
      stem: q.stem,
      format,
    })
    .select('id')
    .single()

  if (qErr || !question) {
    throw new Error(`Q${position + 1} insert failed: ${qErr?.message}`)
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
    throw new Error(`Q${position + 1} options failed: ${oErr?.message}`)
  }

  const correct = options.find((o) => o.label === q.correct)
  if (!correct) {
    throw new Error(`Q${position + 1} has no option matching key ${q.correct}`)
  }

  const { error: kErr } = await supabase.from('assessment_answer_keys').insert({
    question_id: question.id,
    option_id: correct.id,
    course_id: assessment.course_id,
    rationale: q.rationale,
  })

  if (kErr) throw new Error(`Q${position + 1} key failed: ${kErr.message}`)
  inserted += 1
}

/* ----------------------------------------------------------------- verify -- */

const { data: written, error: vErr } = await supabase
  .from('assessment_questions')
  .select('id, section, format, answer:assessment_answer_keys(option_id)')
  .eq('assessment_id', ASSESSMENT_ID)

if (vErr) throw new Error(`Verification read failed: ${vErr.message}`)

const bySection = {}
for (const row of written) {
  bySection[row.section] = (bySection[row.section] ?? 0) + 1
}

const missingKeys = written.filter((row) => !row.answer?.option_id).length
if (written.length !== 30 || missingKeys > 0) {
  throw new Error(
    `Verification failed: ${written.length} questions, ${missingKeys} missing keys`
  )
}

/* ------------------------------------------------------------- revalidate -- */

const site = env.NEXT_PUBLIC_SITE_URL || 'https://sdaia-genai-portal.vercel.app'
const secret = env.REVALIDATE_SECRET
let revalidate = null
if (secret) {
  const res = await fetch(`${site}/api/revalidate-course`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ courseId: assessment.course_id }),
  })
  revalidate = { status: res.status, body: await res.text() }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      assessment: assessment.title,
      assessmentId: ASSESSMENT_ID,
      inserted,
      bySection,
      trueFalse: written.filter((r) => r.format === 'true_false').length,
      published: true,
      locked: true,
      resultsReleased: false,
      revalidate,
    },
    null,
    2
  )
)
