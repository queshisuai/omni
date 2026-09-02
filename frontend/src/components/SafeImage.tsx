'use client'

import { useEffect, useState, type ImgHTMLAttributes, type SyntheticEvent } from 'react'
import { IMAGE_FALLBACK_SRC, resolveImageSrc } from '@/lib/image-url'

type SafeImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  src?: string | null
  fallbackSrc?: string
  onError?: (event: SyntheticEvent<HTMLImageElement, Event>) => void
}

export function SafeImage({ src, fallbackSrc = IMAGE_FALLBACK_SRC, onError, alt = '', ...props }: SafeImageProps) {
  const fallback = resolveImageSrc(fallbackSrc)
  const resolvedSrc = resolveImageSrc(src, fallback)
  const [currentSrc, setCurrentSrc] = useState(resolvedSrc)

  useEffect(() => {
    setCurrentSrc(resolveImageSrc(src, fallback))
  }, [src, fallback])

  const handleError = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    onError?.(event)
    if (currentSrc !== fallback) {
      setCurrentSrc(fallback)
    }
  }

  return <img {...props} src={currentSrc} alt={alt} onError={handleError} />
}
