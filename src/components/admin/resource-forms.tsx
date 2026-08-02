'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import {
  addLinkResource,
  registerUploadedResource,
  type FormState,
} from '@/app/actions/admin'
import { Alert, Button, Field, Input, Select, Textarea } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

const KINDS = [
  { value: 'slides', label: 'Slides' },
  { value: 'pdf', label: 'PDF' },
  { value: 'notebook', label: 'Notebook' },
  { value: 'lab', label: 'Lab' },
  { value: 'dataset', label: 'Dataset' },
  { value: 'link', label: 'Link' },
  { value: 'file', label: 'Other file' },
]

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
          placeholder="Lab 1: first model call"
        />
      </Field>

      <Field
        label="URL"
        htmlFor="external_url"
        hint="Google Colab, GitHub, Drive, or anything with a link."
        error={state?.errors?.external_url}
      >
        <Input
          id="external_url"
          name="external_url"
          type="url"
          required
          inputMode="url"
          placeholder="https://colab.research.google.com/drive/…"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
        <Field label="Type" htmlFor="link_kind" error={state?.errors?.kind}>
          <Select id="link_kind" name="kind" defaultValue="notebook">
            {KINDS.map((k) => (
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
          <Input id="link_description" name="description" />
        </Field>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add link'}
      </Button>
    </form>
  )
}

/* ---------------------------------------------------------- upload form -- */

function safeFileName(name: string) {
  return (
    name
      .normalize('NFKD')
      .replace(/[^\w.\-]+/g, '_')
      .replace(/_+/g, '_')
      .slice(-120) || 'file'
  )
}

const MAX_UPLOAD = 200 * 1024 * 1024

export function UploadFileForm({
  courseId,
  dayId,
}: {
  courseId: string
  dayId: string
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setDone(false)

    const form = event.currentTarget
    const data = new FormData(form)
    const file = data.get('file')
    const title = String(data.get('title') ?? '').trim()

    if (!(file instanceof File) || file.size === 0) {
      setError('Choose a file to upload.')
      return
    }
    if (file.size > MAX_UPLOAD) {
      setError('Files must be 200 MB or smaller.')
      return
    }
    if (title.length < 2) {
      setError('Give the item a title.')
      return
    }

    setBusy(true)
    try {
      // Straight to Storage. The bucket's RLS policy checks that this user
      // manages the course named in the first path segment.
      const path = `${courseId}/${dayId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
      const supabase = createClient()

      const { error: uploadError } = await supabase.storage
        .from('course-files')
        .upload(path, file, {
          contentType: file.type || 'application/octet-stream',
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
        title,
        description: String(data.get('description') ?? ''),
        kind: String(data.get('kind') ?? 'file'),
        size: file.size,
        mimeType: file.type || null,
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
      {done ? <Alert tone="teal">File added.</Alert> : null}

      <Field label="Title" htmlFor="upload_title">
        <Input
          id="upload_title"
          name="title"
          required
          placeholder="Day 1 slides"
        />
      </Field>

      <Field
        label="File"
        htmlFor="file"
        hint="PDF, PowerPoint, notebook, dataset or archive. Up to 200 MB."
      >
        <Input
          id="file"
          name="file"
          type="file"
          required
          className="file:me-3 file:rounded-xs file:border-0 file:bg-navy-100 file:px-2.5 file:py-1 file:text-[13px] file:font-medium file:text-navy-800"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
        <Field label="Type" htmlFor="upload_kind">
          <Select id="upload_kind" name="kind" defaultValue="slides">
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Description" htmlFor="upload_description">
          <Textarea id="upload_description" name="description" rows={1} />
        </Field>
      </div>

      <Button type="submit" disabled={busy}>
        {busy ? 'Uploading…' : 'Upload file'}
      </Button>
    </form>
  )
}
