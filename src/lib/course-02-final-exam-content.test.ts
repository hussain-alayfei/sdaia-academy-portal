import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

/**
 * GENAI-02 final exam must match FinalCourse-02.md exactly.
 *
 * The markdown at the workspace root is the instructor paper. This test
 * re-parses it and compares stems, options and answer keys against the JSON we
 * seed, so the two cannot drift. FinalCourse-02.md itself is never edited by
 * the portal tooling.
 */

const SOURCE = resolve(process.cwd(), '..', 'FinalCourse-02.md')
const SEED = resolve(
  process.cwd(),
  'docs/assessment-content/course-02-final-exam.json'
)
const ARABIC = resolve(
  process.cwd(),
  'docs/assessment-content/course-02-final-exam-ar.json'
)

type SeedQuestion = {
  section: number
  day: number
  format: 'multiple_choice' | 'true_false'
  difficulty: 'easy' | 'medium' | 'hard'
  topic: string
  stem: string
  options: Record<string, string>
  correct: string
  rationale: string
}

const seed = JSON.parse(readFileSync(SEED, 'utf8')) as {
  questions: SeedQuestion[]
  sections: Array<{ n: number; layout: string; use_case?: { intro: string } }>
  instructions: { points: string[] }
  duration_minutes: number
}

const markdown = readFileSync(SOURCE, 'utf8')

const arabic = JSON.parse(readFileSync(ARABIC, 'utf8')) as {
  instructions_ar: string[]
  protected_terms: string[]
  sections_ar: Record<string, { title_ar: string; brief_ar: string }>
  questions: Array<{
    n: number
    stem_ar: string
    options_ar?: Record<string, string>
  }>
}

