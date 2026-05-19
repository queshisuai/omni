'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { createAdminSession, createAdminTicketType, ensureSeatLayoutTemplates, getActivitySeatLayout, getSessionTicketDrafts, listAdminActivities, listAdminSessions, listAdminVenues, listVenueAreas, updateAdminSession } from '@/lib/api'
import { Edit, Plus, RefreshCw, X } from 'lucide-react'
import type { ActivityEntity, SeatCraftLayoutVO, SeatCraftSectionVO, SessionAdminVO, VenueAreaVO, VenueEntity } from '@/types/api'

const PAGE_SIZE = 10

type SessionForm = {
  id?: number
  activityId: string
  venueId: string
  startTime: string
  endTime: string
  status: string
  seatLayoutSource: 'none' | 'activity' | 'template'
  templateId: string
  activityLayoutId: string
}

const emptyForm: SessionForm = {
  activityId: '',
  venueId: '',
  startTime: '',
  endTime: '',
  status: '1',
  seatLayoutSource: 'none',
  templateId: '',
  activityLayoutId: '',
}

export default function SessionsPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>}>
      <SessionsPageContent />
    </Suspense>
  )
}

function SessionsPageContent() {
  const searchParams = useSearchParams()
  const [userId, setUserId] = useState(0)
  const [sessions, setSessions] = useState<SessionAdminVO[]>([])
  const [activities, setActivities] = useState<ActivityEntity[]>([])
  const [venues, setVenues] = useState<VenueEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activityFilter, setActivityFilter] = useState('')
  const [venueFilter, setVenueFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<SessionForm>(emptyForm)
  const [activitySeatLayout, setActivitySeatLayout] = useState<SeatCraftLayoutVO | null>(null)
  const [seatTemplates, setSeatTemplates] = useState<SeatCraftLayoutVO[]>([])
  const [layoutLoading, setLayoutLoading] = useState(false)
  const layoutRequestRef = useRef(0)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [ticketFormSession, setTicketFormSession] = useState<SessionAdminVO | null>(null)
  const [sessionAreas, setSessionAreas] = useState<VenueAreaVO[]>([])
  const [ticketName, setTicketName] = useState('')
  const [ticketPrice, setTicketPrice] = useState('')
  const [selectedAreaIds, setSelectedAreaIds] = useState<number[]>([])
  const [ticketDrafts, setTicketDrafts] = useState<SeatCraftSectionVO[]>([])
  const [selectedLayoutSectionIds, setSelectedLayoutSectionIds] = useState<number[]>([])
  const [ticketMessage, setTicketMessage] = useState('')
  const ticketDraftRequestRef = useRef(0)
  const rawActivityId = searchParams.get('activityId') || ''
  const currentActivityId = isPositiveInteger(rawActivityId) ? rawActivityId : ''

  const loadSessions = (nextPage = page, nextActivityFilter = activityFilter) => {
    const u = getUser()
    if (!u) return
    setUserId(u.userId)
    setLoading(true)
    setError('')
    listAdminSessions(u.userId, {
      page: nextPage,
      size: PAGE_SIZE,
      activityId: nextActivityFilter ? Number(nextActivityFilter) : undefined,
      venueId: venueFilter ? Number(venueFilter) : undefined,
      status: statusFilter === '' ? undefined : Number(statusFilter),
    }).then(res => {
      setSessions(res.records)
      setTotal(res.total)
      setPages(res.pages || 1)
      setPage(res.current || nextPage)
      setLoading(false)
    }).catch(err => {
      setError(err instanceof Error ? err.message : '加载场次失败')
      setLoading(false)
    })
  }

  useEffect(() => {
    const u = getUser()
    if (!u) return
    setUserId(u.userId)
    setActivityFilter(currentActivityId)
    listAdminActivities(u.userId, { page: 1, size: 100 }).then(res => setActivities(res.records)).catch(() => {})
    listAdminVenues(u.userId).then(setVenues).catch(() => {})
    loadSessions(1, currentActivityId)
  }, [currentActivityId])

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    loadSessions(1)
  }

  const openCreate = () => {
    setForm(emptyForm)
    setActivitySeatLayout(null)
    setSeatTemplates([])
    setFormError('')
    setFormOpen(true)
  }

  const openEdit = (session: SessionAdminVO) => {
    setForm({
      id: session.id,
      activityId: String(session.activityId),
      venueId: String(session.venueId),
      startTime: toInputTime(session.startTime),
      endTime: session.endTime ? toInputTime(session.endTime) : '',
      status: String(session.status),
      seatLayoutSource: 'none',
      templateId: '',
      activityLayoutId: '',
    })
    setFormError('')
    setFormOpen(true)
  }

  const loadSeatLayoutOptions = async (nextForm: SessionForm) => {
    const requestId = layoutRequestRef.current + 1
    layoutRequestRef.current = requestId
    if (nextForm.id || !isPositiveInteger(nextForm.activityId) || !isPositiveInteger(nextForm.venueId)) {
      setActivitySeatLayout(null)
      setSeatTemplates([])
      setLayoutLoading(false)
      return
    }
    setLayoutLoading(true)
    try {
      const [activityLayout, templates] = await Promise.all([
        getActivitySeatLayout(Number(nextForm.activityId), userId).catch(() => null),
        ensureSeatLayoutTemplates(Number(nextForm.venueId), userId).catch(() => [] as SeatCraftLayoutVO[]),
      ])
      if (layoutRequestRef.current !== requestId) return
      setActivitySeatLayout(activityLayout)
      setSeatTemplates(templates)
      setForm(current => {
        if (current.id || current.activityId !== nextForm.activityId || current.venueId !== nextForm.venueId) return current
        if (current.seatLayoutSource === 'activity' && activityLayout) {
          return { ...current, activityLayoutId: String(activityLayout.id), templateId: '' }
        }
        if (current.seatLayoutSource === 'template' && templates.length > 0) {
          return { ...current, templateId: String(templates[0].id), activityLayoutId: '' }
        }
        return current
      })
    } finally {
      if (layoutRequestRef.current === requestId) setLayoutLoading(false)
    }
  }

  const validateForm = () => {
    if (!form.activityId) return '请选择活动'
    if (!isPositiveInteger(form.activityId)) return '活动ID不正确'
    if (!form.venueId) return '请选择场馆'
    if (!isPositiveInteger(form.venueId)) return '场馆ID不正确'
    if (!form.startTime) return '请选择开始时间'
    if (form.endTime && new Date(form.endTime).getTime() <= new Date(form.startTime).getTime()) {
      return '结束时间必须晚于开始时间'
    }
    return ''
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationError = validateForm()
    if (validationError) {
      setFormError(validationError)
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      const body = {
        userId,
        activityId: Number(form.activityId),
        venueId: Number(form.venueId),
        startTime: form.startTime,
        endTime: form.endTime || null,
        status: Number(form.status),
        ...(form.seatLayoutSource === 'activity' && form.activityLayoutId ? { activityLayoutId: Number(form.activityLayoutId) } : {}),
        ...(form.seatLayoutSource === 'template' && form.templateId ? { templateId: Number(form.templateId) } : {}),
      }
      if (form.id) {
        await updateAdminSession(form.id, body)
      } else {
        await createAdminSession(body)
      }
      setFormOpen(false)
      loadSessions(page)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '保存场次失败')
    } finally {
      setSubmitting(false)
    }
  }

  const openTicketForm = async (session: SessionAdminVO) => {
    setTicketFormSession(session)
    setTicketName('')
    setTicketPrice('')
    setSelectedAreaIds([])
    setSessionAreas([])
    setTicketDrafts([])
    setSelectedLayoutSectionIds([])
    setTicketMessage('')
    const requestId = ticketDraftRequestRef.current + 1
    ticketDraftRequestRef.current = requestId
    getSessionTicketDrafts(session.id, userId)
      .then(drafts => {
        if (ticketDraftRequestRef.current !== requestId) return
        setTicketDrafts(drafts)
        setSelectedLayoutSectionIds(drafts.filter(draft => !draft.ticketTypeId).map(draft => draft.id))
        if (drafts.length === 0) {
          listVenueAreas(session.venueId, userId).then(areas => {
            if (ticketDraftRequestRef.current === requestId) setSessionAreas(areas)
          }).catch(() => {
            if (ticketDraftRequestRef.current === requestId) setSessionAreas([])
          })
        }
      })
      .catch(() => {
        if (ticketDraftRequestRef.current !== requestId) return
        setTicketDrafts([])
        listVenueAreas(session.venueId, userId).then(areas => {
          if (ticketDraftRequestRef.current === requestId) setSessionAreas(areas)
        }).catch(() => {
          if (ticketDraftRequestRef.current === requestId) setSessionAreas([])
        })
      })
  }

  const toggleArea = (areaId: number) => {
    setSelectedAreaIds(current => current.includes(areaId) ? current.filter(id => id !== areaId) : [...current, areaId])
  }

  const toggleLayoutSection = (sectionId: number) => {
    setSelectedLayoutSectionIds(current => current.includes(sectionId) ? current.filter(id => id !== sectionId) : [...current, sectionId])
  }

  const usingSeatCraftDrafts = ticketDrafts.length > 0
  const estimatedStock = usingSeatCraftDrafts
    ? ticketDrafts.filter(section => selectedLayoutSectionIds.includes(section.id)).reduce((sum, section) => sum + (section.seatCount || section.rows * section.cols), 0)
    : sessionAreas.filter(area => selectedAreaIds.includes(area.id)).reduce((sum, area) => sum + area.rowCount * area.seatsPerRow, 0)

  const handleCreateTicketType = async () => {
    if (!ticketFormSession) return
    if (!ticketName.trim()) {
      setTicketMessage('请填写票档名称')
      return
    }
    if (!ticketPrice || Number(ticketPrice) <= 0) {
      setTicketMessage('请填写有效票价')
      return
    }
    if (usingSeatCraftDrafts && selectedLayoutSectionIds.length === 0) {
      setTicketMessage('请选择绑定分区')
      return
    }
    if (!usingSeatCraftDrafts && selectedAreaIds.length === 0) {
      setTicketMessage('请选择绑定区域')
      return
    }
    try {
      await createAdminTicketType({
        userId,
        sessionId: ticketFormSession.id,
        name: ticketName.trim(),
        price: Number(ticketPrice),
        totalStock: estimatedStock,
        ...(usingSeatCraftDrafts ? { layoutSectionIds: selectedLayoutSectionIds } : { areaIds: selectedAreaIds }),
      })
      setTicketMessage('票档已创建，库存已按区域座位自动计算')
      setSelectedLayoutSectionIds([])
      setTicketDrafts(current => current.map(section => selectedLayoutSectionIds.includes(section.id) ? { ...section, ticketTypeId: -1 } : section))
      loadSessions(page)
    } catch (err) {
      setTicketMessage(err instanceof Error ? err.message : '创建票档失败')
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">场次管理</h1>
          <p className="mt-1 text-[13px] text-[#999]">管理活动场次、场馆安排和票档库存统计。</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[#e0105a]">
          <Plus className="h-4 w-4" /> 新建场次
        </button>
      </div>

      <form onSubmit={handleSearch} className="mb-5 grid gap-3 rounded-xl border border-[#e5e5e5] bg-white p-4 lg:grid-cols-[1fr_1fr_160px_auto]">
        <select value={activityFilter} onChange={event => setActivityFilter(event.target.value)} className="h-10 rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]">
          <option value="">全部活动</option>
          {activities.map(activity => <option key={activity.id} value={activity.id}>{activity.name}</option>)}
        </select>
        <select value={venueFilter} onChange={event => setVenueFilter(event.target.value)} className="h-10 rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]">
          <option value="">全部场馆</option>
          {venues.map(venue => <option key={venue.id} value={venue.id}>{venue.name} ({venue.city})</option>)}
        </select>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="h-10 rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]">
          <option value="">全部状态</option>
          <option value="1">启用</option>
          <option value="0">停用</option>
        </select>
        <button type="submit" className="h-10 rounded-lg bg-[#1a1a2e] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#2a2a42]">查询</button>
      </form>

      {formOpen && (
        <form onSubmit={handleSubmit} className="mb-5 rounded-xl border border-[#ffd9e6] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[16px] font-bold text-[#1a1a2e]">{form.id ? '编辑场次' : '新建场次'}</h2>
            <button type="button" onClick={() => setFormOpen(false)} className="rounded-full p-1 text-[#999] hover:bg-[#f5f5f5]"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <label className="block text-[13px] text-[#666]">
              活动 *
              <select value={form.activityId} disabled={Boolean(form.id)} onChange={event => {
                const nextForm = { ...form, activityId: event.target.value, seatLayoutSource: 'none' as const, activityLayoutId: '', templateId: '' }
                setForm(nextForm)
                loadSeatLayoutOptions(nextForm)
              }} className="mt-1 h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268] disabled:bg-[#f5f5f5]">
                <option value="">请选择活动</option>
                {activities.map(activity => <option key={activity.id} value={activity.id}>{activity.name}</option>)}
              </select>
            </label>
            <label className="block text-[13px] text-[#666]">
              场馆 *
              <select value={form.venueId} onChange={event => {
                const nextForm = { ...form, venueId: event.target.value, seatLayoutSource: 'none' as const, activityLayoutId: '', templateId: '' }
                setForm(nextForm)
                loadSeatLayoutOptions(nextForm)
              }} className="mt-1 h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]">
                <option value="">请选择场馆</option>
                {venues.map(venue => <option key={venue.id} value={venue.id}>{venue.name} ({venue.city})</option>)}
              </select>
            </label>
            <label className="block text-[13px] text-[#666]">
              开始时间 *
              <input type="datetime-local" value={form.startTime} onChange={event => setForm({ ...form, startTime: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]" />
            </label>
            <label className="block text-[13px] text-[#666]">
              结束时间
              <input type="datetime-local" value={form.endTime} onChange={event => setForm({ ...form, endTime: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]" />
            </label>
            <label className="block text-[13px] text-[#666]">
              状态
              <select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]">
                <option value="1">启用</option>
                <option value="0">停用</option>
              </select>
            </label>
          </div>
          {!form.id && (
            <div className="mt-4 rounded-xl border border-[#f0f0f0] bg-[#fafafa] p-4">
              <div className="mb-3 text-[13px] font-semibold text-[#333]">SeatCraft 座位图来源</div>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className={`rounded-lg border p-3 text-[12px] ${form.seatLayoutSource === 'none' ? 'border-[#ff1268] bg-white' : 'border-[#e5e5e5]'}`}>
                  <input type="radio" checked={form.seatLayoutSource === 'none'} onChange={() => setForm({ ...form, seatLayoutSource: 'none', activityLayoutId: '', templateId: '' })} /> 不复制座位图
                </label>
                <label className={`rounded-lg border p-3 text-[12px] ${form.seatLayoutSource === 'activity' ? 'border-[#ff1268] bg-white' : 'border-[#e5e5e5]'}`}>
                  <input type="radio" disabled={!activitySeatLayout || layoutLoading} checked={form.seatLayoutSource === 'activity'} onChange={() => setForm({ ...form, seatLayoutSource: 'activity', activityLayoutId: activitySeatLayout ? String(activitySeatLayout.id) : '', templateId: '' })} /> 从活动统一图复制
                  <div className="mt-1 text-[#999]">{activitySeatLayout ? activitySeatLayout.name : '当前活动无统一图'}</div>
                </label>
                <label className={`rounded-lg border p-3 text-[12px] ${form.seatLayoutSource === 'template' ? 'border-[#ff1268] bg-white' : 'border-[#e5e5e5]'}`}>
                  <input type="radio" disabled={seatTemplates.length === 0 || layoutLoading} checked={form.seatLayoutSource === 'template'} onChange={() => setForm({ ...form, seatLayoutSource: 'template', templateId: seatTemplates[0] ? String(seatTemplates[0].id) : '', activityLayoutId: '' })} /> 从场馆模板复制
                  <div className="mt-1 text-[#999]">{seatTemplates.length} 个可用模板</div>
                </label>
              </div>
              {form.seatLayoutSource === 'template' && (
                <select value={form.templateId} onChange={event => setForm({ ...form, templateId: event.target.value })} className="mt-3 h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]">
                  {seatTemplates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              )}
            </div>
          )}
          {formError && <div className="mt-3 text-[13px] text-[#ef4444]">{formError}</div>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666]">取消</button>
            <button disabled={submitting} className="rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50">{submitting ? '保存中...' : '保存场次'}</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
      ) : error ? (
        <div className="rounded-xl border border-[#ffd9e6] bg-white py-16 text-center text-[14px] text-[#ff4d4f]">
          <div>{error}</div>
          <button onClick={() => loadSessions(page)} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#ff1268] px-4 py-2 text-white">
            <RefreshCw className="h-4 w-4" /> 重试
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border border-[#e5e5e5] bg-white py-20 text-center text-[14px] text-[#999]">暂无匹配场次，可调整筛选条件或新建场次。</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-[#e5e5e5] bg-[#fafafa]">
                <th className="p-3 text-left font-medium text-[#666]">活动</th>
                <th className="p-3 text-left font-medium text-[#666]">场馆</th>
                <th className="p-3 text-left font-medium text-[#666]">时间</th>
                <th className="p-3 text-left font-medium text-[#666]">状态</th>
                <th className="p-3 text-left font-medium text-[#666]">库存统计</th>
                <th className="p-3 text-center font-medium text-[#666]">操作</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(session => (
                <tr key={session.id} className="border-b border-[#f0f0f0] hover:bg-[#fafafa]">
                  <td className="p-3 font-medium text-[#333]">{session.activityName || `活动 #${session.activityId}`}</td>
                  <td className="p-3 text-[#666]">{session.venueName || `场馆 #${session.venueId}`}<span className="ml-1 text-[#999]">{session.venueCity}</span></td>
                  <td className="p-3 text-[#666]">
                    <div>{formatTime(session.startTime)}</div>
                    <div className="text-[12px] text-[#999]">至 {session.endTime ? formatTime(session.endTime) : '未设置'}</div>
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-[12px] ${session.status === 1 ? 'bg-[#f0fff4] text-[#22c55e]' : 'bg-[#f5f5f5] text-[#999]'}`}>{session.status === 1 ? '启用' : '停用'}</span>
                  </td>
                  <td className="p-3 text-[#666]">
                    <div>{session.ticketTypeCount} 个票档，余票 {session.remainStock} / {session.totalStock}</div>
                    <div className="text-[12px] text-[#999]">已售 {session.soldStock}</div>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openTicketForm(session)} className="rounded-lg border border-[#ff1268] px-2 py-1 text-[12px] text-[#ff1268] hover:bg-[#fff0f3]">票档</button>
                      <button onClick={() => openEdit(session)} className="inline-flex rounded p-1.5 text-[#3b82f6] transition-colors hover:bg-[#f0f0f0]" title="编辑">
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-col gap-3 border-t border-[#f0f0f0] px-4 py-3 text-[13px] text-[#666] sm:flex-row sm:items-center sm:justify-between">
            <span>共 {total} 条，当前第 {page} / {pages} 页</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => loadSessions(page - 1)} className="rounded-lg border border-[#e5e5e5] px-3 py-1.5 disabled:cursor-not-allowed disabled:text-[#bbb]">上一页</button>
              <button disabled={page >= pages} onClick={() => loadSessions(page + 1)} className="rounded-lg border border-[#e5e5e5] px-3 py-1.5 disabled:cursor-not-allowed disabled:text-[#bbb]">下一页</button>
            </div>
          </div>
        </div>
      )}

      {ticketFormSession && (
        <div className="mt-5 rounded-xl border border-[#ffd9e6] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-bold text-[#1a1a2e]">新增票档</h2>
              <p className="mt-1 text-[13px] text-[#999]">{ticketFormSession.activityName || `活动 #${ticketFormSession.activityId}`} · {ticketFormSession.venueName || `场馆 #${ticketFormSession.venueId}`}</p>
            </div>
            <button onClick={() => setTicketFormSession(null)} className="text-[13px] text-[#999]">关闭</button>
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <input value={ticketName} onChange={event => setTicketName(event.target.value)} className="h-10 rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="票档名称，如 VIP" />
            <input type="number" value={ticketPrice} onChange={event => setTicketPrice(event.target.value)} className="h-10 rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="票价" />
          </div>
          <div className="mb-3 text-[13px] text-[#666]">{usingSeatCraftDrafts ? '选择 SeatCraft 分区后，库存由分区座位自动计算。' : '选择区域后，库存由该场次区域可售座位自动计算。'}预计库存：{estimatedStock}</div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {usingSeatCraftDrafts ? ticketDrafts.map(section => (
              <label key={section.id} className={`cursor-pointer rounded-lg border p-3 text-[13px] ${selectedLayoutSectionIds.includes(section.id) ? 'border-[#ff1268] bg-[#fff7fa]' : 'border-[#f0f0f0]'}`}>
                <div className="flex items-center gap-2 font-medium text-[#333]"><input type="checkbox" checked={selectedLayoutSectionIds.includes(section.id)} onChange={() => toggleLayoutSection(section.id)} disabled={Boolean(section.ticketTypeId)} />{section.name}</div>
                <div className="mt-1 text-[#666]">{section.rows} 排 × 每排 {section.cols} 座</div>
                {section.ticketTypeId && <div className="mt-1 text-[#999]">已绑定票档 #{section.ticketTypeId}</div>}
              </label>
            )) : sessionAreas.map(area => (
              <label key={area.id} className={`cursor-pointer rounded-lg border p-3 text-[13px] ${selectedAreaIds.includes(area.id) ? 'border-[#ff1268] bg-[#fff7fa]' : 'border-[#f0f0f0]'}`}>
                <div className="flex items-center gap-2 font-medium text-[#333]"><input type="checkbox" checked={selectedAreaIds.includes(area.id)} onChange={() => toggleArea(area.id)} />{area.name}</div>
                <div className="mt-1 text-[#666]">{area.rowCount} 排 × 每排 {area.seatsPerRow} 座</div>
              </label>
            ))}
          </div>
          {!usingSeatCraftDrafts && sessionAreas.length === 0 && <div className="rounded-lg border border-[#f0f0f0] p-4 text-[13px] text-[#999]">当前场馆还没有配置座位区域，请先到场馆管理配置。</div>}
          {ticketMessage && <div className="mt-3 text-[13px] text-[#666]">{ticketMessage}</div>}
          <button onClick={handleCreateTicketType} className="mt-4 rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white">创建票档</button>
        </div>
      )}
    </div>
  )
}

function toInputTime(value: string) {
  return value ? value.substring(0, 16) : ''
}

function formatTime(value: string) {
  return value ? value.replace('T', ' ').substring(0, 16) : '-'
}

function isPositiveInteger(value: string) {
  return /^[1-9]\d*$/.test(value)
}
