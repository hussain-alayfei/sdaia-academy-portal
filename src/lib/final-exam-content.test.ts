import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

/**
 * The final exam paper must match the approved document, exactly.
 *
 * The instructor approved a specific 30-question paper. This test re-parses that
 * document and compares it against the JSON we seed, so the two cannot drift:
 * a reworded stem, a dropped option, a mistyped answer key or a re-graded
 * difficulty all fail here rather than in front of a room of students.
 *
 * The only normalisation applied is stripping Markdown code backticks — the
 * source writes `HR-204` and `E-99999` as inline code, and the database stores
 * plain text. Everything else, including curly apostrophes, must match
 * character for character.
 */

const SOURCE = resolve(
  process.cwd(),
  '..',
  'final_exam',
  'developing_generative_ai_solutions_final_approved_exam.md'
)
const SEED = resolve(process.cwd(), 'docs/assessment-content/final-exam.json')

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
  sections: Array<{ n: number; layout: string }>
  instructions: { points: string[] }
}

const markdown = readFileSync(SOURCE, 'utf8')

const arabic = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'docs/assessment-content/final-exam-ar.json'),
    'utf8'
  )
) as {
  instructions_ar: string[]
  true_false_labels: Record<string, string>
  protected_terms: string[]
  sections_ar: Record<string, { title_ar: string; brief_ar: string }>
  questions: Array<{
    n: number
    stem_ar: string
    options_ar?: Record<string, string>
  }>
}

/** Any Arabic letter. Enough to tell a translation from a copied English line. */
const HAS_ARABIC = /[؀-ۿ]/

