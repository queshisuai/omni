'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { deleteSeatCraftVersion, getSeatCraftDraft, getSessionSeatLayout, listSeatCraftVersions, publishSeatCraftDraft, rollbackSeatCraftVersion, saveSeatCraftDraft } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { globalConfirm } from '@/components/GlobalDialog'
import { SeatLayoutDesigner } from '@/components/seatcraft/SeatLayoutDesigner'
import { mergePersistedSeatCraftLayout, toSeatCraftVersionedLayoutPayload } from '@/components/seatcraft/block-layout'
import { toSeatCraftVersionedLayoutDraft, type SeatCraftLayoutDraft } from '@/components/seatcraft/types'
import type { SeatCraftVersionSummaryVO, SessionSeatVO } from '@/types/api'

export default function SessionSeatLayoutPage() {
  const params = useParams<{ id: string }>()
  const sessionId = Number(params.id)
  const [layout, setLayout] = useState<SeatCraftLayoutDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sessionSeats, setSessionSeats] = useState<SessionSeatVO[]>([])
  const [versions, setVersions] = useState<SeatCraftVersionSummaryVO[]>([])
  const canPersistLayout = canPersistSeatCraftLayout(layout)

  const refreshVersions = () => listSeatCraftVersions('session', sessionId).then(setVersions).catch(() => undefined)

  const refreshSessionSeats = (userId: number) => getSessionSeatLayout(sessionId, userId).then(legacyLayout => setSessionSeats(legacyLayout?.seats ?? sessionSeats)).catch(() => undefined)

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
    getSeatCraftDraft('session', sessionId)
      .then(response => {
        if (cancelled) return
        setLayout(response ? toSeatCraftVersionedLayoutDraft(response) : null)
        setError('')
        getSessionSeatLayout(sessionId, user.userId)
          .then(legacyLayout => {
            if (!cancelled) setSessionSeats(legacyLayout?.seats ?? [])
          })
          .catch(() => {
            if (!cancelled) setSessionSeats([])
          })
        listSeatCraftVersions('session', sessionId)
          .then(versionList => {
            if (!cancelled) setVersions(versionList)
          })
          .catch(() => {
            if (!cancelled) setVersions([])
          })
      })
      .catch(err => {
        if (cancelled) return
        setLayout(null)
        setSessionSeats([])
        setVersions([])
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
    if (!user || !layout || !canPersistLayout || saving || publishing || creating) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const savedSnapshot = layout
      const response = await saveSeatCraftDraft('session', sessionId, toSeatCraftVersionedLayoutPayload(savedSnapshot))
      const persistedLayout = toSeatCraftVersionedLayoutDraft(response)
      setLayout(current => current ? mergePersistedSeatCraftLayout(current, savedSnapshot, persistedLayout) : persistedLayout)
      refreshSessionSeats(user.userId)
      refreshVersions()
      setMessage('场次 SeatCraft 座位图已保存')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存场次 SeatCraft 座位图失败')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    const user = getUser()
    if (!user || !layout || !canPersistLayout || saving || publishing || creating) return
    setPublishing(true)
    setError('')
    setMessage('')
    try {
      const savedSnapshot = layout
      await saveSeatCraftDraft('session', sessionId, toSeatCraftVersionedLayoutPayload(savedSnapshot))
      const response = await publishSeatCraftDraft('session', sessionId)
      const persistedLayout = toSeatCraftVersionedLayoutDraft(response)
      setLayout(current => current ? mergePersistedSeatCraftLayout(current, savedSnapshot, persistedLayout) : persistedLayout)
      refreshSessionSeats(user.userId)
      refreshVersions()
      setMessage('场次 SeatCraft 座位图已发布')
    } catch (err) {
      setError(err instanceof Error ? err.message : '发布场次 SeatCraft 座位图失败')
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
        id: sessionId || 0,
        sessionId,
        versionId: null,
        versionNo: null,
        versionStatus: 'draft',
        name: '场次 SeatCraft 座位图',
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
      setSessionSeats([])
      setVersions([])
      setMessage('已创建空白座位图，请添加座位块和票档绑定后保存草稿')
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建空白场次座位图失败')
    } finally {
      setCreating(false)
    }
  }

  const handleRollbackVersion = async (version: SeatCraftVersionSummaryVO) => {
    const user = getUser()
    if (!user || !version.id || saving || publishing || creating) return
    setError('')
    setMessage('')
    try {
      const response = await rollbackSeatCraftVersion('session', sessionId, version.id)
      setLayout(toSeatCraftVersionedLayoutDraft(response))
      await Promise.all([refreshVersions(), refreshSessionSeats(user.userId)])
      setMessage(`已回到 v${version.versionNo ?? '-'}，可继续编辑或发布`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '回到历史版本失败')
    }
  }

  const handleDeleteVersion = async (version: SeatCraftVersionSummaryVO) => {
    const user = getUser()
    if (!user || !version.id || version.versionStatus === 'published' || saving || publishing || creating) return
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
      await deleteSeatCraftVersion('session', sessionId, version.id)
      await Promise.all([refreshVersions(), refreshSessionSeats(user.userId)])
      setMessage(`已删除 v${version.versionNo ?? '-'}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除历史版本失败')
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
            disabled={saving || publishing || creating}
            className="mt-4 rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50"
          >
            {creating ? '创建中...' : '创建空白座位图'}
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[#f5f5f5] px-3 py-1 text-[12px] text-[#666]">
              {layout.versionStatus === 'published' ? '已发布' : '草稿'}{layout.versionNo ? ` · v${layout.versionNo}` : ''}
            </span>
            <button
              onClick={handleSave}
              disabled={!canPersistLayout || saving || publishing || creating}
              className="rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存草稿'}
            </button>
            <button
              onClick={handlePublish}
              disabled={!canPersistLayout || saving || publishing || creating}
              className="rounded-lg border border-[#ff1268] px-4 py-2 text-[14px] font-medium text-[#ff1268] disabled:opacity-50"
            >
              {publishing ? '发布中...' : '保存并发布'}
            </button>
            <span className="text-[13px] text-[#999]">至少添加一个座位块、票档组和票档绑定后才能保存草稿。</span>
          </div>
          {versions.length > 0 && <SeatCraftVersionList versions={versions} onRollback={handleRollbackVersion} onDelete={handleDeleteVersion} disabled={saving || publishing || creating} />}
          <SeatLayoutDesigner layout={layout} onChange={setLayout} sessionSeats={sessionSeats} />
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

  return Boolean(
    layout
    && (layout.blocks?.length ?? 0) > 0
    && (layout.ticketGroups?.length ?? 0) > 0
    && hasBindingSource,
  )
}
