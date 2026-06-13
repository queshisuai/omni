import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  canToggleArtistRiskStatus,
  formatArtistListReviewStatus,
  formatArtistListRiskStatus,
  getArtistListRiskTone,
  isKnownArtistReviewStatus,
  isReviewableArtistReviewStatus,
} from './console-artists.ts'

test('formats artist list review and risk statuses with Chinese unknown fallbacks', () => {
  assert.equal(formatArtistListReviewStatus('pending'), '待审核')
  assert.equal(formatArtistListReviewStatus('approved'), '已通过')
  assert.equal(formatArtistListReviewStatus('rejected'), '已拒绝')
  assert.equal(formatArtistListReviewStatus('future_status'), '未知审核状态')

  assert.equal(formatArtistListRiskStatus('normal'), '风险正常')
  assert.equal(formatArtistListRiskStatus('risky'), '风险艺人')
  assert.equal(formatArtistListRiskStatus('future_status'), '未知风险状态')
  assert.equal(getArtistListRiskTone('future_status'), 'yellow')
})

test('protects artist risk write action when risk status is unknown', () => {
  assert.equal(canToggleArtistRiskStatus('normal'), true)
  assert.equal(canToggleArtistRiskStatus('risky'), true)
  assert.equal(canToggleArtistRiskStatus('future_status'), false)
})

test('protects artist review write actions when review status is unknown', () => {
  assert.equal(isKnownArtistReviewStatus('pending'), true)
  assert.equal(isKnownArtistReviewStatus('approved'), true)
  assert.equal(isKnownArtistReviewStatus('rejected'), true)
  assert.equal(isKnownArtistReviewStatus('future_status'), false)

  assert.equal(isReviewableArtistReviewStatus('pending'), true)
  assert.equal(isReviewableArtistReviewStatus('approved'), false)
  assert.equal(isReviewableArtistReviewStatus('future_status'), false)
})
