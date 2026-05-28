'use client'

import { useEffect, useState } from 'react'
import { getUser } from '@/lib/auth'
import { listAdminVenues, listVenueApplications, reviewVenueApplication } from '@/lib/api'
import type { VenueApplicationVO, VenueEntity } from '@/types/api'

const statusText: Record<number, string> = { 0: '待审核', 1: '已通过', 2: '已驳回' }

export default function VenueApplicationsPage() {
  const [userId, setUserId] = useState(0)
  const [applications, setApplications] = useState<VenueApplicationVO[]>([])
  const [venues, setVenues] = useState<VenueEntity[]>([])
  const [status, setStatus] = useState('0')
  const [reviewingId, setReviewingId] = useState<number | null>(null)
  const [mode, setMode] = useState<'create' | 'link'>('create')
  const [venueId, setVenueId] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [message, setMessage] = useState('')

  const loadData = (nextUserId = userId) => {
    if (!nextUserId) return
    listVenueApplications(status === '' ? {} : { status: Number(status) }).then(setApplications).catch(() => {})
    listAdminVenues(nextUserId).then(setVenues).catch(() => {})
  }

  useEffect(() => {
    const u = getUser()
    if (!u) return
    setUserId(u.userId)
    loadData(u.userId)
  }, [])

  const openReview = (id: number) => {
    setReviewingId(id)
    setMode('create')
    setVenueId('')
    setReviewNote('')
    setMessage('')
  }

  const handleApprove = async () => {
    if (!reviewingId) return
    if (mode === 'link' && !venueId) {
      setMessage('请选择要关联的已有场馆')
      return
    }
    await reviewVenueApplication(reviewingId, {
      userId,
      action: 'approve',
      mode,
      venueId: mode === 'link' ? Number(venueId) : null,
      reviewNote,
    })
    setReviewingId(null)
    loadData(userId)
  }

  const handleReject = async () => {
    if (!reviewingId) return
    if (!reviewNote.trim()) {
      setMessage('驳回必须填写原因')
      return
    }
    await reviewVenueApplication(reviewingId, { userId, action: 'reject', reviewNote })
    setReviewingId(null)
    loadData(userId)
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">活动地点凭证审核</h1>
          <p className="mt-1 text-[13px] text-[#999]">审核主办方提交的地点资料和场地审批凭证，平台不授予场地使用权。</p>
        </div>
        <div className="flex gap-2">
          <select value={status} onChange={e => setStatus(e.target.value)} className="h-10 rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]">
            <option value="">全部状态</option>
            <option value="0">待审核</option>
            <option value="1">已通过</option>
            <option value="2">已驳回</option>
          </select>
          <button onClick={() => loadData(userId)} className="h-10 rounded-lg bg-[#1a1a2e] px-5 text-[14px] font-medium text-white">查询</button>
        </div>
      </div>

      <div className="space-y-4">
        {applications.length === 0 ? <div className="rounded-xl border border-[#e5e5e5] bg-white py-20 text-center text-[14px] text-[#999]">暂无地点凭证</div> : applications.map(item => (
          <div key={item.id} className="rounded-xl border border-[#e5e5e5] bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-[16px] font-bold text-[#333]">{item.venueName}</div>
                <div className="mt-1 text-[14px] text-[#666]">{item.city} · {item.address}</div>
                <div className="mt-2 grid gap-1 text-[13px] text-[#666] sm:grid-cols-2">
                  <div>容量：{item.capacity ?? '-'}</div>
                  <div>联系人：{item.contactName} / {item.contactPhone}</div>
                  <div>资质编号：{item.qualificationNo || '-'}</div>
                  <div>经营范围：{item.businessScope || '-'}</div>
                </div>
                {item.description && <div className="mt-2 text-[13px] text-[#999]">申请说明：{item.description}</div>}
                {item.reviewNote && <div className="mt-2 text-[13px] text-[#999]">审核备注：{item.reviewNote}</div>}
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[12px] text-[#666]">{statusText[item.status]}</span>
                {item.status === 0 && <button onClick={() => openReview(item.id)} className="rounded-lg bg-[#ff1268] px-4 py-2 text-[13px] font-medium text-white">审核</button>}
              </div>
            </div>

            {reviewingId === item.id && (
              <div className="mt-4 rounded-lg border border-[#ffd9e6] bg-[#fff7fa] p-4">
                <div className="mb-3 flex gap-4 text-[14px] text-[#333]">
                  <label className="flex items-center gap-1"><input type="radio" checked={mode === 'create'} onChange={() => setMode('create')} /> 登记新地点资料</label>
                  <label className="flex items-center gap-1"><input type="radio" checked={mode === 'link'} onChange={() => setMode('link')} /> 关联已有地点档案</label>
                </div>
                {mode === 'link' && (
                  <select value={venueId} onChange={e => setVenueId(e.target.value)} className="mb-3 h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]">
                    <option value="">请选择已有地点档案</option>
                    {venues.map(venue => <option key={venue.id} value={venue.id}>{venue.name} ({venue.city})</option>)}
                  </select>
                )}
                <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={3} className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="审核备注；驳回时必填" />
                {message && <div className="mt-2 text-[13px] text-[#ef4444]">{message}</div>}
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => setReviewingId(null)} className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[13px] text-[#666]">取消</button>
                  <button onClick={handleReject} className="rounded-lg bg-[#ef4444] px-4 py-2 text-[13px] font-medium text-white">驳回</button>
                  <button onClick={handleApprove} className="rounded-lg bg-[#22c55e] px-4 py-2 text-[13px] font-medium text-white">通过</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
