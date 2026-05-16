'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

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
    <div className="w-full flex justify-center mt-2">
      <div
        className="relative w-[1200px] h-[320px] overflow-hidden"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Slides */}
        {slides.map((slide, index) => (
          <a
            key={slide.id}
            href={slide.linkUrl || '#'}
            target={slide.linkUrl ? '_self' : undefined}
            className="absolute inset-0 w-full h-full transition-opacity duration-500 ease-in-out"
            style={{
              opacity: index === current ? 1 : 0,
              zIndex: index === current ? 1 : 0,
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
              className="absolute left-0 top-1/2 -mt-8 w-[56px] h-[64px] z-[101] flex items-center justify-center bg-black/50 hover:bg-[rgba(255,18,104,0.5)] transition-colors cursor-pointer border-none outline-none"
              aria-label="上一张"
            >
              <span className="inline-block w-[18px] h-[18px] border-solid border-white border-t-0 border-r-0 border-2 -rotate-[135deg] ml-1.5" />
            </button>
            <button
              onClick={next}
              className="absolute right-0 top-1/2 -mt-8 w-[56px] h-[64px] z-[101] flex items-center justify-center bg-black/50 hover:bg-[rgba(255,18,104,0.5)] transition-colors cursor-pointer border-none outline-none"
              aria-label="下一张"
            >
              <span className="inline-block w-[18px] h-[18px] border-solid border-white border-t-0 border-r-0 border-2 rotate-45 mr-1.5" />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {slides.length > 1 && (
          <div className="absolute right-8 bottom-[23px] z-[99] flex gap-2.5">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goTo(index)}
                className="w-2.5 h-2.5 rounded-full bg-white cursor-pointer border-none outline-none transition-opacity duration-300"
                style={{ opacity: index === current ? 1 : 0.32 }}
                aria-label={`第 ${index + 1} 张`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
