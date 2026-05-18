'use client'

import { useMemo, useState } from 'react'
import type { SessionSeatVO, VenueAreaVO } from '@/types/api'

type SeatMapProps = {
  seats: SessionSeatVO[]
  areas?: VenueAreaVO[]
  stageLabel?: string
  maxSelectable: number
  selectedSeatIds: number[]
  onChange: (seatIds: number[]) => void
}

const STATUS_AVAILABLE = 1

export function SeatMap({ seats, areas = [], stageLabel = '舞台方向', maxSelectable, selectedSeatIds, onChange }: SeatMapProps) {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const areaById = useMemo(() => new Map(areas.map(area => [area.id, area])), [areas])

  const grouped = useMemo(() => {
    const map = new Map<number, SessionSeatVO[]>()
    for (const seat of seats) {
      const list = map.get(seat.areaId) || []
      list.push(seat)
      map.set(seat.areaId, list)
    }
    return Array.from(map.entries()).map(([areaId, list]) => ({
      areaId,
      area: areaById.get(areaId),
      seats: list.sort((a, b) => a.rowNo === b.rowNo ? a.seatNo - b.seatNo : a.rowNo - b.rowNo),
    }))
  }, [areaById, seats])

  const toggleSeat = (seat: SessionSeatVO) => {
    if (seat.status !== STATUS_AVAILABLE) return
    if (selectedSeatIds.includes(seat.id)) {
      onChange(selectedSeatIds.filter(id => id !== seat.id))
      return
    }
    if (selectedSeatIds.length >= maxSelectable) return
    onChange([...selectedSeatIds, seat.id])
  }

  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="rounded-full bg-gradient-to-r from-[#ff1268] to-[#ff6aa0] px-10 py-2 text-center text-[13px] font-medium text-white shadow-sm">
          {stageLabel}
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[#666]">
          <button onClick={() => setScale(Math.max(0.7, scale - 0.1))} className="rounded border border-[#ddd] px-2 py-1">缩小</button>
          <span>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(Math.min(1.6, scale + 0.1))} className="rounded border border-[#ddd] px-2 py-1">放大</button>
          <button onClick={() => setOffset({ x: offset.x - 20, y: offset.y })} className="rounded border border-[#ddd] px-2 py-1">左</button>
          <button onClick={() => setOffset({ x: offset.x + 20, y: offset.y })} className="rounded border border-[#ddd] px-2 py-1">右</button>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-4 text-[12px] text-[#666]">
        <Legend color="#fff" border="#cfcfcf" label="可选" />
        <Legend color="#ff1268" label="已选" />
        <Legend color="#e5e5e5" label="不可选/已售" />
      </div>
      <div className="overflow-hidden rounded-lg bg-[#fafafa] p-5">
        <div style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: 'top left' }} className="transition-transform">
          {grouped.map(group => (
            <div key={group.areaId} className="mb-6">
              <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-[#333]">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.area?.color || '#ff1268' }} />
                {group.area?.name || `区域 ${group.areaId}`}
              </div>
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(...group.seats.map(seat => seat.seatNo), 1)}, 24px)` }}>
                {group.seats.map(seat => {
                  const selected = selectedSeatIds.includes(seat.id)
                  const available = seat.status === STATUS_AVAILABLE
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      title={seat.seatLabel}
                      onClick={() => toggleSeat(seat)}
                      className={`h-6 w-6 rounded-t-lg border text-[9px] leading-none transition-colors ${selected ? 'border-[#ff1268] bg-[#ff1268] text-white' : available ? 'border-[#cfcfcf] bg-white text-[#666] hover:border-[#ff1268]' : 'cursor-not-allowed border-[#ddd] bg-[#e5e5e5] text-[#aaa]'}`}
                    >
                      {seat.seatNo}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {seats.length === 0 && <div className="py-10 text-center text-[13px] text-[#999]">该票档暂无可选座位</div>}
        </div>
      </div>
    </div>
  )
}

function Legend({ color, border, label }: { color: string; border?: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="h-4 w-4 rounded-t border" style={{ backgroundColor: color, borderColor: border || color }} />{label}</span>
}