const HAS_ARABIC = /[؀-ۿ]/
const clean = (value: string) => value.replace(/`/g, '').trim()

function parsePaper(text: string) {
  const studentHalf = text.split('## Answer key')[0]
  const lines = studentHalf.split(/\r?\n/)

  const questions = new Map<
    number,
    { stem: string; options: Map<string, string> }
  >()
  let current: number | null = null

  for (const line of lines) {
    const heading = /^\*\*Q(\d+)\.\*\*\s+(.*)$/.exec(line.trim())
    if (heading) {
      current = Number(heading[1])
      questions.set(current, {
        stem: clean(heading[2]),
        options: new Map(),
      })
      continue
    }

    if (current === null) continue

    const option = /^-\s*([a-d]):\s+(.*)$/.exec(line.trim())
    if (option) {
      const body = clean(
        option[2].replace(/\s*←\s*\*\*CORRECT\*\*\s*$/, '')
      )
      questions.get(current)?.options.set(option[1].toUpperCase(), body)
    }
  }

  return questions
}

function parseAnswerKey(text: string) {
  const keys = new Map<number, string>()
  for (const m of text.matchAll(/\|\s*(\d+)\s*\|\s*\*\*([abcd])\*\*/gi)) {
    keys.set(Number(m[1]), m[2].toUpperCase())
  }
  return keys
}

const paper = parsePaper(markdown)
const answers = parseAnswerKey(markdown)

test('the source document still parses into 30 questions and 30 keys', () => {
  assert.equal(paper.size, 30)
  assert.equal(answers.size, 30)
})

test('the seed carries exactly the 30 approved questions', () => {
  assert.equal(seed.questions.length, 30)
  assert.equal(seed.duration_minutes, 50)
})

test('every stem matches the approved document word for word', () => {
  for (const [n, source] of paper) {
    const seeded = seed.questions[n - 1]
    assert.ok(seeded, `seed missing Q${n}`)
    assert.equal(seeded.stem, source.stem, `Q${n} stem drifted`)
  }
})

test('every multiple-choice option matches the approved document', () => {
  for (const [n, source] of paper) {
    const seeded = seed.questions[n - 1]
    assert.equal(seeded.options.A, source.options.get('A'), `Q${n} A`)
    assert.equal(seeded.options.B, source.options.get('B'), `Q${n} B`)
    assert.equal(seeded.options.C, source.options.get('C'), `Q${n} C`)
    assert.equal(seeded.options.D, source.options.get('D'), `Q${n} D`)
  }
})

test('every answer key matches the instructor key', () => {
  for (const [n, letter] of answers) {
    assert.equal(seed.questions[n - 1].correct, letter, `Q${n} key`)
  }
})

test('the paper is sectioned 25 / 5', () => {
  const a = seed.questions.filter((q) => q.section === 1)
  const b = seed.questions.filter((q) => q.section === 2)
  assert.equal(a.length, 25)
  assert.equal(b.length, 5)
  assert.equal(seed.sections.length, 2)
  assert.equal(seed.sections[0].layout, 'one_per_screen')
  assert.equal(seed.sections[1].layout, 'single_page')
  assert.ok(seed.sections[1].use_case?.intro.includes('KFUPM'))
})

test('the student briefing states the rules that actually apply', () => {
  const text = seed.instructions.points.join(' ').toLowerCase()
  assert.ok(text.includes('50 minutes'))
  assert.ok(text.includes('3 warnings') || text.includes('3rd warning'))
  assert.ok(text.includes('25'))
  assert.ok(text.includes('fullscreen'))
  assert.ok(text.includes('score is not shown'))
})

test('the briefing warns about every rule that can freeze the exam', () => {
  const text = seed.instructions.points.join(' ').toLowerCase()
  assert.ok(text.includes('tab') || text.includes('another tab'))
  assert.ok(text.includes('fullscreen'))
  assert.ok(text.includes('copy') || text.includes('paste'))
  assert.ok(text.includes('freeze'))
})

test('the briefing states the fullscreen grace window', () => {
  const text = seed.instructions.points.join(' ').toLowerCase()
  assert.ok(text.includes('10 seconds'))
})

test('every question carries a topic and an explanation to release later', () => {
  for (const [i, q] of seed.questions.entries()) {
    assert.ok(q.topic.trim().length > 0, `Q${i + 1} missing topic`)
    assert.ok(q.rationale.trim().length > 20, `Q${i + 1} missing rationale`)
    assert.ok(q.day >= 1 && q.day <= 5, `Q${i + 1} day out of range`)
  }
})

test('the Arabic layer covers all 30 questions', () => {
  assert.equal(arabic.questions.length, 30)
  assert.equal(arabic.instructions_ar.length, seed.instructions.points.length)
  assert.ok(arabic.sections_ar['1']?.title_ar)
  assert.ok(arabic.sections_ar['2']?.title_ar)
})

test('every Arabic stem is actually written in Arabic', () => {
  for (const item of arabic.questions) {
    assert.ok(HAS_ARABIC.test(item.stem_ar), `Q${item.n} stem is not Arabic`)
    assert.ok(item.options_ar, `Q${item.n} missing options_ar`)
    for (const label of ['A', 'B', 'C', 'D'] as const) {
      const body = item.options_ar?.[label]
      assert.ok(body, `Q${item.n} missing ${label}`)
      assert.ok(HAS_ARABIC.test(body), `Q${item.n} ${label} is not Arabic`)
    }
  }
})

test('identifiers survive translation untouched', () => {
  const joined = JSON.stringify(arabic)
  for (const id of [
    'KFUPM',
    'ICS 202',
    'SDAIA-F-CRS-201-01-V1',
    'get_leave_balance',
  ]) {
    assert.ok(joined.includes(id), `Arabic layer dropped ${id}`)
  }
})

test('technical terms stay in English inside the Arabic paper', () => {
  const joined = arabic.questions.map((q) => q.stem_ar).join(' ')
  for (const term of ['RAG', 'token', 'embedding', 'temperature', 'streaming']) {
    // Not every term appears in every paper; only assert when English has it.
    const englishHas = seed.questions.some(
      (q) =>
        q.stem.toLowerCase().includes(term.toLowerCase()) ||
        Object.values(q.options).some((o) =>
          o.toLowerCase().includes(term.toLowerCase())
        )
    )
    if (englishHas) {
      assert.ok(
        joined.includes(term) ||
          JSON.stringify(arabic.questions).includes(term),
        `expected ${term} to remain in Arabic layer`
      )
    }
  }
})

test('the Arabic briefing mirrors the English one', () => {
  assert.equal(arabic.instructions_ar.length, 8)
  const text = arabic.instructions_ar.join(' ')
  assert.ok(HAS_ARABIC.test(text))
  assert.ok(text.includes('50'))
  assert.ok(text.includes('3'))
})
