'use client'

import { useState, useEffect } from 'react'

type DialogOptions = {
  title?: string
  content: string
  confirmText?: string
  cancelText?: string
  type: 'alert' | 'confirm' | 'prompt'
  placeholder?: string
  defaultValue?: string
  onConfirm?: (value?: string) => void
  onCancel?: () => void
}

let dialogFn: ((options: DialogOptions) => void) | null = null

export const globalAlert = (content: string, title = '提示') => {
  return new Promise<void>((resolve) => {
    if (dialogFn) {
      dialogFn({
        type: 'alert',
        title,
        content,
        onConfirm: () => resolve(),
      })
    } else {
      window.alert(content)
      resolve()
    }
  })
}

export const globalConfirm = (content: string, title = '确认操作') => {
  return new Promise<boolean>((resolve) => {
    if (dialogFn) {
      dialogFn({
        type: 'confirm',
        title,
        content,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      })
    } else {
      resolve(window.confirm(content))
    }
  })
}

export const globalPrompt = (content: string, title = '请输入', placeholder = '', defaultValue = '') => {
  return new Promise<string | null>((resolve) => {
    if (dialogFn) {
      dialogFn({
        type: 'prompt',
        title,
        content,
        placeholder,
        defaultValue,
        onConfirm: (val) => resolve(val || ''),
        onCancel: () => resolve(null),
      })
    } else {
      resolve(window.prompt(content, defaultValue))
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

  const handleConfirm = () => {
    setIsOpen(false)
    options.onConfirm?.(options.type === 'prompt' ? inputValue : undefined)
  }

  const handleCancel = () => {
    setIsOpen(false)
    options.onCancel?.()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-[400px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{options.title}</h3>
        </div>
        <div className="px-6 py-6 text-[15px] text-gray-600 leading-relaxed whitespace-pre-wrap">
          {options.content}
          {options.type === 'prompt' && (
            <div className="mt-4">
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder={options.placeholder}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 outline-none focus:border-[#ff1268] text-sm"
                autoFocus
              />
            </div>
          )}
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          {(options.type === 'confirm' || options.type === 'prompt') && (
            <button 
              onClick={handleCancel}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              {options.cancelText || '取消'}
            </button>
          )}
          <button 
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[#ff1268] hover:bg-[#e60f5f] shadow-sm shadow-[#ff1268]/20 transition-colors"
          >
            {options.confirmText || '确定'}
          </button>
        </div>
      </div>
    </div>
  )
}
