import type { OrderEntity } from '../types/api.ts'
import type { UserRole } from '../types/api.ts'
import { isPlatformAdminRole } from './console-auth.ts'

export function formatOrderAttendees(order: Pick<OrderEntity, 'attendees'>) {
  if (!order.attendees?.length) return '-'
  return order.attendees
    .map((attendee) => `${attendee.realName} ${attendee.idNoMask}`)
    .join('；')
}

export type ConsoleOrderStatusFilter = 'all' | 2 | 3 | 4

export const CONSOLE_ORDER_STATUS_TABS: Array<{ value: ConsoleOrderStatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 2, label: '已支付' },
  { value: 4, label: '已退款' },
  { value: 3, label: '已取消' },
]

export const CONSOLE_ORDER_STATUS_LABELS: Record<number, string> = {
  1: '待支付',
  2: '已支付',
  3: '已取消',
  4: '已退款',
}

export function formatConsoleOrderStatusLabel(status: number) {
  return CONSOLE_ORDER_STATUS_LABELS[status] || '未知订单状态'
}

export function getConsoleOrderStatusClassName(status: number) {
  if (status === 1) return 'bg-[#fff8e1] text-[#f59e0b]'
  if (status === 2) return 'bg-[#f0fff4] text-[#22c55e]'
  if (status === 3 || status === 4) return 'bg-[#f5f5f5] text-[#999]'
  return 'bg-[#fff7e6] text-[#ad6800]'
}

export interface ConsoleOrderStatusCounts {
  all: number
  paid: number
  refunded: number
  cancelled: number
}

export function filterConsoleOrdersByStatus(
  orders: OrderEntity[],
  statusFilter: ConsoleOrderStatusFilter,
) {
  if (statusFilter === 'all') return orders
  return orders.filter(order => order.status === statusFilter)
}

export function countConsoleOrdersByStatus(orders: OrderEntity[]): ConsoleOrderStatusCounts {
  return orders.reduce<ConsoleOrderStatusCounts>(
    (counts, order) => {
      counts.all += 1
      if (order.status === 2) counts.paid += 1
      if (order.status === 4) counts.refunded += 1
      if (order.status === 3) counts.cancelled += 1
      return counts
    },
    { all: 0, paid: 0, refunded: 0, cancelled: 0 },
  )
}

export function paginateConsoleOrders(
  orders: OrderEntity[],
  page: number,
  pageSize: number,
) {
  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const start = (currentPage - 1) * pageSize

  return {
    currentPage,
    totalPages,
    pageOrders: orders.slice(start, start + pageSize),
  }
}

export function getConsoleOrderScopeCopy(role: UserRole | null | undefined) {
  if (isPlatformAdminRole(role)) return '当前权限：平台管理员，可查看全部活动订单。'
  if (role === 'organizer_admin') return '当前权限：平台主办方运营员岗位账号，可按权限查看平台主办方业务订单。'
  if (role === 'organizer') return '当前权限：主办方，仅查看自己活动产生的订单。'
  return '当前权限：未识别后台角色，仅在登录后展示可访问订单。'
}

export function getSelectedConsoleOrders(orders: OrderEntity[], selectedIds: Set<number>) {
  if (selectedIds.size === 0) return []
  return orders.filter(order => selectedIds.has(order.id))
}

export function getConsoleOrderTicketLabel(
  order: Pick<OrderEntity, 'ticketName' | 'matchedTicketTypeId' | 'ticketTypeId'>,
) {
  return order.ticketName || '票档信息待同步'
}

export function getConsoleOrderActivityLabel(order: Pick<OrderEntity, 'activityName'>) {
  return order.activityName || '活动信息待同步'
}

export function buildConsoleOrderExportCsv(orders: OrderEntity[]) {
  const header = ['订单号', '活动', '票档', '数量', '金额', '状态', '观演人', '下单时间']
  const rows = orders.map(order => [
    order.orderNo,
    getConsoleOrderActivityLabel(order),
    getConsoleOrderTicketLabel(order),
    order.quantity,
    order.amount,
    formatConsoleOrderStatusLabel(order.status),
    formatOrderAttendees(order),
    order.createTime,
  ])
  return `\ufeff${[header, ...rows].map(row => row.map(csvCell).join(',')).join('\n')}`
}

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value)
  if (!/[",\r\n]/.test(text)) return text
  return `"${text.replaceAll('"', '""')}"`
}
