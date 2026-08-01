import { ClipboardIcon, LinkIcon, LockIcon } from '@/components/icons'
import { Badge, EmptyState, cx } from '@/components/ui'
import { ASSESSMENT_LABELS, percent } from '@/lib/format'
import type { Assessment, AssessmentScore } from '@/lib/types'

function scoreTone(pct: number) {
  if (pct >= 80) return 'teal' as const
  if (pct >= 50) return 'neutral' as const
  return 'amber' as const
}

function AssessmentRow({
  assessment,
  score,
}: {
  assessment: Assessment
  score?: AssessmentScore
}) {
  const open = !assessment.is_locked && Boolean(assessment.external_url)
  const pct = score ? percent(score.score, score.max_score) : null

  const body = (
    <>
      <span
        className={cx(
          'mt-0.5 grid size-9 shrink-0 place-items-center rounded-sm border',
          open
            ? 'border-line bg-navy-50 text-navy-600 group-hover:border-teal-200 group-hover:bg-teal-50 group-hover:text-teal-700'
            : 'border-amber-200 bg-amber-50 text-amber-600'
        )}
      >
        {open ? (
          <ClipboardIcon width={18} height={18} />
        ) : (
          <LockIcon width={18} height={18} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p
            className={cx(
              'font-medium',
              open
                ? 'text-navy-900 group-hover:text-teal-800'
                : 'text-ink-soft'
            )}
          >
            {assessment.title}
          </p>
          <Badge tone="neutral">{ASSESSMENT_LABELS[assessment.kind]}</Badge>
          {assessment.is_locked ? <Badge tone="amber">Locked</Badge> : null}
        </div>

        {assessment.description ? (
          <p className="mt-0.5 text-[13px] text-ink-soft">
            {assessment.description}
          </p>
        ) : null}

        {!open && assessment.is_locked ? (
          <p className="mt-1 text-[12px] text-ink-faint">
            Opens when your instructor releases it.
          </p>
        ) : null}

        {score ? (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
            <span className="text-ink-soft">Your score</span>
            <Badge tone={scoreTone(pct!)}>
              {score.score} / {score.max_score} · {pct}%
            </Badge>
          </p>
        ) : null}
      </div>

      {open ? (
        <span className="mt-1.5 shrink-0 text-ink-faint group-hover:text-teal-700">
          <LinkIcon width={16} height={16} />
          <span className="sr-only">Opens in a new tab</span>
        </span>
      ) : null}
    </>
  )

  return (
    <li>
      {open ? (
        <a
          href={assessment.external_url!}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start gap-3.5 px-4 py-3.5 hover:bg-navy-50 sm:px-5"
        >
          {body}
        </a>
      ) : (
        <div className="flex items-start gap-3.5 px-4 py-3.5 sm:px-5">
          {body}
        </div>
      )}
    </li>
  )
}

export function AssessmentList({
  assessments,
  scores = {},
}: {
  assessments: Assessment[]
  scores?: Record<string, AssessmentScore>
}) {
  if (assessments.length === 0) {
    return (
      <EmptyState
        title="No assessments yet"
        description="The pre-test, post-test and final quiz will appear here once your instructor sets them up."
      />
    )
  }

  return (
    <ul className="divide-y divide-line">
      {assessments.map((a) => (
        <AssessmentRow key={a.id} assessment={a} score={scores[a.id]} />
      ))}
    </ul>
  )
}
