import test from 'node:test'
import assert from 'node:assert/strict'

import { buildSubscriptionEmptyGuides } from './subscription.ts'

test('builds subscription empty guides from recent viewed activities', () => {
  const guides = buildSubscriptionEmptyGuides([
    {
      activityId: '900001',
      title: '周杰伦北京演唱会',
      artist: '周杰伦',
      city: '北京',
      poster: '/posters/jay.jpg',
      status: 2,
    },
    {
      activityId: '900002',
      title: '上海话剧周末场',
      city: '上海',
      status: 1,
    },
    {
      activityId: '900001',
      title: '周杰伦北京演唱会重复浏览',
      artist: '周杰伦',
      city: '北京',
      status: 2,
    },
  ])

  assert.deepEqual(guides.map(item => item.activityId), ['900001', '900002'])
  assert.equal(guides[0].href, '/activity/900001')
  assert.equal(guides[0].title, '周杰伦北京演唱会')
  assert.equal(guides[0].actionLabel, '开启开售提醒')
  assert.equal(guides[0].artistHint, '也可关注周杰伦')
  assert.equal(guides[1].actionLabel, '去添加想看')
})

test('does not build subscription guides without real activity titles', () => {
  assert.deepEqual(
    buildSubscriptionEmptyGuides([
      { activityId: '900001', city: '北京' },
      { activityId: '', title: '无效活动' },
    ]),
    [],
  )
})
