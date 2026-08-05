/**
 * Unit checks for course material upload MIME / kind mapping.
 * Run: npx tsx --test src/lib/course-files.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isAllowedUpload,
  resolveUploadMime,
  suggestResourceKind,
} from './course-files'

describe('resolveUploadMime', () => {
  it('maps empty MIME + .ipynb to notebook MIME', () => {
    assert.equal(
      resolveUploadMime({ name: 'lab.ipynb', type: '' }),
      'application/x-ipynb+json'
    )
  })

  it('normalizes Windows ZIP MIME to application/zip', () => {
    assert.equal(
      resolveUploadMime({
        name: 'data.zip',
        type: 'application/x-zip-compressed',
      }),
      'application/zip'
    )
  })

  it('keeps a valid PDF MIME', () => {
    assert.equal(
      resolveUploadMime({ name: 'deck.pdf', type: 'application/pdf' }),
      'application/pdf'
    )
  })

  it('recovers PDF when browser sends octet-stream', () => {
    assert.equal(
      resolveUploadMime({
        name: 'notes.pdf',
        type: 'application/octet-stream',
      }),
      'application/pdf'
    )
  })

  it('returns null for unknown extensions', () => {
    assert.equal(resolveUploadMime({ name: 'tool.exe', type: '' }), null)
  })
})

describe('isAllowedUpload', () => {
  it('accepts PDF', () => {
    const result = isAllowedUpload({
      name: 'a.pdf',
      type: 'application/pdf',
      size: 1200,
    })
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.mime, 'application/pdf')
  })

  it('rejects exe', () => {
    const result = isAllowedUpload({
      name: 'a.exe',
      type: '',
      size: 1200,
    })
    assert.equal(result.ok, false)
  })

  it('rejects oversized files', () => {
    const result = isAllowedUpload({
      name: 'a.pdf',
      type: 'application/pdf',
      size: 201 * 1024 * 1024,
    })
    assert.equal(result.ok, false)
  })
})

describe('suggestResourceKind', () => {
  it('maps pptx to slides', () => {
    assert.equal(suggestResourceKind({ name: 'Day1.pptx' }), 'slides')
  })
  it('maps pdf to pdf', () => {
    assert.equal(suggestResourceKind({ name: 'reading.pdf' }), 'pdf')
  })
  it('maps ipynb to notebook', () => {
    assert.equal(suggestResourceKind({ name: 'lab.ipynb' }), 'notebook')
  })
  it('maps csv to dataset', () => {
    assert.equal(suggestResourceKind({ name: 'rows.csv' }), 'dataset')
  })
})
