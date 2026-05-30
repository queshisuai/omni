import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHomeResumeRefreshHandlers, createLatestRequestGate } from './home-resume-refresh.ts'

test('refreshes the home page when the browser returns through history', () => {
  let refreshCount = 0
  const handlers = createHomeResumeRefreshHandlers(
    () => { refreshCount += 1 },
    () => 'visible',
  )

  handlers.handlePopState()

  assert.equal(refreshCount, 1)
})

test('refreshes on pageshow events instead of only bfcache restores', () => {
  let refreshCount = 0
  const handlers = createHomeResumeRefreshHandlers(
    () => { refreshCount += 1 },
    () => 'visible',
  )

  handlers.handlePageShow()

  assert.equal(refreshCount, 1)
})

test('does not refresh while the page is still hidden', () => {
  let refreshCount = 0
  const handlers = createHomeResumeRefreshHandlers(
    () => { refreshCount += 1 },
    () => 'hidden',
  )

  handlers.handleVisibilityChange()

  assert.equal(refreshCount, 0)
})

test('marks only the newest home refresh request as current', () => {
  const gate = createLatestRequestGate()

  const first = gate.next()
  const second = gate.next()

  assert.equal(gate.isCurrent(first), false)
  assert.equal(gate.isCurrent(second), true)
})
