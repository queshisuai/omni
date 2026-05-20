'use client'

import { useEffect, useState } from 'react'
import { getUser } from '@/lib/auth'
import { listMyVenueApplications, submitVenueApplication } from '@/lib/api'
import { SeatLayoutDesigner } from '@/components/seatcraft/SeatLayoutDesigner'
import { toSeatCraftLayoutDraft, type SeatCraftLayoutDraft } from '@/components/seatcraft/types'
import type { VenueApplicationVO } from '@/types/api'

const statusText: Record<number, string> = { 0: '待审核', 1: '已通过', 2: '已驳回' }

function createDefaultLayout(name: string): SeatCraftLayoutDraft {
  return {
    name: `${name} 座位图`,
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

export default function VenueApplyPage() {
  const [userId, setUserId] = useState(0)
  const [applications, setApplications] = useState<VenueApplicationVO[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    venueName: '',
    city: '',
    address: '',
    capacity: '',
    contactName: '',
    contactPhone: '',
    qualificationNo: '',
    businessScope: '',
    description: '',
    validFrom: '',
    validTo: '',
    proofNote: '',
    proofFileUrl: '',
  })
  const [layoutDraft, setLayoutDraft] = useState<SeatCraftLayoutDraft | null>(null)

  const loadApplications = (nextUserId = userId) => {
    if (!nextUserId) return
    listMyVenueApplications(nextUserId).then(setApplications).catch(() => {})
  }

  useEffect(() => {
    const u = getUser()
    if (!u) return
    setUserId(u.userId)
    loadApplications(u.userId)
  }, [])

  useEffect(() => {
    if (form.venueName.trim() && !layoutDraft) {
      setLayoutDraft(createDefaultLayout(form.venueName))
    }
  }, [form.venueName])

  const validate = () => {
    if (!form.venueName.trim()) return '请填写场馆名称'
    if (!form.city.trim()) return '请填写城市'
    if (!form.address.trim()) return '请填写地址'
    if (!form.contactName.trim()) return '请填写联系人姓名'
    if (!form.contactPhone.trim()) return '请填写联系电话'
    if (!form.validFrom) return '请选择场地使用开始时间'
    if (!form.validTo) return '请选择场地使用结束时间'
    if (form.validTo <= form.validFrom) return '场地使用结束时间必须晚于开始时间'
    if (!form.proofNote.trim() && !form.proofFileUrl.trim()) return '请填写场地使用证明说明或附件链接'
    if (!layoutDraft || ((layoutDraft.blocks?.length ?? 0) === 0 && layoutDraft.sections.length === 0)) return '请绘制至少一个座位区域'
    if ((layoutDraft.blocks?.length ?? 0) > 0 && (layoutDraft.ticketGroups?.length ?? 0) === 0) return '请至少配置一个票档组'
    return ''
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const error = validate()
    if (error) {
      setMessage(error)
      return
    }
    setSubmitting(true)
    setMessage('')
    try {
      const layoutPayload = layoutDraft ? {
        id: 0,
        name: layoutDraft.name,
        templateType: layoutDraft.templateType,
        stageTitle: layoutDraft.stage.title,
        stageX: layoutDraft.stage.x,
        stageY: layoutDraft.stage.y,
        canvasWidth: layoutDraft.canvasWidth,
        canvasHeight: layoutDraft.canvasHeight,
        sections: layoutDraft.sections.map(s => ({
          id: Number(s.id),
          sectionKey: s.sectionKey,
          name: s.name,
          rows: s.rows,
          cols: s.cols,
          x: s.x,
          y: s.y,
          color: s.color,
          type: s.type,
          layout: s.layout,
          radius: s.radius ?? null,
          arcSpan: s.arcSpan ?? null,
          rotation: s.rotation ?? null,
          primeRowStart: s.primeRowStart ?? null,
          primeRowEnd: s.primeRowEnd ?? null,
          primeColStart: s.primeColStart ?? null,
          primeColEnd: s.primeColEnd ?? null,
          ticketTypeId: s.ticketTypeId ?? null,
        })),
        blocks: layoutDraft.blocks ?? [],
        overrides: layoutDraft.overrides ?? [],
        ticketGroups: layoutDraft.ticketGroups ?? [],
      } : undefined

      await submitVenueApplication({
        userId,
        ...form,
        capacity: form.capacity ? Number(form.capacity) : null,
        layout: layoutPayload,
      })
      setMessage('场馆申请已提交，等待平台审核')
      setForm({ venueName: '', city: '', address: '', capacity: '', contactName: '', contactPhone: '', qualificationNo: '', businessScope: '', description: '', validFrom: '', validTo: '', proofNote: '', proofFileUrl: '' })
      setLayoutDraft(null)
      loadApplications(userId)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-[22px] font-bold text-[#1a1a2e]">场馆申请</h1>
      <p className="mb-5 text-[13px] text-[#999]">提交完整场馆资料，审核通过后进入平台公共场馆库。</p>

      <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-[#e5e5e5] bg-white p-5">
        <div className="grid gap-3 lg:grid-cols-2">
          <input value={form.venueName} onChange={e => setForm({ ...form, venueName: e.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="场馆名称 *" />
          <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="城市 *" />
          <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268] lg:col-span-2" placeholder="地址 *" />
          <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="容量" />
          <input value={form.qualificationNo} onChange={e => setForm({ ...form, qualificationNo: e.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="资质编号" />
          <input value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="联系人姓名 *" />
          <input value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="联系电话 *" />
          <label className="text-[12px] text-[#666]">
            使用开始时间 *
            <input type="datetime-local" value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" />
          </label>
          <label className="text-[12px] text-[#666]">
            使用结束时间 *
            <input type="datetime-local" value={form.validTo} onChange={e => setForm({ ...form, validTo: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" />
          </label>
          <textarea value={form.businessScope} onChange={e => setForm({ ...form, businessScope: e.target.value })} rows={3} className="rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268] lg:col-span-2" placeholder="经营范围" />
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268] lg:col-span-2" placeholder="申请说明/备注" />
          <textarea value={form.proofNote} onChange={e => setForm({ ...form, proofNote: e.target.value })} rows={3} className="rounded-lg border border-[#ddd] px-3 py-2 text-[14px] outline-none focus:border-[#ff1268] lg:col-span-2" placeholder="场地使用证明说明 *（与附件链接至少填写一项）" />
          <input value={form.proofFileUrl} onChange={e => setForm({ ...form, proofFileUrl: e.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268] lg:col-span-2" placeholder="场地使用证明附件链接" />
        </div>

        <div className="mt-5">
          <h3 className="mb-2 text-[15px] font-semibold text-[#1a1a2e]">座位图设计</h3>
          <div className="rounded-lg border border-[#e5e5e5] overflow-hidden">
            {layoutDraft && (
              <SeatLayoutDesigner layout={layoutDraft} onChange={setLayoutDraft} />
            )}
          </div>
        </div>

        {message && <div className="mt-3 text-[13px] text-[#666]">{message}</div>}
        <button
          disabled={submitting || !layoutDraft || ((layoutDraft.blocks?.length ?? 0) === 0 && layoutDraft.sections.length === 0)}
          className="mt-4 rounded-lg bg-[#ff1268] px-5 py-2 text-[14px] font-medium text-white disabled:opacity-50"
        >
          {submitting ? '提交中...' : '提交申请'}
        </button>
      </form>

      <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
        <h2 className="mb-3 text-[16px] font-bold text-[#1a1a2e]">我的申请</h2>
        {applications.length === 0 ? <div className="text-[14px] text-[#999]">暂无申请记录</div> : (
          <div className="space-y-3">
            {applications.map(item => (
              <div key={item.id} className="rounded-lg border border-[#f0f0f0] p-3 text-[14px]">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-[#333]">{item.venueName}</div>
                  <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[12px] text-[#666]">{statusText[item.status]}</span>
                </div>
                <div className="mt-1 text-[#666]">{item.city} · {item.address}</div>
                {item.reviewNote && <div className="mt-1 text-[13px] text-[#999]">审核备注：{item.reviewNote}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
