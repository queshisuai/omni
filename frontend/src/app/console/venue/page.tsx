'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { createAdminVenue, listAdminVenues, getVenueDefaultLayout, updateAdminVenue, updateVenueDefaultLayout } from '@/lib/api'
import { SeatLayoutDesigner } from '@/components/seatcraft/SeatLayoutDesigner'
import { toSeatCraftLayoutPayload } from '@/components/seatcraft/block-layout'
import { toSeatCraftLayoutDraft, type SeatCraftLayoutDraft } from '@/components/seatcraft/types'
import { ClipboardList, Plus } from 'lucide-react'
import type { VenueEntity } from '@/types/api'

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

export default function VenuePage() {
  const [venues, setVenues] = useState<VenueEntity[]>([])
  const [role, setRole] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [capacity, setCapacity] = useState('')
  const [layoutDraft, setLayoutDraft] = useState<SeatCraftLayoutDraft | null>(null)

  // null = create mode, non-null = editing existing venue
  const [editingVenue, setEditingVenue] = useState<VenueEntity | null>(null)

  const loadData = () => {
    const u = getUser()
    if (!u) return
    setRole(u.role || '')
    listAdminVenues(u.userId).then(setVenues).catch(() => {})
  }

  useEffect(() => { loadData() }, [])

  const resetForm = () => {
    setName(''); setCity(''); setAddress(''); setCapacity('')
    setLayoutDraft(null)
    setStep(1)
    setEditingVenue(null)
    setShowForm(false)
  }

  const openEdit = (venue: VenueEntity) => {
    setEditingVenue(venue)
    setName(venue.name)
    setCity(venue.city ?? '')
    setAddress(venue.address ?? '')
    setCapacity(venue.capacity != null ? String(venue.capacity) : '')
    setStep(2)
    setLayoutDraft(null)
    setShowForm(true)

    getVenueDefaultLayout(venue.id)
      .then(layout => {
        setLayoutDraft(layout ? toSeatCraftLayoutDraft(layout) : createDefaultLayout(venue.name))
      })
      .catch(() => {
        setLayoutDraft(createDefaultLayout(venue.name))
      })
  }

  const openCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const handleNext = () => {
    if (!name.trim()) return
    if (!layoutDraft) {
      setLayoutDraft(createDefaultLayout(name.trim()))
    }
    setStep(2)
  }

  const handleSave = async () => {
    const u = getUser()
    if (!u || !name.trim() || !layoutDraft) return

    const layoutPayload = toSeatCraftLayoutPayload({ ...layoutDraft, id: 0 })

    if (editingVenue) {
      await updateAdminVenue(editingVenue.id, {
        userId: u.userId,
        name: name.trim(),
        city,
        address,
        capacity: capacity ? Number(capacity) : null,
      })
      await updateVenueDefaultLayout(editingVenue.id, { userId: u.userId, layout: layoutPayload })
    } else {
      await createAdminVenue({
        userId: u.userId,
        name: name.trim(),
        city,
        address,
        capacity: capacity ? Number(capacity) : null,
        layout: layoutPayload,
      })
    }

    resetForm()
    loadData()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[22px] font-bold text-[#1a1a2e]">场馆管理</h1>
        <div className="flex items-center gap-2">
          {role === 'organizer' && (
            <Link href="/console/venue/apply" className="flex items-center gap-1.5 bg-[#ff1268] text-white px-4 py-2 rounded-lg text-[14px] font-medium hover:bg-[#e0105a] transition-colors">
              <ClipboardList className="w-4 h-4" /> 申请场馆
            </Link>
          )}
          {role === 'admin' && (
            <button onClick={openCreate} className="flex items-center gap-1.5 bg-[#ff1268] text-white px-4 py-2 rounded-lg text-[14px] font-medium hover:bg-[#e0105a] transition-colors border-none cursor-pointer">
              <Plus className="w-4 h-4" /> 新建场馆
            </button>
          )}
        </div>
      </div>

      {role === 'organizer' && (
        <div className="text-[13px] text-[#666] bg-[#fff8e1] border border-[#ffe082] rounded-lg p-3 mb-4">
          主办方可查看平台公共场馆库；如需新增场馆，请提交完整资料申请，审核通过后进入公共场馆库。
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-[#e5e5e5] p-5 mb-5 max-w-[900px]">
          {step === 1 && (
            <div className="grid gap-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-block w-6 h-6 rounded-full bg-[#ff1268] text-white text-[12px] font-bold text-center leading-6">1</span>
                <span className="text-[14px] font-medium text-[#333]">基本信息</span>
                <span className="text-[12px] text-[#ccc] mx-2">→</span>
                <span className="text-[14px] text-[#bbb]">座位图设计</span>
              </div>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268]" placeholder="场馆名称 *" />
              <input value={city} onChange={e => setCity(e.target.value)} className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268]" placeholder="城市" />
              <input value={address} onChange={e => setAddress(e.target.value)} className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268]" placeholder="地址" />
              <input value={capacity} onChange={e => setCapacity(e.target.value)} type="number" className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268]" placeholder="容量" />
              <div className="flex gap-2">
                <button onClick={handleNext} disabled={!name.trim()} className="bg-[#ff1268] text-white px-4 py-2 rounded-lg text-[14px] border-none cursor-pointer hover:bg-[#e0105a] disabled:opacity-50 disabled:cursor-not-allowed">下一步</button>
                <button onClick={resetForm} className="text-[14px] text-[#666] bg-transparent border-none cursor-pointer hover:text-[#333]">取消</button>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[14px] text-[#bbb]">基本信息</span>
                <span className="text-[12px] text-[#ccc] mx-2">→</span>
                <span className="inline-block w-6 h-6 rounded-full bg-[#ff1268] text-white text-[12px] font-bold text-center leading-6">2</span>
                <span className="text-[14px] font-medium text-[#333]">座位图设计</span>
              </div>
              <div className="border border-[#e5e5e5] rounded-lg overflow-hidden">
                {layoutDraft && (
                  <SeatLayoutDesigner layout={layoutDraft} onChange={setLayoutDraft} />
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="text-[14px] text-[#666] bg-transparent border border-[#ddd] px-4 py-2 rounded-lg cursor-pointer hover:text-[#333]">上一步</button>
                <button
                  onClick={handleSave}
                  disabled={!layoutDraft || (layoutDraft.sections.length === 0 && (layoutDraft.blocks?.length ?? 0) === 0)}
                  className="bg-[#ff1268] text-white px-4 py-2 rounded-lg text-[14px] border-none cursor-pointer hover:bg-[#e0105a] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  保存
                </button>
                <button onClick={resetForm} className="text-[14px] text-[#666] bg-transparent border-none cursor-pointer hover:text-[#333]">取消</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#e5e5e5] overflow-hidden">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-[#e5e5e5] bg-[#fafafa]">
              <th className="text-left p-3 font-medium text-[#666]">ID</th>
              <th className="text-left p-3 font-medium text-[#666]">名称</th>
              <th className="text-left p-3 font-medium text-[#666]">城市</th>
              <th className="text-left p-3 font-medium text-[#666]">地址</th>
              <th className="text-left p-3 font-medium text-[#666]">容量</th>
              {role === 'admin' && <th className="text-center p-3 font-medium text-[#666]">座位模板</th>}
            </tr>
          </thead>
          <tbody>
            {venues.map(v => (
              <tr key={v.id} className="border-b border-[#f0f0f0] hover:bg-[#fafafa]">
                <td className="p-3 text-[#999]">{v.id}</td>
                <td className="p-3 font-medium text-[#333]">{v.name}</td>
                <td className="p-3 text-[#666]">{v.city || '-'}</td>
                <td className="p-3 text-[#666]">{v.address || '-'}</td>
                <td className="p-3 text-[#666]">{v.capacity ?? '-'}</td>
                {role === 'admin' && (
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEdit(v)} className="rounded-lg border border-[#ddd] px-3 py-1.5 text-[13px] text-[#666] hover:bg-[#fafafa] cursor-pointer">编辑</button>
                      <Link href={`/console/venue/${v.id}/seats`} className="inline-block rounded-lg border border-[#ff1268] px-3 py-1.5 text-[13px] text-[#ff1268] hover:bg-[#fff0f3]">配置 SeatCraft</Link>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
