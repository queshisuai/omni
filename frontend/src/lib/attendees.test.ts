import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatAttendeeSummary,
  maskChineseIdCard,
  normalizeChineseIdCard,
  removeAttendeeById,
  validateAttendeeSelection,
  getAttendeeIdTypeLabel,
} from './attendees.ts'
import type { UserAttendeeVO } from '../types/api.ts'

test('removes deleted attendee from list and current selection', () => {
  const attendees: UserAttendeeVO[] = [
    { id: 11, realName: 'Alice', idType: 'ID_CARD', idNoMask: '110***********011', phone: null, isDefault: false, createTime: '2026-05-31T00:00:00' },
    { id: 12, realName: 'Bob', idType: 'ID_CARD', idNoMask: '110***********022', phone: null, isDefault: false, createTime: '2026-05-31T00:00:00' },
  ]

  const next = removeAttendeeById(attendees, [12, 11], 12)

  assert.deepEqual(next.attendees.map((attendee) => attendee.id), [11])
  assert.deepEqual(next.selectedAttendeeIds, [11])
})

test('normalizes and masks Chinese ID cards for display', () => {
  assert.equal(normalizeChineseIdCard(' 11010519491231002x '), '11010519491231002X')
  assert.equal(maskChineseIdCard('11010519491231002X'), '110***********02X')
})

test('validates attendee count for real-name purchases', () => {
  assert.equal(validateAttendeeSelection(false, [], 2), null)
  assert.equal(validateAttendeeSelection(true, [11, 12], 2), null)
  assert.equal(validateAttendeeSelection(true, [11], 2), '请选择 2 位实名观演人')
})

test('formats selected attendee names with masked ids', () => {
  const attendees: UserAttendeeVO[] = [
    { id: 11, realName: 'Alice', idType: 'ID_CARD', idNoMask: '110***********011', phone: null, isDefault: false, createTime: '2026-05-31T00:00:00' },
    { id: 12, realName: 'Bob', idType: 'ID_CARD', idNoMask: '110***********022', phone: null, isDefault: false, createTime: '2026-05-31T00:00:00' },
  ]

  assert.equal(formatAttendeeSummary(attendees, [12, 11]), 'Bob（110***********022）、Alice（110***********011）')
})

test('localizes attendee id type labels for display', () => {
  assert.equal(getAttendeeIdTypeLabel('ID_CARD'), '身份证')
  assert.equal(getAttendeeIdTypeLabel('PASSPORT'), '护照')
  assert.equal(getAttendeeIdTypeLabel('UNKNOWN'), '证件')
})
