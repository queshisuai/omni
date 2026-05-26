'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getVenueDefaultLayout, updateVenueDefaultLayout } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { SeatLayoutDesigner } from '@/components/seatcraft/SeatLayoutDesigner'
import { toSeatCraftLayoutPayload } from '@/components/seatcraft/block-layout'
import { toSeatCraftLayoutDraft, type SeatCraftLayoutDraft } from '@/components/seatcraft/types'

function createDefaultLayout(name: string): SeatCraftLayoutDraft {
  return {
    name,
    templateType: 'concert',
    stage: { title: '舞台', x: 0, y: 0 },
    canvasWidth: 960,
    canvasHeight: 720,
    sections: [],
    blocks: [],
    overrides: [],
    ticketGroups: [],
  }
}

export default function VenueSeatTemplatePage() {
  const params = useParams<{ id: string }>()
  const venueId = Number(params.id)
  const [layout, setLayout] = useState<SeatCraftLayoutDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!Number.isInteger(venueId) || venueId <= 0) {
      setError('场馆ID不正确')
      setLoading(false)
      return
    }
    const user = getUser()
    if (!user) {
      setError('请先登录')
      setLoading(false)
      return
    }
    if (user.role !== 'admin') {
      setError('仅管理员可维护场馆 SeatCraft 座位图')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    getVenueDefaultLayout(venueId)
      .then(response => {
        if (cancelled) return
        setLayout(response ? toSeatCraftLayoutDraft(response) : createDefaultLayout(`场馆 #${venueId} SeatCraft 座位图`))
        setError('')
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : '加载场馆 SeatCraft 座位图失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [venueId])

  const handleSave = async () => {
    const user = getUser()
    if (!user || !layout) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await updateVenueDefaultLayout(venueId, {
        userId: user.userId,
        layout: toSeatCraftLayoutPayload({ ...layout, id: layout.id ?? 0 }),
      })
      setLayout(toSeatCraftLayoutDraft(response))
      setMessage('场馆 SeatCraft 座位图已保存')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存场馆 SeatCraft 座位图失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载 SeatCraft 座位图中...</div>
  }

  if (error && !layout) {
    return (
      <div className="rounded-xl border border-[#ffd9e6] bg-white p-6 text-[14px] text-[#666]">
        <div className="text-[#ff4d4f]">{error}</div>
        <Link href="/console/venue" className="mt-4 inline-block rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666]">返回场馆记录</Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">场馆 SeatCraft 座位图</h1>
          <p className="mt-1 text-[13px] text-[#999]">维护场馆默认 SeatCraft 座位图；活动和场次可从这里复制生成。</p>
        </div>
        <Link href="/console/venue" className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666] hover:bg-[#fafafa]">返回场馆记录</Link>
      </div>

      {error && <div className="mb-4 rounded-lg bg-[#fff0f3] px-3 py-2 text-[13px] text-[#ff4d4f]">{error}</div>}
      {message && <div className="mb-4 rounded-lg bg-[#f0fff4] px-3 py-2 text-[13px] text-[#16a34a]">{message}</div>}

      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!layout || saving || (layout.sections.length === 0 && (layout.blocks?.length ?? 0) === 0)}
          className="rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存 SeatCraft 座位图'}
        </button>
        <span className="text-[13px] text-[#999]">至少绘制一个座位区域或座位块后才能保存。</span>
      </div>

      {layout && <SeatLayoutDesigner layout={layout} onChange={setLayout} />}
    </div>
  )
}
