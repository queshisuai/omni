export type PaginationItem = number | 'jump-prev' | 'jump-next'

export function normalizePageRequest(value: number | string, totalPages: number) {
  const pages = Math.max(1, Math.trunc(totalPages))
  const parsed = typeof value === 'number' ? value : Number(value.trim())

  if (!Number.isFinite(parsed)) return 1

  const requestedPage = Math.trunc(parsed)
  return Math.min(Math.max(1, requestedPage), pages)
}

export function buildPaginationItems(page: number, totalPages: number, delta = 2): PaginationItem[] {
  const pages = Math.max(1, Math.trunc(totalPages))
  const current = normalizePageRequest(page, pages)
  const items: PaginationItem[] = []

  for (let i = 1; i <= pages; i += 1) {
    if (i === 1 || i === pages || (i >= current - delta && i <= current + delta)) {
      items.push(i)
      continue
    }

    const jumpItem: PaginationItem = i < current ? 'jump-prev' : 'jump-next'
    if (items[items.length - 1] !== jumpItem) {
      items.push(jumpItem)
    }
  }

  return items
}
