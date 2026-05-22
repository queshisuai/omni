'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getActivitySeatLayout, updateActivitySeatLayout } from '@/lib/api'
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

export default function ActivitySeatLayoutPage() {
  const params = useParams<{ id: string }>()
  const activityId = Number(params.id)
  const [layout, setLayout] = useState<SeatCraftLayoutDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!Number.isInteger(activityId) || activityId <= 0) {
      setError('活动ID不正确')
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
    getActivitySeatLayout(activityId, user.userId)
      .then(response => {
        if (cancelled) return
        setLayout(response ? toSeatCraftLayoutDraft(response) : createDefaultLayout(`活动 #${activityId} SeatCraft 座位图`))
        setError('')
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : '加载座位图失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activityId])

  if (loading) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载座位图中...</div>
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[#ffd9e6] bg-white p-6 text-[14px] text-[#666]">
        <div className="text-[#ff4d4f]">{error}</div>
        <Link href="/console/activities" className="mt-4 inline-block rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666]">
          返回活动列表
        </Link>
      </div>
    )
  }

  const handleSave = async () => {
    const user = getUser()
    if (!user || !layout) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await updateActivitySeatLayout(activityId, {
        userId: user.userId,
        layout: toSeatCraftLayoutPayload({ ...layout, id: layout.id ?? activityId }),
      })
      setLayout(toSeatCraftLayoutDraft(response))
      setMessage('座位图已保存')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存座位图失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">活动座位图</h1>
          <p className="mt-1 text-[13px] text-[#999]">为当前活动创建或维护独立 SeatCraft 座位图，场次可复制后单独调整。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/console/activities/${activityId}/edit`} className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666] hover:bg-[#fafafa]">
            返回活动编辑
          </Link>
          <Link href={`/console/sessions?activityId=${activityId}`} className="rounded-lg bg-[#1a1a2e] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#2a2a42]">
            管理场次/票档
          </Link>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!layout || saving}
          className="rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存座位图'}
        </button>
        {message && <span className="text-[13px] text-[#16a34a]">{message}</span>}
      </div>

      {!layout ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-8 text-center text-[14px] text-[#666]">
          当前活动还没有座位图，可直接创建新的 SeatCraft 座位图。
        </div>
      ) : (
        <SeatLayoutDesigner layout={layout} onChange={setLayout} />
      )}
    </div>
  )
}
