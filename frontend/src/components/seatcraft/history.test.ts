import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyHistoryAction, commitHistory, createSeatCraftHistory, redoHistory, undoHistory } from './history.ts'
import type { SeatCraftLayoutDraft } from './types'

function layout(name: string, x = 0): SeatCraftLayoutDraft {
  return {
    id: 1,
    venueId: null,
    activityId: 10,
    sessionId: null,
    name,
    templateType: 'concert',
    stage: { title: '舞台', x, y: 0 },
    canvasWidth: 1000,
    canvasHeight: 800,
    sections: [],
    blocks: [],
    overrides: [],
    ticketGroups: [],
  }
}

test('commit, undo, and redo move layout snapshots between history stacks', () => {
  const initial = layout('初始')
  const changed = layout('已修改')
  const history = createSeatCraftHistory(initial)

  const committed = commitHistory(history, initial)
  const undone = undoHistory(committed, changed)
  const redone = redoHistory(undone.history, undone.layout)

  assert.equal(committed.past.length, 1)
  assert.equal(undone.layout.name, '初始')
  assert.equal(undone.history.future[0].name, '已修改')
  assert.equal(redone.layout.name, '已修改')
})

test('commit with the same merge key keeps one undo point for continuous drag', () => {
  const initial = layout('初始', 0)
  const firstDrag = layout('初始', 10)
  const secondDrag = layout('初始', 20)
  let history = createSeatCraftHistory(initial)

  history = commitHistory(history, initial, { mergeKey: 'move:block:block-a' })
  history = commitHistory(history, firstDrag, { mergeKey: 'move:block:block-a' })
  const undone = undoHistory(history, secondDrag)

  assert.equal(history.past.length, 1)
  assert.equal(undone.layout.stage.x, 0)
})

test('new commit after undo clears redo history', () => {
  const initial = layout('初始')
  const changed = layout('已修改')
  const another = layout('再次修改')
  const history = commitHistory(createSeatCraftHistory(initial), initial)
  const undone = undoHistory(history, changed)

  const afterNewCommit = commitHistory(undone.history, another)

  assert.equal(afterNewCommit.future.length, 0)
})

test('history action uses the latest history state for repeated undo', () => {
  const initial = layout('初始')
  const first = layout('第一次')
  const second = layout('第二次')
  let state = {
    history: commitHistory(commitHistory(createSeatCraftHistory(initial), initial), first),
    layout: second,
  }

  state = applyHistoryAction(state.history, state.layout, 'undo')
  state = applyHistoryAction(state.history, state.layout, 'undo')

  assert.equal(state.layout.name, '初始')
  assert.equal(state.history.future.map(item => item.name).join(','), '第一次,第二次')
})
