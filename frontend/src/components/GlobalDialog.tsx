'use client'

import { useState, useEffect } from 'react'

type DialogType = 'alert' | 'confirm' | 'danger' | 'reason' | 'textarea'

type DialogOptions = {
  title?: string
  content: string
  confirmText?: string
  cancelText?: string
  type?: DialogType
  placeholder?: string
  defaultValue?: string
  textareaRows?: number
  onConfirm?: (value?: string) => void
  onCancel?: () => void
}

let dialogFn: ((options: DialogOptions) => void) | null = null

export const globalAlert = (contentOrOpts: string | DialogOptions, title = '提示') => {
  return new Promise<void>((resolve) => {
    if (dialogFn) {
      const opts = typeof contentOrOpts === 'string'
        ? { type: 'alert' as const, title, content: contentOrOpts }
        : { type: 'alert' as const, ...contentOrOpts }
      dialogFn({
        ...opts,
        onConfirm: () => resolve(),
      })
    } else {
      window.alert(typeof contentOrOpts === 'string' ? contentOrOpts : contentOrOpts.content)
      resolve()
    }
  })
}

export const globalConfirm = (contentOrOpts: string | DialogOptions, title = '确认操作') => {
  return new Promise<boolean>((resolve) => {
    if (dialogFn) {
      const opts = typeof contentOrOpts === 'string'
        ? { type: 'confirm' as const, title, content: contentOrOpts }
        : { type: 'confirm' as const, ...contentOrOpts }
      dialogFn({
        ...opts,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      })
    } else {
      resolve(window.confirm(typeof contentOrOpts === 'string' ? contentOrOpts : contentOrOpts.content))
    }
  })
}

export const globalPrompt = (
  contentOrOpts: string | DialogOptions,
  title = '请输入',
  placeholder = '',
  defaultValue = ''
) => {
  return new Promise<string | null>((resolve) => {
    if (dialogFn) {
      const opts = typeof contentOrOpts === 'string'
        ? { type: 'reason' as const, title, content: contentOrOpts, placeholder, defaultValue }
        : { type: 'reason' as const, ...contentOrOpts }
      dialogFn({
        ...opts,
        onConfirm: (val) => resolve(val || ''),
        onCancel: () => resolve(null),
      })
    } else {
      const text = typeof contentOrOpts === 'string' ? contentOrOpts : contentOrOpts.content
      resolve(window.prompt(text, defaultValue))
    }
  })
}

export function GlobalDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<DialogOptions | null>(null)
  const [inputValue, setInputValue] = useState('')

  useEffect(() => {
    dialogFn = (opts) => {
      setOptions(opts)
      setInputValue(opts.defaultValue || '')
      setIsOpen(true)
    }
    return () => {
      dialogFn = null
    }
  }, [])

  if (!isOpen || !options) return null

  const effectiveType = options.type || 'alert'

  const handleConfirm = () => {
    setIsOpen(false)
    options.onConfirm?.(effectiveType === 'reason' || effectiveType === 'textarea' ? inputValue : undefined)
  }

  const handleCancel = () => {
    setIsOpen(false)
    options.onCancel?.()
  }

  const isDanger = effectiveType === 'danger'
  const showCancel = effectiveType === 'confirm' || effectiveType === 'danger' || effectiveType === 'reason' || effectiveType === 'textarea'
  const showInput = effectiveType === 'reason' || effectiveType === 'textarea'

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-[400px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{options.title}</h3>
        </div>
        <div className="px-6 py-6 text-[15px] text-gray-600 leading-relaxed whitespace-pre-wrap">
          {options.content}
          {showInput && (
            <div className="mt-4">
              {effectiveType === 'textarea' ? (
                <textarea
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder={options.placeholder}
                  rows={options.textareaRows || 4}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-[#ff1268] text-sm resize-none"
                  autoFocus
                />
              ) : (
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder={options.placeholder}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 outline-none focus:border-[#ff1268] text-sm"
                  autoFocus
                />
              )}
            </div>
          )}
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          {showCancel && (
            <button
              onClick={handleCancel}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              {options.cancelText || '取消'}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700 shadow-sm shadow-red-600/20'
                : 'bg-[#ff1268] hover:bg-[#e60f5f] shadow-sm shadow-[#ff1268]/20'
            }`}
          >
            {options.confirmText || '确定'}
          </button>
        </div>
      </div>
    </div>
  )
}
