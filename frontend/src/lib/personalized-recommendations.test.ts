import test from 'node:test'
import assert from 'node:assert/strict'
import { addActivityViewSignal, buildPersonalizedActivities, parseActivityViewSignals } from './personalized-recommendations.ts'

test('stores latest activity view signal first without duplicates', () => {
  const next = addActivityViewSignal([{ activityId: '1', category: '演唱会', artist: 'A', city: '北京' }], {
    activityId: '1',
    category: '演唱会',
    artist: 'A',
    city: '北京',
  })

  assert.equal(next.length, 1)
  assert.equal(next[0].activityId, '1')
})

test('keeps display fields for browser history', () => {
  const viewedAt = '2026-06-01T09:40:00.000Z'
  const next = addActivityViewSignal([], {
    activityId: '9',
    title: '夏日演唱会',
    poster: '/poster.jpg',
    category: '演唱会',
    artist: 'A',
    city: '上海',
    viewedAt,
  })

  const parsed = parseActivityViewSignals(JSON.stringify(next))

  assert.equal(parsed[0].activityId, '9')
  assert.equal(parsed[0].title, '夏日演唱会')
  assert.equal(parsed[0].poster, '/poster.jpg')
  assert.equal(parsed[0].viewedAt, viewedAt)
})

test('fills view time when adding activity history', () => {
  const before = Date.now()
  const [item] = addActivityViewSignal([], { activityId: '10', title: '没有传时间的演出' })
  const after = Date.now()

  assert.ok(item.viewedAt)
  const time = new Date(item.viewedAt || '').getTime()
  assert.ok(time >= before && time <= after)
})

test('builds personalized activities by recent category artist and city', () => {
  const result = buildPersonalizedActivities(
    [
      { id: '10', title: '周杰伦演唱会', categoryId: '演唱会', venue: '北京' },
      { id: '11', title: '亲子剧', categoryId: '儿童亲子', venue: '上海' },
      { id: '12', title: '五月天演唱会', categoryId: '演唱会', venue: '深圳' },
    ],
    [{ activityId: '1', category: '演唱会', artist: '周杰伦', city: '北京' }],
  )

  assert.equal(result[0].id, '10')
  assert.equal(result[1].id, '12')
})
