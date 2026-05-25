'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getSeatCraftDraft, publishSeatCraftDraft, saveSeatCraftDraft } from '@/lib/api'
import { SeatLayoutDesigner } from '@/components/seatcraft/SeatLayoutDesigner'
import { toSeatCraftVersionedLayoutPayload } from '@/components/seatcraft/block-layout'
import { toSeatCraftVersionedLayoutDraft, type SeatCraftLayoutDraft } from '@/components/seatcraft/types'

export default function ActivitySeatLayoutPage() {
  const params = useParams<{ id: string }>()
  const activityId = Number(params.id)
  const [layout, setLayout] = useState<SeatCraftLayoutDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')
  const canPersistLayout = canPersistSeatCraftLayout(layout)

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
    getSeatCraftDraft('activity', activityId)
      .then(response => {
        if (cancelled) return
        setLayout(response ? toSeatCraftVersionedLayoutDraft(response) : null)
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
    if (!user || !layout || !canPersistLayout || saving || publishing || creating) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await saveSeatCraftDraft('activity', activityId, toSeatCraftVersionedLayoutPayload(layout))
      setLayout(toSeatCraftVersionedLayoutDraft(response))
      setMessage('草稿已保存')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存座位图失败')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!layout || !canPersistLayout || saving || publishing || creating) return
    setPublishing(true)
    setError('')
    setMessage('')
    try {
      await saveSeatCraftDraft('activity', activityId, toSeatCraftVersionedLayoutPayload(layout))
      const response = await publishSeatCraftDraft('activity', activityId)
      setLayout(toSeatCraftVersionedLayoutDraft(response))
      setMessage('座位图已发布')
    } catch (err) {
      setError(err instanceof Error ? err.message : '发布座位图失败')
    } finally {
      setPublishing(false)
    }
  }

  const handleCreateBlank = async () => {
    const user = getUser()
    if (!user || saving || publishing || creating) return
    setCreating(true)
    setError('')
    setMessage('')
    try {
      setLayout({
        id: activityId || 0,
        activityId,
        versionId: null,
        versionNo: null,
        versionStatus: 'draft',
        name: '活动座位图',
        templateType: 'concert',
        stage: { title: '舞台', x: 0, y: 0 },
        canvasWidth: 800,
        canvasHeight: 600,
        sections: [],
        blocks: [],
        overrides: [],
        ticketGroups: [],
        bindings: [],
      })
      setMessage('已创建空白座位图，请添加座位块和票档绑定后保存草稿')
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建空白座位图失败')
    } finally {
      setCreating(false)
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
        {layout && (
          <span className="rounded-full bg-[#f5f5f5] px-3 py-1 text-[12px] text-[#666]">
            {layout.versionStatus === 'published' ? '已发布' : '草稿'}{layout.versionNo ? ` · v${layout.versionNo}` : ''}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={!layout || !canPersistLayout || saving || publishing || creating}
          className="rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存草稿'}
        </button>
        <button
          onClick={handlePublish}
          disabled={!layout || !canPersistLayout || saving || publishing || creating}
          className="rounded-lg border border-[#ff1268] px-4 py-2 text-[14px] font-medium text-[#ff1268] disabled:opacity-50"
        >
          {publishing ? '发布中...' : '保存并发布'}
        </button>
        {message && <span className="text-[13px] text-[#16a34a]">{message}</span>}
      </div>

      {!layout ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-8 text-center text-[14px] text-[#666]">
          <div>当前活动还没有座位图，可创建新的 SeatCraft 空白画布。</div>
          <button
            type="button"
            onClick={handleCreateBlank}
            disabled={saving || publishing || creating}
            className="mt-4 rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50"
          >
            {creating ? '创建中...' : '创建空白座位图'}
          </button>
        </div>
      ) : (
        <SeatLayoutDesigner layout={layout} onChange={setLayout} />
      )}
    </div>
  )
}

function canPersistSeatCraftLayout(layout: SeatCraftLayoutDraft | null) {
  const hasBindingSource = Boolean(
    (layout?.bindings?.length ?? 0) > 0
    || layout?.blocks?.some(block => Boolean(block.ticketGroupKey))
    || layout?.ticketGroups?.some(group => (group.sourceBlockKeys?.length ?? 0) > 0),
  )

  return Boolean(
    layout
    && (layout.blocks?.length ?? 0) > 0
    && (layout.ticketGroups?.length ?? 0) > 0
    && hasBindingSource,
  )
}