/** Inline code markers are formatting, not content. */
const clean = (value: string) => value.replace(/`/g, '').trim()

/* ------------------------------------------------------- parse the source -- */

/** Stems and options, taken from the student-facing half of the document. */
function parsePaper(text: string) {
  const studentHalf = text.split('# Instructor Answer Key')[0]
  const lines = studentHalf.split(/\r?\n/)

  const questions = new Map<number, { stem: string; options: Map<string, string> }>()
  let current: number | null = null

  for (const line of lines) {
    const heading = /^###\s+(\d+)\.\s+(.*)$/.exec(line.trim())
    if (heading) {
      current = Number(heading[1])
      questions.set(current, { stem: clean(heading[2]), options: new Map() })
      continue
    }

    if (current === null) continue

    const option = /^([A-D])\.\s+(.*)$/.exec(line.trim())
    if (option) {
      questions.get(current)?.options.set(option[1], clean(option[2]))
    }
  }

  return questions
}

/** The answer, day, topic and difficulty for each question. */
function parseAnswerKey(text: string) {
  const keys = new Map<
    number,
    { answer: string; day: number; difficulty: string }
  >()

  for (const line of text.split(/\r?\n/)) {
    const row =
      /^\|\s*(\d+)\s*\|\s*([A-Za-z]+)\s*\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*(\w+)\s*\|/.exec(
        line.trim()
      )
    if (!row) continue

    const number = Number(row[1])
    if (number < 1 || number > 30 || keys.has(number)) continue

    keys.set(number, {
      answer: row[2],
      day: Number(row[3]),
      difficulty: row[5].toLowerCase(),
    })
  }

  return keys
}

const paper = parsePaper(markdown)
const answerKey = parseAnswerKey(markdown)

/* -------------------------------------------------------------- the tests -- */

test('the source document still parses into 30 questions and 30 keys', () => {
  assert.equal(paper.size, 30, 'expected 30 question headings in the source')
  assert.equal(answerKey.size, 30, 'expected 30 answer-key rows in the source')
})

test('the seed carries exactly the 30 approved questions', () => {
  assert.equal(seed.questions.length, 30)
})

test('every stem matches the approved document word for word', () => {
  for (const [index, question] of seed.questions.entries()) {
    const source = paper.get(index + 1)
    assert.ok(source, `question ${index + 1} missing from the source`)
    assert.equal(
      question.stem,
      source.stem,
      `question ${index + 1} stem differs from the approved paper`
    )
  }
})

test('every multiple-choice option matches the approved document', () => {
  for (const [index, question] of seed.questions.entries()) {
    if (question.format !== 'multiple_choice') continue

    const source = paper.get(index + 1)
    assert.ok(source)
    assert.deepEqual(
      Object.keys(question.options).sort(),
      ['A', 'B', 'C', 'D'],
      `question ${index + 1} should carry four options`
    )

    for (const label of ['A', 'B', 'C', 'D']) {
      assert.equal(
        question.options[label],
        source.options.get(label),
        `question ${index + 1} option ${label} differs from the approved paper`
      )
    }
  }
})

test('true/false items carry only True and False, in that order', () => {
  const trueFalse = seed.questions.filter((q) => q.format === 'true_false')
  assert.equal(trueFalse.length, 5)

  for (const question of trueFalse) {
    assert.deepEqual(question.options, { A: 'True', B: 'False' })
  }
})

test('every answer key matches the instructor key', () => {
  for (const [index, question] of seed.questions.entries()) {
    const key = answerKey.get(index + 1)
    assert.ok(key, `question ${index + 1} has no key row`)

    // The key writes True/False for the true/false items; the paper stores
    // those as option A and option B respectively.
    const expected =
      key.answer === 'True' ? 'A' : key.answer === 'False' ? 'B' : key.answer

    assert.equal(
      question.correct,
      expected,
      `question ${index + 1} answer differs from the instructor key`
    )
  }
})

test('difficulty and day match the instructor key', () => {
  for (const [index, question] of seed.questions.entries()) {
    const key = answerKey.get(index + 1)
    assert.ok(key)
    assert.equal(
      question.difficulty,
      key.difficulty,
      `question ${index + 1} difficulty differs from the key`
    )
    assert.equal(
      question.day,
      key.day,
      `question ${index + 1} day differs from the key`
    )
  }
})

test('the paper is sectioned 20 / 5 / 5', () => {
  const bySection = new Map<number, number>()
  for (const question of seed.questions) {
    bySection.set(question.section, (bySection.get(question.section) ?? 0) + 1)
  }

  assert.deepEqual(
    [...bySection.entries()].sort((a, b) => a[0] - b[0]),
    [
      [1, 20],
      [2, 5],
      [3, 5],
    ]
  )

  // Sections must not interleave: the order in the file is the order sat.
  const order = seed.questions.map((q) => q.section)
  assert.deepEqual(order, [...order].sort((a, b) => a - b))

  // Only the use-case section is a single page, and it is the one with the
  // scenario attached.
  const single = seed.sections.filter((s) => s.layout === 'single_page')
  assert.deepEqual(
    single.map((s) => s.n),
    [3]
  )
})

test('true/false items are exactly Section B', () => {
  for (const question of seed.questions) {
    assert.equal(
      question.format === 'true_false',
      question.section === 2,
      `question "${question.stem}" is in the wrong section for its format`
    )
  }
})

test('the blueprint from the approved review still holds', () => {
  const count = <T extends string | number>(
    pick: (q: SeedQuestion) => T
  ): Record<string, number> => {
    const out: Record<string, number> = {}
    for (const q of seed.questions) out[String(pick(q))] = (out[String(pick(q))] ?? 0) + 1
    return out
  }

  // Revised 6 August 2026: Q4, Q5, Q9 and Q20 were swapped for Temperature,
  // Message roles, Hybrid search, and RAG online flow. Day 1 lost its two
  // medium questions to two easy ones, and Q20's topic moved from Day 4 to
  // Day 2 (RAG online flow is Day 2 content, not production readiness).
  // Originally 15 easy / 10 medium / 5 hard and Day 1=7 / 2=8 / 3=7 / 4=8.
  assert.deepEqual(count((q) => q.difficulty), {
    easy: 17,
    medium: 8,
    hard: 5,
  })

  assert.deepEqual(count((q) => q.day), { 1: 7, 2: 9, 3: 7, 4: 7 })

  // MCQ answers are balanced A = 6, B = 7, C = 6, D = 6.
  const mcqAnswers: Record<string, number> = {}
  for (const q of seed.questions) {
    if (q.format !== 'multiple_choice') continue
    mcqAnswers[q.correct] = (mcqAnswers[q.correct] ?? 0) + 1
  }
  assert.deepEqual(mcqAnswers, { A: 6, B: 7, C: 6, D: 6 })

  // True/false answers are 3 true, 2 false.
  const tfAnswers: Record<string, number> = {}
  for (const q of seed.questions) {
    if (q.format !== 'true_false') continue
    tfAnswers[q.correct] = (tfAnswers[q.correct] ?? 0) + 1
  }
  assert.deepEqual(tfAnswers, { A: 3, B: 2 })
})

test('every question carries a topic and an explanation to release later', () => {
  for (const [index, question] of seed.questions.entries()) {
    assert.ok(
      question.topic.trim().length > 0,
      `question ${index + 1} has no topic`
    )
    assert.ok(
      question.rationale.trim().length > 20,
      `question ${index + 1} has no usable explanation`
    )
  }
})

test('the stems and options are plain text', () => {
  for (const [index, question] of seed.questions.entries()) {
    const parts = [question.stem, ...Object.values(question.options)]
    for (const part of parts) {
      assert.ok(
        !/[\r\n]/.test(part),
        `question ${index + 1} contains a line break`
      )
      assert.equal(part, part.trim(), `question ${index + 1} has stray padding`)
    }
  }
})

test('the student briefing states the rules that actually apply', () => {
  const text = seed.instructions.points.join(' ').toLowerCase()

  assert.ok(text.includes('30 questions'), 'briefing omits the question count')
  assert.ok(text.includes('50 minutes'), 'briefing omits the duration')
  assert.ok(text.includes('one attempt'), 'briefing omits the one-attempt rule')
  assert.ok(text.includes('laptop'), 'briefing omits the laptop advice')
  assert.ok(
    text.includes('not shown') || text.includes('released'),
    'briefing omits that the score is held back'
  )
})

test('the briefing warns about every rule that can freeze the exam', () => {
  const text = seed.instructions.points.join(' ').toLowerCase()

  // A student must not be able to hit a freeze they were never told about.
  assert.ok(text.includes('3 warnings'), 'briefing omits the warning limit')
  assert.ok(text.includes('freeze'), 'briefing omits what happens at the limit')
  assert.ok(text.includes('fullscreen'), 'briefing omits the fullscreen rule')
  assert.ok(
    text.includes('another tab') || text.includes('leaving this page'),
    'briefing omits that leaving the page is recorded'
  )
  assert.ok(
    text.includes('copy') && text.includes('past'),
    'briefing omits that copy and paste are recorded'
  )
  assert.ok(
    text.includes('clock pauses') || text.includes('do not lose'),
    'briefing omits that the clock pauses while frozen'
  )
})

/* ------------------------------------------------------------- Arabic -- */

test('the Arabic layer covers all 30 questions', () => {
  assert.equal(arabic.questions.length, 30)
  assert.deepEqual(
    arabic.questions.map((q) => q.n),
    Array.from({ length: 30 }, (_, i) => i + 1),
    'Arabic questions must be numbered 1..30 in order'
  )
})

test('every Arabic stem is actually written in Arabic', () => {
  for (const question of arabic.questions) {
    assert.ok(
      HAS_ARABIC.test(question.stem_ar),
      `question ${question.n} has no Arabic script in its stem`
    )
  }
})

test('Arabic options exist for every multiple-choice question only', () => {
  for (const [index, english] of seed.questions.entries()) {
    const item = arabic.questions[index]

    if (english.format === 'true_false') {
      // These take the shared صح / خطأ pair so the wording is identical across
      // the section rather than retyped five times.
      assert.equal(
        item.options_ar,
        undefined,
        `question ${item.n} is true/false and must not carry its own options`
      )
      continue
    }

    assert.ok(item.options_ar, `question ${item.n} has no Arabic options`)
    assert.deepEqual(
      Object.keys(item.options_ar).sort(),
      ['A', 'B', 'C', 'D'],
      `question ${item.n} must have Arabic A-D`
    )
  }

  assert.deepEqual(arabic.true_false_labels, { A: 'صح', B: 'خطأ' })
})

test('identifiers survive translation untouched', () => {
  // These appear inside Arabic sentences and must not be transliterated, or the
  // question stops matching the thing it is asking about.
  const find = (n: number) => arabic.questions.find((q) => q.n === n)

  assert.ok(find(8)?.stem_ar.includes('HR-204'), 'Q8 lost HR-204')
  assert.ok(find(15)?.stem_ar.includes('E-99999'), 'Q15 lost E-99999')
  assert.ok(
    find(15)?.options_ar?.A.includes('E-10482'),
    'Q15 option A lost E-10482'
  )
  // The JSON error string is code, not prose.
  assert.ok(
    find(15)?.options_ar?.A.includes('"error"'),
    'Q15 option A lost its JSON error payload'
  )
})

test('technical terms stay in English inside the Arabic paper', () => {
  const all = arabic.questions
    .map((q) => `${q.stem_ar} ${Object.values(q.options_ar ?? {}).join(' ')}`)
    .join(' ')

  // A representative sample of the protected list. If these were translated,
  // the paper would stop matching the slides and the labs.
  for (const term of ['RAG', 'embedding', 'token', 'API', 'agent', 'cache']) {
    assert.ok(
      all.includes(term),
      `"${term}" should appear in English in the Arabic paper`
    )
  }
})

test('the Arabic briefing mirrors the English one', () => {
  assert.equal(
    arabic.instructions_ar.length,
    seed.instructions.points.length,
    'Arabic and English briefings must have the same number of points'
  )

  for (const point of arabic.instructions_ar) {
    assert.ok(HAS_ARABIC.test(point), `briefing point is not in Arabic: ${point}`)
  }

  const text = arabic.instructions_ar.join(' ')
  assert.ok(text.includes('50'), 'Arabic briefing omits the duration')
  assert.ok(text.includes('3'), 'Arabic briefing omits the warning limit')
  assert.ok(text.includes('30'), 'Arabic briefing omits the question count')
})

test('all three sections are translated', () => {
  for (const n of ['1', '2', '3']) {
    const section = arabic.sections_ar[n]
    assert.ok(section, `section ${n} has no Arabic`)
    assert.ok(HAS_ARABIC.test(section.title_ar), `section ${n} title not Arabic`)
    assert.ok(HAS_ARABIC.test(section.brief_ar), `section ${n} brief not Arabic`)
  }
})

test('the briefing states the fullscreen grace window', () => {
  const text = seed.instructions.points.join(' ').toLowerCase()

  // The grace window is the difference between a fair rule and a trap.
  assert.ok(
    text.includes('10 seconds'),
    'briefing omits the fullscreen grace window'
  )
})
