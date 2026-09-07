'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { batchUpdateAdminTicketTypes, createAdminTicketType, deleteAdminSession, deleteAdminTicketType, listAdminActivities, listAdminSessions, listAdminVenues, updateAdminSession, updateAdminTicketType } from '@/lib/api'
import { Armchair, Download, Edit, PackageOpen, Plus, Power, PowerOff, RefreshCw, Save, Tags, Trash2, Upload } from 'lucide-react'
import { globalAlert, globalConfirm, globalPrompt } from '@/components/GlobalDialog'
import { GlobalPagination } from '@/components/Pagination'
import { Modal } from '@/components/ui/Modal'
import { Drawer } from '@/components/ui/Drawer'
import { buildConsoleSessionReportCsv, buildConsoleSessionReportExcelHtml, formatConsoleSessionStatus, getConsoleSessionStatusClassName } from '@/lib/console-sessions'
import { formatConsoleTicketTypeStatus, getBatchTicketPriceUpdateCandidates, getBatchTicketPriceUpdateTargets, getBatchTicketStatusUpdateTargets, getBatchTicketStockUpdateBlockedTargets, getBatchTicketStockUpdateTargets, getTicketTypeSoldStock, isBatchTicketPriceUpdateCandidate, parseBatchTicketImportInput, parseBatchTicketPriceInput, parseBatchTicketStockInput } from '@/lib/console-ticket-types'
import type { ActivityEntity, SessionAdminVO, TicketTypeEntity, VenueEntity } from '@/types/api'

const PAGE_SIZE = 10

