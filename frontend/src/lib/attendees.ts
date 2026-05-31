import type { UserAttendeeVO } from '../types/api.ts'

export function normalizeChineseIdCard(value: string) {
  return value.trim().toUpperCase()
}

export function maskChineseIdCard(value: string) {
  const normalized = normalizeChineseIdCard(value)
  if (normalized.length <= 6) return normalized
  return `${normalized.slice(0, 3)}***********${normalized.slice(-3)}`
}

export function getAttendeeIdTypeLabel(value: string | null | undefined) {
  if (value === 'ID_CARD') return '身份证'
  if (value === 'PASSPORT') return '护照'
  return '证件'
}

export function validateAttendeeSelection(realNameRequired: boolean, attendeeIds: number[], quantity: number) {
  if (!realNameRequired) return null
  if (attendeeIds.length !== quantity) return `请选择 ${quantity} 位实名观演人`
  if (new Set(attendeeIds).size !== attendeeIds.length) return '实名观演人不能重复'
  return null
}

export function formatAttendeeSummary(attendees: UserAttendeeVO[], selectedIds: number[]) {
  const byId = new Map(attendees.map((attendee) => [attendee.id, attendee]))
  return selectedIds
    .map((id) => byId.get(id))
    .filter((attendee): attendee is UserAttendeeVO => Boolean(attendee))
    .map((attendee) => `${attendee.realName}（${attendee.idNoMask}）`)
    .join('、')
}
export function removeAttendeeById(attendees: UserAttendeeVO[], selectedAttendeeIds: number[], attendeeId: number) {
  return {
    attendees: attendees.filter((attendee) => attendee.id !== attendeeId),
    selectedAttendeeIds: selectedAttendeeIds.filter((id) => id !== attendeeId),
  }
}
