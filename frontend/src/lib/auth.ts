/**
 * Token 管理工具
 */

const TOKEN_KEY = 'damai_token'
const USER_KEY = 'damai_user'

interface StoredUser {
  userId: number
  phone: string
  nickname: string | null
  role?: string
}

export function setToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token)
  }
}

export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY)
  }
  return null
}

export function removeToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }
}

export function setUser(user: StoredUser) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  }
}

export function getUser(): StoredUser | null {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(USER_KEY)
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
