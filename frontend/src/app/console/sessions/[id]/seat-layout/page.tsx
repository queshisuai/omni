'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createBlankSessionSeatLayout, getSessionSeatLayout, updateSessionSeatLayout } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { SeatLayoutDesigner } from '@/components/seatcraft/SeatLayoutDesigner'
import { toSeatCraftLayoutPayload } from '@/components/seatcraft/block-layout'
import { toSeatCraftLayoutDraft, type SeatCraftLayoutDraft } from '@/components/seatcraft/types'
import type { SessionSeatVO } from '@/types/api'

export default function SessionSeatLayoutPage() {
  const params = useParams<{ id: string }>()
  const sessionId = Number(params.id)
  const [layout, setLayout] = useState<SeatCraftLayoutDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sessionSeats, setSessionSeats] = useState<SessionSeatVO[]>([])

  useEffect(() => {
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      setError('场次ID不正确')
      setLoading(false)
      return
    }

    const user = getUser()
    if (!user) {
      setError('请先登录')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    getSessionSeatLayout(sessionId, user.userId)
      .then(response => {
        if (cancelled) return
        setLayout(response ? toSeatCraftLayoutDraft(response) : null)
        setSessionSeats(response?.seats ?? [])
        setError('')
      })
      .catch(err => {
        if (cancelled) return
        setLayout(null)
        setSessionSeats([])
        setError(err instanceof Error ? err.message : '加载场次 SeatCraft 座位图失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sessionId])

  const handleSave = async () => {
    const user = getUser()
    if (!user || !layout) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await updateSessionSeatLayout(sessionId, {
        userId: user.userId,
        layout: toSeatCraftLayoutPayload({ ...layout, id: layout.id ?? 0 }),
      })
      setLayout(toSeatCraftLayoutDraft(response))
      setSessionSeats(response.seats ?? [])
      setMessage('场次 SeatCraft 座位图已保存')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存场次 SeatCraft 座位图失败')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateBlank = async () => {
    const user = getUser()
    if (!user) return
    setCreating(true)
    setError('')
    setMessage('')
    try {
      const response = await createBlankSessionSeatLayout(sessionId, user.userId)
      setLayout(toSeatCraftLayoutDraft(response))
      setSessionSeats(response.seats ?? [])
      setMessage('已创建空白场次座位图')
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建空白场次座位图失败')
    } finally {
      setCreating(false)
    }
  }



  if (loading) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载 SeatCraft 座位图中...</div>
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">场次 SeatCraft 座位图</h1>
          <p className="mt-1 text-[13px] text-[#999]">为当前场次创建或维护 SeatCraft 座位图，保存后即可在票档创建中绑定区域。</p>
        </div>
        <Link href="/console/sessions" className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666] hover:bg-[#fafafa]">
          返回场次/票档
        </Link>
      </div>

      {error && <div className="mb-4 rounded-lg bg-[#fff7ed] px-3 py-2 text-[13px] text-[#c2410c]">{error}</div>}
      {message && <div className="mb-4 rounded-lg bg-[#f0fff4] px-3 py-2 text-[13px] text-[#16a34a]">{message}</div>}

      {!layout ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-8 text-center text-[14px] text-[#666]">
          <div>当前场次还没有座位图，可创建新的 SeatCraft 空白画布。</div>
          <button
            type="button"
            onClick={handleCreateBlank}
            disabled={creating}
            className="mt-4 rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50"
          >
            {creating ? '创建中...' : '创建空白座位图'}
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || (layout.sections.length === 0 && (layout.blocks?.length ?? 0) === 0)}
              className="rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存 SeatCraft 座位图'}
            </button>
            <span className="text-[13px] text-[#999]">至少绘制一个座位区域或座位块后才能保存。</span>
          </div>
          <SeatLayoutDesigner layout={layout} onChange={setLayout} sessionSeats={sessionSeats} />
        </>
      )}
    </div>
  )
}
