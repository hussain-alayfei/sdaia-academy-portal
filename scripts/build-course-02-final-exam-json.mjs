/**
 * One-shot builder: reads FinalCourse-02.md and writes course-02-final-exam.json.
 * The markdown file is never modified.
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const mdPath = resolve(process.cwd(), '..', 'FinalCourse-02.md')
const outPath = resolve(
  process.cwd(),
  'docs/assessment-content/course-02-final-exam.json'
)

const md = readFileSync(mdPath, 'utf8')
const lines = md.split(/\r?\n/)

const key = new Map()
for (const m of md.matchAll(/\|\s*(\d+)\s*\|\s*\*\*([abcd])\*\*/gi)) {
  key.set(Number(m[1]), m[2].toUpperCase())
}

const dayTopic = new Map()
const daySection =
  md.split('## Where each question comes from')[1]?.split('## Notes')[0] ?? ''
for (const m of daySection.matchAll(/\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([^|]+)\|/g)) {
  dayTopic.set(Number(m[1]), { day: Number(m[2]), topic: m[3].trim() })
}

const questions = []
let current = null
for (const line of lines) {
  const qh = /^\*\*Q(\d+)\.\*\*\s+(.*)$/.exec(line.trim())
  if (qh) {
    current = {
      n: Number(qh[1]),
      stem: qh[2].trim().replace(/`/g, ''),
      options: {},
    }
    questions.push(current)
    continue
  }
  if (!current) continue
  const opt = /^-\s*([a-d]):\s+(.*)$/.exec(line.trim())
  if (opt) {
    const label = opt[1].toUpperCase()
    const body = opt[2]
      .replace(/\s*←\s*\*\*CORRECT\*\*\s*$/, '')
      .trim()
      .replace(/`/g, '')
    current.options[label] = body
  }
}

if (questions.length !== 30) {
  throw new Error(`Expected 30 questions, found ${questions.length}`)
}

const difficultyFor = (day) => (day <= 2 ? 'easy' : 'medium')

const rationales = {
  1: 'Arabic typically uses more tokens than English for the same meaning, so cost rises when the same assistant is launched in Arabic.',
  2: 'When code must read structured fields reliably, a low temperature near 0.0 keeps the same input producing the same output.',
  3: 'The model chooses likely next words; that process does not check whether a policy clause is true.',
  4: 'Fine-tuning mainly teaches style and behaviour, not a trustworthy fact store; retrieval fits an internal procedures manual better.',
  5: 'A response schema constrains the output shape so application code can rely on named keys.',
  6: 'If the heading that carries the query terms is missing from the chunk, meaning-based search may never find that chunk.',
  7: 'Embeddings place text with similar meaning close together, so "vacation days" can match a query for "annual leave".',
  8: 'An opaque document code has little meaning to compare, so meaning-based search often misses the exact identifier.',
  9: 'Raising top-k increases cost and noise: the model must read more text, much of which may be wrong.',
  10: 'Citations need file name and page from the start; adding them later usually means re-ingesting everything.',
  11: 'A tool call request is executed by your application code, which then returns the result to the model.',
  12: 'The model chooses tools from their descriptions, so wrong choices usually start with vague or misleading tool text.',
  13: 'Each agent step resends the growing conversation, so later steps cost more than early ones.',
  14: 'A tool should return a readable error that explains what was wrong and what values are valid.',
  15: 'Agentic RAG lets the model decide whether to search, what to search for, and when to stop.',
  16: 'Streaming does not usually shorten total generation time; it makes the first tokens appear sooner.',
  17: 'Caching and reusing the first answer for an identical question removes most repeated cost.',
  18: 'Immediate retries keep hitting the rate limit and can turn a short pause into an outage.',
  19: 'Input tokens are billed, so putting fewer chunks into each prompt cuts cost most directly.',
  20: 'Showing source and page lets the reader check the claim — that is how trust is decided in government settings.',
  21: 'Indirect prompt injection places the harmful instruction inside a document that the system later retrieves.',
  22: 'Worked examples that show the exact output shape make classification answers machine-readable.',
  23: 'System-prompt rules have no stronger force than user text, so assume instructions can be revealed.',
  24: 'Building the index from documents happens once in advance; retrieval and generation happen per question.',
  25: 'Sending email cannot be undone, so a human approval step matters most.',
  26: 'Without the KFUPM documents, the model has not seen the catalogue and will invent prerequisites.',
  27: 'Registering a student is an action that changes state, so it belongs to a tool rather than retrieval alone.',
  28: 'Changing a real university record needs a confirmation or human approval step before it runs.',
  29: 'Exact course codes need keyword search alongside meaning search so identifiers match.',
  30: 'Trust comes from showing the catalogue page the claim came from so the student can check it.',
}

const out = {
  schema: 'sdaia-assessment/v1',
  kind: 'quiz',
  title: 'Final exam',
  day: 5,
  duration_minutes: 50,
  source: 'FinalCourse-02.md',
  note: 'Applied Generative AI (GENAI-02) theory exam. Stems and options transcribed verbatim from FinalCourse-02.md; CORRECT markers stripped. Drift guarded by course-02-final-exam-content.test.ts.',
  sections: [
    {
      n: 1,
      code: 'A',
      title: 'Section A — Multiple choice',
      brief:
        'Twenty-five standalone questions. Select the single best answer for each one.',
      layout: 'one_per_screen',
    },
    {
      n: 2,
      code: 'B',
      title: 'Section B — Shared scenario',
      brief:
        'Read the KFUPM registration scenario once, then answer all five questions on this page.',
      layout: 'single_page',
      use_case: {
        title: 'The scenario',
        intro:
          'A team at KFUPM is building an assistant to help students register for courses. It has three documents, all ordinary PDF files: the course catalogue, the list of prerequisites for every course, and the university registration rules. Students ask things like "what do I need before taking ICS 202?" and "can I register for two labs in the same term?". The team also wants the assistant to be able to register a student in a course once the student agrees.',
        requirements_title: '',
        requirements: [],
        closing: 'Answer questions 26 to 30 from this scenario.',
      },
    },
  ],
  instructions: {
    heading: 'Read this before you begin',
    points: [
      'This exam has 30 questions in two sections: Section A is 25 multiple-choice questions, and Section B is 5 questions about one shared KFUPM registration scenario.',
      'You have 50 minutes and one attempt. The clock runs on the server, so closing the page does not pause it, and the attempt cannot be reopened once submitted.',
      'Answer every question by choosing one option. Your answers save the moment you pick them.',
      'You may take this exam on a phone, tablet, or computer. Stay on this page for the whole attempt — switching to another app or tab counts as a warning.',
      'On a computer, the exam runs in fullscreen. If you leave fullscreen you have 10 seconds to return before it is recorded. On a phone, fullscreen is not required.',
      'You have 3 warnings. Leaving this page for another tab or app, staying out of fullscreen on a computer, or trying to copy or paste each record one warning.',
      'After the 3rd warning the exam freezes and you cannot answer until an instructor unlocks it. Your clock pauses while you wait, so you lose no exam time. Raise your hand straight away.',
      'Your score is not shown when you submit. Your instructor releases marks and explanations after the exam.',
    ],
  },
  questions: questions.map((q) => {
    const meta = dayTopic.get(q.n) ?? {
      day: 1,
      topic: 'Applied generative AI',
    }
    const correct = key.get(q.n)
    if (!correct) throw new Error(`Missing key for Q${q.n}`)
    if (!q.options[correct]) {
      throw new Error(`Correct option ${correct} missing for Q${q.n}`)
    }
    return {
      section: q.n <= 25 ? 1 : 2,
      day: meta.day,
      format: 'multiple_choice',
      difficulty: difficultyFor(meta.day),
      topic: meta.topic,
      stem: q.stem,
      options: q.options,
      correct,
      rationale: rationales[q.n],
    }
  }),
}

writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8')
console.log(
  JSON.stringify(
    {
      ok: true,
      path: outPath,
      questions: out.questions.length,
      sectionA: out.questions.filter((q) => q.section === 1).length,
      sectionB: out.questions.filter((q) => q.section === 2).length,
      keys: Object.fromEntries([...key.entries()].sort((a, b) => a[0] - b[0])),
    },
    null,
    2
  )
)
