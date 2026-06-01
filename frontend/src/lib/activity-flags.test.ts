import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getRealNameRequirementLabel, getTicketTransferAllowedLabel } from './activity-flags.ts'

test('returns readable real-name requirement labels', () => {
  assert.equal(getRealNameRequirementLabel(true), '实名制')
  assert.equal(getRealNameRequirementLabel(false), '非实名制')
  assert.equal(getRealNameRequirementLabel(null), '非实名制')
  assert.equal(getRealNameRequirementLabel(undefined), '非实名制')
})

test('returns readable ticket transfer rule labels', () => {
  assert.equal(getTicketTransferAllowedLabel(true), '可转赠')
  assert.equal(getTicketTransferAllowedLabel(false), '不可转赠')
  assert.equal(getTicketTransferAllowedLabel(null), '可转赠')
  assert.equal(getTicketTransferAllowedLabel(undefined), '可转赠')
})
