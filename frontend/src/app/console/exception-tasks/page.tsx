'use client'

import { useEffect, useState } from 'react'
import { listExceptionTasks } from '@/lib/api'
import type { ExceptionTaskVO } from '@/types/api'

const severityText: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const statusText: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已处理',
}

export default function ExceptionTasksPage() {
  const [items, setItems] = useState<ExceptionTaskVO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await listExceptionTasks())
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载异常任务失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-[22px] font-bold text-[#1a1a2e]">异常任务</h1>
        <button onClick={load} className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-[13px] font-medium text-[#333] hover:border-[#ff1268] hover:text-[#ff1268]">刷新</button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-[#fff0f3] px-3 py-2 text-[13px] text-[#ff4d4f]">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
        {loading ? (
          <div className="py-16 text-center text-[14px] text-[#999]">正在加载...</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-[14px] text-[#999]">暂无异常任务</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-[#fafafa] text-[#666]">
                <tr>
                  <th className="px-4 py-3 font-medium">类型</th>
                  <th className="px-4 py-3 font-medium">业务编号</th>
                  <th className="px-4 py-3 font-medium">订单号</th>
                  <th className="px-4 py-3 font-medium">等级</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">原因</th>
                  <th className="px-4 py-3 font-medium">TraceId</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {items.map(item => (
                  <tr key={item.id} className="text-[#333]">
                    <td className="px-4 py-3">{item.taskType}</td>
                    <td className="px-4 py-3">{item.businessNo || '-'}</td>
                    <td className="px-4 py-3">{item.orderNo || '-'}</td>
                    <td className="px-4 py-3">{severityText[item.severity] || item.severity}</td>
                    <td className="px-4 py-3">{statusText[item.status] || item.status}</td>
                    <td className="max-w-[280px] px-4 py-3">{item.reason || '-'}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#666]">{item.traceId || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
