'use client'

import { useState, useEffect } from 'react'
import { listMoments, createMoment, deleteMoment } from '@/lib/api'
import { getUser, isAuthenticated } from '@/lib/auth'
import { MessageCircle, Trash2 } from 'lucide-react'
import type { MomentEntity } from '@/types/api'

export function MomentSection({ activityId }: { activityId: number }) {
  const [moments, setMoments] = useState<MomentEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadData = () => {
    listMoments(activityId).then(res => setMoments(res.records)).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [activityId])

  const handleSubmit = async () => {
    const u = getUser()
    if (!u || !content.trim()) return
    setSubmitting(true)
    try {
      await createMoment({ userId: u.userId, activityId, content: content.trim() })
      setContent('')
      setShowForm(false)
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : '发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除动态？')) return
    await deleteMoment(id)
    loadData()
  }

  return (
    <section className="mt-8 border-t border-[#f0f0f0] pt-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-[18px] font-medium text-[#111]">用户动态</h2>
          <span className="text-[13px] text-[#999]">({moments.length}条)</span>
        </div>
        {isAuthenticated() && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-[13px] text-[#ff1268] border border-[#ff1268] rounded-lg px-4 py-1.5 bg-transparent cursor-pointer hover:bg-[#fff0f3] transition-colors"
          >
            {showForm ? '取消' : '发动态'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-[#fafafa] rounded-lg p-4 mb-4">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268] resize-none"
            placeholder="分享你的想法..."
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="mt-2 bg-[#ff1268] text-white px-5 py-1.5 rounded-lg text-[13px] border-none cursor-pointer hover:bg-[#e0105a] transition-colors disabled:opacity-50"
          >
            {submitting ? '发布中...' : '发布'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center text-[#999] py-8 text-[13px]">加载中...</div>
      ) : moments.length === 0 ? (
        <div className="text-center text-[#999] py-8 text-[13px]">暂无动态</div>
      ) : (
        <div className="space-y-4">
          {moments.map(m => (
            <div key={m.id} className="border-b border-[#f5f5f5] pb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[13px] font-medium text-[#333]">用户{m.userId}</span>
                <span className="text-[12px] text-[#999] ml-auto">{m.createTime?.substring(0, 10)}</span>
              </div>
              <p className="text-[14px] text-[#666] leading-relaxed">{m.content}</p>
              {m.images && (
                <div className="flex gap-2 mt-2">
                  {JSON.parse(m.images).map((img: string, i: number) => (
                    <img key={i} src={img} alt="" className="w-16 h-16 object-cover rounded" />
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4 mt-2">
                <span className="text-[12px] text-[#999] flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" /> {m.commentCount || 0}
                </span>
                {getUser()?.userId === m.userId && (
                  <button onClick={() => handleDelete(m.id)} className="text-[12px] text-[#999] bg-transparent border-none cursor-pointer hover:text-[#ef4444]">
                    <Trash2 className="w-3 h-3 inline mr-1" />删除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
