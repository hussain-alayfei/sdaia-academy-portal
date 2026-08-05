/**
 * Sectioned papers.
 *
 * A paper may be split into ordered sections — for the final exam, twenty
 * multiple-choice questions, five true/false statements, and five questions
 * hanging off one shared use case. `start_attempt` shuffles *within* a section,
 * so the running order always reads A then B then C while no two students meet
 * the questions in the same order.
 *
 * Everything here is pure and knows nothing about React or Supabase: the paging
 * decision is the part worth testing, and it should be testable without either.
 */

export type ExamUseCase = {
  title: string
  intro: string
  requirementsTitle: string | null
  requirements: string[]
  closing: string | null
  /** Arabic variants. Any missing field falls back to its English counterpart. */
  titleAr: string | null
  introAr: string | null
  requirementsTitleAr: string | null
  requirementsAr: string[]
  closingAr: string | null
}

export type ExamSectionLayout = 'one_per_screen' | 'single_page'

export type ExamSection = {
  n: number
  code: string | null
  title: string
  brief: string | null
  layout: ExamSectionLayout
  useCase: ExamUseCase | null
  titleAr: string | null
  briefAr: string | null
}

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null

function readUseCase(value: unknown): ExamUseCase | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>

  const intro = asString(raw.intro)
  if (!intro) return null

  const strings = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : []

  return {
    title: asString(raw.title) ?? 'The use case',
    intro,
    requirementsTitle: asString(raw.requirements_title),
    requirements: strings(raw.requirements),
    closing: asString(raw.closing),
    titleAr: asString(raw.title_ar),
    introAr: asString(raw.intro_ar),
    requirementsTitleAr: asString(raw.requirements_title_ar),
    requirementsAr: strings(raw.requirements_ar),
    closingAr: asString(raw.closing_ar),
  }
}

/**
 * Narrow the `assessments.sections` jsonb into the shape it was written as.
 *
 * Anything malformed drops out rather than throwing. A paper whose section
 * metadata is unreadable still runs — it just runs as one plain section, which
 * is the behaviour every assessment had before sections existed.
 */
export function readExamSections(value: unknown): ExamSection[] {
  if (!Array.isArray(value)) return []

  return value
    .flatMap((entry): ExamSection[] => {
      if (!entry || typeof entry !== 'object') return []
      const raw = entry as Record<string, unknown>

      const n = typeof raw.n === 'number' ? raw.n : null
      const title = asString(raw.title)
      if (n === null || !title) return []

      return [
        {
          n,
          code: asString(raw.code),
          title,
          brief: asString(raw.brief),
          layout: raw.layout === 'single_page' ? 'single_page' : 'one_per_screen',
          useCase: readUseCase(raw.use_case),
          titleAr: asString(raw.title_ar),
          briefAr: asString(raw.brief_ar),
        },
      ]
    })
    .sort((a, b) => a.n - b.n)
}

/**
 * One screen of the runner.
 *
 * `questions` holds indexes into the paper array rather than the questions
 * themselves, so the runner keeps a single source of truth for answer state and
 * this module stays free of the question shape.
 */
export type ExamPage = {
  /** Stable key for React, derived from the section and the first question. */
  key: string
  section: ExamSection | null
  /** Indexes into the paper array, in the order they should be shown. */
  questions: number[]
  /** True when this page opens a new section, so the header can announce it. */
  opensSection: boolean
}

/**
 * Turn a section-ordered paper into the pages a student walks through.
 *
 * A `single_page` section becomes one screen holding all of its questions —
 * that is what puts the use case and Questions 26 to 30 in front of the student
 * together, instead of making them re-read the scenario five times. Every other
 * section keeps the proven one-question-per-screen flow.
 *
 * The paper is assumed to already be grouped by section, which `start_attempt`
 * guarantees. Should a section ever appear twice, each run becomes its own set
 * of pages rather than being silently merged.
 */
export function buildExamPages(
  questions: ReadonlyArray<{ section: number }>,
  sections: ReadonlyArray<ExamSection>
): ExamPage[] {
  const byNumber = new Map(sections.map((section) => [section.n, section]))
  const pages: ExamPage[] = []

  let index = 0
  while (index < questions.length) {
    const sectionNumber = questions[index].section
    const section = byNumber.get(sectionNumber) ?? null

    // How far this run of the same section extends.
    let end = index
    while (end < questions.length && questions[end].section === sectionNumber) {
      end += 1
    }

    if (section?.layout === 'single_page') {
      const group: number[] = []
      for (let i = index; i < end; i += 1) group.push(i)
      pages.push({
        key: `s${sectionNumber}-p${index}`,
        section,
        questions: group,
        opensSection: true,
      })
    } else {
      for (let i = index; i < end; i += 1) {
        pages.push({
          key: `s${sectionNumber}-q${i}`,
          section,
          questions: [i],
          opensSection: i === index,
        })
      }
    }

    index = end
  }

  return pages
}

/** The page holding a given question, for the navigator. */
export function pageOfQuestion(pages: ReadonlyArray<ExamPage>, question: number): number {
  const found = pages.findIndex((page) => page.questions.includes(question))
  return found === -1 ? 0 : found
}
