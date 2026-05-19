'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createVenueArea, createVenueSeat, deleteVenueSeat, listVenueAreas, listVenueSeats, updateVenueSeat } from '@/lib/api'
import { getUser } from '@/lib/auth'
import type { SeatTemplateSyncResponseVO, VenueAreaVO, VenueSeatVO } from '@/types/api'

type AreaForm = {
  name: string
  rowCount: string
  seatsPerRow: string
  rowStart: string
  seatStart: string
  color: string
  sort: string
}

type SeatForm = {
  areaId: string
  rowNo: string
  seatNo: string
  seatLabel: string
  x: string
  y: string
  status: string
}

const emptyAreaForm: AreaForm = {
  name: '',
  rowCount: '2',
  seatsPerRow: '10',
  rowStart: '1',
  seatStart: '1',
  color: '#ff1268',
  sort: '0',
}

const emptySeatForm: SeatForm = {
  areaId: '',
  rowNo: '1',
  seatNo: '1',
  seatLabel: '',
  x: '0',
  y: '0',
  status: '1',
}

export default function VenueSeatTemplatePage() {
  const params = useParams<{ id: string }>()
  const venueId = Number(params.id)
  const [userId, setUserId] = useState(0)
  const [areas, setAreas] = useState<VenueAreaVO[]>([])
  const [seats, setSeats] = useState<VenueSeatVO[]>([])
  const [selectedSeatId, setSelectedSeatId] = useState<number | null>(null)
  const [areaForm, setAreaForm] = useState<AreaForm>(emptyAreaForm)
  const [seatForm, setSeatForm] = useState<SeatForm>(emptySeatForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const areaById = useMemo(() => new Map(areas.map(area => [area.id, area])), [areas])
  const seatsByArea = useMemo(() => {
    const grouped = new Map<number, VenueSeatVO[]>()
    for (const seat of seats) {
      const list = grouped.get(seat.areaId) || []
      list.push(seat)
      grouped.set(seat.areaId, list)
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => a.rowNo - b.rowNo || a.seatNo - b.seatNo || a.id - b.id)
    }
    return grouped
  }, [seats])

  useEffect(() => {
    if (!Number.isInteger(venueId) || venueId <= 0) {
      setError('场馆ID不正确')
      setLoading(false)
      return
    }
    const user = getUser()
    if (!user) {
      setError('请先登录')
      setLoading(false)
      return
    }
    if (user.role !== 'admin') {
      setError('仅管理员可维护场馆座位模板')
      setLoading(false)
      return
    }
    setUserId(user.userId)
    refreshData(user.userId)
  }, [venueId])

  const refreshData = async (uid = userId) => {
    if (!uid || !Number.isInteger(venueId) || venueId <= 0) return
    setLoading(true)
    setError('')
    try {
      const [nextAreas, nextSeats] = await Promise.all([
        listVenueAreas(venueId, uid),
        listVenueSeats(venueId, uid),
      ])
      setAreas(nextAreas)
      setSeats(nextSeats)
      setSeatForm(current => current.areaId || !nextAreas[0] ? current : { ...current, areaId: String(nextAreas[0].id) })
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载座位模板失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateArea = async () => {
    if (!userId) {
      setError('请先登录')
      return
    }
    if (!areaForm.name.trim()) {
      setError('请填写区域名称')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await createVenueArea(venueId, {
        userId,
        name: areaForm.name.trim(),
        rowCount: Number(areaForm.rowCount),
        seatsPerRow: Number(areaForm.seatsPerRow),
        rowStart: Number(areaForm.rowStart),
        seatStart: Number(areaForm.seatStart),
        color: areaForm.color.trim() || '#ff1268',
        sort: Number(areaForm.sort),
      })
      setMessage(response.syncResult ? syncMessage(`已生成 ${response.generatedSeatCount} 个座位`, response.syncResult) : `已生成 ${response.generatedSeatCount} 个座位`)
      setAreaForm(emptyAreaForm)
      await refreshData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建区域失败')
    } finally {
      setSaving(false)
    }
  }

  const startCreateSeat = () => {
    setSelectedSeatId(null)
    setSeatForm({ ...emptySeatForm, areaId: areas[0] ? String(areas[0].id) : '' })
    setMessage('正在新增座位，请填写右侧表单')
    setError('')
  }

  const selectSeat = (seat: VenueSeatVO) => {
    setSelectedSeatId(seat.id)
    setSeatForm({
      areaId: String(seat.areaId),
      rowNo: String(seat.rowNo),
      seatNo: String(seat.seatNo),
      seatLabel: seat.seatLabel || '',
      x: String(seat.x ?? 0),
      y: String(seat.y ?? 0),
      status: String(seat.status),
    })
    setError('')
    setMessage('')
  }

  const handleSaveSeat = async () => {
    if (!userId) {
      setError('请先登录')
      return
    }
    const body = buildSeatRequest(userId, venueId, seatForm)
    if (!body) {
      setError('请完整填写区域、排号、座号和状态')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const sync = selectedSeatId
        ? await updateVenueSeat(selectedSeatId, body)
        : await createVenueSeat(venueId, body)
      setMessage(syncMessage(selectedSeatId ? '座位已保存' : '座位已新增', sync))
      await refreshData()
      setSelectedSeatId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存座位失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSeat = async () => {
    if (!selectedSeatId || !userId) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const sync = await deleteVenueSeat(selectedSeatId, userId)
      setMessage(syncMessage('座位已删除/禁用', sync))
      setSelectedSeatId(null)
      setSeatForm({ ...emptySeatForm, areaId: areas[0] ? String(areas[0].id) : '' })
      await refreshData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除座位失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !userId) {
    return <div className="py-20 text-center text-[14px] text-[#999]">加载中...</div>
  }

  if (error && !userId) {
    return (
      <div className="rounded-xl border border-[#ffd9e6] bg-white p-6 text-[14px] text-[#666]">
        <div className="text-[#ff4d4f]">{error}</div>
        <Link href="/console/venue" className="mt-4 inline-block rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666]">返回场馆管理</Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">场馆座位模板</h1>
          <p className="mt-1 text-[13px] text-[#999]">维护场馆固定座位；保存后会同步到未产生交易数据的场次。</p>
        </div>
        <Link href="/console/venue" className="rounded-lg border border-[#e5e5e5] px-4 py-2 text-[14px] text-[#666] hover:bg-[#fafafa]">返回场馆管理</Link>
      </div>

      {error && <div className="mb-4 rounded-lg bg-[#fff0f3] px-3 py-2 text-[13px] text-[#ff4d4f]">{error}</div>}
      {message && <div className="mb-4 rounded-lg bg-[#f0fff4] px-3 py-2 text-[13px] text-[#16a34a]">{message}</div>}

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        <aside className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <h2 className="text-[16px] font-bold text-[#1a1a2e]">区域列表</h2>
          <div className="mt-3 grid gap-2">
            {areas.length === 0 && <div className="text-[13px] text-[#999]">暂无区域，请先批量生成。</div>}
            {areas.map(area => (
              <div key={area.id} className="rounded-lg border border-[#f0f0f0] p-3 text-[13px] text-[#666]">
                <div className="mb-1 flex items-center gap-2 font-medium text-[#333]"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: area.color || '#ff1268' }} />{area.name}</div>
                <div>{area.rowCount} 排 x 每排 {area.seatsPerRow} 座</div>
                <div>起始：{area.rowStart} 排 {area.seatStart} 座，排序 {area.sort}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-[#f0f0f0] pt-5">
            <h3 className="text-[15px] font-bold text-[#1a1a2e]">批量生成区域</h3>
            <div className="mt-3 grid gap-3">
              <Field label="区域名称"><input value={areaForm.name} onChange={event => setAreaForm({ ...areaForm, name: event.target.value })} className={inputClassName} placeholder="A区" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="排数"><input type="number" value={areaForm.rowCount} onChange={event => setAreaForm({ ...areaForm, rowCount: event.target.value })} className={inputClassName} /></Field>
                <Field label="每排座数"><input type="number" value={areaForm.seatsPerRow} onChange={event => setAreaForm({ ...areaForm, seatsPerRow: event.target.value })} className={inputClassName} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="起始排"><input type="number" value={areaForm.rowStart} onChange={event => setAreaForm({ ...areaForm, rowStart: event.target.value })} className={inputClassName} /></Field>
                <Field label="起始座"><input type="number" value={areaForm.seatStart} onChange={event => setAreaForm({ ...areaForm, seatStart: event.target.value })} className={inputClassName} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="颜色"><input value={areaForm.color} onChange={event => setAreaForm({ ...areaForm, color: event.target.value })} className={inputClassName} /></Field>
                <Field label="排序"><input type="number" value={areaForm.sort} onChange={event => setAreaForm({ ...areaForm, sort: event.target.value })} className={inputClassName} /></Field>
              </div>
              <button onClick={handleCreateArea} disabled={saving} className="rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50">生成区域座位</button>
            </div>
          </div>
        </aside>

        <main className="min-h-[520px] rounded-xl border border-[#e5e5e5] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[16px] font-bold text-[#1a1a2e]">座位点阵</h2>
            <button onClick={startCreateSeat} className="rounded-lg bg-[#1a1a2e] px-4 py-2 text-[14px] font-medium text-white">新增座位</button>
          </div>
          {loading ? <div className="py-20 text-center text-[14px] text-[#999]">刷新中...</div> : (
            <div className="space-y-6 overflow-auto pb-2">
              {areas.map(area => {
                const areaSeats = seatsByArea.get(area.id) || []
                return (
                  <section key={area.id}>
                    <div className="mb-3 flex items-center gap-2 text-[14px] font-bold text-[#333]"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: area.color || '#ff1268' }} />{area.name}</div>
                    <div className="flex flex-wrap gap-2">
                      {areaSeats.map(seat => {
                        const disabled = seat.status !== 1
                        const selected = selectedSeatId === seat.id
                        return (
                          <button key={seat.id} onClick={() => selectSeat(seat)} title={`${seat.rowNo}排${seat.seatNo}座`} className={`h-9 min-w-9 rounded-lg border px-2 text-[12px] transition-colors ${selected ? 'border-[#1a1a2e] bg-[#1a1a2e] text-white' : disabled ? 'border-[#ddd] bg-[#f5f5f5] text-[#aaa] line-through' : 'border-transparent text-white hover:opacity-80'}`} style={selected || disabled ? undefined : { backgroundColor: area.color || '#ff1268' }}>
                            {seat.seatLabel || `${seat.rowNo}-${seat.seatNo}`}
                          </button>
                        )
                      })}
                      {areaSeats.length === 0 && <div className="text-[13px] text-[#999]">该区域暂无座位。</div>}
                    </div>
                  </section>
                )
              })}
              {areas.length === 0 && <div className="py-20 text-center text-[14px] text-[#999]">暂无区域和座位。</div>}
            </div>
          )}
        </main>

        <aside className="rounded-xl border border-[#e5e5e5] bg-white p-5">
          <h2 className="text-[16px] font-bold text-[#1a1a2e]">{selectedSeatId ? '编辑座位' : '新增座位'}</h2>
          <div className="mt-4 grid gap-3">
            <Field label="区域"><select value={seatForm.areaId} onChange={event => setSeatForm({ ...seatForm, areaId: event.target.value })} className={inputClassName}><option value="">请选择区域</option>{areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="排号"><input type="number" value={seatForm.rowNo} onChange={event => setSeatForm({ ...seatForm, rowNo: event.target.value })} className={inputClassName} /></Field>
              <Field label="座号"><input type="number" value={seatForm.seatNo} onChange={event => setSeatForm({ ...seatForm, seatNo: event.target.value })} className={inputClassName} /></Field>
            </div>
            <Field label="座位显示名"><input value={seatForm.seatLabel} onChange={event => setSeatForm({ ...seatForm, seatLabel: event.target.value })} className={inputClassName} placeholder="例：A1-01" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="X坐标"><input type="number" value={seatForm.x} onChange={event => setSeatForm({ ...seatForm, x: event.target.value })} className={inputClassName} /></Field>
              <Field label="Y坐标"><input type="number" value={seatForm.y} onChange={event => setSeatForm({ ...seatForm, y: event.target.value })} className={inputClassName} /></Field>
            </div>
            <Field label="状态"><select value={seatForm.status} onChange={event => setSeatForm({ ...seatForm, status: event.target.value })} className={inputClassName}><option value="1">可用</option><option value="0">禁用/删除</option></select></Field>
            <div className="mt-2 flex gap-2">
              <button onClick={handleSaveSeat} disabled={saving || areas.length === 0} className="flex-1 rounded-lg bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50">{saving ? '处理中...' : '保存座位'}</button>
              <button onClick={handleDeleteSeat} disabled={saving || !selectedSeatId} className="rounded-lg border border-[#ff4d4f] px-4 py-2 text-[14px] text-[#ff4d4f] disabled:opacity-50">删除</button>
            </div>
            {selectedSeatId && <div className="text-[12px] text-[#999]">当前座位 ID：{selectedSeatId}，区域：{areaById.get(Number(seatForm.areaId))?.name || '-'}</div>}
          </div>
        </aside>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[13px] font-medium text-[#333]"><span className="mb-1.5 block">{label}</span>{children}</label>
}

function buildSeatRequest(userId: number, venueId: number, form: SeatForm) {
  const areaId = Number(form.areaId)
  const rowNo = Number(form.rowNo)
  const seatNo = Number(form.seatNo)
  const status = Number(form.status)
  const x = form.x.trim() === '' ? 0 : Number(form.x)
  const y = form.y.trim() === '' ? 0 : Number(form.y)
  if (!Number.isInteger(venueId) || venueId <= 0 || !Number.isInteger(areaId) || areaId <= 0 || !Number.isInteger(rowNo) || rowNo <= 0 || !Number.isInteger(seatNo) || seatNo <= 0 || ![0, 1].includes(status) || !Number.isFinite(x) || x < 0 || !Number.isFinite(y) || y < 0) {
    return null
  }
  return {
    userId,
    venueId,
    areaId,
    rowNo,
    seatNo,
    seatLabel: form.seatLabel.trim() || null,
    x,
    y,
    status,
  }
}

function syncMessage(prefix: string, sync: SeatTemplateSyncResponseVO) {
  const skipped = sync.skippedSessionIds.length > 0 ? `，跳过场次：${sync.skippedSessionIds.join(', ')}` : ''
  return `${prefix}，已同步 ${sync.syncedSessionCount} 个场次，跳过 ${sync.skippedSessionCount} 个场次${skipped}`
}

const inputClassName = 'h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] outline-none focus:border-[#ff1268]'