type SessionForm = {
  id: number
  activityId: string
  venueId: string
  startTime: string
  endTime: string
  status: string
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
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<SessionForm | null>(null)
  const [ticketDrawerSession, setTicketDrawerSession] = useState<SessionAdminVO | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [exportMessage, setExportMessage] = useState('')
  const [selectedTicketTypeKeys, setSelectedTicketTypeKeys] = useState<Set<number>>(new Set())
  const [batchPriceSubmitting, setBatchPriceSubmitting] = useState(false)
  const [batchStatusSubmitting, setBatchStatusSubmitting] = useState(false)
  const [batchStockSubmitting, setBatchStockSubmitting] = useState(false)
  const [batchImportSubmitting, setBatchImportSubmitting] = useState(false)
  const loadSessionsRef = useRef(() => {})
  const lastRefreshRef = useRef(0)
  const rawActivityId = searchParams.get('activityId') || ''
  const currentActivityId = isPositiveInteger(rawActivityId) ? rawActivityId : ''
  const currentPageTicketTypes = sessions.flatMap(session => session.ticketTypes ?? [])
  const activeTicketDrawerSession = ticketDrawerSession ? sessions.find(session => session.id === ticketDrawerSession.id) ?? ticketDrawerSession : null
  const batchPriceCandidates = getBatchTicketPriceUpdateCandidates(currentPageTicketTypes)
  const batchPriceTargets = getBatchTicketPriceUpdateTargets(currentPageTicketTypes, selectedTicketTypeKeys)
  const batchEnableTargets = getBatchTicketStatusUpdateTargets(currentPageTicketTypes, selectedTicketTypeKeys, 1)
  const batchDisableTargets = getBatchTicketStatusUpdateTargets(currentPageTicketTypes, selectedTicketTypeKeys, 0)
  const batchStockTargets = getBatchTicketStockUpdateTargets(currentPageTicketTypes, selectedTicketTypeKeys)
  const batchTicketSubmitting = batchPriceSubmitting || batchStatusSubmitting || batchStockSubmitting || batchImportSubmitting
  const allBatchPriceCandidatesSelected = batchPriceCandidates.length > 0 && batchPriceCandidates.every(ticket => selectedTicketTypeKeys.has(ticket.id))

  const loadSessions = (nextPage = page, nextActivityFilter = activityFilter) => {
    const u = getUser()
    if (!u) return
    setUserId(u.userId)
    setLoading(true)
    setError('')
    setExportMessage('')
    listAdminSessions(u.userId, {
      page: nextPage,
      size: PAGE_SIZE,
      activityId: nextActivityFilter ? Number(nextActivityFilter) : undefined,
      venueId: venueFilter ? Number(venueFilter) : undefined,
      status: statusFilter === '' ? undefined : Number(statusFilter),
    }).then(res => {
      setSessions(res.records)
      setSelectedTicketTypeKeys(new Set())
      setTotal(res.total)
      setPage(res.current || nextPage)
      setLoading(false)
    }).catch(err => {
      setError(err instanceof Error ? err.message : '加载场次失败')
      setLoading(false)
    })
  }

  loadSessionsRef.current = loadSessions

  const refreshWhenVisible = () => {
    const now = Date.now()
    if (now - lastRefreshRef.current < 200) return
    lastRefreshRef.current = now
    loadSessionsRef.current()
  }

  useEffect(() => {
    const u = getUser()
    if (!u) return
    setUserId(u.userId)
    setActivityFilter(currentActivityId)
    listAdminActivities({ page: 1, size: 100 }).then(res => setActivities(res.records)).catch(() => {})
    listAdminVenues(u.userId).then(setVenues).catch(() => {})
    loadSessions(1, currentActivityId)
  }, [currentActivityId])

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refreshWhenVisible()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshWhenVisible()
    }

    window.addEventListener('pageshow', handlePageShow)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    loadSessions(1)
  }

  const downloadSessionReport = (content: string, type: string, extension: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `场次报表-${new Date().toISOString().slice(0, 10)}.${extension}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const exportSessionReportCsv = () => {
    if (sessions.length === 0) {
      setExportMessage('暂无可导出的场次报表')
      return
    }
    downloadSessionReport(buildConsoleSessionReportCsv(sessions), 'text/csv;charset=utf-8', 'csv')
    setExportMessage(`已导出当前页 ${sessions.length} 条场次报表`)
  }

  const exportSessionReportExcel = () => {
    if (sessions.length === 0) {
      setExportMessage('暂无可导出的场次报表')
      return
    }
    downloadSessionReport(buildConsoleSessionReportExcelHtml(sessions), 'application/vnd.ms-excel;charset=utf-8', 'xls')
    setExportMessage(`已导出当前页 ${sessions.length} 条场次 Excel 报表`)
  }

  const handleBatchTicketImport = async () => {
    if (sessions.length === 0) {
      await globalAlert('当前页暂无可导入票档的场次')
      return
    }

    const input = await globalPrompt({
      type: 'textarea',
      title: '批量导入票档',
      content: '请粘贴票档数据，每行一个票档。支持英文逗号、中文逗号或 Tab 分隔。字段顺序：场次编号,票档名称,票价,总库存。',
      placeholder: '场次编号,票档名称,票价,总库存\n1001,内场票,880,100\n1002,看台票,380,200',
      defaultValue: '场次编号,票档名称,票价,总库存\n',
      textareaRows: 8,
      confirmText: '解析导入',
    })
    if (input === null) return

    const parsed = parseBatchTicketImportInput(input)
    if (parsed.errors.length > 0) {
      await globalAlert(`批量导入票档校验失败：${parsed.errors.slice(0, 5).join('；')}${parsed.errors.length > 5 ? '；其余错误请修正后重试。' : ''}`)
      return
    }
    if (parsed.rows.length === 0) {
      await globalAlert('批量导入票档内容不能为空')
      return
    }

    const confirmed = await globalConfirm(
      `即将导入 ${parsed.rows.length} 个票档。批量导入票档会逐条调用现有单条创建接口，场次编号必须属于当前主办方可管理场次。请确认：确认批量导入票档。`,
      '确认批量导入票档',
    )
    if (!confirmed) return

    setBatchImportSubmitting(true)
    setError('')
    setExportMessage('')
    const createdTickets: TicketTypeEntity[] = []
    const failedMessages: string[] = []

    for (const row of parsed.rows) {
      try {
        const created = await createAdminTicketType({ userId, sessionId: row.sessionId, name: row.name, price: row.price, totalStock: row.totalStock })
        createdTickets.push(created)
      } catch (err) {
        const reason = err instanceof Error ? err.message : '创建失败'
        failedMessages.push(`场次 ${row.sessionId} / ${row.name}：${reason}`)
      }
    }

    setBatchImportSubmitting(false)
    if (createdTickets.length > 0) {
      setSessions(current => current.map(session => {
        const additions = createdTickets.filter(ticket => ticket.sessionId === session.id)
        if (additions.length === 0) return session
        return {
          ...session,
          ticketTypeCount: session.ticketTypeCount + additions.length,
          totalStock: session.totalStock + additions.reduce((sum, ticket) => sum + ticket.totalStock, 0),
          remainStock: session.remainStock + additions.reduce((sum, ticket) => sum + ticket.remainStock, 0),
          ticketTypes: [...(session.ticketTypes ?? []), ...additions],
        }
      }))
    }

    const outcome = `批量导入票档处理完成：成功 ${createdTickets.length} 个，失败 ${failedMessages.length} 个。`
    setExportMessage(outcome)
    if (failedMessages.length > 0) {
      setError(`批量导入票档有 ${failedMessages.length} 个票档失败：${failedMessages.slice(0, 3).join('；')}${failedMessages.length > 3 ? '；其余失败项请刷新后重试。' : ''}`)
    }
  }

  const toggleTicketTypeSelection = (ticket: TicketTypeEntity) => {
    if (!isBatchTicketPriceUpdateCandidate(ticket) || batchTicketSubmitting) return
    setSelectedTicketTypeKeys(current => {
      const next = new Set(current)
      if (next.has(ticket.id)) {
        next.delete(ticket.id)
      } else {
        next.add(ticket.id)
      }
      return next
    })
  }

  const toggleCurrentPageTicketTypes = () => {
    if (batchPriceCandidates.length === 0 || batchTicketSubmitting) return
    setSelectedTicketTypeKeys(current => {
      const next = new Set(current)
      if (allBatchPriceCandidatesSelected) {
        batchPriceCandidates.forEach(ticket => next.delete(ticket.id))
      } else {
        batchPriceCandidates.forEach(ticket => next.add(ticket.id))
      }
      return next
    })
  }

  const handleBatchTicketStatusUpdate = async (targetStatus: number) => {
    const targets = getBatchTicketStatusUpdateTargets(currentPageTicketTypes, selectedTicketTypeKeys, targetStatus)
    const actionLabel = targetStatus === 1 ? '启用' : '停用'
    if (targets.length === 0) {
      await globalAlert(`请先选择需要批量${actionLabel}的票档`)
      return
    }

    const confirmed = await globalConfirm(
      `已选择 ${targets.length} 个票档，目标状态为${formatConsoleTicketTypeStatus(targetStatus)}。批量调整票档状态会通过后端原子事务一次提交，任一票档失败整批回滚。请确认：确认批量调整票档状态。`,
      '确认批量调整票档状态',
    )
    if (!confirmed) return

    setBatchStatusSubmitting(true)
    setError('')
    setExportMessage('')
    try {
      const updatedTickets = await batchUpdateAdminTicketTypes({
        ids: targets.map(ticket => ticket.id),
        action: 'SET_STATUS',
        status: targetStatus,
      })
      const updatedIds = new Set(updatedTickets.map(ticket => ticket.id))
      setSessions(current => mergeUpdatedTicketTypes(current, updatedTickets))
      setSelectedTicketTypeKeys(current => {
        const next = new Set(current)
        updatedIds.forEach(id => next.delete(id))
        return next
      })
      setExportMessage(`批量调整票档状态已通过原子事务完成：成功 ${updatedTickets.length} 个。目标状态 ${formatConsoleTicketTypeStatus(targetStatus)}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : '批量调整票档状态失败'
      setError(message)
      await globalAlert(message)
    } finally {
      setBatchStatusSubmitting(false)
    }
  }

  const handleBatchTicketStockUpdate = async () => {
    const targets = batchStockTargets
    if (targets.length === 0) {
      await globalAlert('请先选择可调整库存的票档')
      return
    }

    const input = await globalPrompt('请输入要统一调整到的目标总库存。目标总库存不能小于已售数量。', '批量库存', '请输入目标总库存（非负整数）')
    if (input === null) return

    const parsed = parseBatchTicketStockInput(input)
    if (parsed.error || parsed.totalStock === null) {
      await globalAlert(parsed.error)
      return
    }

    const blockedTargets = getBatchTicketStockUpdateBlockedTargets(currentPageTicketTypes, selectedTicketTypeKeys, parsed.totalStock)
    if (blockedTargets.length > 0) {
      const examples = blockedTargets.slice(0, 3).map(ticket => `${ticket.name || `票档编号：${ticket.id}`} 已售 ${getTicketTypeSoldStock(ticket)} 张`).join('；')
      await globalAlert(`目标总库存不能小于已售数量：${examples}${blockedTargets.length > 3 ? '；其余票档请分批调整。' : ''}`)
      return
    }

    const confirmed = await globalConfirm(
      `已选择 ${targets.length} 个票档，目标总库存为 ${parsed.totalStock}。批量调整票档库存会通过后端原子事务一次提交，任一票档失败整批回滚。请确认：确认批量调整票档库存。`,
      '确认批量调整票档库存',
    )
    if (!confirmed) return

    setBatchStockSubmitting(true)
    setError('')
    setExportMessage('')
    try {
      const updatedTickets = await batchUpdateAdminTicketTypes({
        ids: targets.map(ticket => ticket.id),
        action: 'ADJUST_STOCK',
        totalStock: parsed.totalStock,
      })
      const updatedIds = new Set(updatedTickets.map(ticket => ticket.id))
      setSessions(current => mergeUpdatedTicketTypes(current, updatedTickets))
      setSelectedTicketTypeKeys(current => {
        const next = new Set(current)
        updatedIds.forEach(id => next.delete(id))
        return next
      })
      setExportMessage(`批量调整票档库存已通过原子事务完成：成功 ${updatedTickets.length} 个。目标总库存 ${parsed.totalStock}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : '批量调整票档库存失败'
      setError(message)
      await globalAlert(message)
    } finally {
      setBatchStockSubmitting(false)
    }
  }

  const handleBatchTicketPriceUpdate = async () => {
    const targets = batchPriceTargets
    if (targets.length === 0) {
      await globalAlert('请先选择可改价的票档')
      return
    }

    const input = await globalPrompt('请输入要统一调整到的目标票价，单位为元。已支付订单仍以订单快照为准。', '批量改价', '请输入目标票价（必填）')
    if (input === null) return

    const parsed = parseBatchTicketPriceInput(input)
    if (parsed.error || parsed.price === null) {
      await globalAlert(parsed.error)
      return
    }

    const confirmed = await globalConfirm(
      `已选择 ${targets.length} 个票档，目标票价为 ${formatTicketPrice(parsed.price)}。批量改价会通过后端原子事务一次提交，任一票档失败整批回滚。请确认：确认批量改价。`,
      '确认批量改价',
    )
    if (!confirmed) return

    setBatchPriceSubmitting(true)
    setError('')
    setExportMessage('')
    try {
      const updatedTickets = await batchUpdateAdminTicketTypes({
        ids: targets.map(ticket => ticket.id),
        action: 'UPDATE_PRICE',
        price: parsed.price,
      })
      const updatedIds = new Set(updatedTickets.map(ticket => ticket.id))
      setSessions(current => mergeUpdatedTicketTypes(current, updatedTickets))
      setSelectedTicketTypeKeys(current => {
        const next = new Set(current)
        updatedIds.forEach(id => next.delete(id))
        return next
      })
      setExportMessage(`批量改价已通过原子事务完成：成功 ${updatedTickets.length} 个。目标票价 ${formatTicketPrice(parsed.price)}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : '批量改价失败'
      setError(message)
      await globalAlert(message)
    } finally {
      setBatchPriceSubmitting(false)
    }
  }

  const openEdit = (session: SessionAdminVO) => {
    setForm({
      id: session.id,
      activityId: String(session.activityId),
      venueId: String(session.venueId),
      startTime: toInputTime(session.startTime),
      endTime: session.endTime ? toInputTime(session.endTime) : '',
      status: String(session.status),
    })
    setFormError('')
    setFormOpen(true)
  }

  const closeEdit = () => {
    if (submitting) return
    setFormOpen(false)
    setForm(null)
    setFormError('')
  }

  const validateForm = () => {
    if (!form) return '请选择要编辑的场次'
    if (!form.venueId) return '请选择场馆'
    if (!isPositiveInteger(form.venueId)) return '场馆编号不正确'
    if (!form.startTime) return '请选择开始时间'
    if (form.endTime && new Date(form.endTime).getTime() <= new Date(form.startTime).getTime()) {
      return '结束时间必须晚于开始时间'
    }
    return ''
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationError = validateForm()
    if (validationError || !form) {
      setFormError(validationError)
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      await updateAdminSession(form.id, {
        userId,
        activityId: Number(form.activityId),
        venueId: Number(form.venueId),
        startTime: form.startTime,
        endTime: form.endTime || null,
        status: Number(form.status),
      })
      setFormOpen(false)
      setForm(null)
      loadSessions(page)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '保存场次失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteSession = async (session: SessionAdminVO) => {
    if (session.ticketTypeCount > 0) {
      const confirmed = await globalConfirm('该场次已有票档。删除场次会同时删除票档和座位快照。确认删除？')
      if (!confirmed) return
    } else if (!(await globalConfirm('确认删除该场次？'))) {
      return
    }
    try {
      await deleteAdminSession(session.id, userId)
      loadSessions(page)
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除场次失败')
    }
  }

  const openTicketDrawer = (session: SessionAdminVO) => {
    setFormOpen(false)
    setForm(null)
    setTicketDrawerSession(session)
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">场次管理</h1>
          <p className="mt-1 text-[13px] text-[#999]">管理活动场次、场馆安排和票档库存统计。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportSessionReportCsv}
            disabled={loading || sessions.length === 0}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-4 text-[14px] font-medium text-[#333] transition hover:border-[#ff1268] hover:text-[#ff1268] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            导出场次报表
          </button>
          <button
            type="button"
            onClick={exportSessionReportExcel}
            disabled={loading || sessions.length === 0}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-4 text-[14px] font-medium text-[#333] transition hover:border-[#ff1268] hover:text-[#ff1268] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            导出 Excel
          </button>
          <button
            type="button"
            onClick={handleBatchTicketImport}
            disabled={batchImportSubmitting || loading}
            title="批量导入票档"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#0f766e] bg-white px-4 text-[14px] font-medium text-[#0f766e] transition hover:bg-[#f0fdfa] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {batchImportSubmitting ? '导入中...' : '批量导入票档'}
          </button>
        </div>
      </div>

      {exportMessage ? <div className="mb-4 rounded-lg bg-[#f0fff4] px-3 py-2 text-[13px] text-[#16a34a]">{exportMessage}</div> : null}

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

      <Modal
        open={formOpen}
        onClose={closeEdit}
        title="编辑场次"
        size="md"
        loading={submitting}
        footer={(
          <>
            <button type="button" onClick={closeEdit} disabled={submitting} className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666] disabled:cursor-not-allowed disabled:opacity-60">取消</button>
            <button type="submit" form="session-edit-form" disabled={submitting} className="rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? '保存中...' : '保存场次'}</button>
          </>
        )}
      >
        {form ? (
          <form id="session-edit-form" onSubmit={handleSubmit} className="grid gap-3">
            <label className="block text-[13px] text-[#666]">
              活动
              <select value={form.activityId} disabled className="mt-1 h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none disabled:bg-[#f5f5f5]">
                {activities.map(activity => <option key={activity.id} value={activity.id}>{activity.name}</option>)}
              </select>
            </label>
            <label className="block text-[13px] text-[#666]">
              场馆 *
              <select value={form.venueId} onChange={event => setForm({ ...form, venueId: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]">
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
            {formError && <div className="text-[13px] text-[#ef4444]">{formError}</div>}
          </form>
        ) : null}
      </Modal>

      {selectedTicketTypeKeys.size > 0 && (
        <div className="mb-3 flex flex-col gap-3 rounded-xl border border-[#dbeafe] bg-[#eff6ff] p-4 text-[13px] text-[#1d4ed8] lg:flex-row lg:items-center lg:justify-between">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={allBatchPriceCandidatesSelected}
              onChange={toggleCurrentPageTicketTypes}
              disabled={batchPriceCandidates.length === 0 || batchTicketSubmitting}
              aria-label="选择当前页可批量操作票档"
              className="mt-0.5 h-4 w-4 rounded border-[#bfdbfe] text-[#ff1268]"
            />
            <span>
              已选择 {selectedTicketTypeKeys.size} 个票档，可批量改价 {batchPriceTargets.length} 个，可批量启用 {batchEnableTargets.length} 个，可批量停用 {batchDisableTargets.length} 个，可批量库存 {batchStockTargets.length} 个；更新失败时后端会整批回滚。
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleBatchTicketPriceUpdate}
              disabled={batchPriceTargets.length === 0 || batchTicketSubmitting}
              title="批量改价"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#ff1268] bg-white px-4 text-[14px] font-medium text-[#ff1268] transition hover:bg-[#fff0f3] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Tags className="h-4 w-4" />
              {batchPriceSubmitting ? '批量改价中...' : '批量改价'}
            </button>
            <button
              type="button"
              onClick={() => handleBatchTicketStatusUpdate(1)}
              disabled={batchEnableTargets.length === 0 || batchTicketSubmitting}
              title="批量启用"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#16a34a] bg-white px-4 text-[14px] font-medium text-[#16a34a] transition hover:bg-[#f0fff4] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Power className="h-4 w-4" />
              {batchStatusSubmitting ? '处理中...' : '批量启用'}
            </button>
            <button
              type="button"
              onClick={() => handleBatchTicketStatusUpdate(0)}
              disabled={batchDisableTargets.length === 0 || batchTicketSubmitting}
              title="批量停用"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#f59e0b] bg-white px-4 text-[14px] font-medium text-[#b45309] transition hover:bg-[#fff7e6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PowerOff className="h-4 w-4" />
              {batchStatusSubmitting ? '处理中...' : '批量停用'}
            </button>
            <button
              type="button"
              onClick={handleBatchTicketStockUpdate}
              disabled={batchStockTargets.length === 0 || batchTicketSubmitting}
              title="批量库存"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#2563eb] bg-white px-4 text-[14px] font-medium text-[#2563eb] transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PackageOpen className="h-4 w-4" />
              {batchStockSubmitting ? '库存调整中...' : '批量库存'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedTicketTypeKeys(new Set())}
              disabled={batchTicketSubmitting}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#bfdbfe] bg-white px-4 text-[14px] font-medium text-[#1d4ed8] hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              取消选择
            </button>
          </div>
        </div>
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
        <div className="rounded-xl border border-[#e5e5e5] bg-white py-20 text-center text-[14px] text-[#999]">暂无匹配场次，可调整筛选条件。</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-[#e5e5e5] bg-[#fafafa]">
                <th className="whitespace-nowrap p-3 text-left font-medium text-[#666]">活动</th>
                <th className="whitespace-nowrap p-3 text-left font-medium text-[#666]">场馆</th>
                <th className="whitespace-nowrap p-3 text-left font-medium text-[#666]">时间</th>
                <th className="w-24 min-w-[90px] whitespace-nowrap p-3 text-center font-medium text-[#666]">状态</th>
                <th className="whitespace-nowrap p-3 text-left font-medium text-[#666]">库存统计</th>
                <th className="min-w-[220px] whitespace-nowrap p-3 text-center font-medium text-[#666]">操作</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(session => (
                <tr key={session.id} className="border-b border-[#f0f0f0] hover:bg-[#fafafa]">
                  <td className="max-w-[240px] truncate p-3 font-medium text-[#333]" title={session.activityName || `活动编号：${session.activityId}`}>{session.activityName || `活动编号：${session.activityId}`}</td>
                  <td className="max-w-[240px] truncate p-3 text-[#666]" title={`${session.venueName || `场馆编号：${session.venueId}`} ${session.venueCity || ''}`}>{session.venueName || `场馆编号：${session.venueId}`}<span className="ml-1 text-[#999]">{session.venueCity}</span></td>
                  <td className="whitespace-nowrap p-3 text-[#666]">
                    <div>{formatTime(session.startTime)}</div>
                    <div className="text-[12px] text-[#999]">至 {session.endTime ? formatTime(session.endTime) : '未设置'}</div>
                  </td>
                  <td className="w-24 min-w-[90px] whitespace-nowrap p-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-[12px] ${getConsoleSessionStatusClassName(session.status)}`}>{formatConsoleSessionStatus(session.status)}</span>
                  </td>
                  <td className="whitespace-nowrap p-3 text-[#666]">
                    <div>{session.ticketTypeCount} 个票档，余票 {session.remainStock} / {session.totalStock}</div>
                    <div className="text-[12px] text-[#999]">已售 {session.soldStock}</div>
                    <div className="text-[12px] text-[#999]">票档明细请进入右侧抽屉配置</div>
                  </td>
                  <td className="min-w-[220px] whitespace-nowrap p-3 text-center">
                    <div className="flex items-center gap-2 whitespace-nowrap justify-center">
                      <button
                        type="button"
                        onClick={() => openTicketDrawer(session)}
                        className="rounded-lg border border-[#ff1268] px-3 py-1.5 text-[12px] text-[#ff1268] hover:bg-[#fff0f3]"
                      >
                        票档配置
                      </button>
                      <Link href={`/console/sessions/${session.id}/seat-layout`} className="inline-flex items-center gap-1 rounded-lg border border-[#2563eb] px-3 py-1.5 text-[12px] text-[#2563eb] hover:bg-[#eff6ff]">
                        <Armchair className="h-3.5 w-3.5" />
                        座位图设计
                      </Link>
                      <button onClick={() => openEdit(session)} className="inline-flex rounded p-1.5 text-[#3b82f6] transition-colors hover:bg-[#f0f0f0]" title="编辑"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => handleDeleteSession(session)} className="inline-flex rounded p-1.5 text-[#ef4444] transition-colors hover:bg-[#fff1f2]" title="删除"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-[#f0f0f0] px-4 pb-4">
            <GlobalPagination page={page} total={total} pageSize={PAGE_SIZE} loading={loading} onChange={nextPage => loadSessions(nextPage)} />
          </div>
        </div>
      )}
      {activeTicketDrawerSession && (
        <TicketTypeDrawer
          session={activeTicketDrawerSession}
          userId={userId}
          selectedTicketTypeKeys={selectedTicketTypeKeys}
          batchTicketSubmitting={batchTicketSubmitting}
          onToggleSelection={toggleTicketTypeSelection}
          onClose={() => setTicketDrawerSession(null)}
          onRefresh={() => loadSessions(page)}
        />
      )}
    </div>
  )
}

function mergeUpdatedTicketTypes(sessions: SessionAdminVO[], updatedTickets: TicketTypeEntity[]) {
  const updatedById = new Map(updatedTickets.map(ticket => [ticket.id, ticket]))
  return sessions.map(session => {
    const ticketTypes = session.ticketTypes ?? []
    if (!ticketTypes.some(ticket => updatedById.has(ticket.id))) return session
    return rebuildSessionInventory({
      ...session,
      ticketTypes: ticketTypes.map(ticket => updatedById.get(ticket.id) ?? ticket),
    })
  })
}

function rebuildSessionInventory(session: SessionAdminVO) {
  const ticketTypes = session.ticketTypes ?? []
  const totalStock = ticketTypes.reduce((sum, ticket) => sum + ticket.totalStock, 0)
  const remainStock = ticketTypes.reduce((sum, ticket) => sum + ticket.remainStock, 0)
  return {
    ...session,
    ticketTypeCount: ticketTypes.length,
    totalStock,
    remainStock,
    soldStock: ticketTypes.reduce((sum, ticket) => sum + getTicketTypeSoldStock(ticket), 0),
  }
}

function emptyTicketForm() {
  return { name: '', price: '', totalStock: '' }
}

function TicketTypeDrawer({
  session,
  userId,
  selectedTicketTypeKeys,
  batchTicketSubmitting,
  onToggleSelection,
  onClose,
  onRefresh,
}: {
  session: SessionAdminVO
  userId: number
  selectedTicketTypeKeys: Set<number>
  batchTicketSubmitting: boolean
  onToggleSelection: (ticket: TicketTypeEntity) => void
  onClose: () => void
  onRefresh: () => void
}) {
  const [form, setForm] = useState(emptyTicketForm)
  const [editingTicket, setEditingTicket] = useState<TicketTypeEntity | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const ticketTypes = session.ticketTypes ?? []

  useEffect(() => {
    setForm(emptyTicketForm())
    setEditingTicket(null)
    setError('')
  }, [session.id])

  const startEdit = (ticket: TicketTypeEntity) => {
    setEditingTicket(ticket)
    setForm({
      name: ticket.name || '',
      price: String(ticket.price ?? ''),
      totalStock: String(ticket.totalStock ?? ''),
    })
    setError('')
  }

  const resetTicketForm = () => {
    setEditingTicket(null)
    setForm(emptyTicketForm())
    setError('')
  }

  const validateTicketForm = () => {
    const price = Number(form.price)
    const totalStock = Number(form.totalStock)
    if (!form.name.trim()) return '票档名称不能为空'
    if (!Number.isFinite(price) || price <= 0) return '票价必须大于 0'
    if (form.totalStock.trim() && (!Number.isInteger(totalStock) || totalStock < 0)) return '总库存必须是非负整数'
    return ''
  }

  const handleTicketSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationError = validateTicketForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        price: Number(Number(form.price).toFixed(2)),
        totalStock: form.totalStock.trim() ? Number(form.totalStock) : undefined,
      }
      if (editingTicket) {
        await updateAdminTicketType(editingTicket.id, payload)
      } else {
        await createAdminTicketType({
          userId,
          sessionId: session.id,
          ...payload,
        })
      }
      resetTicketForm()
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存票档失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteTicket = async (ticket: TicketTypeEntity) => {
    if (!(await globalConfirm(`确认删除票档“${ticket.name || `票档编号：${ticket.id}`}”？已售出票档会被后端拒绝删除。`))) return
    setSubmitting(true)
    setError('')
    try {
      await deleteAdminTicketType(ticket.id, userId)
      if (editingTicket?.id === ticket.id) resetTicketForm()
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除票档失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={true} onClose={onClose} width="w-[540px]" title="票档配置" loading={submitting}>
        <p className="text-[13px] text-[#999]">{session.activityName || `活动编号：${session.activityId}`} · {formatTime(session.startTime)}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[12px] text-[#666]">
          <div className="rounded-lg bg-[#fafafa] px-2 py-2">票档 {session.ticketTypeCount}</div>
          <div className="rounded-lg bg-[#fafafa] px-2 py-2">余票 {session.remainStock}</div>
          <div className="rounded-lg bg-[#fafafa] px-2 py-2">已售 {session.soldStock}</div>
        </div>

        <div className="mt-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[14px] font-semibold text-[#1a1a2e]">票档列表</div>
            <Link href={`/console/sessions/${session.id}/seat-layout?mode=tickets`} className="inline-flex items-center gap-1 rounded-lg border border-[#2563eb] px-3 py-1.5 text-[12px] text-[#2563eb] hover:bg-[#eff6ff]">
              <Armchair className="h-3.5 w-3.5" />
              座位票档绑定
            </Link>
          </div>

          {ticketTypes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#e5e5e5] py-10 text-center text-[13px] text-[#999]">当前场次暂无票档，请在下方新增。</div>
          ) : (
            <div className="space-y-2">
              {ticketTypes.map(ticket => {
                const selectable = isBatchTicketPriceUpdateCandidate(ticket)
                return (
                  <div key={ticket.id} className="rounded-xl border border-[#f0f0f0] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex min-w-0 items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedTicketTypeKeys.has(ticket.id)}
                          onChange={() => onToggleSelection(ticket)}
                          disabled={!selectable || batchTicketSubmitting}
                          aria-label={`选择票档 ${ticket.name || ticket.id}`}
                          className="mt-0.5 h-4 w-4 rounded border-[#d9d9d9] text-[#ff1268]"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-[#333]">{ticket.name || `票档编号：${ticket.id}`}</span>
                          <span className="mt-1 block text-[12px] text-[#999]">总库存 {ticket.totalStock} · 余票 {ticket.remainStock} · {formatConsoleTicketTypeStatus(ticket.status)}</span>
                        </span>
                      </label>
                      <div className="shrink-0 text-right">
                        <div className="font-semibold text-[#ff1268]">{formatTicketPrice(ticket.price)}</div>
                        <div className="mt-2 flex gap-2">
                          <button type="button" onClick={() => startEdit(ticket)} className="rounded-md border border-[#e5e5e5] px-2 py-1 text-[12px] text-[#333] hover:border-[#ff1268] hover:text-[#ff1268]">编辑</button>
                          <button type="button" onClick={() => handleDeleteTicket(ticket)} disabled={submitting} className="rounded-md border border-[#fecaca] px-2 py-1 text-[12px] text-[#ef4444] hover:bg-[#fff1f2] disabled:opacity-60">删除</button>
                        </div>
                      </div>
                    </div>
                    {ticket.ticketGroupKey ? <div className="mt-2 text-[12px] text-[#2563eb]">已绑定座位块组：{ticket.ticketGroupKey}</div> : null}
                  </div>
                )
              })}
            </div>
          )}

          <form onSubmit={handleTicketSubmit} className="mt-5 rounded-xl border border-[#ffd9e6] bg-[#fff7fb] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[14px] font-semibold text-[#1a1a2e]">{editingTicket ? '编辑票档' : '新增票档'}</div>
              {editingTicket && <button type="button" onClick={resetTicketForm} className="text-[12px] text-[#666] hover:text-[#ff1268]">取消编辑</button>}
            </div>
            <div className="grid gap-3">
              <label className="block text-[13px] text-[#666]">
                票档名称 *
                <input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="如 VIP 票、看台 A 区" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-[13px] text-[#666]">
                  票价 *
                  <input value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} inputMode="decimal" className="mt-1 h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="如 380" />
                </label>
                <label className="block text-[13px] text-[#666]">
                  总库存
                  <input value={form.totalStock} onChange={event => setForm({ ...form, totalStock: event.target.value })} inputMode="numeric" className="mt-1 h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="非负整数" />
                </label>
              </div>
            </div>
            {error && <div className="mt-3 text-[13px] text-[#ef4444]">{error}</div>}
            <button disabled={submitting || !userId} className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#ff1268] px-4 text-[14px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
              {editingTicket ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {submitting ? '保存中...' : editingTicket ? '保存票档' : '新增票档'}
            </button>
          </form>
        </div>
    </Drawer>
  )
}

function toInputTime(value: string) {
  return value ? value.substring(0, 16) : ''
}

function formatTime(value: string) {
  return value ? value.replace('T', ' ').substring(0, 16) : '-'
}

function formatTicketPrice(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '票价待同步'
  return `¥${value.toFixed(value % 1 === 0 ? 0 : 2)}`
}

function isPositiveInteger(value: string) {
  return /^[1-9]\d*$/.test(value)
}
