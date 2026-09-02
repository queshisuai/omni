import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

function source(path: string) {
  return readFileSync(resolve(root, path), 'utf8')
}

function runtimeSources(dir = root): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = resolve(dir, name)
    const stat = statSync(file)
    if (stat.isDirectory()) return runtimeSources(file)
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) return []
    return [file]
  })
}

test('uploaded image previews accept backend relative urls and absolute cdn urls', () => {
  const content = source('components/LocalFileUpload.tsx')

  assert.doesNotMatch(content, /startsWith\(['"]\/uploads\/['"]\)/)
  assert.match(content, /isRenderableImageSrc/)
})

test('runtime code centralizes image fallback instead of inline background fallbacks', () => {
  const offenders = runtimeSources()
    .filter(file => !file.endsWith('lib\\image-url.ts') && !file.endsWith('lib/image-url.ts'))
    .map(file => ({ file, content: readFileSync(file, 'utf8') }))
    .filter(({ content }) => /(?:\|\||\?\?)\s*['"]\/background\.png['"]/.test(content))

  assert.deepEqual(offenders.map(item => item.file.replace(root, '')), [])
})

test('shared safe image component handles render-time load errors', () => {
  const componentPath = resolve(root, 'components/SafeImage.tsx')
  assert.equal(existsSync(componentPath), true)

  const content = readFileSync(componentPath, 'utf8')
  assert.match(content, /resolveImageSrc/)
  assert.match(content, /onError/)
  assert.match(content, /IMAGE_FALLBACK_SRC/)
})
