import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

test('private file upload uses business fallback for missing file type', () => {
  const source = readFileSync(resolve(root, 'components/PrivateFileUpload.tsx'), 'utf8')

  assert.doesNotMatch(source, /'未知类型'/)
  assert.match(source, /文件类型待同步/)
})

test('private file upload uses sync fallback for missing file size', () => {
  const source = readFileSync(resolve(root, 'components/PrivateFileUpload.tsx'), 'utf8')

  assert.doesNotMatch(source, /'未知大小'/)
  assert.match(source, /文件大小待同步/)
})
