import { z } from 'zod'

import { MAX_COURSE_DAYS } from '@/lib/course'
import type { AssessmentKind, QuestionDifficulty } from '@/lib/types'

/**
 * The upload contract between the authoring LLM and the portal.
 *
 * `public/assessment-authoring-prompt.md` is the human half of this file: it
 * tells the model what to produce, and everything it promises is enforced here.
 * If you change one, change the other.
 *
 * Two tiers of feedback on purpose. **Errors** are objective violations of the
 * authoring contract and block the import. **Warnings** are heuristics that are
 * useful to a human reviewer but too subjective to reject automatically.
 */

export const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const
export type OptionLabel = (typeof OPTION_LABELS)[number]

/** How many questions each kind is meant to carry. */
export const QUESTION_COUNTS: Record<AssessmentKind, number> = {
  pre: 20,
  quiz: 10,
  post: 30,
}

/** Target spread of difficulty, keyed by kind. Sums to QUESTION_COUNTS. */
export const DIFFICULTY_MIX: Record<
  AssessmentKind,
  Record<QuestionDifficulty, number>
> = {
  pre: { easy: 6, medium: 9, hard: 5 },
  quiz: { easy: 3, medium: 5, hard: 2 },
  post: { easy: 9, medium: 13, hard: 8 },
}

/** Default minutes on the clock, keyed by kind. */
export const DEFAULT_DURATIONS: Record<AssessmentKind, number> = {
  pre: 20,
  quiz: 10,
  post: 30,
}

/* ------------------------------------------------------------- the schema -- */

const MARKUP = /```|<\/?[a-z][^>]*>|!\[[^\]]*\]\([^)]*\)|\[[^\]]+\]\([^)]*\)/i

function plainText(
  minimum: number,
  maximum: number,
  messages: { short: string; long: string }
) {
  return z
    .string()
    .trim()
    .min(minimum, messages.short)
    .max(maximum, messages.long)
    .refine((value) => !/[\r\n]/.test(value), 'Use one line of plain text.')
    .refine(
      (value) => !MARKUP.test(value),
      'Use plain text without Markdown or HTML.'
    )
}

const OptionText = plainText(1, 400, {
  short: 'An option cannot be empty.',
  long: 'Options must be under 400 characters.',
})

const TopicText = plainText(3, 80, {
  short: 'A topic cannot be empty.',
  long: 'Topics must be under 80 characters.',
}).refine(
  (value) => value.split(/\s+/).length >= 2 && value.split(/\s+/).length <= 4,
  'A topic must contain two to four words.'
)

const QuestionSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']),
  topic: TopicText,
  stem: plainText(15, 1200, {
    short: 'A stem that short cannot be a self-contained question.',
    long: 'Stems must be under 1200 characters.',
  }),
  options: z
    .object({
      A: OptionText,
      B: OptionText,
      C: OptionText,
      D: OptionText,
    })
    .strict(),
  correct: z.enum(OPTION_LABELS),
  rationale: plainText(10, 1200, {
    short: 'A rationale must explain why the answer is correct.',
    long: 'Rationales must be under 1200 characters.',
  }),
}).strict()

export const AssessmentFileSchema = z.object({
  schema: z.literal(
    'sdaia-assessment/v1',
    'The file must declare "schema": "sdaia-assessment/v1".'
  ),
  assessment: z
    .object({
      kind: z.enum(['pre', 'post', 'quiz']),
      day: z.coerce.number().int().min(1).max(MAX_COURSE_DAYS),
      title: plainText(2, 120, {
        short: 'The assessment title is too short.',
        long: 'The assessment title must be under 120 characters.',
      }),
      duration_minutes: z.coerce.number().int().min(1).max(300),
    })
    .strict(),
  questions: z
    .array(QuestionSchema)
    .min(1, 'The file contains no questions.')
    .max(200, 'That is more questions than one assessment should hold.'),
}).strict()

export type AssessmentFile = z.infer<typeof AssessmentFileSchema>
export type ParsedQuestion = AssessmentFile['questions'][number]

/* ------------------------------------------------------------ extraction -- */

/**
 * Pull the JSON out of whatever the instructor pasted or uploaded.
 *
 * The authoring brief asks the model for one fenced block, and models usually
 * add a line of preamble regardless of instructions, so accept three shapes: a
 * raw `.json` file, a `.md` file with a fenced block, and pasted text with prose
 * either side of the block.
 */
export function extractJson(raw: string): string {
  // Strip a UTF-8 BOM; Windows editors add one and JSON.parse chokes on it.
  const text = raw.replace(/^\uFEFF/, '').trim()

  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)\n?```/i)
  if (fenced?.[1]) return fenced[1].trim()

  // No fence: take from the first brace to the last, so surrounding chatter in a
  // pasted reply does not break the parse.
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first !== -1 && last > first) return text.slice(first, last + 1)

  return text
}

