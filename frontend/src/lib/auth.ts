/**
 * Token 管理工具
 */

import type { UserRole } from '@/types/api'

export const AUTH_UPDATED_EVENT = 'omni-user-updated'

const TOKEN_KEY = 'omni_token'
const USER_KEY = 'omni_user'
const LEGACY_PREFIX = String.fromCharCode(100, 97, 109, 97, 105)
const LEGACY_TOKEN_KEY = `${LEGACY_PREFIX}_token`
const LEGACY_USER_KEY = `${LEGACY_PREFIX}_user`

interface StoredUser {
  userId: number
  phone: string
  nickname: string | null
  avatar?: string | null
  role?: UserRole
  permissionCodes?: string[]
}

function readWithLegacy(key: string, legacyKey: string): string | null {
  const current = localStorage.getItem(key)
  if (current !== null) return current
  const legacy = localStorage.getItem(legacyKey)
  if (legacy !== null) {
    localStorage.setItem(key, legacy)
    localStorage.removeItem(legacyKey)
  }
  return legacy
}

function removeLegacyAuth() {
  localStorage.removeItem(LEGACY_TOKEN_KEY)
  localStorage.removeItem(LEGACY_USER_KEY)
}

function dispatchAuthUpdated() {
  window.dispatchEvent(new Event(AUTH_UPDATED_EVENT))
}

export function setToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.removeItem(LEGACY_TOKEN_KEY)
  }
}

export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return readWithLegacy(TOKEN_KEY, LEGACY_TOKEN_KEY)
  }
  return null
}

export function removeToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    removeLegacyAuth()
  }
}

export function setUser(user: StoredUser) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    localStorage.removeItem(LEGACY_USER_KEY)
  }
}

export function updateStoredUser(patch: Partial<StoredUser>) {
  const current = getUser()
  if (!current || typeof window === 'undefined') {
    return
  }
  const next = { ...current, ...patch }
  localStorage.setItem(USER_KEY, JSON.stringify(next))
  localStorage.removeItem(LEGACY_USER_KEY)
  dispatchAuthUpdated()
}

export function updateUserRole(role: UserRole) {
  updateStoredUser({ role })
}

export function getUser(): StoredUser | null {
  if (typeof window !== 'undefined') {
    const raw = readWithLegacy(USER_KEY, LEGACY_USER_KEY)
    if (raw) {
      try { return JSON.parse(raw) } catch { return null }
    }
  }
  return null
}

export function isAuthenticated(): boolean {
  return getToken() !== null
}

export function logout() {
  removeToken()
  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
}
