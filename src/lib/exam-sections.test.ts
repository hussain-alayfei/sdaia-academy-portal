import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildExamPages,
  pageOfQuestion,
  readExamSections,
  type ExamSection,
} from './exam-sections'

/**
 * The paging rules for a sectioned paper.
 *
 * The thing worth protecting here is the shape of the final exam: twenty
 * screens, then five screens, then one screen carrying the use case and its
 * five questions. Getting that wrong would either bury the scenario or split it
 * away from the questions that depend on it.
 */

const sections: ExamSection[] = [
  {
    n: 1,
    code: 'A',
    title: 'Section A',
    brief: null,
    layout: 'one_per_screen',
    useCase: null,
  },
  {
    n: 2,
    code: 'B',
    title: 'Section B',
    brief: null,
    layout: 'one_per_screen',
    useCase: null,
  },
  {
    n: 3,
    code: 'C',
    title: 'Section C',
    brief: null,
    layout: 'single_page',
    useCase: null,
  },
]

/** A paper shaped like the real one: 20 + 5 + 5. */
const paper = [
  ...Array.from({ length: 20 }, () => ({ section: 1 })),
  ...Array.from({ length: 5 }, () => ({ section: 2 })),
  ...Array.from({ length: 5 }, () => ({ section: 3 })),
]

test('the final exam pages as 20 + 5 + 1', () => {
  const pages = buildExamPages(paper, sections)

  assert.equal(pages.length, 26)
  assert.equal(pages[0].questions.length, 1)
  assert.equal(pages[24].questions.length, 1)

  // The single_page section arrives whole.
  assert.deepEqual(pages[25].questions, [25, 26, 27, 28, 29])
  assert.equal(pages[25].section?.n, 3)
})

test('every question appears exactly once across the pages', () => {
  const pages = buildExamPages(paper, sections)
  const seen = pages.flatMap((page) => page.questions)

  assert.equal(seen.length, paper.length)
  assert.deepEqual([...seen].sort((a, b) => a - b), [...seen])
  assert.equal(new Set(seen).size, paper.length)
})

test('a section is announced once, on the page that opens it', () => {
  const pages = buildExamPages(paper, sections)
  const opensBySection = new Map<number, number>()

  for (const page of pages) {
    if (!page.opensSection || !page.section) continue
    opensBySection.set(
      page.section.n,
      (opensBySection.get(page.section.n) ?? 0) + 1
    )
  }

  assert.deepEqual([...opensBySection.entries()], [
    [1, 1],
    [2, 1],
    [3, 1],
  ])
})

test('a paper with no section metadata stays one question per screen', () => {
  const pages = buildExamPages(paper, [])

  assert.equal(pages.length, 30)
  assert.ok(pages.every((page) => page.questions.length === 1))
  assert.ok(pages.every((page) => page.section === null))
})

test('pageOfQuestion finds the page holding a question', () => {
  const pages = buildExamPages(paper, sections)

  assert.equal(pageOfQuestion(pages, 0), 0)
  assert.equal(pageOfQuestion(pages, 19), 19)
  assert.equal(pageOfQuestion(pages, 24), 24)

  // Everything in the single page section lands on the same screen.
  for (const q of [25, 26, 27, 28, 29]) {
    assert.equal(pageOfQuestion(pages, q), 25)
  }

  // A question that is not in the paper falls back to the first page rather
  // than stranding the runner on undefined.
  assert.equal(pageOfQuestion(pages, 999), 0)
})

test('readExamSections narrows the stored jsonb and sorts by number', () => {
  const parsed = readExamSections([
    { n: 3, code: 'C', title: 'Section C', layout: 'single_page' },
    { n: 1, code: 'A', title: 'Section A' },
  ])

  assert.deepEqual(
    parsed.map((s) => s.n),
    [1, 3]
  )
  // Anything not explicitly single_page keeps the safe default.
  assert.equal(parsed[0].layout, 'one_per_screen')
  assert.equal(parsed[1].layout, 'single_page')
})

test('readExamSections drops malformed entries instead of throwing', () => {
  assert.deepEqual(readExamSections(null), [])
  assert.deepEqual(readExamSections('nonsense'), [])
  assert.deepEqual(readExamSections([{ n: 1 }, { title: 'no number' }, 7]), [])
})

test('readExamSections reads a use case only when it has an intro', () => {
  const [withCase] = readExamSections([
    {
      n: 3,
      title: 'Section C',
      use_case: {
        title: 'The use case',
        intro: 'An organisation has 200 policy documents.',
        requirements_title: 'The system must:',
        requirements: ['Answer from current approved documents', 42],
        closing: 'They get harder.',
      },
    },
  ])

  assert.equal(withCase.useCase?.intro, 'An organisation has 200 policy documents.')
  // Non-string requirements are dropped rather than rendered as "42".
  assert.deepEqual(withCase.useCase?.requirements, [
    'Answer from current approved documents',
  ])

  const [withoutCase] = readExamSections([
    { n: 3, title: 'Section C', use_case: { title: 'Missing the intro' } },
  ])
  assert.equal(withoutCase.useCase, null)
})
