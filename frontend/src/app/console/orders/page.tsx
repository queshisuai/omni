'use client'

import { useEffect, useState } from 'react'
import { getUser } from '@/lib/auth'
import { listOrders } from '@/lib/api'
import type { OrderEntity } from '@/types/api'

export default function ConsoleOrdersPage() {
  const [orders, setOrders] = useState<OrderEntity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = getUser()
    if (!u) return
    // 简单加载当前用户订单（后续可扩展为按活动筛选）
    listOrders(u.userId).then(setOrders).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const statusLabels: Record<number, string> = { 1: '待支付', 2: '已支付', 3: '已取消', 4: '已退款' }

  return (
    <div>
      <h1 className="text-[22px] font-bold text-[#1a1a2e] mb-5">订单查看</h1>
      <div className="text-[13px] text-[#666] bg-[#e3f2fd] border border-[#bbdefb] rounded-lg p-3 mb-4">
        此处显示您名下的订单。后续将支持按活动筛选订单。
      </div>

      {loading ? (
        <div className="text-center text-[#999] py-20">加载中...</div>
      ) : orders.length === 0 ? (
        <div className="text-center text-[#999] py-20 bg-white rounded-xl border border-[#e5e5e5] text-[14px]">
          暂无订单
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#e5e5e5] overflow-hidden">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-[#e5e5e5] bg-[#fafafa]">
                <th className="text-left p-3 font-medium text-[#666]">订单号</th>
                <th className="text-left p-3 font-medium text-[#666]">金额</th>
                <th className="text-left p-3 font-medium text-[#666]">数量</th>
                <th className="text-left p-3 font-medium text-[#666]">状态</th>
                <th className="text-left p-3 font-medium text-[#666]">时间</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b border-[#f0f0f0] hover:bg-[#fafafa]">
                  <td className="p-3 font-medium text-[#333]">{o.orderNo}</td>
                  <td className="p-3 text-[#ff1268] font-medium">¥{o.amount}</td>
                  <td className="p-3 text-[#666]">{o.quantity}张</td>
                  <td className="p-3">
                    <span className={`text-[12px] px-2 py-0.5 rounded-full ${
                      o.status === 1 ? 'bg-[#fff8e1] text-[#f59e0b]' :
                      o.status === 2 ? 'bg-[#f0fff4] text-[#22c55e]' :
                      'bg-[#f5f5f5] text-[#999]'
                    }`}>{statusLabels[o.status] || '-'}</span>
                  </td>
                  <td className="p-3 text-[#999]">{o.createTime?.substring(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
