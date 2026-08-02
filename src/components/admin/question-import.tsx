'use client'

import { useActionState, useRef, useState } from 'react'

import { importQuestions, type ImportState } from '@/app/actions/questions'
import { AlertIcon, LinkIcon } from '@/components/icons'
import { Alert, Badge, Button, Panel, PanelHeader, cx } from '@/components/ui'
import { DIFFICULTY_LABELS, DIFFICULTY_TONES } from '@/lib/format'
import { OPTION_LABELS, QUESTION_COUNTS } from '@/lib/assessment-schema'
import type { AssessmentKind } from '@/lib/types'

/**
 * Upload a question file, see what is wrong with it, then import.
 *
 * Deliberately two steps. A 30-question paper is too much to eyeball in a diff
 * after the fact, so nothing is written until the instructor has read the
 * validation report and the preview.
 */
export function QuestionImport({
  courseId,
  assessmentId,
  kind,
  hasAttempts,
}: {
  courseId: string
  assessmentId: string
  kind: AssessmentKind
  hasAttempts: boolean
}) {
  const [state, action, pending] = useActionState<ImportState, FormData>(
    importQuestions,
    undefined
  )
  const [mode, setMode] = useState<'check' | 'apply'>('check')
  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // After a dry run the server hands back canonical JSON, so an uploaded file
  // becomes editable text and the Import button has something to resubmit.
  const editorValue = state?.preview && state.raw && !text ? state.raw : text

  const expected = QUESTION_COUNTS[kind]

  return (
    <div className="space-y-4">
      {hasAttempts ? (
        <Alert tone="amber" title="Students have already sat this assessment">
          Importing is blocked while attempts exist, because replacing the
          questions would leave their scores measuring a paper that no longer
          exists. Reset the attempts below if you need to change it.
        </Alert>
      ) : null}

      <Panel className="p-5 sm:p-6">
        <div className="mb-4">
          <h3 className="text-[15px] font-semibold text-navy-900">
            Import questions
          </h3>
          <p className="mt-1 text-[13px] text-ink-soft">
            Paste the JSON block your model produced, or upload the file. A{' '}
            {kind === 'quiz' ? 'day quiz' : `${kind}-assessment`} normally holds{' '}
            {expected} questions. Importing replaces everything currently here.
          </p>
          <a
            href="/assessment-authoring-prompt.md"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-teal-700 hover:text-teal-800"
          >
            <LinkIcon width={14} height={14} />
            Open the authoring brief to paste into your model
          </a>
        </div>

        <form action={action} className="space-y-4">
          <input type="hidden" name="course_id" value={courseId} />
          <input type="hidden" name="assessment_id" value={assessmentId} />
          <input type="hidden" name="mode" value={mode} />

          <textarea
            name="raw"
            rows={8}
            value={editorValue}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            disabled={hasAttempts}
            placeholder={'{\n  "schema": "sdaia-assessment/v1",\n  ...\n}'}
            className={cx(
              'block w-full rounded-sm border border-line-strong bg-surface px-3 py-2',
              'font-mono text-[12.5px] text-ink placeholder:text-ink-faint',
              'focus:border-teal-600 focus:outline-none disabled:bg-navy-50'
            )}
          />

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              name="file"
              accept=".json,.md,.txt,application/json,text/markdown"
              disabled={hasAttempts}
              className={cx(
                'text-[13px] text-ink-soft',
                'file:mr-3 file:rounded-sm file:border file:border-line-strong',
                'file:bg-surface file:px-3 file:py-1.5 file:text-[13px]',
                'file:font-medium file:text-navy-800 hover:file:bg-navy-50'
              )}
            />

            <div className="ml-auto flex items-center gap-2">
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={pending || hasAttempts}
                onClick={() => setMode('check')}
              >
                {pending && mode === 'check' ? 'Checking…' : 'Check the file'}
              </Button>

              <Button
                type="submit"
                size="sm"
                disabled={pending || hasAttempts || !state?.preview}
                onClick={() => setMode('apply')}
              >
                {pending && mode === 'apply'
                  ? 'Importing…'
                  : state?.preview
                    ? `Import ${state.preview.length} questions`
                    : 'Import'}
              </Button>
            </div>
          </div>
        </form>
      </Panel>

      {state?.ok ? (
        <Alert tone="teal" title="Imported">
          {state.imported} questions are now in this assessment. Publish it when
          you are ready for students to see the card.
        </Alert>
      ) : null}

      {state?.errors && state.errors.length > 0 ? (
        <Alert
          title={
            state.errors.length === 1
              ? 'This file cannot be imported'
              : `${state.errors.length} problems block this import`
          }
        >
          <ul className="mt-1 space-y-1">
            {state.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {state?.warnings && state.warnings.length > 0 ? (
        <Alert
          tone="amber"
          title={`${state.warnings.length} thing${
            state.warnings.length === 1 ? '' : 's'
          } worth a look`}
        >
          <p className="mb-1">
            None of these block the import. They are the cues that let a student
            score above chance without knowing the material.
          </p>
          <ul className="space-y-1">
            {state.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {state?.preview && !state.ok ? (
        <Panel>
          <PanelHeader
            title={`Preview · ${state.preview.length} questions`}
            description="Nothing has been saved. Read it through, then import."
          />
          <ol className="divide-y divide-line">
            {state.preview.map((q, i) => (
              <li key={`${i}-${q.stem.slice(0, 24)}`} className="px-4 py-4 sm:px-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-semibold text-ink-faint">
                    {i + 1}
                  </span>
                  <Badge tone={DIFFICULTY_TONES[q.difficulty]}>
                    {DIFFICULTY_LABELS[q.difficulty]}
                  </Badge>
                  {q.topic ? <Badge tone="neutral">{q.topic}</Badge> : null}
                </div>

                <p className="text-[14px] font-medium text-navy-900">{q.stem}</p>

                <ul className="mt-2 space-y-1">
                  {OPTION_LABELS.map((label) => {
                    const correct = q.correct === label
                    return (
                      <li
                        key={label}
                        className={cx(
                          'flex gap-2 text-[13px]',
                          correct
                            ? 'font-medium text-teal-800'
                            : 'text-ink-soft'
                        )}
                      >
                        <span className="w-4 shrink-0">{label}</span>
                        <span>{q.options[label]}</span>
                        {correct ? (
                          <span className="text-[11px] tracking-wide uppercase">
                            correct
                          </span>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>

                {q.rationale ? (
                  <p className="mt-2 flex gap-2 text-[12.5px] text-ink-faint">
                    <AlertIcon className="mt-px shrink-0" width={13} height={13} />
                    {q.rationale}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}
    </div>
  )
}
