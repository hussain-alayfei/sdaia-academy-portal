import type { ResourceKind } from '@/lib/types'

/** Matches the course-files Storage bucket size limit. */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024

/** Canonical MIME for each allowed extension (Storage allowlist). */
export const EXTENSION_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
  ipynb: 'application/x-ipynb+json',
  json: 'application/json',
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  markdown: 'text/markdown',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
}

/** Browser MIME aliases we normalize to a canonical type. */
const MIME_ALIASES: Record<string, string> = {
  'application/x-zip-compressed': 'application/zip',
  'application/zip-compressed': 'application/zip',
  'application/octet-stream': '', // force extension lookup
  '': '',
}

export const ALLOWED_MIME_TYPES = Array.from(
  new Set(Object.values(EXTENSION_MIME))
)

/** For `<input type="file" accept=…>`. */
export const FILE_ACCEPT = Object.keys(EXTENSION_MIME)
  .map((ext) => `.${ext}`)
  .concat(ALLOWED_MIME_TYPES)
  .join(',')

export const UPLOAD_HINT =
  'PDF, Word, Excel, PowerPoint, Jupyter (.ipynb), CSV, ZIP, images, or MP4. Up to 200 MB.'

export function fileExtension(name: string): string {
  const base = name.trim().split(/[/\\]/).pop() ?? name
  const dot = base.lastIndexOf('.')
  if (dot < 0) return ''
  return base.slice(dot + 1).toLowerCase()
}

export function resolveUploadMime(file: {
  name: string
  type?: string | null
}): string | null {
  const raw = (file.type ?? '').trim().toLowerCase()
  const aliased = Object.prototype.hasOwnProperty.call(MIME_ALIASES, raw)
    ? MIME_ALIASES[raw]
    : raw

  if (aliased && ALLOWED_MIME_TYPES.includes(aliased)) {
    return aliased
  }

  const ext = fileExtension(file.name)
  const fromExt = ext ? EXTENSION_MIME[ext] : undefined
  return fromExt ?? null
}

export function isAllowedUpload(file: {
  name: string
  type?: string | null
  size?: number
}): { ok: true; mime: string } | { ok: false; reason: string } {
  if (typeof file.size === 'number' && file.size <= 0) {
    return { ok: false, reason: 'Choose a file to upload.' }
  }
  if (typeof file.size === 'number' && file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: 'Files must be 200 MB or smaller.' }
  }

  const mime = resolveUploadMime(file)
  if (!mime) {
    return {
      ok: false,
      reason: `That file type is not supported. ${UPLOAD_HINT}`,
    }
  }
  return { ok: true, mime }
}

export function suggestResourceKind(file: {
  name: string
}): Exclude<ResourceKind, 'link'> {
  const ext = fileExtension(file.name)
  switch (ext) {
    case 'ppt':
    case 'pptx':
      return 'slides'
    case 'pdf':
      return 'pdf'
    case 'ipynb':
      return 'notebook'
    case 'csv':
    case 'xls':
    case 'xlsx':
    case 'zip':
    case 'json':
      return 'dataset'
    default:
      return 'file'
  }
}

export function formatUploadBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
