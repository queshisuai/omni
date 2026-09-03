'use client'

import { buildPaginationItems, normalizePageRequest } from '@/lib/pagination'
import { useEffect, useRef, useState } from 'react'

interface PaginationProps {
  page: number
  total: number
  pageSize?: number
  loading?: boolean
  onChange: (page: number) => void
}

export const DEFAULT_PAGE_SIZE = 10

export function GlobalPagination({ page, total, pageSize = DEFAULT_PAGE_SIZE, loading = false, onChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), pages)
  const [editingJumpIndex, setEditingJumpIndex] = useState<number | null>(null)
  const [jumpValue, setJumpValue] = useState('')
  const jumpInputRef = useRef<HTMLInputElement>(null)
  const ignoreNextJumpBlurRef = useRef(false)

  useEffect(() => {
    setEditingJumpIndex(null)
    setJumpValue('')
  }, [current, pages])

  useEffect(() => {
    if (editingJumpIndex != null) {
      jumpInputRef.current?.focus()
      jumpInputRef.current?.select()
    }
  }, [editingJumpIndex])

  if (total <= pageSize) return null

  const pageItems = buildPaginationItems(current, pages)
  const goToPage = (nextPage: number) => {
    if (loading) return
    const normalized = normalizePageRequest(nextPage, pages)
    if (normalized !== current) onChange(normalized)
  }

  const closeInlineJump = () => {
    setEditingJumpIndex(null)
    setJumpValue('')
  }

  const cancelInlineJump = () => {
    ignoreNextJumpBlurRef.current = true
    closeInlineJump()
  }

  const submitInlineJump = () => {
    if (ignoreNextJumpBlurRef.current) {
      ignoreNextJumpBlurRef.current = false
      return
    }
    const value = jumpValue.trim()
    if (!value) {
      closeInlineJump()
      return
    }
    const normalized = normalizePageRequest(value, pages)
    ignoreNextJumpBlurRef.current = true
    closeInlineJump()
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
        {pageItems.map((item, index) => (
          item === 'jump-prev' || item === 'jump-next' ? (
            editingJumpIndex === index ? (
              <input
                key={`jump-input-${index}`}
                ref={jumpInputRef}
                type="text"
                inputMode="numeric"
                value={jumpValue}
                onChange={event => setJumpValue(event.target.value.replace(/\D/g, ''))}
                onBlur={submitInlineJump}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    submitInlineJump()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    cancelInlineJump()
                  }
                }}
                aria-label="输入页码跳转"
                placeholder="页码"
                disabled={loading}
                className="h-8 w-14 rounded-lg border border-[#ff2d55] bg-white px-2 text-center text-[13px] text-[#333] outline-none shadow-sm shadow-[#ff2d55]/10 disabled:cursor-not-allowed disabled:opacity-50"
              />
            ) : (
              <button
                key={`${item}-${index}`}
                type="button"
                onClick={() => {
                  if (loading) return
                  ignoreNextJumpBlurRef.current = false
                  setEditingJumpIndex(index)
                  setJumpValue('')
                }}
                disabled={loading}
                aria-label="输入页码跳转"
                title="输入页码跳转"
                className="h-8 min-w-8 rounded-lg border border-transparent px-2 text-[13px] font-medium text-gray-400 transition-all hover:border-gray-200 hover:bg-gray-50 hover:text-[#ff2d55] disabled:cursor-not-allowed disabled:opacity-50"
              >
                ...
              </button>
            )
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => goToPage(item)}
              disabled={loading}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                item === current
                  ? 'bg-[#ff2d55] text-white shadow-sm shadow-[#ff2d55]/20'
                  : 'border border-[#e5e5e5] bg-white text-[#666] hover:border-[#ff2d55] hover:text-[#ff2d55]'
              }`}
            >
              {item}
            </button>
          )
        ))}
        <button
          type="button"
          onClick={() => goToPage(current + 1)}
          disabled={loading || current >= pages}
          className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-[13px] text-[#666] hover:border-[#ff1268] hover:text-[#ff1268] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#e5e5e5] disabled:hover:text-[#666]"
        >
          下一页
        </button>
      </div>
    </div>
  )
}

export const Pagination = GlobalPagination
