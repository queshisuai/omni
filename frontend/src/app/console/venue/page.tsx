'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { createAdminVenue, deleteAdminVenue, getVenueDefaultLayout, listAdminVenues, updateAdminVenue } from '@/lib/api'
import { canUseConsoleAction } from '@/lib/console-auth'
import { globalAlert, globalConfirm } from '@/components/GlobalDialog'
import { DEFAULT_PAGE_SIZE, GlobalPagination } from '@/components/Pagination'
import { Modal } from '@/components/ui/Modal'
import { ClipboardList, Plus, Settings, Trash2 } from 'lucide-react'
import type { SeatCraftLayoutVO, VenueEntity } from '@/types/api'

const DEFAULT_LAYOUT_NOTICE = '此处配置为该场馆的默认底图模板（Default Layout），作为后续新建活动与场次时的初始复制底图，修改不会影响已关联的历史售票场次。'

export default function VenuePage() {
  const [venues, setVenues] = useState<VenueEntity[]>([])
  const [role, setRole] = useState('')
  const [permissionCodes, setPermissionCodes] = useState<string[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [capacity, setCapacity] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [page, setPage] = useState(1)
  const [defaultLayoutStatusByVenueId, setDefaultLayoutStatusByVenueId] = useState<Record<number, boolean>>({})

  const [editingVenue, setEditingVenue] = useState<VenueEntity | null>(null)
  const pageVenues = useMemo(() => venues.slice((page - 1) * DEFAULT_PAGE_SIZE, page * DEFAULT_PAGE_SIZE), [venues, page])
  const canManageVenueRecords = role !== 'organizer' && canUseConsoleAction('venue.manage', permissionCodes)

  const loadData = useCallback(() => {
    const u = getUser()
    if (!u) {
      setLoading(false)
      setLoadError('请先登录后再查看场馆记录')
      return
    }
    setRole(u.role || '')
    setPermissionCodes(u.permissionCodes || [])
    setLoading(true)
    setLoadError('')
    setDefaultLayoutStatusByVenueId({})
    listAdminVenues(u.userId)
      .then(data => {
        setVenues(data)
        setPage(1)
        Promise.all(data.map(venue => getVenueDefaultLayout(venue.id)
          .then(layout => [venue.id, hasConfiguredDefaultLayout(layout)] as const)
          .catch(() => [venue.id, false] as const)))
          .then(entries => setDefaultLayoutStatusByVenueId(Object.fromEntries(entries)))
      })
      .catch(err => setLoadError(err instanceof Error ? err.message : '加载场馆记录失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  const resetForm = () => {
    setName(''); setCity(''); setAddress(''); setCapacity('')
    setEditingVenue(null)
    setFormError('')
    setShowForm(false)
  }

  const openEdit = (venue: VenueEntity) => {
    setEditingVenue(venue)
    setName(venue.name)
    setCity(venue.city ?? '')
    setAddress(venue.address ?? '')
    setCapacity(venue.capacity != null ? String(venue.capacity) : '')
    setShowForm(true)
  }

  const openCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const handleSave = async () => {
    const u = getUser()
    if (!u) return
    if (!name.trim()) {
      setFormError('场馆名称不能为空')
      return
    }
    if (capacity.trim() && (!Number.isFinite(Number(capacity)) || Number(capacity) < 0)) {
      setFormError('容量必须是非负数字')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      if (editingVenue) {
        await updateAdminVenue(editingVenue.id, {
          userId: u.userId,
          name: name.trim(),
          city,
          address,
          capacity: capacity ? Number(capacity) : null,
        })
      } else {
        await createAdminVenue({
          userId: u.userId,
          name: name.trim(),
          city,
          address,
          capacity: capacity ? Number(capacity) : null,
        })
      }

      resetForm()
      loadData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '保存场馆记录失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (venue: VenueEntity) => {
    const u = getUser()
    if (!u) return
    if (!(await globalConfirm(`确认永久删除场馆记录“${venue.name}”？如果该场馆已被场次、审核资料或座位模板引用，系统会拒绝删除。`))) return
    setDeletingId(venue.id)
    try {
      await deleteAdminVenue(venue.id, u.userId)
      if (editingVenue?.id === venue.id) resetForm()
      loadData()
    } catch (err) {
      await globalAlert(err instanceof Error ? err.message : '删除场馆记录失败')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[22px] font-bold text-[#1a1a2e]">场馆记录</h1>
        <div className="flex items-center gap-2">
          {role === 'organizer' && (
            <Link href="/console/venue/apply" className="flex items-center gap-1.5 bg-[#ff1268] text-white px-4 py-2 rounded-lg text-[14px] font-medium hover:bg-[#e0105a] transition-colors">
              <ClipboardList className="w-4 h-4" /> + 提交场馆入驻申请
            </Link>
          )}
          {canManageVenueRecords && (
            <button onClick={openCreate} className="flex items-center gap-1.5 bg-[#ff1268] text-white px-4 py-2 rounded-lg text-[14px] font-medium hover:bg-[#e0105a] transition-colors border-none cursor-pointer">
              <Plus className="w-4 h-4" /> + 新增场馆记录
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-[#dbeafe] bg-[#eff6ff] p-3 text-[13px] leading-6 text-[#1d4ed8]">
        座位模板配置：{DEFAULT_LAYOUT_NOTICE}
      </div>

      {role === 'organizer' && (
        <div className="text-[13px] text-[#666] bg-[#fff8e1] border border-[#ffe082] rounded-lg p-3 mb-4">
          主办方可查看已审核场馆记录。场馆审核资料随活动或场馆记录提交，平台只核验资料真伪，不代表拥有场馆或授予场地使用权。
        </div>
      )}

      <Modal
        open={showForm}
        onClose={resetForm}
        title={editingVenue ? '编辑场馆记录' : '新增场馆记录'}
        size="md"
        loading={saving}
        footer={(
          <>
            <button type="button" onClick={resetForm} disabled={saving} className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666] disabled:cursor-not-allowed disabled:opacity-60">取消</button>
            <button type="button" onClick={handleSave} disabled={saving || !name.trim()} className="rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#e0105a] disabled:cursor-not-allowed disabled:opacity-50">{saving ? '保存中...' : '保存场馆记录'}</button>
          </>
        )}
      >
        <div className="grid gap-3">
          <input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="场馆名称 *" />
          <input value={city} onChange={e => setCity(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="城市" />
          <input value={address} onChange={e => setAddress(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="地址" />
          <input value={capacity} onChange={e => setCapacity(e.target.value)} type="number" min={0} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="容量" />
          {formError && <div className="rounded-lg bg-[#fef2f2] px-3 py-2 text-[13px] text-[#dc2626]">{formError}</div>}
        </div>
      </Modal>

      {loadError ? (
        <div className="rounded-xl border border-[#ffd9e6] bg-white py-16 text-center text-[14px] text-[#ff4d4f]">{loadError}</div>
      ) : loading ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white py-16 text-center text-[14px] text-[#999]">加载中...</div>
      ) : venues.length === 0 ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white py-16 text-center text-[14px] text-[#999]">暂无场馆记录</div>
      ) : (
        <div className="bg-white rounded-xl border border-[#e5e5e5] overflow-hidden">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-[#e5e5e5] bg-[#fafafa]">
              <th className="whitespace-nowrap p-3 text-left font-medium text-[#666]">场馆编号</th>
              <th className="whitespace-nowrap p-3 text-left font-medium text-[#666]">场馆名称</th>
              <th className="whitespace-nowrap p-3 text-left font-medium text-[#666]">所属城市</th>
              <th className="whitespace-nowrap p-3 text-left font-medium text-[#666]">详细地址</th>
              <th className="whitespace-nowrap p-3 text-left font-medium text-[#666]">容纳人数（Capacity）</th>
              <th className="w-28 min-w-[110px] whitespace-nowrap p-3 text-center font-medium text-[#666]">默认座位图状态</th>
              {canManageVenueRecords && <th className="min-w-[260px] whitespace-nowrap p-3 text-center font-medium text-[#666]">操作</th>}
            </tr>
          </thead>
          <tbody>
            {pageVenues.map(v => (
              <tr key={v.id} className="border-b border-[#f0f0f0] hover:bg-[#fafafa]">
                <td className="whitespace-nowrap p-3 text-[#999]">{v.id}</td>
                <td className="max-w-[240px] truncate p-3 font-medium text-[#333]" title={v.name}>{v.name}</td>
                <td className="whitespace-nowrap p-3 text-[#666]">{v.city || '-'}</td>
                <td className="max-w-[240px] truncate p-3 text-[#666]" title={v.address || ''}>{v.address || '-'}</td>
                <td className="whitespace-nowrap p-3 text-[#666]">{v.capacity ?? '-'}</td>
                <td className="w-28 min-w-[110px] whitespace-nowrap p-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-[12px] ${defaultLayoutStatusByVenueId[v.id] ? 'bg-[#f0fdf4] text-[#15803d]' : 'bg-[#f5f5f5] text-[#666]'}`}>
                    {defaultLayoutStatusByVenueId[v.id] ? '已配置' : '未配置'}
                  </span>
                </td>
                {canManageVenueRecords && (
                  <td className="min-w-[260px] whitespace-nowrap p-3 text-center">
                    <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                      <button onClick={() => openEdit(v)} className="rounded-lg border border-[#ddd] px-3 py-1.5 text-[13px] text-[#666] hover:bg-[#fafafa] cursor-pointer">编辑</button>
                      <Link href={`/console/venue/${v.id}/seats`} className="inline-flex items-center gap-1 rounded-lg border border-[#2563eb] px-3 py-1.5 text-[13px] text-[#2563eb] hover:bg-[#eff6ff]">
                        <Settings className="h-3.5 w-3.5" />
                        座位模板配置
                      </Link>
                      <button
                        onClick={() => handleDelete(v)}
                        disabled={deletingId === v.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#fecaca] px-3 py-1.5 text-[13px] text-[#ef4444] hover:bg-[#fff1f2] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingId === v.id ? '删除中' : '删除'}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 pb-4">
          <GlobalPagination page={page} total={venues.length} loading={loading} onChange={setPage} />
        </div>
      </div>
      )}
    </div>
  )
}

function hasConfiguredDefaultLayout(layout: SeatCraftLayoutVO | null) {
  return Boolean(
    layout
    && (
      (layout.sections?.length ?? 0) > 0
      || (layout.blocks?.length ?? 0) > 0
      || (layout.blockLayout?.blocks?.length ?? 0) > 0
    ),
  )
}
