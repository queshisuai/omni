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

test('all currently empty artist avatars have a local image mapping', () => {
  const avatarMappings: Record<number, string> = {
    1: '/avatars/artists/artist-1.jpg',
    2: '/seed-posters/activity-02.jpg',
    5: '/seed-posters/activity-05.jpg',
    8: '/seed-posters/activity-08.jpg',
    9: '/seed-posters/activity-09.jpg',
    10: '/avatars/artists/artist-10.jpg',
    13: '/seed-posters/activity-13.jpg',
    15: '/avatars/artists/artist-15.jpg',
    16: '/seed-posters/activity-16.jpg',
    17: '/avatars/artists/artist-17.jpg',
    20: '/seed-posters/activity-20.jpg',
    21: '/seed-posters/activity-21.jpg',
    22: '/seed-posters/activity-22.jpg',
    23: '/seed-posters/activity-23.jpg',
    24: '/seed-posters/activity-24.jpg',
    26: '/seed-posters/activity-26.jpg',
    27: '/seed-posters/activity-27.jpg',
    28: '/seed-posters/activity-28.jpg',
    29: '/seed-posters/activity-29.jpg',
    30: '/seed-posters/activity-30.jpg',
    901001: '/seed-posters-real/activity-900061.jpg',
    901002: '/seed-artist-avatars-real/artist-901002.jpg',
    901003: '/seed-artist-avatars-real/artist-901003.jpg',
    901004: '/seed-posters-real/activity-900021.jpg',
    901005: '/seed-posters-real/activity-900031.png',
    901006: '/seed-posters-real/activity-900041.jpg',
    901007: '/seed-posters-real/activity-900051.jpg',
    901009: '/seed-posters-real/activity-900062.png',
    901011: '/seed-posters-real/activity-900012.png',
    901012: '/seed-posters-real/activity-900022.png',
    901013: '/seed-posters-real/activity-900032.png',
    901014: '/seed-posters-real/activity-900042.png',
    901015: '/seed-posters-real/activity-900043.jpg',
    901016: '/seed-posters-real/activity-900053.jpg',
    901017: '/seed-posters-real/activity-900063.png',
    901018: '/seed-posters-real/activity-900003.jpg',
    901019: '/seed-posters-real/activity-900013.jpg',
    901020: '/seed-posters-real/activity-900023.jpg',
    901021: '/seed-posters-real/activity-900033.jpg',
    901022: '/seed-posters-real/activity-900034.jpg',
    901024: '/seed-posters-real/activity-900054.jpg',
    901025: '/seed-posters-real/activity-900064.png',
    901026: '/seed-posters-real/activity-900004.png',
    901028: '/seed-posters-real/activity-900024.jpg',
    901029: '/seed-posters-real/activity-900015.jpg',
    901031: '/seed-posters-real/activity-900005.jpg',
    901032: '/seed-posters-real/activity-900006.jpg',
    901033: '/seed-posters-real/activity-900016.jpg',
    901036: '/seed-posters-real/activity-900007.jpg',
    901037: '/seed-posters-real/activity-900017.jpg',
    901038: '/seed-posters-real/activity-900018.jpg',
    901039: '/seed-posters-real/activity-900028.jpg',
    901040: '/seed-posters-real/activity-900008.jpg',
    901042: '/seed-posters-real/activity-900019.jpg',
    901043: '/seed-posters-real/activity-900029.jpg',
    901044: '/seed-posters-real/activity-900030.jpg',
    901045: '/seed-posters-real/activity-900010.jpg',
    901046: '/seed-posters-real/activity-900020.jpg',
  }
  const migration = readFileSync(resolve(root, '..', '..', 'sql/production-split/ticket/20260612_artist_avatar_completion.sql'), 'utf8')
  const publicRoot = resolve(root, '..', 'public')

  for (const [id, avatar] of Object.entries(avatarMappings)) {
    assert.match(migration, new RegExp(`\\b${id}\\b[\\s\\S]*${avatar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `missing migration mapping for artist ${id}`)
    assert.equal(existsSync(resolve(publicRoot, avatar.slice(1))), true, `missing local avatar asset for artist ${id}`)
  }
})
