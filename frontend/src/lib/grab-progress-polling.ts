export const GRAB_PROGRESS_POLL_INTERVAL_MS = 500

type TimerHandle = ReturnType<typeof setInterval>

export function startGrabProgressPolling(
  fetchProgress: () => void,
  options: {
    setIntervalFn?: (callback: () => void, intervalMs: number) => TimerHandle | unknown
    clearIntervalFn?: (timer: TimerHandle | unknown) => void
  } = {},
) {
  fetchProgress()
  const timer = (options.setIntervalFn ?? setInterval)(fetchProgress, GRAB_PROGRESS_POLL_INTERVAL_MS)
  return () => {
    ;(options.clearIntervalFn ?? clearInterval)(timer as TimerHandle)
  }
}
