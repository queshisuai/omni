import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildConsoleSessionReportCsv, buildConsoleSessionReportExcelHtml, formatConsoleSessionStatus } from './console-sessions.ts'
import type { SessionAdminVO } from '../types/api.ts'

test('builds session report csv with business fields and without row ids', () => {
  const sessions = [
    {
      id: 71001,
      activityId: 72001,
      venueId: 73001,
      activityName: '夏夜演唱会',
      venueName: '中心剧场',
      venueCity: '上海',
      startTime: '2026-07-01T19:30:00',
      endTime: '2026-07-01T21:30:00',
      status: 1,
      ticketTypeCount: 3,
      totalStock: 1000,
      soldStock: 600,
      remainStock: 400,
    },
  ] as SessionAdminVO[]

  const csv = buildConsoleSessionReportCsv(sessions)

  assert.equal(csv.startsWith('\ufeff活动,场馆,城市,开始时间,结束时间,状态,票档数,总库存,已售,余票'), true)
  assert.match(csv, /夏夜演唱会,中心剧场,上海,2026-07-01 19:30,2026-07-01 21:30,启用,3,1000,600,400/)
  assert.doesNotMatch(csv, /71001|72001|73001|id|activityId|venueId/)
})

test('builds session report excel html with escaped business fields', () => {
  const sessions = [
    {
      id: 71002,
      activityId: 72002,
      venueId: 73002,
      activityName: '音乐节<夜场>',
      venueName: '露天&广场',
      venueCity: '杭州',
      startTime: '2026-07-02T20:00:00',
      endTime: '',
      status: 0,
      ticketTypeCount: 2,
      totalStock: 800,
      soldStock: 300,
      remainStock: 500,
    },
  ] as SessionAdminVO[]

  const html = buildConsoleSessionReportExcelHtml(sessions)

  assert.equal(html.startsWith('\ufeff<html><head><meta charset="utf-8">'), true)
  assert.match(html, /<table>/)
  assert.match(html, /音乐节&lt;夜场&gt;/)
  assert.match(html, /露天&amp;广场/)
  assert.match(html, /停用/)
  assert.doesNotMatch(html, /71002|72002|73002|id|activityId|venueId/)
})

test('formats unknown session status without treating it as disabled', () => {
  assert.equal(formatConsoleSessionStatus(1), '启用')
  assert.equal(formatConsoleSessionStatus(0), '停用')
  assert.equal(formatConsoleSessionStatus(9), '未知场次状态')

  const sessions = [
    {
      id: 71003,
      activityId: 72003,
      venueId: 73003,
      activityName: '未知状态演出',
      venueName: '主舞台',
      venueCity: '成都',
      startTime: '2026-07-03T19:00:00',
      endTime: '2026-07-03T21:00:00',
      status: 9,
      ticketTypeCount: 1,
      totalStock: 100,
      soldStock: 10,
      remainStock: 90,
    },
  ] as SessionAdminVO[]

  assert.match(buildConsoleSessionReportCsv(sessions), /未知场次状态/)
  assert.match(buildConsoleSessionReportExcelHtml(sessions), /未知场次状态/)
})
