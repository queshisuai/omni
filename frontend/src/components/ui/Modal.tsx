'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children: ReactNode
  footer?: ReactNode
  danger?: boolean
  loading?: boolean
}

const sizeClassName: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

export function Modal({
  open,
  onClose,
  title,
  size = 'md',
  children,
  footer,
  danger = false,
  loading = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [loading, onClose, open])

  if (!open) return null

  const defaultFooter = (
    <>
      <button
        type="button"
        onClick={onClose}
        disabled={loading}
        className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-2.5 text-[14px] font-medium text-[#666] hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-60"
      >
        取消
      </button>
      <button
        type="button"
        onClick={onClose}
        disabled={loading}
        className={`rounded-xl px-5 py-2.5 text-[14px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${danger ? 'bg-[#f53f3f] hover:bg-[#d92d2d]' : 'bg-[#ff1268] hover:bg-[#e0105a]'}`}
      >
        {loading ? '处理中...' : '确定'}
      </button>
    </>
  )

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={() => {
        if (!loading) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${sizeClassName[size]}`}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#f0f0f0] px-6 py-4">
          <h2 id="modal-title" className="text-[18px] font-bold text-[#1a1a2e]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-full p-1.5 text-[#999] hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="关闭弹窗"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">{children}</div>
        <div className="flex items-center justify-end gap-3 border-t border-[#f0f0f0] bg-[#fafafa] px-6 py-4">
          {footer ?? defaultFooter}
        </div>
      </div>
    </div>
  )
}
