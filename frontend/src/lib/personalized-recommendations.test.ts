import test from 'node:test'
import assert from 'node:assert/strict'
import { addActivityViewSignal, buildPersonalizedActivities } from './personalized-recommendations.ts'

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
