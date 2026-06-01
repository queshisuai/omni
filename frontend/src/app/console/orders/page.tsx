'use client'

import { useEffect, useMemo, useState } from 'react'
import { getUser } from '@/lib/auth'
import { listConsoleOrders } from '@/lib/api'
import { DEFAULT_PAGE_SIZE, Pagination } from '@/components/Pagination'
import { ConsoleTableSkeleton } from '@/components/Skeleton'
import { CheckSquare, Download, Square } from 'lucide-react'
import {
  buildConsoleOrderExportCsv,
  CONSOLE_ORDER_STATUS_LABELS,
  CONSOLE_ORDER_STATUS_TABS,
  countConsoleOrdersByStatus,
  filterConsoleOrdersByStatus,
  paginateConsoleOrders,
  type ConsoleOrderStatusFilter,
  getConsoleOrderScopeCopy,
  getSelectedConsoleOrders,
  formatOrderAttendees,
} from '@/lib/console-orders'
import type { OrderEntity, UserRole } from '@/types/api'

function getTicketTypeLabel(order: OrderEntity) {
  return order.ticketName || `票档 ${order.matchedTicketTypeId ?? order.ticketTypeId}`
}

export default function ConsoleOrdersPage() {
  const [orders, setOrders] = useState<OrderEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<ConsoleOrderStatusFilter>('all')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
  const [exportMessage, setExportMessage] = useState('')
  const [userRole, setUserRole] = useState<UserRole | null>(() => {
    if (typeof window === 'undefined') return null
    return getUser()?.role ?? null
  })

  useEffect(() => {
    const u = getUser()
    if (!u) {
      setLoading(false)
      return
    }
    setUserRole(u.role ?? null)
    listConsoleOrders({ paidOnly: false }).then(setOrders).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const statusCounts = useMemo(() => countConsoleOrdersByStatus(orders), [orders])
  const filteredOrders = useMemo(
    () => filterConsoleOrdersByStatus(orders, statusFilter),
    [orders, statusFilter],
  )
  const { currentPage, pageOrders } = useMemo(
    () => paginateConsoleOrders(filteredOrders, page, DEFAULT_PAGE_SIZE),
    [filteredOrders, page],
  )
  const selectedOrders = useMemo(
    () => getSelectedConsoleOrders(filteredOrders, selectedIds),
    [filteredOrders, selectedIds],
  )
  const allPageSelected = pageOrders.length > 0 && pageOrders.every(order => selectedIds.has(order.id))

  const getStatusCount = (value: ConsoleOrderStatusFilter) => {
    if (value === 'all') return statusCounts.all
    if (value === 2) return statusCounts.paid
    if (value === 4) return statusCounts.refunded
    return statusCounts.cancelled
  }

  const toggleOrder = (orderId: number) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
    setExportMessage('')
  }

  const togglePageOrders = () => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allPageSelected) {
        for (const order of pageOrders) next.delete(order.id)
      } else {
        for (const order of pageOrders) next.add(order.id)
      }
      return next
    })
    setExportMessage('')
  }

  const exportOrders = (scope: 'selected' | 'filtered') => {
    const target = scope === 'selected' ? selectedOrders : filteredOrders
    if (target.length === 0) {
      setExportMessage('暂无可导出的订单')
      return
    }
    const blob = new Blob([buildConsoleOrderExportCsv(target)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `后台订单-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setExportMessage(scope === 'selected' ? `已导出 ${target.length} 条所选订单` : `已导出 ${target.length} 条当前筛选订单`)
  }

  return (
    <div>
      <h1 className="text-[22px] font-bold text-[#1a1a2e] mb-5">订单查看</h1>
      <div className="text-[13px] text-[#35506b] bg-[#e3f2fd] border border-[#bbdefb] rounded-lg p-3 mb-4">
        <div className="font-medium text-[#1f3f5b]">{getConsoleOrderScopeCopy(userRole)}</div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {CONSOLE_ORDER_STATUS_TABS.map(tab => {
          const active = statusFilter === tab.value

          return (
            <button
              key={String(tab.value)}
              type="button"
              onClick={() => {
                setStatusFilter(tab.value)
                setPage(1)
                setSelectedIds(new Set())
                setExportMessage('')
              }}
              className={`h-9 rounded-lg border px-3 text-[13px] transition ${
                active
                  ? 'border-[#ff1268] bg-[#fff1f6] text-[#ff1268]'
                  : 'border-[#e5e5e5] bg-white text-[#666] hover:border-[#ff1268] hover:text-[#ff1268]'
              }`}
            >
              {tab.label}
              <span className="ml-1 text-[12px] opacity-75">{getStatusCount(tab.value)}</span>
            </button>
          )
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5e5e5] bg-white px-4 py-3">
        <div className="text-[13px] text-[#666]">
          已选择 <span className="font-semibold text-[#ff1268]">{selectedOrders.length}</span> 条；当前筛选共 {filteredOrders.length} 条
          {exportMessage ? <span className="ml-3 text-[#22c55e]">{exportMessage}</span> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportOrders('selected')}
            disabled={selectedOrders.length === 0}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#ff1268] bg-white px-3 text-[13px] font-medium text-[#ff1268] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            导出所选
          </button>
          <button
            type="button"
            onClick={() => exportOrders('filtered')}
            disabled={filteredOrders.length === 0}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#ff1268] px-3 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            导出当前筛选
          </button>
        </div>
      </div>

      {loading ? (
        <ConsoleTableSkeleton />
      ) : orders.length === 0 ? (
        <div className="text-center text-[#999] py-20 bg-white rounded-xl border border-[#e5e5e5] text-[14px]">
          暂无订单
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center text-[#999] py-20 bg-white rounded-xl border border-[#e5e5e5] text-[14px]">
          当前状态暂无订单
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#e5e5e5] overflow-hidden">
          <table className="w-full text-[14px]">
            <thead>
                <tr className="border-b border-[#e5e5e5] bg-[#fafafa]">
                  <th className="w-12 p-3 text-left font-medium text-[#666]">
                    <button type="button" onClick={togglePageOrders} className="text-[#666] hover:text-[#ff1268]" title={allPageSelected ? '取消选择本页' : '选择本页'}>
                      {allPageSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </button>
                  </th>
                  <th className="text-left p-3 font-medium text-[#666]">订单号</th>
                  <th className="text-left p-3 font-medium text-[#666]">活动</th>
                  <th className="text-left p-3 font-medium text-[#666]">金额</th>
                <th className="text-left p-3 font-medium text-[#666]">数量</th>
                <th className="text-left p-3 font-medium text-[#666]">状态</th>
                <th className="text-left p-3 font-medium text-[#666]">时间</th>
              </tr>
            </thead>
            <tbody>
              {pageOrders.map(o => {
                const requestedTicketTypeId = o.requestedTicketTypeId ?? o.ticketTypeId
                const matchedTicketTypeId = o.matchedTicketTypeId ?? o.ticketTypeId
                const showTicketRoute = o.autoDowngraded && requestedTicketTypeId !== matchedTicketTypeId

                return (
                <tr key={o.id} className="border-b border-[#f0f0f0] hover:bg-[#fafafa]">
                  <td className="p-3">
                    <button type="button" onClick={() => toggleOrder(o.id)} className="text-[#999] hover:text-[#ff1268]" title={selectedIds.has(o.id) ? '取消选择' : '选择订单'}>
                      {selectedIds.has(o.id) ? <CheckSquare className="h-4 w-4 text-[#ff1268]" /> : <Square className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="p-3 font-medium text-[#333]">{o.orderNo}</td>
                  <td className="p-3 text-[#333] max-w-[260px]">
                    <div className="font-medium line-clamp-2">{o.activityName || '未知活动'}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-[#777]">
                      <span>{getTicketTypeLabel(o)}</span>
                      {showTicketRoute && (
                        <span className="text-[#999]">#{requestedTicketTypeId} → #{matchedTicketTypeId}</span>
                      )}
                      {o.autoDowngraded && (
                        <span className="inline-flex items-center rounded border border-[#ffb3ca] bg-[#fff7fa] px-1.5 py-0.5 text-[11px] font-medium text-[#ff1268]">
                          降级成功
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-[#333]">
                    <div className="font-medium text-[#ff1268]">¥{o.amount}</div>
                    <div className="mt-1 text-[12px] text-[#777]">{formatOrderAttendees(o)}</div>
                  </td>
                  <td className="p-3 text-[#666]">{o.quantity}张</td>
                  <td className="p-3">
                    <span className={`text-[12px] px-2 py-0.5 rounded-full ${
                      o.status === 1 ? 'bg-[#fff8e1] text-[#f59e0b]' :
                      o.status === 2 ? 'bg-[#f0fff4] text-[#22c55e]' :
                      'bg-[#f5f5f5] text-[#999]'
                    }`}>{CONSOLE_ORDER_STATUS_LABELS[o.status] || '-'}</span>
                  </td>
                  <td className="p-3 text-[#999]">{o.createTime?.substring(0, 10)}</td>
                </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <Pagination page={currentPage} total={filteredOrders.length} loading={loading} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  )
}
