'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { createStationDraft, createTourDraft, listMyVenueApplications, publishStation, submitVenueApplication } from '@/lib/api'
import { SeatLayoutDesigner } from '@/components/seatcraft/SeatLayoutDesigner'
import { toSeatCraftLayoutPayload } from '@/components/seatcraft/block-layout'
import type { SeatCraftLayoutDraft } from '@/components/seatcraft/types'
import type { VenueApplicationVO } from '@/types/api'

const steps = ['Tour 基本信息', 'Station 城市站点', '场地申请', 'SeatCraft', '票档价格', '场次排期', '发布确认']

function createDefaultLayout(title: string): SeatCraftLayoutDraft {
  return {
    name: `${title || '演出'} 座位图`,
    templateType: 'concert',
    stage: { title: '舞台', x: 0, y: 0 },
    canvasWidth: 800,
    canvasHeight: 600,
    sections: [],
    blocks: [],
    overrides: [],
    ticketGroups: [],
  }
}

export default function NewTourPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [poster, setPoster] = useState('')
  const [description, setDescription] = useState('')
  const [city, setCity] = useState('')
  const [stationName, setStationName] = useState('')
  const [address, setAddress] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [proofNote, setProofNote] = useState('')
  const [proofFileUrl, setProofFileUrl] = useState('')
  const [venueApplications, setVenueApplications] = useState<VenueApplicationVO[]>([])
  const [selectedVenueApplicationId, setSelectedVenueApplicationId] = useState<number | null>(null)
  const [sessionStartTime, setSessionStartTime] = useState('')
  const [sessionEndTime, setSessionEndTime] = useState('')
  const [layoutDraft, setLayoutDraft] = useState<SeatCraftLayoutDraft>(() => createDefaultLayout('演出'))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const approvedApplications = venueApplications.filter(item => item.status === 1 && item.venueId)
  const selectedApprovedApplication = approvedApplications.find(item => item.id === selectedVenueApplicationId) || null

  useEffect(() => {
    const user = getUser()
    if (!user) return
    listMyVenueApplications(user.userId).then(setVenueApplications).catch(() => {})
  }, [])

  const handleSubmit = async () => {
    const user = getUser()
    if (!user) return
    const usingApprovedApplication = Boolean(selectedApprovedApplication)
    if (!title.trim() || !city.trim() || !stationName.trim()) {
      setError('请填写演出名称、城市和站点名称')
      return
    }
    if (!usingApprovedApplication) {
      if (!address.trim() || !contactName.trim() || !contactPhone.trim() || !validFrom || !validTo || (!proofNote.trim() && !proofFileUrl.trim())) {
        setError('请填写场地使用申请必填信息，或选择一个已审核通过的场地申请')
        return
      }
      if ((layoutDraft.blocks?.length ?? 0) === 0 && layoutDraft.sections.length === 0) {
        setError('请至少绘制一个 SeatCraft 座位块或座位区域')
        return
      }
      if ((layoutDraft.blocks?.length ?? 0) > 0 && (layoutDraft.ticketGroups?.length ?? 0) === 0) {
        setError('请至少配置一个票档组')
        return
      }
      if ((layoutDraft.ticketGroups ?? []).some(group => (group.activityPrice ?? group.defaultPrice ?? 0) <= 0)) {
        setError('请为每个票档组填写大于 0 的价格')
        return
      }
    }
    if (usingApprovedApplication && (!sessionStartTime || !sessionEndTime)) {
      setError('选择已通过场地申请后，请填写场次排期')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const tour = await createTourDraft({ userId: user.userId, title: title.trim(), poster: poster.trim() || null, description: description.trim() || null })
      const venueApplication = selectedApprovedApplication ?? await submitVenueApplication({
          userId: user.userId,
          venueName: stationName.trim(),
          city: city.trim(),
          address: address.trim(),
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          validFrom,
          validTo,
          proofNote: proofNote.trim() || null,
          proofFileUrl: proofFileUrl.trim() || null,
          layout: toSeatCraftLayoutPayload({ ...layoutDraft, id: 0, name: `${title.trim()} 座位图` }),
        })
      const station = await createStationDraft(tour.id, { userId: user.userId, city: city.trim(), stationName: stationName.trim(), venueApplicationId: venueApplication.id })
      if (selectedApprovedApplication?.venueId && sessionStartTime && sessionEndTime) {
        await publishStation(station.id, {
          userId: user.userId,
          startTime: sessionStartTime,
          endTime: sessionEndTime,
        })
      }
      router.push('/console/tours')
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="mb-5 text-[22px] font-bold text-[#1a1a2e]">创建演出</h1>
      <div className="mb-6 flex flex-wrap gap-2">
        {steps.map((step, index) => (
          <span key={step} className={`rounded-full px-3 py-1 text-[12px] ${index < 7 ? 'bg-[#fff0f5] text-[#ff1268]' : 'bg-[#f5f5f5] text-[#999]'}`}>
            {index + 1}. {step}
          </span>
        ))}
      </div>
      <div className="max-w-[720px] rounded-xl border border-[#e5e5e5] bg-white p-6">
        <div className="mb-6">
          <h2 className="mb-3 text-[16px] font-semibold text-[#1a1a2e]">Tour 基本信息</h2>
          <label className="mb-3 block">
            <span className="mb-1 block text-[13px] text-[#666]">演出项目名称 *</span>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="例：2026 万象巡回演唱会" />
          </label>
          <label className="mb-3 block">
            <span className="mb-1 block text-[13px] text-[#666]">海报 URL</span>
            <input value={poster} onChange={e => setPoster(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="https://..." />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] text-[#666]">简介</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" />
          </label>
        </div>
        <div className="mb-6 border-t border-[#f0f0f0] pt-6">
          <h2 className="mb-3 text-[16px] font-semibold text-[#1a1a2e]">Station 城市站点</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[13px] text-[#666]">城市 *</span>
              <input value={city} onChange={e => setCity(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="北京" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] text-[#666]">站点名称 *</span>
              <input value={stationName} onChange={e => setStationName(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="北京站" />
            </label>
          </div>
        </div>
        <div className="mb-6 border-t border-[#f0f0f0] pt-6">
          <h2 className="mb-3 text-[16px] font-semibold text-[#1a1a2e]">场地申请和证明</h2>
          <label className="mb-4 block">
            <span className="mb-1 block text-[13px] text-[#666]">使用已有已通过场地申请</span>
            <select value={selectedVenueApplicationId ?? ''} onChange={e => setSelectedVenueApplicationId(e.target.value ? Number(e.target.value) : null)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]">
              <option value="">不选择，提交新的场地申请</option>
              {approvedApplications.map(item => <option key={item.id} value={item.id}>{item.venueName} · {item.city}</option>)}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[13px] text-[#666]">场地地址 *</span>
              <input value={address} onChange={e => setAddress(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="详细地址" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] text-[#666]">联系人 *</span>
              <input value={contactName} onChange={e => setContactName(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] text-[#666]">联系电话 *</span>
              <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] text-[#666]">使用开始时间 *</span>
              <input type="datetime-local" value={validFrom} onChange={e => setValidFrom(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] text-[#666]">使用结束时间 *</span>
              <input type="datetime-local" value={validTo} onChange={e => setValidTo(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[13px] text-[#666]">场地使用证明说明 *</span>
              <textarea value={proofNote} onChange={e => setProofNote(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="说明合同、授权书、租赁证明等材料" />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[13px] text-[#666]">证明附件链接</span>
              <input value={proofFileUrl} onChange={e => setProofFileUrl(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" placeholder="https://..." />
            </label>
          </div>
        </div>
        <div className="mb-6 border-t border-[#f0f0f0] pt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-[#1a1a2e]">SeatCraft 座位图</h2>
              <p className="mt-1 text-[12px] text-[#999]">先配置自由座位块和票档组，审核通过后可复用到活动与场次。</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-[#e5e5e5]">
            <SeatLayoutDesigner layout={layoutDraft} onChange={setLayoutDraft} />
          </div>
        </div>
        <div className="mb-6 border-t border-[#f0f0f0] pt-6">
          <h2 className="mb-3 text-[16px] font-semibold text-[#1a1a2e]">场次排期</h2>
          {selectedApprovedApplication ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[13px] text-[#666]">开始时间 *</span>
                <input type="datetime-local" value={sessionStartTime} onChange={e => setSessionStartTime(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] text-[#666]">结束时间 *</span>
                <input type="datetime-local" value={sessionEndTime} onChange={e => setSessionEndTime(e.target.value)} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268]" />
              </label>
              <div className="rounded-lg bg-[#f7f7f7] px-3 py-2 text-[13px] text-[#666] sm:col-span-2">将通过后端发布服务创建活动、场次、复制 SeatCraft，并生成票档与库存。</div>
            </div>
          ) : (
            <div className="rounded-lg bg-[#fff7ed] px-3 py-2 text-[13px] text-[#9a5b00]">新场地申请需先审核通过，暂不创建场次。审核通过后可回到场次管理继续排期。</div>
          )}
        </div>
        <div className="mb-6 border-t border-[#f0f0f0] pt-6">
          <h2 className="mb-3 text-[16px] font-semibold text-[#1a1a2e]">发布确认</h2>
          <div className="rounded-lg bg-[#f7f7f7] px-3 py-2 text-[13px] text-[#666]">当前保存为草稿。场地审核、SeatCraft、票档库存和场次排期完成后再发布。</div>
        </div>
        {error && <div className="mb-4 rounded-lg bg-[#fff0f3] px-3 py-2 text-[13px] text-[#ff1268]">{error}</div>}
        <button onClick={handleSubmit} disabled={submitting} className="rounded-lg bg-[#ff1268] px-5 py-2.5 text-[14px] font-medium text-white disabled:opacity-60">
          {submitting ? '创建中...' : '保存草稿'}
        </button>
      </div>
    </div>
  )
}
