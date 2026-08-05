'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import {
  addLinkResource,
  registerUploadedResource,
  type FormState,
} from '@/app/actions/admin'
import { Alert, Button, Field, Input, Select, Textarea, cx } from '@/components/ui'
import {
  FILE_ACCEPT,
  UPLOAD_HINT,
  formatUploadBytes,
  isAllowedUpload,
  resolveUploadMime,
  suggestResourceKind,
} from '@/lib/course-files'
import { createClient } from '@/lib/supabase/client'

const UPLOAD_KINDS = [
  { value: 'slides', label: 'Slides' },
  { value: 'pdf', label: 'PDF' },
  { value: 'notebook', label: 'Notebook' },
  { value: 'lab', label: 'Lab' },
  { value: 'dataset', label: 'Dataset' },
  { value: 'file', label: 'Other file' },
]

const LINK_KINDS = [
  { value: 'lab', label: 'Lab' },
  { value: 'notebook', label: 'Notebook' },
  { value: 'link', label: 'Link' },
  { value: 'slides', label: 'Slides' },
  { value: 'pdf', label: 'PDF' },
  { value: 'dataset', label: 'Dataset' },
  { value: 'file', label: 'Other' },
]

function safeFileName(name: string) {
  return (
    name
      .normalize('NFKD')
      .replace(/[^\w.\-]+/g, '_')
      .replace(/_+/g, '_')
      .slice(-120) || 'file'
  )
}

/* ------------------------------------------------------------ link form -- */

export function AddLinkForm({
  courseId,
  dayId,
}: {
  courseId: string
  dayId: string
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addLinkResource,
    undefined
  )
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.ok) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="day_id" value={dayId} />

      {state?.message ? <Alert>{state.message}</Alert> : null}

      <Field label="Title" htmlFor="link_title" error={state?.errors?.title}>
        <Input
          id="link_title"
          name="title"
          required
          placeholder="Lab notebook or external resource"
        />
      </Field>

      <Field
        label="URL"
        htmlFor="external_url"
        hint="Colab, GitHub, Drive, or any https link."
        error={state?.errors?.external_url}
      >
        <Input
          id="external_url"
          name="external_url"
          type="url"
          required
          inputMode="url"
          placeholder="https://"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
        <Field label="Type" htmlFor="link_kind" error={state?.errors?.kind}>
          <Select id="link_kind" name="kind" defaultValue="notebook">
            {LINK_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Description"
          htmlFor="link_description"
          error={state?.errors?.description}
        >
          <Input
            id="link_description"
            name="description"
            placeholder="Optional"
          />
        </Field>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add link'}
      </Button>
    </form>
  )
}

/* ---------------------------------------------------------- upload form -- */

export function UploadFileForm({
  courseId,
  dayId,
}: {
  courseId: string
  dayId: string
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [picked, setPicked] = useState<File | null>(null)
  const [kind, setKind] = useState('slides')
  const [title, setTitle] = useState('')

  function onFileChange(file: File | null) {
    setError(null)
    setDone(false)
    setPicked(file)
    if (!file) return

    const check = isAllowedUpload(file)
    if (!check.ok) {
      setError(check.reason)
      setPicked(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const suggested = suggestResourceKind(file)
    setKind(suggested)
    const base = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
    if (!title.trim() && base.length >= 2) setTitle(base)
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setDone(false)

    const form = event.currentTarget
    const data = new FormData(form)
    const file = picked ?? data.get('file')
    const nextTitle = String(data.get('title') ?? '').trim()

    if (!(file instanceof File) || file.size === 0) {
      setError('Choose a file to upload.')
      return
    }

    const check = isAllowedUpload(file)
    if (!check.ok) {
      setError(check.reason)
      return
    }
    if (nextTitle.length < 2) {
      setError('Give the item a title.')
      return
    }

    const mime = resolveUploadMime(file) ?? check.mime

    setBusy(true)
    try {
      const path = `${courseId}/${dayId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
      const supabase = createClient()

      const { error: uploadError } = await supabase.storage
        .from('course-files')
        .upload(path, file, {
          contentType: mime,
          upsert: false,
        })

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`)
        return
      }

      const result = await registerUploadedResource({
        courseId,
        dayId,
        path,
        title: nextTitle,
        description: String(data.get('description') ?? ''),
        kind: String(data.get('kind') ?? 'file'),
        size: file.size,
        mimeType: mime,
      })

      if (result?.message) {
        setError(result.message)
        return
      }
      if (result?.errors) {
        setError(Object.values(result.errors).flat()[0] ?? 'Could not save.')
        return
      }

      form.reset()
      setPicked(null)
      setTitle('')
      setKind('slides')
      setDone(true)
    } catch {
      setError('Something went wrong during the upload. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <Alert>{error}</Alert> : null}
      {done ? <Alert tone="teal">File added. It is a draft until you show it.</Alert> : null}

      <div>
        <label
          htmlFor="file"
          className={cx(
            'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line-strong bg-navy-50/40 px-4 py-8 text-center transition',
            'hover:border-teal-600 hover:bg-teal-50/40'
          )}
        >
          <span className="text-[14px] font-medium text-navy-900">
            {picked ? 'Replace file' : 'Choose a file'}
          </span>
          <span className="max-w-md text-[12px] leading-snug text-ink-soft">
            {UPLOAD_HINT}
          </span>
          {picked ? (
            <span className="mt-2 text-[13px] font-medium text-teal-800">
              {picked.name} · {formatUploadBytes(picked.size)}
            </span>
          ) : null}
        </label>
        <input
          ref={fileInputRef}
          id="file"
          name="file"
          type="file"
          accept={FILE_ACCEPT}
          required={!picked}
          className="sr-only"
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        />
      </div>

      <Field label="Title" htmlFor="upload_title">
        <Input
          id="upload_title"
          name="title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Short title students will see"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
        <Field label="Type" htmlFor="upload_kind">
          <Select
            id="upload_kind"
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            {UPLOAD_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Description" htmlFor="upload_description">
          <Textarea
            id="upload_description"
            name="description"
            rows={1}
            placeholder="Optional"
          />
        </Field>
      </div>

      <Button type="submit" disabled={busy || !picked}>
        {busy ? 'Uploading…' : 'Upload file'}
      </Button>
    </form>
  )
}
