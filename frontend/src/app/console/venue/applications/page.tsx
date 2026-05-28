'use client'

import { useEffect, useMemo, useState } from 'react'
import { getToken, getUser } from '@/lib/auth'
import { listAdminVenues, listVenueApplications, privateAssetDownloadUrl, reviewVenueApplication } from '@/lib/api'
import { DEFAULT_PAGE_SIZE, Pagination } from '@/components/Pagination'
import type { PrivateAssetVO, VenueApplicationVO, VenueEntity } from '@/types/api'

const statusText: Record<number, string> = { 0: '待审核', 1: '已通过', 2: '已驳回' }

function formatSize(size?: number | null) {
  if (size === null || size === undefined) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback
}

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
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [page, setPage] = useState(1)

  const pageApplications = useMemo(() => applications.slice((page - 1) * DEFAULT_PAGE_SIZE, page * DEFAULT_PAGE_SIZE), [applications, page])

  const loadData = async (nextUserId = userId) => {
    if (!nextUserId) return
    setLoading(true)
    setLoadError('')
    try {
      const [applicationList, venueList] = await Promise.all([
        listVenueApplications(status === '' ? {} : { status: Number(status) }),
        listAdminVenues(nextUserId),
      ])
      setApplications(applicationList)
      setVenues(venueList)
      setPage(1)
    } catch (err) {
      setLoadError(getErrorMessage(err, '加载场馆资料审核失败'))
    } finally {
      setLoading(false)
    }
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

  const downloadProofAsset = async (proofAsset: PrivateAssetVO) => {
    const token = getToken()
    if (!token) {
      setMessage('登录已失效，请重新登录后下载')
      return
    }

    let objectUrl: string | null = null
    try {
      const response = await fetch(privateAssetDownloadUrl(proofAsset.id), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('download failed')

      const blob = await response.blob()
      objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const disposition = response.headers.get('Content-Disposition') || response.headers.get('content-disposition')
      const filename = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1]
      link.href = objectUrl
      link.download = filename ? decodeURIComponent(filename) : proofAsset.originalFilename || `proof-asset-${proofAsset.id}`
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch {
      setMessage('附件下载失败，请稍后重试')
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }

  const handleApprove = async () => {
    if (!reviewingId) return
    if (mode === 'link' && !venueId) {
      setMessage('请选择要关联的已有场馆')
      return
    }
    try {
      await reviewVenueApplication(reviewingId, {
        action: 'approve',
        mode,
        venueId: mode === 'link' ? Number(venueId) : null,
        reviewNote,
      })
      setReviewingId(null)
      loadData(userId)
    } catch (err) {
      setMessage(getErrorMessage(err, '审核通过失败，请稍后重试'))
    }
  }

  const handleReject = async () => {
    if (!reviewingId) return
    if (!reviewNote.trim()) {
      setMessage('驳回必须填写原因')
      return
    }
    try {
      await reviewVenueApplication(reviewingId, { action: 'reject', reviewNote })
      setReviewingId(null)
      loadData(userId)
    } catch (err) {
      setMessage(getErrorMessage(err, '审核驳回失败，请稍后重试'))
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">场馆资料审核</h1>
          <p className="mt-1 text-[13px] text-[#999]">核验主办方上传的场馆资料和场地审批文件真伪，避免虚假材料造成后续纠纷；平台不拥有场馆，也不授予场地使用权。</p>
        </div>
        <div className="flex gap-2">
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="h-10 rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]">
            <option value="">全部状态</option>
            <option value="0">待审核</option>
            <option value="1">已通过</option>
            <option value="2">已驳回</option>
          </select>
          <button onClick={() => loadData(userId)} className="h-10 rounded-lg bg-[#1a1a2e] px-5 text-[14px] font-medium text-white">查询</button>
        </div>
      </div>

      {message && <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-2 text-[13px] text-[#ef4444]">{message}</div>}

      <div className="space-y-4">
        {loadError ? <div className="rounded-xl border border-[#ffd9e6] bg-white py-20 text-center text-[14px] text-[#ff4d4f]">{loadError}</div> : loading ? <div className="rounded-xl border border-[#e5e5e5] bg-white py-20 text-center text-[14px] text-[#999]">加载中...</div> : applications.length === 0 ? <div className="rounded-xl border border-[#e5e5e5] bg-white py-20 text-center text-[14px] text-[#999]">暂无场馆审核资料</div> : pageApplications.map(item => (
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
                {item.proofAsset && (
                  <div className="mt-3 rounded-lg border border-[#f0f0f0] bg-[#fafafa] p-3 text-[13px] text-[#666]">
                    <div className="font-medium text-[#333]">审核资料附件</div>
                    <div className="mt-1 grid gap-1 sm:grid-cols-3">
                      <div>文件名：{item.proofAsset.originalFilename || '-'}</div>
                      <div>大小：{formatSize(item.proofAsset.fileSize)}</div>
                      <div>类型：{item.proofAsset.contentType || '-'}</div>
                    </div>
                    <button onClick={() => downloadProofAsset(item.proofAsset!)} className="mt-2 rounded-lg border border-[#ff1268] px-3 py-1.5 text-[12px] font-medium text-[#ff1268]">下载审核文件</button>
                  </div>
                )}
                {item.proofFileUrl && <div className="mt-2 text-[13px] text-[#999]">历史审核文件链接：<a href={item.proofFileUrl} target="_blank" rel="noreferrer" className="text-[#666] underline break-all">{item.proofFileUrl}</a></div>}
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
                  <label className="flex items-center gap-1"><input type="radio" checked={mode === 'create'} onChange={() => setMode('create')} /> 新增场馆记录</label>
                  <label className="flex items-center gap-1"><input type="radio" checked={mode === 'link'} onChange={() => setMode('link')} /> 关联已有场馆记录</label>
                </div>
                {mode === 'link' && (
                  <select value={venueId} onChange={e => setVenueId(e.target.value)} className="mb-3 h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]">
                    <option value="">请选择已有场馆记录</option>
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
      {!loadError && !loading && applications.length > 0 && (
        <Pagination page={page} total={applications.length} loading={loading} onChange={setPage} />
      )}
    </div>
  )
}
