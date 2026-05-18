'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { createAdminVenue, createVenueArea, listAdminVenues, listVenueAreas } from '@/lib/api'
import { ClipboardList, Plus } from 'lucide-react'
import type { VenueAreaVO, VenueEntity } from '@/types/api'

export default function VenuePage() {
  const [venues, setVenues] = useState<VenueEntity[]>([])
  const [role, setRole] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [capacity, setCapacity] = useState('')
  const [selectedVenueId, setSelectedVenueId] = useState<number | null>(null)
  const [areas, setAreas] = useState<VenueAreaVO[]>([])
  const [areaMessage, setAreaMessage] = useState('')
  const [areaForm, setAreaForm] = useState({
    name: '',
    rowCount: '2',
    seatsPerRow: '10',
    rowStart: '1',
    seatStart: '1',
    color: '#ff1268',
    sort: '0',
  })

  const loadData = () => {
    const u = getUser()
    if (!u) return
    setRole(u.role || '')
    listAdminVenues(u.userId).then(setVenues).catch(() => {})
  }

  useEffect(() => { loadData() }, [])

  const handleCreate = async () => {
    const u = getUser()
    if (!u || !name.trim()) return
    await createAdminVenue({ userId: u.userId, name: name.trim(), city, address, capacity: capacity ? Number(capacity) : null })
    setName(''); setCity(''); setAddress(''); setCapacity('')
    setShowForm(false)
    loadData()
  }

  const openSeatTemplate = async (venueId: number) => {
    const u = getUser()
    if (!u) return
    setSelectedVenueId(venueId)
    setAreaMessage('')
    listVenueAreas(venueId, u.userId).then(setAreas).catch(() => setAreas([]))
  }

  const handleCreateArea = async () => {
    const u = getUser()
    if (!u || !selectedVenueId) return
    if (!areaForm.name.trim()) {
      setAreaMessage('请填写区域名称')
      return
    }
    try {
      const response = await createVenueArea(selectedVenueId, {
        userId: u.userId,
        name: areaForm.name.trim(),
        rowCount: Number(areaForm.rowCount),
        seatsPerRow: Number(areaForm.seatsPerRow),
        rowStart: Number(areaForm.rowStart),
        seatStart: Number(areaForm.seatStart),
        color: areaForm.color,
        sort: Number(areaForm.sort),
      })
      setAreaMessage(`已生成 ${response.generatedSeatCount} 个座位`)
      setAreaForm({ name: '', rowCount: '2', seatsPerRow: '10', rowStart: '1', seatStart: '1', color: '#ff1268', sort: '0' })
      openSeatTemplate(selectedVenueId)
    } catch (err) {
      setAreaMessage(err instanceof Error ? err.message : '创建区域失败')
    }
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
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 bg-[#ff1268] text-white px-4 py-2 rounded-lg text-[14px] font-medium hover:bg-[#e0105a] transition-colors border-none cursor-pointer">
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
        <div className="bg-white rounded-xl border border-[#e5e5e5] p-5 mb-5 max-w-[500px]">
          <div className="grid gap-3">
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268]" placeholder="场馆名称 *" />
            <input value={city} onChange={e => setCity(e.target.value)} className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268]" placeholder="城市" />
            <input value={address} onChange={e => setAddress(e.target.value)} className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268]" placeholder="地址" />
            <input value={capacity} onChange={e => setCapacity(e.target.value)} type="number" className="w-full px-3 py-2 border border-[#ddd] rounded-lg text-[14px] outline-none focus:border-[#ff1268]" placeholder="容量" />
            <div className="flex gap-2">
              <button onClick={handleCreate} className="bg-[#ff1268] text-white px-4 py-2 rounded-lg text-[14px] border-none cursor-pointer hover:bg-[#e0105a]">保存</button>
              <button onClick={() => setShowForm(false)} className="text-[14px] text-[#666] bg-transparent border-none cursor-pointer hover:text-[#333]">取消</button>
            </div>
          </div>
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
                    <button onClick={() => openSeatTemplate(v.id)} className="rounded-lg border border-[#ff1268] px-3 py-1.5 text-[13px] text-[#ff1268] hover:bg-[#fff0f3]">配置区域</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {role === 'admin' && selectedVenueId && (
        <div className="mt-5 rounded-xl border border-[#e5e5e5] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[16px] font-bold text-[#1a1a2e]">座位区域模板</h2>
            <button onClick={() => setSelectedVenueId(null)} className="text-[13px] text-[#999]">关闭</button>
          </div>
          <div className="mb-4 grid gap-3 lg:grid-cols-7">
            <input value={areaForm.name} onChange={e => setAreaForm({ ...areaForm, name: e.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="区域名称" />
            <input type="number" value={areaForm.rowCount} onChange={e => setAreaForm({ ...areaForm, rowCount: e.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="排数" />
            <input type="number" value={areaForm.seatsPerRow} onChange={e => setAreaForm({ ...areaForm, seatsPerRow: e.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="每排座位数" />
            <input type="number" value={areaForm.rowStart} onChange={e => setAreaForm({ ...areaForm, rowStart: e.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="起始排号" />
            <input type="number" value={areaForm.seatStart} onChange={e => setAreaForm({ ...areaForm, seatStart: e.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="起始座号" />
            <input value={areaForm.color} onChange={e => setAreaForm({ ...areaForm, color: e.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="颜色" />
            <input type="number" value={areaForm.sort} onChange={e => setAreaForm({ ...areaForm, sort: e.target.value })} className="h-10 rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]" placeholder="排序" />
          </div>
          <button onClick={handleCreateArea} className="rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white">生成区域座位</button>
          {areaMessage && <span className="ml-3 text-[13px] text-[#666]">{areaMessage}</span>}
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {areas.map(area => (
              <div key={area.id} className="rounded-lg border border-[#f0f0f0] p-3 text-[13px] text-[#666]">
                <div className="mb-1 flex items-center gap-2 font-medium text-[#333]"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: area.color || '#ff1268' }} />{area.name}</div>
                <div>{area.rowCount} 排 × 每排 {area.seatsPerRow} 座</div>
                <div>起始：{area.rowStart} 排 {area.seatStart} 座，排序 {area.sort}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
