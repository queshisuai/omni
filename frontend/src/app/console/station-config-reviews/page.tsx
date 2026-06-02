'use client'

import { useEffect, useState } from 'react'
import { getUser } from '@/lib/auth'
import { approveStationConfigVersion, listStationConfigReviews, rejectStationConfigVersion } from '@/lib/api'
import { globalPrompt } from '@/components/GlobalDialog'
import type { StationConfigVersionVO } from '@/types/api'

function formatChangeType(type: string) {
  const text: Record<string, string> = {
    create: '创建站点',
    update_city: '修改城市',
    set_venue: '设置场馆',
    change_venue: '变更场馆',
    delete_station: '删除站点',
  }
  return text[type] || type
}

export default function StationConfigReviewsPage() {
  const [items, setItems] = useState<StationConfigVersionVO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [processingId, setProcessingId] = useState<number | null>(null)

  const loadReviews = async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await listStationConfigReviews({ status: 'submitted' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const user = getUser()
    if (!user || user.role !== 'admin') {
      setForbidden(true)
      setLoading(false)
      return
    }
    loadReviews()
  }, [])

  const handleReview = async (item: StationConfigVersionVO, action: 'approve' | 'reject') => {
    const reviewNote = await globalPrompt({
      title: action === 'approve' ? '通过备注' : '驳回原因',
      content: action === 'approve' ? '请输入通过备注（可留空）' : '请输入驳回原因（可留空）',
      type: 'reason',
    })
    if (reviewNote === null) return
    setProcessingId(item.id)
    setError('')
    try {
      const body = { reviewNote: reviewNote.trim() || null }
      if (action === 'approve') {
        await approveStationConfigVersion(item.id, body)
      } else {
        await rejectStationConfigVersion(item.id, body)
      }
      await loadReviews()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
  }

  if (forbidden) {
    return <div className="rounded-xl border border-[#e5e5e5] bg-white py-16 text-center text-[14px] text-[#999]">无权限访问</div>
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[22px] font-bold text-[#1a1a2e]">站点变更审核</h1>
        <p className="mt-1 text-[13px] text-[#999]">审核主办方提交的城市站点和场馆配置变更。</p>
      </div>

      {error && <div className="mb-4 rounded-lg bg-[#fff0f3] px-3 py-2 text-[13px] text-[#ff4d4f]">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
        {items.length === 0 ? (
          <div className="py-16 text-center text-[14px] text-[#999]">暂无待审核站点配置变更。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-[#fafafa] text-[#666]">
                <tr>
                  <th className="px-4 py-3 font-medium">版本号</th>
                  <th className="px-4 py-3 font-medium">变更类型</th>
                  <th className="px-4 py-3 font-medium">城市</th>
                  <th className="px-4 py-3 font-medium">站点名</th>
                  <th className="px-4 py-3 font-medium">场馆</th>
                  <th className="px-4 py-3 font-medium">原因</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {items.map(item => (
                  <tr key={item.id} className="text-[#333]">
                    <td className="px-4 py-3">{item.versionNo ? `v${item.versionNo}` : '-'}</td>
                    <td className="px-4 py-3">{formatChangeType(item.changeType)}</td>
                    <td className="px-4 py-3">{item.city || '城市待定'}</td>
                    <td className="px-4 py-3">{item.stationName || (item.city ? `${item.city}站` : '未命名站点')}</td>
                    <td className="px-4 py-3">{item.venueName || '未绑定场馆'}</td>
                    <td className="px-4 py-3">{item.reason || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => handleReview(item, 'approve')} disabled={processingId === item.id} className="rounded-lg bg-[#22c55e] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60">通过</button>
                        <button onClick={() => handleReview(item, 'reject')} disabled={processingId === item.id} className="rounded-lg bg-[#ff1268] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60">驳回</button>
                      </div>
                    </td>
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
