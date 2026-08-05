/**
 * Layers Arabic onto the GENAI-02 Final exam.
 *
 * Only UPDATEs `_ar` columns. Safe after attempts exist — grading is untouched.
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

const ASSESSMENT_ID = 'f3ec2af7-d5c8-4f4a-96b2-536be25bbf13'

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const ar = JSON.parse(
  readFileSync(
    resolve('docs/assessment-content/course-02-final-exam-ar.json'),
    'utf8'
  )
)
const en = JSON.parse(
  readFileSync(
    resolve('docs/assessment-content/course-02-final-exam.json'),
    'utf8'
  )
)

if (ar.questions.length !== 30) {
  throw new Error(`Expected 30 Arabic questions, found ${ar.questions.length}`)
}

const sections = en.sections.map((section) => {
  const extra = ar.sections_ar[String(section.n)]
  if (!extra) return section

  const merged = {
    ...section,
    title_ar: extra.title_ar,
    brief_ar: extra.brief_ar,
  }

  if (section.use_case && extra.use_case_ar) {
    merged.use_case = {
      ...section.use_case,
      title_ar: extra.use_case_ar.title,
      intro_ar: extra.use_case_ar.intro,
      requirements_title_ar: extra.use_case_ar.requirements_title,
      requirements_ar: extra.use_case_ar.requirements,
      closing_ar: extra.use_case_ar.closing,
    }
  }

  return merged
})

const { error: aErr } = await supabase
  .from('assessments')
  .update({
    sections,
    instructions_ar: ar.instructions_ar.join('\n'),
  })
  .eq('id', ASSESSMENT_ID)

if (aErr) throw new Error(`Assessment update failed: ${aErr.message}`)

const { data: questions, error: qErr } = await supabase
  .from('assessment_questions')
  .select('id, position, format, options:assessment_options(id, label)')
  .eq('assessment_id', ASSESSMENT_ID)
  .order('position')

if (qErr) throw new Error(`Question read failed: ${qErr.message}`)
if (questions.length !== 30) {
  throw new Error(`Expected 30 seeded questions, found ${questions.length}`)
}

const byNumber = new Map(questions.map((q) => [q.position + 1, q]))

let stems = 0
let options = 0

for (const item of ar.questions) {
  const question = byNumber.get(item.n)
  if (!question) throw new Error(`No seeded question at number ${item.n}`)

  const { error } = await supabase
    .from('assessment_questions')
    .update({ stem_ar: item.stem_ar })
    .eq('id', question.id)

  if (error) throw new Error(`Q${item.n} stem_ar failed: ${error.message}`)
  stems += 1

  const bodies = item.options_ar ?? null
  if (!bodies) throw new Error(`Q${item.n} has no Arabic options`)

  for (const option of question.options) {
    const body = bodies[option.label]
    if (!body) throw new Error(`Q${item.n} missing Arabic option ${option.label}`)

    const { error: oErr } = await supabase
      .from('assessment_options')
      .update({ body_ar: body })
      .eq('id', option.id)

    if (oErr) {
      throw new Error(`Q${item.n} option ${option.label}: ${oErr.message}`)
    }
    options += 1
  }
}

const { data: check } = await supabase
  .from('assessment_questions')
  .select('id, stem_ar, options:assessment_options(body_ar)')
  .eq('assessment_id', ASSESSMENT_ID)

const missingStems = check.filter((q) => !q.stem_ar).length
const missingOptions = check.reduce(
  (n, q) => n + q.options.filter((o) => !o.body_ar).length,
  0
)

if (missingStems > 0 || missingOptions > 0) {
  throw new Error(
    `Verification failed: ${missingStems} stems and ${missingOptions} options still missing Arabic`
  )
}

console.log(
  JSON.stringify(
    {
      ok: true,
      stems,
      options,
      instructionPoints: ar.instructions_ar.length,
      sectionsTranslated: Object.keys(ar.sections_ar).length,
      note: 'English untouched. Rationales remain English until translated.',
    },
    null,
    2
  )
)
