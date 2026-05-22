'use client'

import { ChangeEvent, useRef, useState } from 'react'

type LocalFileUploadProps = {
  label: string
  value: string
  accept: string
  uploading: boolean
  onUpload: (file: File) => Promise<string>
  onChange: (url: string) => void
  hint?: string
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?.*)?$/i.test(url) || url.startsWith('data:image/') || url.startsWith('/uploads/')
}

export function LocalFileUpload({ label, value, accept, uploading, onUpload, onChange, hint }: LocalFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const disabled = uploading || pending

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setPending(true)
    setError('')
    try {
      const url = await onUpload(file)
      onChange(url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '上传失败，请重试')
    } finally {
      setPending(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            disabled={disabled}
            className="text-xs font-medium text-gray-400 hover:text-[#ff1268] disabled:cursor-not-allowed disabled:opacity-60"
          >
            清除
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {value && isImageUrl(value) && (
          <div className="h-24 w-24 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            <img src={value} alt={`${label}预览`} className="h-full w-full object-cover" />
          </div>
        )}

        <div className="flex-1 space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            disabled={disabled}
            className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-[#ff1268] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#e00958] disabled:cursor-not-allowed disabled:opacity-60"
          />
          {value && (
            <input
              type="text"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              disabled={disabled}
              placeholder="上传后自动填入文件地址"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#ff1268] focus:ring-2 focus:ring-[#ff1268]/15 disabled:bg-gray-50 disabled:text-gray-400"
            />
          )}
          {hint && <p className="text-xs leading-5 text-gray-500">{hint}</p>}
          {disabled && <p className="text-xs text-[#ff1268]">上传中...</p>}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  )
}
