'use client'

import { useState, useRef, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

interface GraphicCaptchaProps {
  onSuccess: () => void
  onFail: () => void
}

export function GraphicCaptcha({ onSuccess, onFail }: GraphicCaptchaProps) {
  const [code, setCode] = useState('')
  const [input, setInput] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let result = ''
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  const drawCaptcha = (text: string) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Background
    ctx.fillStyle = '#f9fafb'
    ctx.fillRect(0, 0, width, height)

    // Text
    const colors = ['#ff1268', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#111827']
    ctx.font = 'bold 26px sans-serif'
    ctx.textBaseline = 'middle'

    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)]
      
      ctx.save()
      const x = 20 + i * 22
      const y = height / 2 + (Math.random() * 10 - 5)
      ctx.translate(x, y)
      const angle = (Math.random() * 60 - 30) * Math.PI / 180
      ctx.rotate(angle)
      ctx.fillText(char, 0, 0)
      ctx.restore()
    }

    // Noise lines
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = colors[Math.floor(Math.random() * colors.length)]
      ctx.beginPath()
      ctx.moveTo(Math.random() * width, Math.random() * height)
      ctx.lineTo(Math.random() * width, Math.random() * height)
      ctx.stroke()
    }

    // Noise dots
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)]
      ctx.beginPath()
      ctx.arc(Math.random() * width, Math.random() * height, 1, 0, 2 * Math.PI)
      ctx.fill()
    }
  }

  const refresh = () => {
    const newCode = generateCode()
    setCode(newCode)
    drawCaptcha(newCode)
    setInput('')
    onFail()
  }

  // Use an empty dependency array to only run on mount
  useEffect(() => {
    refresh()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInput(val)
    if (val.toLowerCase() === code.toLowerCase()) {
      onSuccess()
    } else {
      onFail()
    }
  }

  return (
    <div className="flex items-center gap-3 w-full">
      <input
        type="text"
        value={input}
        onChange={handleChange}
        placeholder="请输入右侧图形验证码"
        maxLength={4}
        className="flex-1 bg-gray-50/50 border border-gray-200 text-gray-900 rounded-xl block p-3.5 focus:ring-2 focus:ring-[#ff1268]/20 focus:border-[#ff1268] focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium"
      />
      <div 
        className="relative shrink-0 w-[120px] h-[52px] rounded-xl overflow-hidden border border-gray-200 cursor-pointer group shadow-sm bg-[#f9fafb]"
        onClick={refresh}
        title="点击刷新验证码"
      >
        <canvas ref={canvasRef} width={120} height={52} className="w-full h-full" />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <RefreshCw className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  )
}
