'use client'

import { useState, useRef, useEffect } from 'react'
import { ArrowRight, Check } from 'lucide-react'

interface SlideVerifyProps {
  onSuccess: () => void
}

export function SlideVerify({ onSuccess }: SlideVerifyProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState(0)
  const [verified, setVerified] = useState(false)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)

  const handlePointerDown = (e: React.PointerEvent) => {
    if (verified) return
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || verified) return
    if (!containerRef.current || !sliderRef.current) return
    
    const containerRect = containerRef.current.getBoundingClientRect()
    const sliderWidth = sliderRef.current.offsetWidth
    
    let newPos = e.clientX - containerRect.left - sliderWidth / 2
    const maxPos = containerRect.width - sliderWidth - 8 // 8px for padding (4 left + 4 right)
    
    if (newPos < 0) newPos = 0
    if (newPos >= maxPos) {
      newPos = maxPos
      setVerified(true)
      setIsDragging(false)
      onSuccess()
    }
    
    setPosition(newPos)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (verified) return
    setIsDragging(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
    
    if (!verified) {
      setPosition(0)
    }
  }

  return (
    <div 
      ref={containerRef}
      className={`relative h-12 rounded-xl overflow-hidden flex items-center justify-center border transition-colors select-none touch-none ${
        verified ? 'bg-green-50 border-green-200' : 'bg-gray-100 border-gray-200'
      }`}
    >
      <div 
        className={`absolute left-0 top-0 bottom-0 transition-colors ${verified ? 'bg-green-400' : 'bg-[#ff1268]/20'}`}
        style={{ width: position + 24, transition: (!isDragging && !verified) ? 'width 0.3s' : 'none' }}
      />
      
      <span className={`text-[14px] z-10 transition-colors ${verified ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
        {verified ? '验证成功' : '向右滑动验证'}
      </span>
      
      <div 
        ref={sliderRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`absolute left-1 top-1 bottom-1 w-[44px] rounded-lg shadow-sm border flex items-center justify-center z-20 ${
          verified 
            ? 'bg-white border-green-200 text-green-500 cursor-default' 
            : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50 cursor-grab active:cursor-grabbing'
        }`}
        style={{ 
          transform: `translateX(${position}px)`,
          transition: (!isDragging && !verified) ? 'transform 0.3s' : 'none'
        }}
      >
        {verified ? <Check className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
      </div>
    </div>
  )
}
