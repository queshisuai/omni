'use client'

import { useEffect, useState } from 'react'
import { getUser } from '@/lib/auth'
import { listAdminVenues, createAdminVenue } from '@/lib/api'
import { Plus } from 'lucide-react'
import type { VenueEntity } from '@/types/api'

export default function VenuePage() {
  const [venues, setVenues] = useState<VenueEntity[]>([])
  const [role, setRole] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [capacity, setCapacity] = useState('')

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

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[22px] font-bold text-[#1a1a2e]">场馆管理</h1>
        {role === 'admin' && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 bg-[#ff1268] text-white px-4 py-2 rounded-lg text-[14px] font-medium hover:bg-[#e0105a] transition-colors border-none cursor-pointer">
            <Plus className="w-4 h-4" /> 新建场馆
          </button>
        )}
      </div>

      {role === 'organizer' && (
        <div className="text-[13px] text-[#666] bg-[#fff8e1] border border-[#ffe082] rounded-lg p-3 mb-4">
          主办方仅可查看场馆列表，新建/修改场馆请联系平台管理员
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