/* ------------------------------------------------------------ validation -- */

export type ValidationReport = {
  errors: string[]
  warnings: string[]
}

const BANNED_OPTION_PATTERNS: Array<[RegExp, string]> = [
  [/\ball of the above\b/i, '"all of the above"'],
  [/\bnone of the above\b/i, '"none of the above"'],
  [/\bboth [a-d] and [a-d]\b/i, 'a "both A and B" style option'],
  [/\b[a-d] and [a-d] only\b/i, 'an "A and C only" style option'],
]

const CONTEXT_REFERENCE = /\b(lecture|slide|diagram|figure|the image|as we saw|shown above|above table)\b/i

const NEGATIVE_PIVOT = /\b(not|except|false|incorrect)\b/i

const VAGUE_OR_ABSOLUTE = /\b(always|never|may be|is associated with|is useful for)\b/i

const STATEMENT_STYLE = /^which statement\b/i

/** Longest option may exceed the shortest by this factor before it is a tell. */
const LENGTH_RATIO_LIMIT = 1.35

/** No single letter should hold more than this share of the answer key. */
const KEY_SHARE_LIMIT = 0.3

/** Below this many questions the key-spread maths is meaningless. */
const MIN_FOR_KEY_SPREAD = 8

const ANSWER_KEY_RANGES: Record<AssessmentKind, { min: number; max: number }> = {
  pre: { min: 4, max: 6 },
  quiz: { min: 2, max: 3 },
  post: { min: 7, max: 8 },
}

const WORD_CUE_STOPLIST = new Set([
  'about',
  'after',
  'before',
  'could',
  'directly',
  'following',
  'should',
  'their',
  'there',
  'these',
  'which',
  'would',
])

function words(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .match(/[a-z][a-z0-9_-]{4,}/g)
      ?.filter((word) => !WORD_CUE_STOPLIST.has(word)) ?? []
  )
}

function numericOption(value: string) {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*([^\d\s].*)?$/)
  if (!match) return null
  return { value: Number(match[1]), unit: (match[2] ?? '').trim().toLowerCase() }
}

/**
 * Everything the schema cannot express: cross-question balance, length cues,
 * banned phrasing. Runs after a successful parse.
 */
