'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { listActivityRiskResolutions, reviewActivityRiskResolution } from '@/lib/api'
import type { ActivityRiskResolutionVO } from '@/types/api'

export default function RiskResolutionsPage() {
  const router = useRouter()
  const [items, setItems] = useState<ActivityRiskResolutionVO[]>([])
  const [userId, setUserId] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  const loadData = async (id = userId) => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      setItems(await listActivityRiskResolutions(id, 'pending'))
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载恢复申请失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const user = getUser()
    if (!user) {
      router.replace('/login?ru=/console/risk-resolutions')
      return
    }
    setUserId(user.userId)
    void loadData(user.userId)
  }, [router])

  const review = async (id: number, action: 'approve' | 'reject') => {
    await reviewActivityRiskResolution(id, { userId, action, reviewNote: note.trim() || null })
    setNote('')
    await loadData(userId)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-[#1a1a2e]">恢复售票审核</h1>
        <p className="mt-1 text-[13px] text-[#999]">审核风险停票活动的主办方处理申请。</p>
      </div>
      <textarea value={note} onChange={event => setNote(event.target.value)} className="h-20 w-full rounded-xl border border-[#ddd] p-3 text-[14px]" placeholder="审核备注" />
      {error && <div className="rounded-xl bg-[#fef2f2] p-3 text-[#dc2626]">{error}</div>}
      {loading ? <div className="text-[#999]">加载中...</div> : items.length === 0 ? <div className="rounded-xl bg-white p-8 text-center text-[#999]">暂无待审核申请</div> : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="rounded-xl border border-[#eee] bg-white p-4">
              <div className="font-semibold text-[#1a1a2e]">活动 #{item.activityId}</div>
              <div className="mt-1 text-[13px] text-[#666]">处理说明：{item.resolutionNote || '未填写'}</div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => review(item.id, 'approve')} className="rounded-full bg-[#16a34a] px-4 py-2 text-[13px] text-white">通过恢复</button>
                <button onClick={() => review(item.id, 'reject')} className="rounded-full bg-[#ef4444] px-4 py-2 text-[13px] text-white">拒绝</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
