type VisibilityState = 'hidden' | 'visible' | 'prerender'

export function createHomeResumeRefreshHandlers(
  refresh: () => void,
  getVisibilityState: () => VisibilityState,
) {
  return {
    handlePageShow() {
      refresh()
    },
    handlePopState() {
      refresh()
    },
    handleVisibilityChange() {
      if (getVisibilityState() === 'visible') {
        refresh()
      }
    },
  }
}

export function createLatestRequestGate() {
  let current = 0
  return {
    next() {
      current += 1
      return current
    },
    isCurrent(requestId: number) {
      return requestId === current
    },
  }
}
