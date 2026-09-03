'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { createAdminTicketType, deleteAdminSession, listAdminActivities, listAdminSessions, listAdminVenues, updateAdminSession, updateAdminTicketType } from '@/lib/api'
import { Download, Edit, PackageOpen, Power, PowerOff, RefreshCw, Tags, Trash2, Upload, X } from 'lucide-react'
import { globalAlert, globalConfirm, globalPrompt } from '@/components/GlobalDialog'
import { GlobalPagination } from '@/components/Pagination'
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
      `已选择 ${targets.length} 个票档，目标状态为${formatConsoleTicketTypeStatus(targetStatus)}。批量调整票档状态会逐条更新当前页选中的票档，并沿用现有单条票档更新链路。请确认：确认批量调整票档状态。`,
      '确认批量调整票档状态',
    )
    if (!confirmed) return

    setBatchStatusSubmitting(true)
    setError('')
    setExportMessage('')
    const completedIds = new Set<number>()
    const failedMessages: string[] = []

    for (const ticket of targets) {
      try {
        await updateAdminTicketType(ticket.id, { status: targetStatus })
        completedIds.add(ticket.id)
      } catch (err) {
        const reason = err instanceof Error ? err.message : '更新失败'
        failedMessages.push(`${ticket.name || `票档编号：${ticket.id}`}：${reason}`)
      }
    }

    setBatchStatusSubmitting(false)
    setSelectedTicketTypeKeys(current => {
      const next = new Set(current)
      completedIds.forEach(id => next.delete(id))
      return next
    })
    if (completedIds.size > 0) {
      setSessions(current => current.map(session => ({
        ...session,
        ticketTypes: session.ticketTypes?.map(ticket => (
          completedIds.has(ticket.id) ? { ...ticket, status: targetStatus } : ticket
        )),
      })))
    }

    const outcome = `批量调整票档状态处理完成：成功 ${completedIds.size} 个，失败 ${failedMessages.length} 个。目标状态 ${formatConsoleTicketTypeStatus(targetStatus)}`
    setExportMessage(outcome)
    if (failedMessages.length > 0) {
      setError(`批量调整票档状态有 ${failedMessages.length} 个票档失败：${failedMessages.slice(0, 3).join('；')}${failedMessages.length > 3 ? '；其余失败项请刷新后重试。' : ''}`)
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
      `已选择 ${targets.length} 个票档，目标总库存为 ${parsed.totalStock}。批量调整票档库存会逐条更新当前页选中的票档，并沿用现有单条票档更新链路。请确认：确认批量调整票档库存。`,
      '确认批量调整票档库存',
    )
    if (!confirmed) return

    setBatchStockSubmitting(true)
    setError('')
    setExportMessage('')
    const completedIds = new Set<number>()
    const failedMessages: string[] = []

    for (const ticket of targets) {
      try {
        await updateAdminTicketType(ticket.id, { totalStock: parsed.totalStock })
        completedIds.add(ticket.id)
      } catch (err) {
        const reason = err instanceof Error ? err.message : '更新失败'
        failedMessages.push(`${ticket.name || `票档编号：${ticket.id}`}：${reason}`)
      }
    }

    setBatchStockSubmitting(false)
    setSelectedTicketTypeKeys(current => {
      const next = new Set(current)
      completedIds.forEach(id => next.delete(id))
      return next
    })
    if (completedIds.size > 0) {
      setSessions(current => current.map(session => ({
        ...session,
        ticketTypes: session.ticketTypes?.map(ticket => {
          if (!completedIds.has(ticket.id)) return ticket
          const soldStock = getTicketTypeSoldStock(ticket)
          return { ...ticket, totalStock: parsed.totalStock, remainStock: parsed.totalStock - soldStock }
        }),
      })))
    }

    const outcome = `批量调整票档库存处理完成：成功 ${completedIds.size} 个，失败 ${failedMessages.length} 个。目标总库存 ${parsed.totalStock}`
    setExportMessage(outcome)
    if (failedMessages.length > 0) {
      setError(`批量调整票档库存有 ${failedMessages.length} 个票档失败：${failedMessages.slice(0, 3).join('；')}${failedMessages.length > 3 ? '；其余失败项请刷新后重试。' : ''}`)
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
      `已选择 ${targets.length} 个票档，目标票价为 ${formatTicketPrice(parsed.price)}。批量改价会逐条更新当前页选中的票档，并沿用现有单条票档更新链路。请确认：确认批量改价。`,
      '确认批量改价',
    )
    if (!confirmed) return

    setBatchPriceSubmitting(true)
    setError('')
    setExportMessage('')
    const completedIds = new Set<number>()
    const failedMessages: string[] = []

    for (const ticket of targets) {
      try {
        await updateAdminTicketType(ticket.id, { price: parsed.price })
        completedIds.add(ticket.id)
      } catch (err) {
        const reason = err instanceof Error ? err.message : '更新失败'
        failedMessages.push(`${ticket.name || `票档编号：${ticket.id}`}：${reason}`)
      }
    }

    setBatchPriceSubmitting(false)
    setSelectedTicketTypeKeys(current => {
      const next = new Set(current)
      completedIds.forEach(id => next.delete(id))
      return next
    })
    if (completedIds.size > 0) {
      setSessions(current => current.map(session => ({
        ...session,
        ticketTypes: session.ticketTypes?.map(ticket => (
          completedIds.has(ticket.id) ? { ...ticket, price: parsed.price } : ticket
        )),
      })))
    }

    const outcome = `批量改价处理完成：成功 ${completedIds.size} 个，失败 ${failedMessages.length} 个。目标票价 ${formatTicketPrice(parsed.price)}`
    setExportMessage(outcome)
    if (failedMessages.length > 0) {
      setError(`批量改价有 ${failedMessages.length} 个票档失败：${failedMessages.slice(0, 3).join('；')}${failedMessages.length > 3 ? '；其余失败项请刷新后重试。' : ''}`)
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
        </div>
      </div>

      {exportMessage ? <div className="mb-4 rounded-lg bg-[#f0fff4] px-3 py-2 text-[13px] text-[#16a34a]">{exportMessage}</div> : null}

      {sessions.length > 0 && (
        <div className="mb-5 flex flex-col gap-3 rounded-xl border border-[#e5e5e5] bg-white p-4 text-[13px] text-[#666] lg:flex-row lg:items-center lg:justify-between">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={allBatchPriceCandidatesSelected}
              onChange={toggleCurrentPageTicketTypes}
              disabled={batchPriceCandidates.length === 0 || batchTicketSubmitting}
              aria-label="选择当前页可批量操作票档"
              className="mt-0.5 h-4 w-4 rounded border-[#d9d9d9] text-[#ff1268]"
            />
            <span>
              已选择 {selectedTicketTypeKeys.size} 个，可批量改价 {batchPriceTargets.length} 个，可批量启用 {batchEnableTargets.length} 个，可批量停用 {batchDisableTargets.length} 个，可批量库存 {batchStockTargets.length} 个；未知票档状态不会进入批量操作。
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
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#2563eb] bg-white px-4 text-[14px] font-medium text-[#2563eb] transition hover:bg-[#eff6ff] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PackageOpen className="h-4 w-4" />
              {batchStockSubmitting ? '库存调整中...' : '批量库存'}
            </button>
            <button
              type="button"
              onClick={handleBatchTicketImport}
              disabled={batchTicketSubmitting}
              title="批量导入票档"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#0f766e] bg-white px-4 text-[14px] font-medium text-[#0f766e] transition hover:bg-[#f0fdfa] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {batchImportSubmitting ? '导入中...' : '批量导入票档'}
            </button>
          </div>
        </div>
      )}

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

      {formOpen && form && (
        <form onSubmit={handleSubmit} className="mb-5 rounded-xl border border-[#ffd9e6] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[16px] font-bold text-[#1a1a2e]">编辑场次</h2>
            <button type="button" onClick={() => { setFormOpen(false); setForm(null) }} className="rounded-full p-1 text-[#999] hover:bg-[#f5f5f5]"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
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
          </div>

          {formError && <div className="mt-3 text-[13px] text-[#ef4444]">{formError}</div>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => { setFormOpen(false); setForm(null) }} className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666]">取消</button>
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
        <div className="rounded-xl border border-[#e5e5e5] bg-white py-20 text-center text-[14px] text-[#999]">暂无匹配场次，可调整筛选条件。</div>
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
                  <td className="p-3 font-medium text-[#333]">{session.activityName || `活动编号：${session.activityId}`}</td>
                  <td className="p-3 text-[#666]">{session.venueName || `场馆编号：${session.venueId}`}<span className="ml-1 text-[#999]">{session.venueCity}</span></td>
                  <td className="p-3 text-[#666]">
                    <div>{formatTime(session.startTime)}</div>
                    <div className="text-[12px] text-[#999]">至 {session.endTime ? formatTime(session.endTime) : '未设置'}</div>
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-[12px] ${getConsoleSessionStatusClassName(session.status)}`}>{formatConsoleSessionStatus(session.status)}</span>
                  </td>
                  <td className="p-3 text-[#666]">
                    <div>{session.ticketTypeCount} 个票档，余票 {session.remainStock} / {session.totalStock}</div>
                    <div className="text-[12px] text-[#999]">已售 {session.soldStock}</div>
                    {(session.ticketTypes?.length ?? 0) > 0 ? (
                      <div className="mt-2 space-y-1">
                        {session.ticketTypes?.map(ticket => {
                          const selectable = isBatchTicketPriceUpdateCandidate(ticket)
                          return (
                            <label key={ticket.id} className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[12px] ${selectable ? 'bg-[#fafafa]' : 'bg-[#fff7e6] text-[#ad6800]'}`}>
                              <span className="flex min-w-0 items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedTicketTypeKeys.has(ticket.id)}
                                  onChange={() => toggleTicketTypeSelection(ticket)}
                                  disabled={!selectable || batchTicketSubmitting}
                                  aria-label={`选择票档 ${ticket.name || ticket.id}`}
                                  className="h-3.5 w-3.5 rounded border-[#d9d9d9] text-[#ff1268]"
                                />
                                <span className="truncate">{ticket.name || `票档编号：${ticket.id}`}</span>
                              </span>
                              <span className="shrink-0 text-[#999]">{formatTicketPrice(ticket.price)} · {formatConsoleTicketTypeStatus(ticket.status)}</span>
                            </label>
                          )
                        })}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Link href={`/console/sessions/${session.id}/seat-layout?mode=tickets`} className="rounded-lg border border-[#ff1268] px-2 py-1 text-[12px] text-[#ff1268] hover:bg-[#fff0f3]">票档</Link>
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
    </div>
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
