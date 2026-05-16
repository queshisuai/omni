'use client'

import { useState, useEffect } from 'react'
import { listReviews, createReview, deleteReview } from '@/lib/api'
import { getUser, isAuthenticated } from '@/lib/auth'
import { Star, Trash2 } from 'lucide-react'
import type { ReviewEntity } from '@/types/api'

export function ReviewSection({ activityId }: { activityId: number }) {
  const [reviews, setReviews] = useState<ReviewEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadData = () => {
    listReviews(activityId).then(res => setReviews(res.records)).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [activityId])

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '0'

  const handleSubmit = async () => {
    const u = getUser()
    if (!u) return
    setSubmitting(true)
    try {
      await createReview({ userId: u.userId, activityId, rating, content: content || null })
      setContent('')
      setRating(5)
      setShowForm(false)
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : '发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除评价？')) return
    await deleteReview(id)
    loadData()
  }

  return (
    <section className="mt-10 border-t border-[#f0f0f0] pt-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-[18px] font-medium text-[#111]">用户评价</h2>
          <span className="text-[24px] text-[#ff1268] font-bold">{avgRating}</span>
          <span className="text-[13px] text-[#999]">({reviews.length}条)</span>
        </div>
        {isAuthenticated() && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-[13px] text-[#ff1268] border border-[#ff1268] rounded-lg px-4 py-1.5 bg-transparent cursor-pointer hover:bg-[#fff0f3] transition-colors"
          >
            {showForm ? '取消' : '写评价'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-[#fafafa] rounded-lg p-4 mb-4">
          <div className="flex items-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map(i => (
              <button key={i} onClick={() => setRating(i)} className="bg-transparent border-none cursor-pointer p-0">
                <Star className={`w-6 h-6 ${i <= rating ? 'fill-[#ff1268] text-[#ff1268]' : 'text-[#ddd]'}`} />
              </button>
            ))}
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268] resize-none"
            placeholder="分享你的观演体验..."
          />
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-2 bg-[#ff1268] text-white px-5 py-1.5 rounded-lg text-[13px] border-none cursor-pointer hover:bg-[#e0105a] transition-colors disabled:opacity-50"
          >
            {submitting ? '发布中...' : '发布'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center text-[#999] py-8 text-[13px]">加载中...</div>
      ) : reviews.length === 0 ? (
        <div className="text-center text-[#999] py-8 text-[13px]">暂无评价，成为第一个评价的人吧</div>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => (
            <div key={r.id} className="border-b border-[#f5f5f5] pb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[13px] font-medium text-[#333]">用户{r.userId}</span>
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-3 h-3 ${i < r.rating ? 'fill-[#ff1268] text-[#ff1268]' : 'text-[#ddd]'}`} />
                  ))}
                </div>
                <span className="text-[12px] text-[#999] ml-auto">{r.createTime?.substring(0, 10)}</span>
              </div>
              {r.content && <p className="text-[14px] text-[#666] leading-relaxed">{r.content}</p>}
              {r.images && (
                <div className="flex gap-2 mt-2">
                  {JSON.parse(r.images).map((img: string, i: number) => (
                    <img key={i} src={img} alt="" className="w-16 h-16 object-cover rounded" />
                  ))}
                </div>
              )}
              {getUser()?.userId === r.userId && (
                <button onClick={() => handleDelete(r.id)} className="mt-2 text-[12px] text-[#999] bg-transparent border-none cursor-pointer hover:text-[#ef4444]">
                  <Trash2 className="w-3 h-3 inline mr-1" />删除
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
