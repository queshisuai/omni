'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface BannerSlide {
  id: string
  imageUrl: string
  linkUrl?: string
  title?: string
  subtitle?: string
  bgColor?: string
}

interface BannerProps {
  slides: BannerSlide[]
}

export function Banner({ slides }: BannerProps) {
  const [current, setCurrent] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    clearTimer()
    if (slides.length <= 1) return
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length)
    }, 3000)
  }, [slides.length, clearTimer])

  useEffect(() => {
    if (!isHovering) {
      startTimer()
    } else {
      clearTimer()
    }
    return clearTimer
  }, [isHovering, startTimer, clearTimer])

  const goTo = useCallback(
    (index: number) => {
      setCurrent(index)
      if (!isHovering) startTimer()
    },
    [isHovering, startTimer]
  )

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length)
    if (!isHovering) startTimer()
  }, [slides.length, isHovering, startTimer])

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length)
    if (!isHovering) startTimer()
  }, [slides.length, isHovering, startTimer])

  if (slides.length === 0) return null

  return (
    <div className="w-full flex justify-center pt-6 px-4">
      <div
        className="relative w-full max-w-[1200px] aspect-[21/9] sm:h-[400px] overflow-hidden rounded-3xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] group"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Slides */}
        {slides.map((slide, index) => (
          <a
            key={slide.id}
            href={slide.linkUrl || '#'}
            target={slide.linkUrl ? '_self' : undefined}
            className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${
              index === current ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
            style={{
              backgroundColor: slide.bgColor,
            }}
          >
            <img
              src={slide.imageUrl}
              alt={slide.title || ''}
              className="w-full h-full object-cover"
            />
          </a>
        ))}

        {/* Prev / Next buttons */}
        {slides.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full z-[101] flex items-center justify-center bg-white/20 backdrop-blur-md border border-white/30 text-white hover:bg-white/40 hover:scale-110 transition-all opacity-0 group-hover:opacity-100 shadow-lg"
              aria-label="上一张"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={next}
              className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full z-[101] flex items-center justify-center bg-white/20 backdrop-blur-md border border-white/30 text-white hover:bg-white/40 hover:scale-110 transition-all opacity-0 group-hover:opacity-100 shadow-lg"
              aria-label="下一张"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {slides.length > 1 && (
          <div className="absolute left-1/2 bottom-6 -translate-x-1/2 z-[99] flex gap-3 px-4 py-2 rounded-full bg-black/20 backdrop-blur-sm">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goTo(index)}
                className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all duration-300 ${
                  index === current ? 'bg-white w-6' : 'bg-white/50 hover:bg-white/80'
                }`}
                aria-label={`第 ${index + 1} 张`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
