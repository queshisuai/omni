'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { createStationDraft, listMyVenueApplications, uploadTicketAsset } from '@/lib/api'
import { LocalFileUpload } from '@/components/LocalFileUpload'
import type { VenueApplicationVO } from '@/types/api'

export default function NewStationPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const tourId = Number(params.id)
  const [userId, setUserId] = useState(0)
  const [city, setCity] = useState('')
  const [stationName, setStationName] = useState('')
  const [poster, setPoster] = useState('')
  const [uploadingPoster, setUploadingPoster] = useState(false)
  const [announceOnly, setAnnounceOnly] = useState(true)
  const [applications, setApplications] = useState<VenueApplicationVO[]>([])
  const [selectedVenueApplicationId, setSelectedVenueApplicationId] = useState('')
  const [checkingLogin, setCheckingLogin] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = getUser()
    if (!user) {
      setError('登录状态已失效，请重新登录后再新增城市站点')
      setCheckingLogin(false)
      return
    }
    setUserId(user.userId)
    listMyVenueApplications(user.userId)
      .then(items => setApplications(items.filter(item => item.status === 1)))
      .catch(() => setApplications([]))
      .finally(() => setCheckingLogin(false))
  }, [])

  const handlePosterUpload = async (file: File) => {
    if (!userId) throw new Error('请先登录')
    setUploadingPoster(true)
    try {
      const asset = await uploadTicketAsset({ userId, bizType: 'station-poster', file })
      setPoster(asset.publicUrl)
      return asset.publicUrl
    } finally {
      setUploadingPoster(false)
    }
  }

  const handleSubmit = async () => {
    if (!userId) {
      setError('请先登录后再新增城市站点')
      return
    }
    if (!Number.isInteger(tourId) || tourId <= 0) {
      setError('巡演编号不正确')
      return
    }
    if (!city.trim()) {
      setError('请填写城市')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createStationDraft(tourId, {
        userId,
        city: city.trim(),
        stationName: stationName.trim() || null,
        poster: poster.trim() || null,
        announceOnly,
        venueApplicationId: selectedVenueApplicationId ? Number(selectedVenueApplicationId) : null,
      })
      router.push(`/console/tours/${tourId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (checkingLogin) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
  }

  if (!userId) {
    return (
      <div className="max-w-[720px] rounded-xl border border-[#e5e5e5] bg-white p-6">
        <h1 className="mb-2 text-[22px] font-bold text-[#1a1a2e]">请先登录</h1>
        <p className="mb-5 text-[14px] text-[#666]">{error || '登录后可为巡演新增城市站点。'}</p>
        <Link href="/login" className="inline-flex rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white">去登录</Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5">
        <Link href={`/console/tours/${tourId}`} className="mb-2 inline-flex text-[13px] text-[#666] hover:text-[#ff1268]">返回巡演详情</Link>
        <h1 className="text-[22px] font-bold text-[#1a1a2e]">新增城市站点</h1>
      </div>

      <div className="max-w-[720px] rounded-xl border border-[#e5e5e5] bg-white p-6">
        <div className="mb-6">
          <h2 className="mb-3 text-[16px] font-semibold text-[#1a1a2e]">站点基本信息</h2>
          <label className="mb-3 block">
            <span className="mb-1 block text-[13px] text-[#666]">城市 *</span>
            <input value={city} onChange={e => setCity(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="例：上海" />
          </label>
          <label className="mb-3 block">
            <span className="mb-1 block text-[13px] text-[#666]">城市站点名</span>
            <input value={stationName} onChange={e => setStationName(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="留空则默认使用城市 + 站，例如：上海站" />
          </label>
          <div className="mb-3">
            <LocalFileUpload
              label="城市站海报"
              value={poster}
              accept="image/jpeg,image/png,image/webp,image/gif"
              uploading={uploadingPoster}
              onUpload={handlePosterUpload}
              onChange={setPoster}
              hint="支持 JPG、PNG、WEBP、GIF；不上传时会使用巡演主海报。"
            />
          </div>
          <label className="mb-3 flex items-start gap-2 rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3 text-[14px] text-[#333]">
            <input type="checkbox" checked={announceOnly} onChange={e => setAnnounceOnly(e.target.checked)} className="mt-1" />
            <span>
              <span className="block font-medium">仅官宣城市</span>
              <span className="mt-1 block text-[13px] text-[#999]">未公布城市不会展示时间/场馆/票价/购买入口；新增草稿可暂不绑定场馆。</span>
            </span>
          </label>
          {!announceOnly && (
            <label className="block">
              <span className="mb-1 block text-[13px] text-[#666]">已通过场馆审核资料</span>
              <select value={selectedVenueApplicationId} onChange={e => setSelectedVenueApplicationId(e.target.value)} className="h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]">
                <option value="">请选择场馆审核资料</option>
                {applications.map(item => <option key={item.id} value={item.id}>{item.venueName}（{item.city}）</option>)}
              </select>
              {applications.length === 0 && <div className="mt-2 text-[13px] text-[#999]">暂无已通过场馆审核资料，请先上传场馆审核文件并通过平台核验。</div>}
            </label>
          )}
        </div>
        {error && <div className="mb-4 rounded-lg bg-[#fff0f3] px-3 py-2 text-[13px] text-[#ff1268]">{error}</div>}
        <button onClick={handleSubmit} disabled={submitting || uploadingPoster} className="rounded-lg bg-[#ff1268] px-5 py-2.5 text-[14px] font-medium text-white disabled:opacity-60">
          {submitting ? '保存中...' : uploadingPoster ? '海报上传中...' : '保存站点草稿'}
        </button>
      </div>
    </div>
  )
}
