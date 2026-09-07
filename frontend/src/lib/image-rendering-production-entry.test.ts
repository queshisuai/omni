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
  assert.match(content, /fallbackText/)
  assert.match(content, /bg-gradient-to-br/)
})

test('console artist avatars use safe generated badges without horizontal table scrolling', () => {
  const content = source('app/console/artists/page.tsx')

  assert.match(content, /<SafeImage[\s\S]*src=\{item\.avatar\}[\s\S]*fallbackText=\{item\.name\}/)
  assert.match(content, /max-w-\[200px\] truncate/)
  assert.doesNotMatch(content, /overflow-x-auto/)
  assert.doesNotMatch(content, /min-w-\[980px\]/)
  assert.doesNotMatch(content, /40×40px 艺人头像" className="flex h-10 w-10/)
})

test('seed artist avatars have archived webp assets and a production backfill migration', () => {
  const avatarIds = [3, 4, 6, 7, 11, 12, 14, 18, 19, 25, 901008, 901010, 901023, 901027, 901030, 901034, 901035, 901041]
  const publicAvatarRoot = resolve(root, '..', 'public', 'avatars', 'artists')

  for (const id of avatarIds) {
    const file = resolve(publicAvatarRoot, `artist-${id}.webp`)
    assert.equal(existsSync(file), true, `missing archived artist avatar: ${file}`)
    assert.ok(statSync(file).size > 1000, `archived artist avatar is unexpectedly small: ${file}`)
  }

  const migration = readFileSync(resolve(root, '..', '..', 'sql/production-split/ticket/20260610_artist_avatar_backfill.sql'), 'utf8')
  const manifest = readFileSync(resolve(root, '..', '..', 'sql/production-split/manifest.json'), 'utf8')
  const demoSeed = readFileSync(resolve(root, '..', '..', 'sql/seeds/prod-split-real-demo/01-ticket.sql'), 'utf8')

  assert.match(manifest, /ticket\/20260610_artist_avatar_backfill\.sql/)
  assert.match(migration, /UPDATE artist/)
  assert.match(migration, /\/avatars\/artists\/artist-901041\.webp/)
  assert.match(migration, /\/avatars\/artists\/artist-3\.webp/)
  assert.match(demoSeed, /\/avatars\/artists\/artist-901041\.webp/)
  assert.match(demoSeed, /\/avatars\/artists\/artist-901008\.webp/)
})
