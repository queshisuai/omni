export const SEARCH_RETURN_STATE_KEY = 'omni_search_return_state'

const MAX_SEARCH_RETURN_AGE_MS = 30 * 60 * 1000

export interface SearchReturnState {
  url: string
  scrollY: number
  savedAt: number
  pendingRestore: boolean
}

function getWindow() {
  return typeof window === 'undefined' ? null : window
}

function normalizeSearchUrl(url: string) {
  const trimmed = url.trim()
  if (!trimmed.startsWith('/search')) return null
  return trimmed
}

function writeSearchReturnState(state: SearchReturnState) {
  const currentWindow = getWindow()
  if (!currentWindow) return
  currentWindow.sessionStorage.setItem(SEARCH_RETURN_STATE_KEY, JSON.stringify(state))
}

export function readSearchReturnState(): SearchReturnState | null {
  const currentWindow = getWindow()
  if (!currentWindow) return null
  const raw = currentWindow.sessionStorage.getItem(SEARCH_RETURN_STATE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<SearchReturnState>
    const url = typeof parsed.url === 'string' ? normalizeSearchUrl(parsed.url) : null
    const savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : 0
    const scrollY = typeof parsed.scrollY === 'number' && Number.isFinite(parsed.scrollY)
      ? Math.max(0, parsed.scrollY)
      : 0
    if (!url || !savedAt || Date.now() - savedAt > MAX_SEARCH_RETURN_AGE_MS) {
      currentWindow.sessionStorage.removeItem(SEARCH_RETURN_STATE_KEY)
      return null
    }
    return {
      url,
      scrollY,
      savedAt,
      pendingRestore: parsed.pendingRestore === true,
    }
  } catch {
    currentWindow.sessionStorage.removeItem(SEARCH_RETURN_STATE_KEY)
    return null
  }
}

export function saveSearchReturnState(input: { url?: string; scrollY?: number } = {}) {
  const currentWindow = getWindow()
  if (!currentWindow) return false
  const url = normalizeSearchUrl(input.url || `${currentWindow.location.pathname}${currentWindow.location.search}`)
  if (!url) return false
  writeSearchReturnState({
    url,
    scrollY: Math.max(0, input.scrollY ?? currentWindow.scrollY ?? 0),
    savedAt: Date.now(),
    pendingRestore: false,
  })
  return true
}

export function markSearchReturnPending() {
  const state = readSearchReturnState()
  if (!state) return false
  writeSearchReturnState({ ...state, pendingRestore: true })
  return true
}

export function restoreSearchScrollIfPending() {
  const currentWindow = getWindow()
  const state = readSearchReturnState()
  if (!currentWindow || !state?.pendingRestore) return false
  const currentUrl = `${currentWindow.location.pathname}${currentWindow.location.search}`
  if (currentUrl !== state.url && currentWindow.location.pathname !== '/search') return false
  writeSearchReturnState({ ...state, pendingRestore: false })
  currentWindow.setTimeout(() => {
    currentWindow.scrollTo({ top: state.scrollY, behavior: 'auto' })
  }, 0)
  return true
}
