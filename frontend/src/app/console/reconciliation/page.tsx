'use client'

import { useEffect, useState } from 'react'
import { createReconciliationBatch, listReconciliationBatches } from '@/lib/api'
import { globalAlert } from '@/components/GlobalDialog'
import type { ReconciliationBatchVO } from '@/types/api'

function todayText() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function ReconciliationPage() {
  const [items, setItems] = useState<ReconciliationBatchVO[]>([])
  const [bizDate, setBizDate] = useState(todayText())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await listReconciliationBatches())
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载对账批次失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleCreate = async () => {
    if (!bizDate) {
      await globalAlert('请选择对账日期')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createReconciliationBatch(bizDate)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成对账批次失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-bold text-[#1a1a2e]">日结对账</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={bizDate}
            onChange={event => setBizDate(event.target.value)}
            className="h-9 rounded-lg border border-[#e5e5e5] bg-white px-3 text-[13px] outline-none focus:border-[#ff1268]"
          />
          <button onClick={handleCreate} disabled={submitting} className="rounded-lg bg-[#ff1268] px-3 py-2 text-[13px] font-medium text-white disabled:opacity-60">
            {submitting ? '生成中...' : '生成批次'}
          </button>
          <button onClick={load} className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-[13px] font-medium text-[#333] hover:border-[#ff1268] hover:text-[#ff1268]">刷新</button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-[#fff0f3] px-3 py-2 text-[13px] text-[#ff4d4f]">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
        {loading ? (
          <div className="py-16 text-center text-[14px] text-[#999]">正在加载...</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-[14px] text-[#999]">暂无对账批次</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-[#fafafa] text-[#666]">
                <tr>
                  <th className="px-4 py-3 font-medium">批次号</th>
                  <th className="px-4 py-3 font-medium">日期</th>
                  <th className="px-4 py-3 font-medium">来源</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">生成时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {items.map(item => (
                  <tr key={item.id} className="text-[#333]">
                    <td className="px-4 py-3 font-mono text-[12px]">{item.batchNo}</td>
                    <td className="px-4 py-3">{item.bizDate}</td>
                    <td className="px-4 py-3">{item.sourceType}</td>
                    <td className="px-4 py-3">{item.status}</td>
                    <td className="px-4 py-3">{item.createTime || '-'}</td>
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