export function inspectQuestions(
  file: AssessmentFile,
  targetKind?: AssessmentKind
): ValidationReport {
  const errors: string[] = []
  const warnings: string[] = []
  const questions = file.questions

  const label = (i: number) => `Question ${i + 1}`

  /* ---- per question ---- */

  const seen = new Map<string, number>()

  questions.forEach((q, i) => {
    const bodies = OPTION_LABELS.map((l) => q.options[l])

    // Four distinct options. Two identical choices make the item unanswerable.
    const lowered = bodies.map((b) => b.toLowerCase())
    const duplicate = lowered.find((b, j) => lowered.indexOf(b) !== j)
    if (duplicate) {
      errors.push(`${label(i)} repeats the same option text more than once.`)
    }

    // Duplicate stems usually mean the model looped rather than wrote 20 items.
    const key = q.stem.toLowerCase().replace(/\s+/g, ' ')
    const earlier = seen.get(key)
    if (earlier !== undefined) {
      errors.push(
        `${label(i)} asks the same thing as question ${earlier + 1}.`
      )
    } else {
      seen.set(key, i)
    }

    // Length cue: the reason to care is that a student can score above chance by
    // always picking the longest answer.
    const lengths = bodies.map((b) => b.length)
    const shortest = Math.min(...lengths)
    const longest = Math.max(...lengths)
    if (shortest > 0 && longest / shortest > LENGTH_RATIO_LIMIT) {
      errors.push(
        `${label(i)}: the longest option is ${Math.round(
          (longest / shortest) * 100
        )}% of the shortest, so length hints at the answer.`
      )
    }

    const correctLength = q.options[q.correct].length
    if (questions.length > 1 && correctLength === longest && longest > shortest) {
      errors.push(
        `${label(i)}: the correct option is the longest one.`
      )
    }

    for (const [pattern, name] of BANNED_OPTION_PATTERNS) {
      if (bodies.some((b) => pattern.test(b))) {
        errors.push(`${label(i)} uses ${name}.`)
        break
      }
    }

    const negative = q.stem.match(NEGATIVE_PIVOT)
    if (negative) {
      errors.push(
        `${label(i)} uses "${negative[0]}" as negative wording. Ask for the correct answer positively.`
      )
    }

    const context = q.stem.match(CONTEXT_REFERENCE)
    if (context) {
      errors.push(
        `${label(i)} refers to "${context[0]}", but students sit the quiz without the material beside them.`
      )
    }

    const vague = q.stem.match(VAGUE_OR_ABSOLUTE)
    if (vague) {
      errors.push(
        `${label(i)} uses the vague or absolute phrase "${vague[0]}".`
      )
    }

    if (!/[?:]$/.test(q.stem)) {
      warnings.push(
        `${label(i)} should end with a question mark or clearly introduce a sentence completion.`
      )
    }

    const parsedNumbers = bodies.map(numericOption)
    if (parsedNumbers.every((item) => item !== null)) {
      const numeric = parsedNumbers.filter((item) => item !== null)
      const units = new Set(numeric.map((item) => item.unit))
      if (units.size > 1) {
        errors.push(`${label(i)} uses different units across numeric options.`)
      }
      if (
        numeric.some(
          (item, index) => index > 0 && item.value <= numeric[index - 1].value
        )
      ) {
        errors.push(`${label(i)} must place numeric options in ascending order.`)
      }
    }

    const stemWords = words(q.stem)
    const optionWords = Object.fromEntries(
      OPTION_LABELS.map((optionLabel) => [
        optionLabel,
        words(q.options[optionLabel]),
      ])
    ) as Record<OptionLabel, Set<string>>
    const cueWords = [...stemWords].filter(
      (word) =>
        optionWords[q.correct].has(word) &&
        OPTION_LABELS.filter((optionLabel) => optionLabel !== q.correct).every(
          (optionLabel) => !optionWords[optionLabel].has(word)
        )
    )
    if (cueWords.length > 0) {
      warnings.push(
        `${label(i)} repeats ${cueWords
          .slice(0, 3)
          .map((word) => `"${word}"`)
          .join(', ')} from the stem only in the key; check for a word cue.`
      )
    }
  })

  /* ---- across the set ---- */

  const kind = targetKind ?? file.assessment?.kind
  const expected = kind ? QUESTION_COUNTS[kind] : undefined

  if (expected !== undefined && questions.length !== expected) {
    errors.push(
      `This file has ${questions.length} questions; a ${kind} assessment requires exactly ${expected}.`
    )
  }

  if (targetKind && file.assessment.kind !== targetKind) {
    errors.push(
      `The file declares a ${file.assessment.kind} assessment, but this assessment is ${targetKind}.`
    )
  }

  const expectedDuration = DEFAULT_DURATIONS[file.assessment.kind]
  if (file.assessment.duration_minutes !== expectedDuration) {
    errors.push(
      `A ${file.assessment.kind} assessment must use ${expectedDuration} minutes, not ${file.assessment.duration_minutes}.`
    )
  }

  if (questions.length >= MIN_FOR_KEY_SPREAD) {
    const counts = new Map<OptionLabel, number>(
      OPTION_LABELS.map((l) => [l, 0])
    )
    for (const q of questions) {
      counts.set(q.correct, (counts.get(q.correct) ?? 0) + 1)
    }

    if (kind && questions.length === QUESTION_COUNTS[kind]) {
      const range = ANSWER_KEY_RANGES[kind]
      for (const l of OPTION_LABELS) {
        const count = counts.get(l) ?? 0
        if (count < range.min || count > range.max) {
          errors.push(
            `${count} answers use ${l}; a ${kind} assessment requires ${range.min} to ${range.max} per letter.`
          )
        }
      }
    } else {
      const unused = OPTION_LABELS.filter((l) => (counts.get(l) ?? 0) === 0)
      if (unused.length > 0) {
        errors.push(
          `Every answer letter must be used; none of the questions currently use ${unused.join(' or ')}.`
        )
      }

      for (const l of OPTION_LABELS) {
        const share = (counts.get(l) ?? 0) / questions.length
        if (share > KEY_SHARE_LIMIT) {
          errors.push(
            `${Math.round(share * 100)}% of answers are ${l}; no letter may exceed 30%.`
          )
        }
      }
    }
  }

  // Only worth checking the mix when the count is the one the mix was written
  // for; otherwise the numbers are not comparable.
  if (kind && expected !== undefined && questions.length === expected) {
    const target = DIFFICULTY_MIX[kind]
    const actual: Record<QuestionDifficulty, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
    }
    for (const q of questions) actual[q.difficulty] += 1

    const off = (
      Object.keys(target) as QuestionDifficulty[]
    ).filter((d) => actual[d] !== target[d])

    if (off.length > 0) {
      errors.push(
        `Difficulty mix is ${actual.easy} easy, ${actual.medium} medium, ${actual.hard} hard; ` +
          `a ${kind} assessment requires ${target.easy}, ${target.medium}, ${target.hard}.`
      )
    }
  }

  const statementCount = questions.filter((q) =>
    STATEMENT_STYLE.test(q.stem)
  ).length
  const statementLimit = Math.floor(questions.length / 5)
  if (statementCount > statementLimit) {
    errors.push(
      `${statementCount} questions use statement-style stems; the limit for this set is ${statementLimit}.`
    )
  }

  return { errors, warnings }
}

