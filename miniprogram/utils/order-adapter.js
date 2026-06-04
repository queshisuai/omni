function formatDateTime(value) {
  if (!value) {
    return '时间待定'
  }
  return String(value).replace('T', ' ').slice(0, 16)
}

function statusText(status) {
  if (status === 1) return '待支付'
  if (status === 2) return '已支付'
  if (status === 3) return '已取消'
  if (status === 4) return '已退款'
  return '未知状态'
}

function normalizeOrderItem(item) {
  return {
    id: item.id,
    orderNo: item.orderNo,
    title: item.activityName || '未知活动',
    venue: item.venueName || '未知场馆',
    date: formatDateTime(item.sessionTime || item.createTime),
    ticketName: item.ticketName || '未知票档',
    quantity: item.quantity || 0,
    total: Number(item.amount || 0),
    status: item.status,
    statusText: statusText(item.status),
    statusClass: 'status-' + item.status,
    seatLabels: item.seatLabels || '',
    createdAt: formatDateTime(item.createTime)
  }
}

module.exports = {
  normalizeOrderItem: normalizeOrderItem,
  statusText: statusText
}
