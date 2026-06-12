import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

test('real demo seed does not depend on remote marketplace images', () => {
  const combined = [
    source('../../../sql/seeds/prod-split-real-demo/01-ticket.sql'),
    source('../../../sql/seeds/prod-split-real-demo/posters.json'),
    source('../../../sql/seeds/prod-split-real-demo/artist-avatars.json'),
  ].join('\n')

  assert.doesNotMatch(combined, /img\.alicdn\.com|p\.damai\.cn/)
})

test('real demo artist records keep local archived avatars on reseed', () => {
  const ticketSeed = source('../../../sql/seeds/prod-split-real-demo/01-ticket.sql')
  const artistAvatars = source('../../../sql/seeds/prod-split-real-demo/artist-avatars.json')

  assert.doesNotMatch(ticketSeed, /^\(901\d+,[^\r\n]*,\s*NULL,\s*1,\s*NULL,\s*'项目\/艺人'/m)
  assert.match(ticketSeed, /avatar = EXCLUDED\.avatar/)
  assert.doesNotMatch(ticketSeed, /^\(901002,[^\r\n]*\/seed-posters-real\/activity-900001\.jpg/m)
  assert.doesNotMatch(ticketSeed, /^\(901003,[^\r\n]*\/seed-posters-real\/activity-900011\.jpg/m)
  assert.match(ticketSeed, /\/seed-artist-avatars-real\/artist-901002\.(jpg|png|webp)/)
  assert.match(ticketSeed, /\/seed-artist-avatars-real\/artist-901003\.(jpg|png|webp)/)
  assert.match(artistAvatars, /"sourceUrl":\s*"https:\/\//)
  assert.doesNotMatch(artistAvatars, /"sourceUrl":\s*"\/seed-/)
})