export type ParseResult =
  | { ok: true; file: AssessmentFile; report: ValidationReport }
  | { ok: false; report: ValidationReport }

/**
 * Text in, either a usable question set or a list of what is wrong with it.
 *
 * Never throws: an instructor pasting the wrong thing should read a sentence,
 * not a stack trace.
 */
export function parseAssessmentFile(
  raw: string,
  targetKind?: AssessmentKind
): ParseResult {
  if (!raw.trim()) {
    return { ok: false, report: { errors: ['Nothing to import.'], warnings: [] } }
  }

  let json: unknown
  try {
    json = JSON.parse(extractJson(raw))
  } catch {
    return {
      ok: false,
      report: {
        errors: [
          'That is not valid JSON. Paste the whole fenced json block the model produced, or upload the .json file.',
        ],
        warnings: [],
      },
    }
  }

  const parsed = AssessmentFileSchema.safeParse(json)
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const path = issue.path.join('.')
      // "questions.4.options.C" reads better as "questions[4].options.C".
      const where = path.replace(/\.(\d+)\./g, '[$1].')
      return where ? `${where}: ${issue.message}` : issue.message
    })
    return { ok: false, report: { errors: errors.slice(0, 25), warnings: [] } }
  }

  const report = inspectQuestions(parsed.data, targetKind)
  if (report.errors.length > 0) return { ok: false, report }

  return { ok: true, file: parsed.data, report }
}
