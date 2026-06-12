'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { deleteSeatCraftVersion, getSeatCraftDraft, listSeatCraftVersions, publishSeatCraftDraft, rollbackSeatCraftVersion, saveSeatCraftDraft } from '@/lib/api'
import { globalConfirm } from '@/components/GlobalDialog'
import { SeatLayoutDesigner } from '@/components/seatcraft/SeatLayoutDesigner'
import { mergePersistedSeatCraftLayout, toSeatCraftVersionedLayoutPayload } from '@/components/seatcraft/block-layout'
import { toSeatCraftVersionedLayoutDraft, type SeatCraftLayoutDraft } from '@/components/seatcraft/types'
import type { SeatCraftVersionSummaryVO } from '@/types/api'

export default function StationSeatCraftPage() {
  const params = useParams<{ id: string }>()
  const stationId = Number(params.id)
  const [layout, setLayout] = useState<SeatCraftLayoutDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')
  const [versions, setVersions] = useState<SeatCraftVersionSummaryVO[]>([])
  const canPersistLayout = canPersistSeatCraftLayout(layout)

  const refreshVersions = () => listSeatCraftVersions('station', stationId).then(setVersions).catch(() => undefined)

  useEffect(() => {
    if (!Number.isInteger(stationId) || stationId <= 0) {
      setError('站点编号不正确')
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
    getSeatCraftDraft('station', stationId)
      .then(response => {
        if (cancelled) return
        setLayout(response ? toSeatCraftVersionedLayoutDraft(response) : null)
        setError('')
        listSeatCraftVersions('station', stationId).then(list => {
          if (!cancelled) setVersions(list)
        }).catch(() => {
          if (!cancelled) setVersions([])
        })
      })
      .catch(err => {
        if (cancelled) return
        setVersions([])
        setError(err instanceof Error ? err.message : '加载站点座位票档失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [stationId])

  const handleSave = async () => {
    if (!layout || !canPersistLayout || saving || publishing || creating) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const savedSnapshot = layout
      const response = await saveSeatCraftDraft('station', stationId, toSeatCraftVersionedLayoutPayload(savedSnapshot))
      const persistedLayout = toSeatCraftVersionedLayoutDraft(response)
      setLayout(current => current ? mergePersistedSeatCraftLayout(current, savedSnapshot, persistedLayout) : persistedLayout)
      refreshVersions()
      setMessage('站点座位票档草稿已保存')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存站点座位票档失败')
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
      const savedSnapshot = layout
      await saveSeatCraftDraft('station', stationId, toSeatCraftVersionedLayoutPayload(savedSnapshot))
      const response = await publishSeatCraftDraft('station', stationId)
      const persistedLayout = toSeatCraftVersionedLayoutDraft(response)
      setLayout(current => current ? mergePersistedSeatCraftLayout(current, savedSnapshot, persistedLayout) : persistedLayout)
      refreshVersions()
      setMessage('站点座位票档已发布')
    } catch (err) {
      setError(err instanceof Error ? err.message : '发布站点座位票档失败')
    } finally {
      setPublishing(false)
    }
  }

  const handleCreateBlank = () => {
    if (saving || publishing || creating) return
    setCreating(true)
    setError('')
    setMessage('')
    setLayout({
      id: stationId || 0,
      activityId: null,
      versionId: null,
      versionNo: null,
      versionStatus: 'draft',
      name: '站点座位票档',
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
    setVersions([])
    setMessage('已创建空白站点座位票档，请添加座位块和票档绑定后保存草稿')
    setCreating(false)
  }

  const handleRollbackVersion = async (version: SeatCraftVersionSummaryVO) => {
    if (!version.id || saving || publishing || creating) return
    setError('')
    setMessage('')
    try {
      const response = await rollbackSeatCraftVersion('station', stationId, version.id)
      setLayout(toSeatCraftVersionedLayoutDraft(response))
      await refreshVersions()
      setMessage(`已回到 v${version.versionNo ?? '-'}，可继续编辑或发布`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '回到历史版本失败')
    }
  }

  const handleDeleteVersion = async (version: SeatCraftVersionSummaryVO) => {
    if (!version.id || version.versionStatus === 'published' || saving || publishing || creating) return
    const ok = await globalConfirm({
      title: '确认删除',
      content: `确认删除 v${version.versionNo ?? '-'}？删除后不可恢复。`,
      type: 'danger',
      confirmText: '确认删除',
    })
    if (!ok) return
    setError('')
    setMessage('')
    try {
      await deleteSeatCraftVersion('station', stationId, version.id)
      await refreshVersions()
      setMessage(`已删除 v${version.versionNo ?? '-'}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除历史版本失败')
    }
  }

  if (loading) return <div className="py-20 text-center text-[14px] text-[#999]">加载站点座位票档中...</div>

  if (error) {
    return (
      <div className="rounded-xl border border-[#ffd9e6] bg-white p-6 text-[14px] text-[#666]">
        <div className="text-[#ff4d4f]">{error}</div>
        <Link href="/console/tours" className="mt-4 inline-block rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666]">返回巡演列表</Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">站点座位票档</h1>
          <p className="mt-1 text-[13px] text-[#999]">为当前巡演城市站点维护 SeatCraft 座位图、票档、票价和区域绑定。</p>
        </div>
        <Link href="/console/tours" className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666] hover:bg-[#fafafa]">返回巡演列表</Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {layout && <span className="rounded-full bg-[#f5f5f5] px-3 py-1 text-[12px] text-[#666]">{layout.versionStatus === 'published' ? '已发布' : '草稿'}{layout.versionNo ? ` · v${layout.versionNo}` : ''}</span>}
        <button onClick={handleSave} disabled={!layout || !canPersistLayout || saving || publishing || creating} className="rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50">{saving ? '保存中...' : '保存站点座位票档草稿'}</button>
        <button onClick={handlePublish} disabled={!layout || !canPersistLayout || saving || publishing || creating} className="rounded-lg border border-[#ff1268] px-4 py-2 text-[14px] font-medium text-[#ff1268] disabled:opacity-50">{publishing ? '发布中...' : '保存并发布站点座位票档'}</button>
        {message && <span className="text-[13px] text-[#16a34a]">{message}</span>}
      </div>

      {!layout ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white p-8 text-center text-[14px] text-[#666]">
          <div>当前站点还没有座位票档，可创建新的 SeatCraft 空白画布。</div>
          <button type="button" onClick={handleCreateBlank} disabled={saving || publishing || creating} className="mt-4 rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50">{creating ? '创建中...' : '创建空白站点座位票档'}</button>
        </div>
      ) : (
        <>
          {versions.length > 0 && <SeatCraftVersionList versions={versions} onRollback={handleRollbackVersion} onDelete={handleDeleteVersion} disabled={saving || publishing || creating} />}
          <SeatLayoutDesigner layout={layout} onChange={setLayout} />
        </>
      )}
    </div>
  )
}

function SeatCraftVersionList({ versions, onRollback, onDelete, disabled }: {
  versions: SeatCraftVersionSummaryVO[]
  onRollback: (version: SeatCraftVersionSummaryVO) => void
  onDelete: (version: SeatCraftVersionSummaryVO) => void
  disabled: boolean
}) {
  return (
    <div className="mb-4 rounded-xl border border-[#e5e5e5] bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[12px] font-semibold text-[#666]">历史版本</div>
        <div className="text-[12px] text-[#999]">共 {versions.length} 个版本</div>
      </div>
      <div className="max-h-[136px] space-y-2 overflow-y-auto pr-1">
        {versions.map(version => (
          <div key={`${version.id}-${version.versionNo}-${version.versionStatus}`} className="flex flex-col gap-2 rounded-lg bg-[#f7f7f8] px-3 py-2 text-[12px] text-[#666] sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <span className="font-semibold text-[#1a1a2e]">v{version.versionNo ?? '-'}</span>
              <span className="ml-2 rounded-full bg-white px-2 py-0.5">{formatVersionStatus(version.versionStatus)}</span>
              <span className="ml-2">{version.name ?? '未命名'}</span>
              <span className="ml-2 text-[#999]">{formatVersionTime(version.updateTime)}</span>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => onRollback(version)} disabled={disabled || !version.id} className="rounded-md border border-[#ff1268] px-2 py-1 text-[#ff1268] disabled:opacity-50">回到此版本</button>
              <button type="button" onClick={() => onDelete(version)} disabled={disabled || !version.id || version.versionStatus === 'published'} className="rounded-md border border-[#e5e5e5] px-2 py-1 text-[#666] disabled:opacity-50">删除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatVersionTime(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
}

function formatVersionStatus(value?: string | null) {
  if (value === 'published') return '已发布'
  if (value === 'archived') return '归档'
  return '草稿'
}

function canPersistSeatCraftLayout(layout: SeatCraftLayoutDraft | null) {
  const hasBindingSource = Boolean(
    (layout?.bindings?.length ?? 0) > 0
    || layout?.blocks?.some(block => Boolean(block.ticketGroupKey))
    || layout?.ticketGroups?.some(group => (group.sourceBlockKeys?.length ?? 0) > 0),
  )
  return Boolean(layout && (layout.blocks?.length ?? 0) > 0 && (layout.ticketGroups?.length ?? 0) > 0 && hasBindingSource)
}
