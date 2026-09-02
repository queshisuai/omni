import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { test } from 'node:test'

const sourceRoot = resolve(import.meta.dirname, '..')
const borrowedBrandPattern = new RegExp([100, 97, 109, 97, 105].map(code => String.fromCharCode(code)).join(''), 'i')

function collectProductionSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) return collectProductionSources(path)
    if (!/\.(css|ts|tsx)$/.test(entry.name)) return []
    if (/\.test\.(ts|tsx)$/.test(entry.name)) return []
    return [path]
  })
}

test('frontend production source uses Omni-neutral identifiers', () => {
  const hits = collectProductionSources(sourceRoot)
    .filter(path => borrowedBrandPattern.test(readFileSync(path, 'utf8')))
    .map(path => relative(sourceRoot, path).replace(/\\/g, '/'))

  assert.deepEqual(hits, [])
})

test('auth storage migrates legacy browser keys to Omni keys', async () => {
  const store = new Map<string, string>()
  const events: string[] = []
  const storage: Storage = {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  }

  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      dispatchEvent(event: Event) {
        events.push(event.type)
        return true
      },
      location: { href: '' },
    },
  })

  const { AUTH_UPDATED_EVENT, getToken, getUser, removeToken, setToken, setUser, updateStoredUser } = await import('./auth.ts')
  const legacyPrefix = [100, 97, 109, 97, 105].map(code => String.fromCharCode(code)).join('')
  const legacyUser = { userId: 2004, phone: '13900000001', nickname: '旧登录态', role: 'user' }

  storage.setItem(`${legacyPrefix}_token`, 'legacy-token')
  storage.setItem(`${legacyPrefix}_user`, JSON.stringify(legacyUser))

  assert.equal(getToken(), 'legacy-token')
  assert.equal(storage.getItem('omni_token'), 'legacy-token')
  assert.equal(storage.getItem(`${legacyPrefix}_token`), null)
  assert.deepEqual(getUser(), legacyUser)
  assert.equal(storage.getItem(`${legacyPrefix}_user`), null)

  setToken('fresh-token')
  setUser({ userId: 2004, phone: '13900000001', nickname: '新登录态', role: 'user' })
  updateStoredUser({ nickname: '已更新' })

  assert.equal(getToken(), 'fresh-token')
  assert.equal(getUser()?.nickname, '已更新')
  assert.deepEqual(events, [AUTH_UPDATED_EVENT])

  removeToken()
  assert.equal(storage.getItem('omni_token'), null)
  assert.equal(storage.getItem('omni_user'), null)
  assert.deepEqual(events, [AUTH_UPDATED_EVENT, AUTH_UPDATED_EVENT])
})
