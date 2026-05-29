'use client'

import { normalizePageRequest } from '@/lib/pagination'
import type { FormEvent } from 'react'

interface PaginationProps {
  page: number
  total: number
  pageSize?: number
  loading?: boolean
  onChange: (page: number) => void
}

export const DEFAULT_PAGE_SIZE = 10

export function Pagination({ page, total, pageSize = DEFAULT_PAGE_SIZE, loading = false, onChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), pages)

  if (total <= pageSize) return null

  const goToPage = (nextPage: number) => {
    if (loading) return
    const normalized = normalizePageRequest(nextPage, pages)
    if (normalized !== current) onChange(normalized)
  }

  const submitJump = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const input = form.elements.namedItem('page') as HTMLInputElement | null
    const normalized = normalizePageRequest(input?.value ?? current, pages)

    if (input && normalized === current) input.value = String(current)
    goToPage(normalized)
  }

  return (
    <div className="mt-4 flex flex-col gap-3 text-[13px] text-[#666] lg:flex-row lg:items-center lg:justify-between">
      <div>
        共 {total} 条，当前第 {current} / {pages} 页
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => goToPage(current - 1)}
          disabled={loading || current <= 1}
          className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-[13px] text-[#666] hover:border-[#ff1268] hover:text-[#ff1268] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#e5e5e5] disabled:hover:text-[#666]"
        >
          上一页
        </button>
        <button
          type="button"
          onClick={() => goToPage(current + 1)}
          disabled={loading || current >= pages}
          className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-[13px] text-[#666] hover:border-[#ff1268] hover:text-[#ff1268] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#e5e5e5] disabled:hover:text-[#666]"
        >
          下一页
        </button>
        <form key={current} onSubmit={submitJump} className="flex items-center gap-2">
          <span className="whitespace-nowrap">跳至</span>
          <input
            name="page"
            aria-label="跳转页码"
            inputMode="numeric"
            defaultValue={current}
            disabled={loading}
            className="h-8 w-16 rounded-lg border border-[#e5e5e5] bg-white px-2 text-center text-[13px] text-[#333] outline-none focus:border-[#ff1268] disabled:cursor-not-allowed disabled:opacity-50"
          />
          <span className="whitespace-nowrap">页</span>
          <button
            type="submit"
            disabled={loading}
            className="h-8 rounded-lg border border-[#e5e5e5] bg-white px-3 text-[13px] text-[#666] hover:border-[#ff1268] hover:text-[#ff1268] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#e5e5e5] disabled:hover:text-[#666]"
          >
            跳转
          </button>
        </form>
      </div>
    </div>
  )
}
