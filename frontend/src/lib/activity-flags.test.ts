import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getRealNameRequirementLabel } from './activity-flags.ts'

test('returns readable real-name requirement labels', () => {
  assert.equal(getRealNameRequirementLabel(true), '实名制')
  assert.equal(getRealNameRequirementLabel(false), '非实名制')
  assert.equal(getRealNameRequirementLabel(null), '非实名制')
  assert.equal(getRealNameRequirementLabel(undefined), '非实名制')
})
