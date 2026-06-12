import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

function readSource(path: string) {
  return readFileSync(resolve(root, path), 'utf8')
}

test('C-end activity cards do not mislabel unknown activity sale status as sold out', () => {
  const homeSource = readSource('app/page.tsx')
  const searchSource = readSource('app/search/page.tsx')
  const detailSource = readSource('app/activity/[id]/page.tsx')
  const cardSource = readSource('components/TicketCard.tsx')
  const typeSource = readSource('types/omni.ts')

  assert.doesNotMatch(homeSource, /vo\.status === 1 \? 'on_sale' : vo\.status === 2 \? 'coming_soon' : 'sold_out'/)
  assert.doesNotMatch(searchSource, /vo\.status === 1 \? 'on_sale' : vo\.status === 2 \? 'coming_soon' : 'sold_out'/)
  assert.doesNotMatch(detailSource, /if \(status === 2\) return 'coming_soon'\s+return 'sold_out'/)
  assert.match(homeSource, /toActivitySaleStatus/)
  assert.match(searchSource, /toActivitySaleStatus/)
  assert.match(detailSource, /toActivitySaleStatus/)
  assert.match(cardSource, /status_syncing/)
  assert.match(cardSource, /状态同步中/)
  assert.match(typeSource, /status_syncing/)
})
