'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  width?: string
  children: ReactNode
  footer?: ReactNode
  loading?: boolean
}

export function Drawer({
  open,
  onClose,
  title,
  width = 'w-[480px]',
  children,
  footer,
  loading = false,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [loading, onClose, open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40"
      onClick={() => {
        if (!loading) onClose()
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className={`fixed inset-y-0 right-0 flex h-full max-w-full flex-col bg-white shadow-2xl transition-transform duration-300 ${width} translate-x-0`}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#f0f0f0] px-6 py-4">
          <h2 id="drawer-title" className="text-[18px] font-bold text-[#1a1a2e]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-full p-1.5 text-[#999] hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="关闭抽屉"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer ? <div className="border-t p-4 bg-white">{footer}</div> : null}
      </aside>
    </div>
  )
}
