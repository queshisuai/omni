'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { createStationDraft, listMyVenueApplications } from '@/lib/api'
import type { VenueApplicationVO } from '@/types/api'

export default function NewStationPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const tourId = Number(params.id)
  const [userId, setUserId] = useState(0)
  const [city, setCity] = useState('')
  const [stationName, setStationName] = useState('')
  const [perUserLimit, setPerUserLimit] = useState('')
  const [announceOnly, setAnnounceOnly] = useState(true)
  const [applications, setApplications] = useState<VenueApplicationVO[]>([])
  const [selectedVenueApplicationId, setSelectedVenueApplicationId] = useState('')
  const [checkingLogin, setCheckingLogin] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = getUser()
    if (!user) {
      setCheckingLogin(false)
      return
    }
    setUserId(user.userId)
    listMyVenueApplications(user.userId)
      .then(items => setApplications(items.filter(item => item.status === 1)))
      .catch(() => setApplications([]))
      .finally(() => setCheckingLogin(false))
  }, [])

  const handleSubmit = async () => {
    if (!userId) {
      setError('请先登录后再新增城市站点')
      return
    }
    if (!Number.isInteger(tourId) || tourId <= 0) {
      setError('巡演ID不正确')
      return
    }
    if (!city.trim()) {
      setError('请填写城市')
      return
    }
    if (!stationName.trim()) {
      setError('请填写城市站点名')
      return
    }
    if (!announceOnly && !selectedVenueApplicationId) {
      setError('请选择已通过的场地申请')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createStationDraft(tourId, {
        userId,
        city: city.trim(),
        stationName: stationName.trim(),
        perUserLimit: perUserLimit.trim() ? Number(perUserLimit) : null,
        announceOnly,
        venueApplicationId: announceOnly ? null : Number(selectedVenueApplicationId),
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
        <p className="mb-5 text-[14px] text-[#666]">登录后可为巡演新增城市站点。</p>
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
            <span className="mb-1 block text-[13px] text-[#666]">城市站点名 *</span>
            <input value={stationName} onChange={e => setStationName(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="例：上海站" />
          </label>
          <label className="mb-3 block">
            <span className="mb-1 block text-[13px] text-[#666]">个人限购</span>
            <input type="number" min={1} value={perUserLimit} onChange={e => setPerUserLimit(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="留空表示不限购，例如 2" />
            <span className="mt-1 block text-[12px] text-[#999]">巡演城市站按每个城市站单独限购，不按整轮巡演累计。</span>
          </label>
          <label className="mb-3 flex items-start gap-2 rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3 text-[14px] text-[#333]">
            <input type="checkbox" checked={announceOnly} onChange={e => setAnnounceOnly(e.target.checked)} className="mt-1" />
            <span>
              <span className="block font-medium">仅官宣城市</span>
              <span className="mt-1 block text-[13px] text-[#999]">未公布城市不会展示时间/场馆/票价/购买入口。</span>
            </span>
          </label>
          {!announceOnly && (
            <label className="block">
              <span className="mb-1 block text-[13px] text-[#666]">已通过场地申请 *</span>
              <select value={selectedVenueApplicationId} onChange={e => setSelectedVenueApplicationId(e.target.value)} className="h-10 w-full rounded-lg border border-[#e5e5e5] px-3 text-[14px] outline-none focus:border-[#ff1268]">
                <option value="">请选择场地申请</option>
                {applications.map(item => <option key={item.id} value={item.id}>{item.venueName}（{item.city}）</option>)}
              </select>
              {applications.length === 0 && <div className="mt-2 text-[13px] text-[#999]">暂无已通过场地申请，请先提交并通过场地凭证审核。</div>}
            </label>
          )}
        </div>
        {error && <div className="mb-4 rounded-lg bg-[#fff0f3] px-3 py-2 text-[13px] text-[#ff1268]">{error}</div>}
        <button onClick={handleSubmit} disabled={submitting} className="rounded-lg bg-[#ff1268] px-5 py-2.5 text-[14px] font-medium text-white disabled:opacity-60">
          {submitting ? '保存中...' : '保存站点草稿'}
        </button>
      </div>
    </div>
  )
}
