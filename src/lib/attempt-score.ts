/**
 * One way to turn an attempt into a mark.
 *
 * Every instructor screen used to work this out for itself, and they disagreed.
 * The Results page fell back to `0`, the Students matrix and the student detail
 * page fell back to `null`, so the same finished attempt read as `0/30` on one
 * screen and `—` on another. This module is the single answer, and the screens
 * only render what it returns.
 *
 * ## Where the number comes from
 *
 * `assessment_attempts.correct_count` is authoritative when it is set — but it
 * is deliberately left null while a paper's results are withheld, because that
 * column is readable by the student it belongs to. For those papers the mark is
 * rebuilt from `assessment_responses.is_correct`, which RLS keeps manager-only
 * once an attempt is over. Withholding results hides them from students; it
 * must never hide them from the instructor.
 *
 * ## Zero is not the same as unknown
 *
 * This is the distinction the old code got wrong. A finished attempt that
 * scored nothing must read `0`, while an attempt still in progress must read
 * `—`. `manager_attempt_scores` returns a row for any attempt that has
 * responses, so a finished attempt with no row genuinely answered nothing and
 * scores zero — not "unknown".
 */

export type AttemptScoreInput = {
  status: string
  correct_count: number | null
  question_count: number | null
}

/** Rows from the `manager_attempt_scores` RPC, keyed by attempt id. */
export type GradedTally = Record<string, { correct: number; answered: number }>

export type AttemptScore = {
  /** Correct answers, or null when the attempt has not been marked yet. */
  correct: number | null
  /** Questions on the paper this student sat. */
  total: number | null
  /** Rounded percentage, or null when there is nothing to show. */
  percent: number | null
  /** True once the attempt is over and a mark is meaningful. */
  finished: boolean
}

export function isFinishedAttempt(status: string): boolean {
  return status !== 'in_progress'
}

export function resolveAttemptScore(
  attempt: AttemptScoreInput | undefined | null,
  tally: GradedTally,
  attemptId: string | undefined
): AttemptScore {
  if (!attempt) {
    return { correct: null, total: null, percent: null, finished: false }
  }

  const finished = isFinishedAttempt(attempt.status)
  const total = attempt.question_count ?? null

  // Still working: no mark exists yet, and inventing one would be a lie.
  if (!finished) {
    return { correct: null, total, percent: null, finished: false }
  }

  const correct =
    attempt.correct_count ??
    (attemptId ? (tally[attemptId]?.correct ?? 0) : 0)

  const percent =
    total && total > 0 ? Math.round((correct / total) * 100) : null

  return { correct, total, percent, finished: true }
}

/**
 * Mean percentage across attempts, ignoring anything unmarked.
 *
 * Returns null rather than 0 for an empty set, so "no data" cannot be mistaken
 * for "averaged zero".
 */
export function averagePercent(scores: AttemptScore[]): number | null {
  const values = scores
    .map((score) => score.percent)
    .filter((percent): percent is number => percent !== null)

  if (values.length === 0) return null
  return Math.round(values.reduce((sum, n) => sum + n, 0) / values.length)
}
