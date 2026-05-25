import type { SeatCraftLayoutDraft } from './types'

export const HISTORY_LIMIT = 50

export type CommitOptions = {
  mergeKey?: string
}

export type SeatCraftHistoryState = {
  past: SeatCraftLayoutDraft[]
  future: SeatCraftLayoutDraft[]
  lastMergeKey: string | null
  ownerKey: string
}

export function ownerKeyForLayout(layout: SeatCraftLayoutDraft) {
  return [layout.sessionId ?? '', layout.activityId ?? '', layout.venueId ?? '', layout.id ?? ''].join(':')
}

export function createSeatCraftHistory(layout: SeatCraftLayoutDraft): SeatCraftHistoryState {
  return {
    past: [],
    future: [],
    lastMergeKey: null,
    ownerKey: ownerKeyForLayout(layout),
  }
}

export function commitHistory(history: SeatCraftHistoryState, currentLayout: SeatCraftLayoutDraft, options: CommitOptions = {}): SeatCraftHistoryState {
  const ownerKey = ownerKeyForLayout(currentLayout)
  const shouldMerge = options.mergeKey != null && history.lastMergeKey === options.mergeKey
  return {
    ownerKey,
    past: shouldMerge ? history.past : pushHistory(history.past, currentLayout),
    future: [],
    lastMergeKey: options.mergeKey ?? null,
  }
}

export function undoHistory(history: SeatCraftHistoryState, currentLayout: SeatCraftLayoutDraft) {
  if (history.past.length === 0) return { history, layout: currentLayout }
  const previous = history.past[history.past.length - 1]
  return {
    layout: previous,
    history: {
      ...history,
      past: history.past.slice(0, -1),
      future: [currentLayout, ...history.future],
      lastMergeKey: null,
    },
  }
}

export function redoHistory(history: SeatCraftHistoryState, currentLayout: SeatCraftLayoutDraft) {
  if (history.future.length === 0) return { history, layout: currentLayout }
  const next = history.future[0]
  return {
    layout: next,
    history: {
      ...history,
      past: pushHistory(history.past, currentLayout),
      future: history.future.slice(1),
      lastMergeKey: null,
    },
  }
}

export function applyHistoryAction(history: SeatCraftHistoryState, currentLayout: SeatCraftLayoutDraft, action: 'undo' | 'redo') {
  return action === 'undo' ? undoHistory(history, currentLayout) : redoHistory(history, currentLayout)
}

export function resetHistoryForOwner(history: SeatCraftHistoryState, layout: SeatCraftLayoutDraft) {
  const ownerKey = ownerKeyForLayout(layout)
  return history.ownerKey === ownerKey ? history : createSeatCraftHistory(layout)
}

function pushHistory(history: SeatCraftLayoutDraft[], snapshot: SeatCraftLayoutDraft) {
  const next = [...history, snapshot]
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next
}
