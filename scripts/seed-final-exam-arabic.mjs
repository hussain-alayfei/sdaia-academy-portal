/**
 * Layers the Arabic translation onto the already-seeded final exam.
 *
 * Only ever UPDATEs the `_ar` columns. It never touches a stem, an option body,
 * an answer key or a position, so running it cannot disturb the approved English
 * paper — and unlike the English seed it is safe to run after attempts exist,
 * because it changes nothing that grading depends on.
 *
 * Matching is by authored position (`position + 1` = the number in the approved
 * document), not by text, so it is immune to punctuation drift.
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

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const ar = JSON.parse(
  readFileSync(resolve('docs/assessment-content/final-exam-ar.json'), 'utf8')
)
const en = JSON.parse(
  readFileSync(resolve('docs/assessment-content/final-exam.json'), 'utf8')
)

if (ar.questions.length !== 30) {
  throw new Error(`Expected 30 Arabic questions, found ${ar.questions.length}`)
}

/* ------------------------------------------------- assessment-level text -- */

// Merge the Arabic section text into the existing sections jsonb rather than
// replacing it, so the English layout and use case survive untouched.
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

/* ------------------------------------------------------------- questions -- */

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

  // True/false items take their labels from the shared pair rather than from
  // per-question text, so صح and خطأ read identically across the section.
  const bodies =
    question.format === 'true_false'
      ? ar.true_false_labels
      : (item.options_ar ?? null)

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

/* ----------------------------------------------------------------- verify -- */

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
