import type { OrderEntity } from '../types/api.ts'
import type { UserRole } from '../types/api.ts'

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
  if (role === 'admin') return '当前权限：平台管理员，可查看全部活动订单。'
  if (role === 'organizer') return '当前权限：主办方，仅查看自己活动产生的订单。'
  return '当前权限：未识别后台角色，仅在登录后展示可访问订单。'
}
