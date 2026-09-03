import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SEARCH_RETURN_STATE_KEY,
  markSearchReturnPending,
  readSearchReturnState,
  restoreSearchScrollIfPending,
  saveSearchReturnState,
} from './search-return-state.ts'

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  clear() {
    this.values.clear()
  }
}

function installWindow(url = '/search?keyword=音乐会') {
  const storage = new MemoryStorage()
  const scrollCalls: unknown[] = []
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      sessionStorage: storage,
      location: { pathname: '/search', search: url.includes('?') ? url.slice(url.indexOf('?')) : '' },
      scrollY: 320,
      scrollTo: (...args: unknown[]) => scrollCalls.push(args),
      setTimeout: (callback: () => void) => {
        callback()
        return 1
      },
      clearTimeout: () => undefined,
    },
  })
  return { storage, scrollCalls }
}

test('search return state saves search url and restores pending scroll position', () => {
  const { scrollCalls } = installWindow()

  saveSearchReturnState({ url: '/search?keyword=音乐会&city=上海', scrollY: 480 })
  const saved = readSearchReturnState()
  assert.equal(saved?.url, '/search?keyword=音乐会&city=上海')
  assert.equal(saved?.scrollY, 480)
  assert.equal(saved?.pendingRestore, false)

  markSearchReturnPending()
  assert.equal(readSearchReturnState()?.pendingRestore, true)

  const restored = restoreSearchScrollIfPending()
  assert.equal(restored, true)
  assert.deepEqual(scrollCalls.at(-1), [{ top: 480, behavior: 'auto' }])
  assert.equal(readSearchReturnState()?.pendingRestore, false)
})

test('search return state rejects stale or non-search urls', () => {
  const { storage } = installWindow()
  storage.setItem(SEARCH_RETURN_STATE_KEY, JSON.stringify({
    url: 'https://example.com/search',
    scrollY: 100,
    savedAt: Date.now(),
    pendingRestore: true,
  }))
  assert.equal(readSearchReturnState(), null)

  storage.setItem(SEARCH_RETURN_STATE_KEY, JSON.stringify({
    url: '/search?keyword=旧记录',
    scrollY: 100,
    savedAt: Date.now() - 31 * 60 * 1000,
    pendingRestore: true,
  }))
  assert.equal(readSearchReturnState(), null)
})

