import test from 'node:test'
import assert from 'node:assert/strict'
import { buildActivityDetailRecommendations } from './activity-recommendations.ts'

test('ranks real activity candidates by related signals before unrelated content', () => {
  const recommendations = buildActivityDetailRecommendations(
    [
      {
        id: 900001,
        name: '当前活动',
        categoryName: '演唱会',
        artistName: '周杰伦',
        venueCity: '北京',
        startTime: '2026-07-12T19:30:00',
        minPrice: 480,
        poster: '/current.jpg',
        status: 1,
      },
      {
        id: 900101,
        name: '周杰伦北京演唱会加场',
        categoryName: '演唱会',
        artistName: '周杰伦',
        venueCity: '北京',
        startTime: '2026-07-20T19:30:00',
        minPrice: 520,
        poster: '/jay-beijing.jpg',
        status: 1,
      },
      {
        id: 900102,
        name: '北京夏日音乐节',
        categoryName: '演唱会',
        artistName: '群星',
        venueCity: '北京',
        startTime: '2026-08-01T19:30:00',
        minPrice: 388,
        poster: '/festival.jpg',
        status: 1,
      },
      {
        id: 900103,
        name: '上海亲子剧',
        categoryName: '儿童亲子',
        artistName: '剧团',
        venueCity: '上海',
        startTime: '2026-08-10T10:30:00',
        minPrice: 180,
        poster: '/kids.jpg',
        status: 1,
      },
    ],
    {
      activityId: 900001,
      categoryName: '演唱会',
      artistName: '周杰伦',
      city: '北京',
      startTime: '2026-07-12T19:30:00',
      minPrice: 480,
    },
    3,
  )

  assert.deepEqual(recommendations.map(item => item.id), ['900101', '900102', '900103'])
  assert.equal(recommendations[0].reason, '同类目 · 同城市 · 同艺人')
  assert.ok(recommendations.every(item => item.id !== '900001'))
})

test('keeps recommendation results diverse when candidates repeat the same artist and city', () => {
  const recommendations = buildActivityDetailRecommendations(
    [
      { id: 1, name: '当前活动', categoryName: '演唱会', artistName: 'A', venueCity: '北京', startTime: '2026-07-01T20:00:00', minPrice: 500, poster: '/current.jpg', status: 1 },
      { id: 2, name: 'A 北京加场一', categoryName: '演唱会', artistName: 'A', venueCity: '北京', startTime: '2026-07-02T20:00:00', minPrice: 520, poster: '/a1.jpg', status: 1 },
      { id: 3, name: 'A 北京加场二', categoryName: '演唱会', artistName: 'A', venueCity: '北京', startTime: '2026-07-03T20:00:00', minPrice: 530, poster: '/a2.jpg', status: 1 },
      { id: 4, name: 'B 上海巡演', categoryName: '演唱会', artistName: 'B', venueCity: '上海', startTime: '2026-07-05T20:00:00', minPrice: 480, poster: '/b.jpg', status: 1 },
      { id: 5, name: 'C 广州音乐节', categoryName: '音乐节', artistName: 'C', venueCity: '广州', startTime: '2026-07-09T20:00:00', minPrice: 360, poster: '/c.jpg', status: 1 },
    ],
    {
      activityId: 1,
      categoryName: '演唱会',
      artistName: 'A',
      city: '北京',
      startTime: '2026-07-01T20:00:00',
      minPrice: 500,
    },
    3,
  )

  assert.equal(recommendations[0].id, '2')
  assert.ok(recommendations.some(item => item.id === '4'))
  assert.ok(recommendations.some(item => item.artistName !== 'A'))
})
