'use client'

import { ChangeEvent, useId, useRef, useState } from 'react'
import { FileText, Loader2, UploadCloud, X } from 'lucide-react'
import type { PrivateAssetVO } from '@/types/api'

type PrivateFileUploadProps = {
  label: string
  value?: PrivateAssetVO | null
  accept?: string
  uploading?: boolean
  onUpload: (file: File) => Promise<PrivateAssetVO>
  onChange: (asset: PrivateAssetVO | null) => void
  hint?: string
}

function formatFileSize(size?: number | null) {
  if (!size || size <= 0) return '未知大小'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export function PrivateFileUpload({ label, value, accept, uploading = false, onUpload, onChange, hint }: PrivateFileUploadProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const disabled = uploading || pending
  const filename = value?.originalFilename || '未命名文件'
  const contentType = value?.contentType || '未知类型'

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setPending(true)
    setError('')
    try {
      const asset = await onUpload(file)
      onChange(asset)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '上传失败，请重试')
    } finally {
      setPending(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemove = () => {
    setError('')
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="text-[14px] font-semibold text-gray-800">{label}</label>
        {value && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-gray-400 transition-colors hover:text-red-500 disabled:cursor-not-allowed"
          >
            <X className="h-3.5 w-3.5" />
            移除文件
          </button>
        )}
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
      />

      {value ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#fff4f8] text-[#ff1268]">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-[14px] font-semibold text-gray-900">{filename}</p>
              <p className="text-[12px] text-gray-500">大小：{formatFileSize(value.fileSize)}</p>
              <p className="break-all text-[12px] text-gray-500">类型：{contentType}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="mt-4 inline-flex h-9 items-center justify-center rounded-full border border-gray-200 px-4 text-[13px] font-medium text-gray-700 transition-colors hover:border-[#ff1268]/40 hover:text-[#ff1268] disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            更换文件
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-4 py-8 text-gray-400 transition-all hover:border-[#ff1268]/50 hover:bg-[#fff4f8] hover:text-[#ff1268] disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-gray-50/50 disabled:hover:text-gray-400"
        >
          {pending ? <Loader2 className="h-6 w-6 animate-spin text-[#ff1268]" /> : <UploadCloud className="h-6 w-6" />}
          <span className="text-[13px] font-medium">选择文件并上传</span>
        </button>
      )}

      {hint && <p className="text-[12px] leading-relaxed text-gray-500">{hint}</p>}
      {error && <p className="text-[12px] font-medium text-red-500" role="alert">{error}</p>}
    </div>
  )
}
