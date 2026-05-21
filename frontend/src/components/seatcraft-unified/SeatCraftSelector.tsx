'use client'

import { useMemo } from 'react'
import type { SeatCraftSeat } from '@/components/seatcraft/types'
import { SeatCraftCanvas } from './SeatCraftCanvas'
import type { SeatCraftSelectorProps } from './types'

export function SeatCraftSelector({ selectionModel, selectedSeatIds, onChange, maxSelectable, focusTarget }: SeatCraftSelectorProps) {
  const availableSeatKeys = useMemo(() => new Set(selectionModel.availableSeatIds.map(String)), [selectionModel.availableSeatIds])
  const selectedKeys = useMemo(() => new Set(selectedSeatIds.filter(id => availableSeatKeys.has(String(id))).map(String)), [availableSeatKeys, selectedSeatIds])

  const sectionSeats = useMemo(() => Object.fromEntries(Object.entries(selectionModel.seatsBySectionKey).map(([sectionKey, seats]) => [
    sectionKey,
    seats.map(seat => ({ ...seat, status: selectedKeys.has(String(seat.sessionSeatId)) ? 'selected' : seat.status }) satisfies SeatCraftSeat),
  ])), [selectionModel.seatsBySectionKey, selectedKeys])

  const toggleSeat = (seat: SeatCraftSeat) => {
    if (seat.sessionSeatId == null || seat.status === 'occupied' || seat.status === 'reserved') return
    const next = new Set(selectedKeys)
    const key = String(seat.sessionSeatId)
    if (next.has(key)) {
      next.delete(key)
    } else {
      if (maxSelectable != null && next.size >= maxSelectable) return
      if (!availableSeatKeys.has(key)) return
      next.add(key)
    }
    onChange(Array.from(next).map(Number))
  }

  if (!selectionModel.layout) {
    return <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">当前场次暂无 SeatCraft 座位图。</div>
  }

  return (
    <SeatCraftCanvas
      layout={selectionModel.layout}
      mode="selection"
      selectedSeatIds={Array.from(selectedKeys)}
      sectionSeats={sectionSeats}
      focusTarget={focusTarget}
      onSeatClick={toggleSeat}
    />
  )
}
