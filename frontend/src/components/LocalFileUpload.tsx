'use client'

import { ChangeEvent, useId, useRef, useState, useCallback } from 'react'
import { Loader2, UploadCloud, Link as LinkIcon, X } from 'lucide-react'
import Cropper from 'react-easy-crop'
import { SafeImage } from '@/components/SafeImage'
import { isRenderableImageSrc } from '@/lib/image-url'

type LocalFileUploadProps = {
  label: string
  value: string
  accept: string
  uploading: boolean
  onUpload: (file: File) => Promise<string>
  onChange: (url: string) => void
  hint?: string
  cropImage?: boolean
}

type Area = { x: number; y: number; width: number; height: number }

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', (error) => reject(error))
    img.src = imageSrc
  })

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('图片处理环境不可用')

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(new File([blob], 'cropped.jpg', { type: 'image/jpeg' }))
      } else {
        reject(new Error('图片裁剪结果为空'))
      }
    }, 'image/jpeg', 0.9)
  })
}

export function LocalFileUpload({ label, value, accept, uploading, onUpload, onChange, hint, cropImage }: LocalFileUploadProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const disabled = uploading || pending

  // Crop states
  const [cropSrc, setCropSrc] = useState<string>('')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (cropImage && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.addEventListener('load', () => {
        setCropSrc(reader.result?.toString() || '')
        if (inputRef.current) inputRef.current.value = ''
      })
      reader.readAsDataURL(file)
      return
    }

    await doUpload(file)
  }

  const doUpload = async (file: File) => {
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

  const handleConfirmCrop = async () => {
    if (!cropSrc || !croppedAreaPixels) return
    try {
      const croppedFile = await getCroppedImg(cropSrc, croppedAreaPixels)
      setCropSrc('')
      await doUpload(croppedFile)
    } catch (e) {
      setError('图片裁剪失败，请重试')
      setCropSrc('')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="text-[14px] font-semibold text-gray-800">{label}</label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            disabled={disabled}
            className="text-[12px] font-medium text-gray-400 hover:text-red-500 transition-colors disabled:cursor-not-allowed"
          >
            清除文件
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {value && isRenderableImageSrc(value) ? (
          <div className="relative h-[100px] w-[100px] shrink-0 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 shadow-sm group">
            <SafeImage src={value} alt={`${label}预览`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button 
                type="button" 
                onClick={() => inputRef.current?.click()} 
                className="text-white text-[12px] font-medium px-3 py-1.5 border border-white/50 rounded-full hover:bg-white/20 transition-colors"
              >
                更换
              </button>
            </div>
          </div>
        ) : (
          <div 
            onClick={() => inputRef.current?.click()}
            className="flex h-[100px] w-[100px] shrink-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 text-gray-400 transition-all hover:border-[#ff1268]/50 hover:bg-[#fff4f8] hover:text-[#ff1268]"
          >
            {pending ? (
              <Loader2 className="h-6 w-6 animate-spin text-[#ff1268]" />
            ) : (
              <>
                <UploadCloud className="h-6 w-6" />
                <span className="text-[12px] font-medium">点击上传</span>
              </>
            )}
          </div>
        )}

        <div className="flex-1 space-y-3 pt-1 w-full">
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            disabled={disabled}
            className="hidden"
          />
          
          {!(value && isRenderableImageSrc(value)) && (
            <div className="relative w-full">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                disabled={disabled}
                placeholder="上传后自动填入地址，也可手动粘贴"
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-[13px] text-gray-700 outline-none transition-all focus:border-[#ff1268]/40 focus:ring-4 focus:ring-[#ff1268]/10 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          )}
          
          {hint && <p className="text-[12px] leading-relaxed text-gray-500">{hint}</p>}
          {error && <p className="text-[12px] font-medium text-red-500" role="alert">{error}</p>}
        </div>
      </div>

      {cropSrc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl overflow-hidden w-full max-w-md shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white z-10">
              <h3 className="text-lg font-bold text-gray-900">调整头像</h3>
              <button onClick={() => setCropSrc('')} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative h-[300px] w-full bg-black/5">
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="p-5 bg-gray-50 border-t border-gray-100">
              <div className="flex items-center gap-4 mb-6">
                <span className="text-xs font-medium text-gray-500">缩放</span>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-label="缩放"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#ff1268]"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setCropSrc('')}
                  className="px-5 py-2.5 rounded-full text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmCrop}
                  className="px-5 py-2.5 rounded-full text-sm font-medium text-white bg-[#ff1268] hover:bg-[#e60f5f] shadow-sm shadow-[#ff1268]/20 transition-colors"
                >
                  确认裁剪
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
