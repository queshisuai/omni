'use client'

import { useEffect, useState, type ImgHTMLAttributes, type SyntheticEvent } from 'react'
import { IMAGE_FALLBACK_SRC, resolveImageSrc } from '@/lib/image-url'

type SafeImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  src?: string | null
  fallbackSrc?: string
  fallbackText?: string | null
  fallbackClassName?: string
  onError?: (event: SyntheticEvent<HTMLImageElement, Event>) => void
}

export function SafeImage({
  src,
  fallbackSrc = IMAGE_FALLBACK_SRC,
  fallbackText,
  fallbackClassName,
  onError,
  alt = '',
  className,
  title,
  ...props
}: SafeImageProps) {
  const fallback = resolveImageSrc(fallbackSrc)
  const resolvedSrc = resolveImageSrc(src, fallback)
  const [currentSrc, setCurrentSrc] = useState(resolvedSrc)
  const [showTextFallback, setShowTextFallback] = useState(Boolean(fallbackText?.trim()) && resolvedSrc === fallback)

  useEffect(() => {
    const nextSrc = resolveImageSrc(src, fallback)
    setCurrentSrc(nextSrc)
    setShowTextFallback(Boolean(fallbackText?.trim()) && nextSrc === fallback)
  }, [src, fallback, fallbackText])

  const handleError = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    onError?.(event)
    if (fallbackText?.trim()) {
      setShowTextFallback(true)
      return
    }
    if (currentSrc !== fallback) {
      setCurrentSrc(fallback)
    }
  }

  if (showTextFallback) {
    const text = (fallbackText || alt || '图').trim()
    const initial = Array.from(text)[0] || '图'
    return (
      <span
        role="img"
        aria-label={alt || text}
        title={title}
        className={fallbackClassName || `inline-flex items-center justify-center bg-gradient-to-br from-[#fff1f6] to-[#e0f2fe] font-semibold text-[#ff1268] ${className || ''}`}
      >
        {initial}
      </span>
    )
  }

  return <img {...props} className={className} title={title} src={currentSrc} alt={alt} onError={handleError} />
}
