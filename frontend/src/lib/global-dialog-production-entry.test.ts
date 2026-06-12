import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

test('global dialog does not fall back to native browser dialogs', () => {
  const content = source('../components/GlobalDialog.tsx')

  assert.doesNotMatch(content, /window\.(alert|confirm|prompt)\s*\(/)
})

test('root layout mounts global dialog for production entrypoints', () => {
  const content = source('../app/layout.tsx')

  assert.match(content, /import\s+\{\s*GlobalDialog\s*\}\s+from\s+["']@\/components\/GlobalDialog["']/)
  assert.match(content, /<GlobalDialog\s*\/>/)
})
