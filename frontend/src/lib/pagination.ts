export function normalizePageRequest(value: number | string, totalPages: number) {
  const pages = Math.max(1, Math.trunc(totalPages))
  const parsed = typeof value === 'number' ? value : Number(value.trim())

  if (!Number.isFinite(parsed)) return 1

  const requestedPage = Math.trunc(parsed)
  return Math.min(Math.max(1, requestedPage), pages)
}
