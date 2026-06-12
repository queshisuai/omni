import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildConsoleCheckInExceptionExportCsv,
  buildConsoleCheckInExceptionExportExcelHtml,
  buildConsoleCheckInExportCsv,
  buildConsoleCheckInExportExcelHtml,
  formatConsoleCheckInResult,
  getConsoleCheckInResultClassName,
} from './console-check-in.ts'
import type { CheckInRecordVO } from '../types/api.ts'

test('builds check-in csv without internal relationship identifiers', () => {
  const records = [
    {
      id: 10,
      requestId: 'CHECK-REQ-1',
      ticketId: 9001,
      ticketNo: 'ET-1',
      orderId: 980057,
      userId: 2004,
      sessionId: 910011,
      ticketTypeId: 920011,
      deviceCode: 'GATE-A',
      operatorUserId: 2003,
      channel: 'WEB',
      result: 'FAILED',
      failureReason: '重复扫码,请人工复核',
      checkedInAt: '2026-06-11T12:00:00',
      createTime: '2026-06-11T11:59:59',
    },
  ] as CheckInRecordVO[]

  const csv = buildConsoleCheckInExportCsv(records)

  assert.equal(csv.startsWith('\ufeff请求号,票号,设备,渠道,结果,失败原因,核验时间'), true)
  assert.match(csv, /CHECK-REQ-1,ET-1,GATE-A,WEB,失败,"重复扫码,请人工复核",2026-06-11T12:00:00/)
  assert.doesNotMatch(csv, /9001|980057|2004|910011|920011|2003/)
})

test('builds check-in excel html without internal relationship identifiers', () => {
  const records = [
    {
      id: 11,
      requestId: 'CHECK-REQ-2',
      ticketId: 9002,
      ticketNo: 'ET-2',
      orderId: 980058,
      userId: 2005,
      sessionId: 910012,
      ticketTypeId: 920012,
      deviceCode: 'GATE<1>',
      operatorUserId: 2006,
      channel: 'WEB&APP',
      result: 'DUPLICATE',
      failureReason: '重复扫码<请复核>',
      checkedInAt: '2026-06-11T12:30:00',
      createTime: '2026-06-11T12:29:59',
    },
  ] as CheckInRecordVO[]

  const html = buildConsoleCheckInExportExcelHtml(records)

  assert.equal(html.startsWith('\ufeff<html><head><meta charset="utf-8">'), true)
  assert.match(html, /<table>/)
  assert.match(html, /请求号/)
  assert.match(html, /重复/)
  assert.match(html, /GATE&lt;1&gt;/)
  assert.match(html, /WEB&amp;APP/)
  assert.match(html, /重复扫码&lt;请复核&gt;/)
  assert.doesNotMatch(html, /9002|980058|2005|910012|920012|2006/)
})

test('builds check-in exception exports without successful records or internal identifiers', () => {
  const records = [
    {
      id: 20,
      requestId: 'CHECK-OK',
      ticketId: 9101,
      ticketNo: 'ET-OK',
      orderId: 980101,
      userId: 2101,
      sessionId: 920101,
      ticketTypeId: 930101,
      deviceCode: 'GATE-A',
      operatorUserId: 2201,
      channel: 'WEB',
      result: 'SUCCESS',
      failureReason: null,
      checkedInAt: '2026-06-11T13:00:00',
      createTime: '2026-06-11T12:59:59',
    },
    {
      id: 21,
      requestId: 'CHECK-DUP',
      ticketId: 9102,
      ticketNo: 'ET-DUP',
      orderId: 980102,
      userId: 2102,
      sessionId: 920102,
      ticketTypeId: 930102,
      deviceCode: 'GATE-B',
      operatorUserId: 2202,
      channel: 'WEB',
      result: 'DUPLICATE',
      failureReason: '重复扫码',
      checkedInAt: '2026-06-11T13:10:00',
      createTime: '2026-06-11T13:09:59',
    },
    {
      id: 22,
      requestId: 'CHECK-FAIL',
      ticketId: 9103,
      ticketNo: 'ET-FAIL',
      orderId: 980103,
      userId: 2103,
      sessionId: 920103,
      ticketTypeId: 930103,
      deviceCode: 'GATE-C',
      operatorUserId: 2203,
      channel: 'APP',
      result: 'FAILED',
      failureReason: '票券已失效',
      checkedInAt: '2026-06-11T13:20:00',
      createTime: '2026-06-11T13:19:59',
    },
    {
      id: 23,
      requestId: 'CHECK-FUTURE',
      ticketId: 9104,
      ticketNo: 'ET-FUTURE',
      orderId: 980104,
      userId: 2104,
      sessionId: 920104,
      ticketTypeId: 930104,
      deviceCode: 'GATE-D',
      operatorUserId: 2204,
      channel: 'DEVICE',
      result: 'REVIEW_REQUIRED',
      failureReason: '设备回传待核对',
      checkedInAt: '2026-06-11T13:30:00',
      createTime: '2026-06-11T13:29:59',
    },
  ] as CheckInRecordVO[]

  const csv = buildConsoleCheckInExceptionExportCsv(records)
  const html = buildConsoleCheckInExceptionExportExcelHtml(records)

  assert.doesNotMatch(csv, /CHECK-OK|ET-OK/)
  assert.match(csv, /CHECK-DUP,ET-DUP,GATE-B,WEB,重复,重复扫码,2026-06-11T13:10:00/)
  assert.match(csv, /CHECK-FAIL,ET-FAIL,GATE-C,APP,失败,票券已失效,2026-06-11T13:20:00/)
  assert.match(csv, /CHECK-FUTURE,ET-FUTURE,GATE-D,DEVICE,未知结果,设备回传待核对,2026-06-11T13:30:00/)
  assert.doesNotMatch(csv, /9101|980101|2101|920101|930101|2201|9102|980102|2102|920102|930102|2202/)
  assert.doesNotMatch(html, /CHECK-OK|ET-OK/)
  assert.match(html, /未知结果/)
  assert.doesNotMatch(html, /9103|980103|2103|920103|930103|2203|9104|980104|2104|920104|930104|2204/)
})

test('formats check-in results with review-needed style for unknown codes', () => {
  assert.equal(formatConsoleCheckInResult('SUCCESS'), '成功')
  assert.equal(formatConsoleCheckInResult('DUPLICATE'), '重复')
  assert.equal(formatConsoleCheckInResult('FAILED'), '失败')
  assert.equal(formatConsoleCheckInResult('FUTURE_RESULT'), '未知结果')
  assert.equal(getConsoleCheckInResultClassName('SUCCESS'), 'bg-[#f0fff4] text-[#16a34a]')
  assert.equal(getConsoleCheckInResultClassName('DUPLICATE'), 'bg-[#fff7ed] text-[#f97316]')
  assert.equal(getConsoleCheckInResultClassName('FAILED'), 'bg-[#fef2f2] text-[#dc2626]')
  assert.equal(getConsoleCheckInResultClassName('FUTURE_RESULT'), 'bg-[#fff7e6] text-[#ad6800]')
})
