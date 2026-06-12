import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

test('shared footers do not expose placeholder hash links', () => {
  const contents = [
    source('../components/Footer.tsx'),
    source('../components/LoginFooter.tsx'),
    source('./site-links.ts'),
  ].join('\n')

  assert.doesNotMatch(contents, /href=["']#["']/)
  assert.doesNotMatch(contents, /href:\s*["']#["']/)
})
