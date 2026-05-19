'use client'

import { useMemo } from 'react'
import type { SeatSelectionMapProps, SeatCraftSeat } from './types'
import { SeatCanvas } from './SeatCanvas'
import { buildSeatsForSection } from './layout'

export function SeatSelectionMap({ layout, seats, ticketTypeId, selectedSeatIds, onChange }: SeatSelectionMapProps) {
  const seatIds = useMemo(() => new Set(selectedSeatIds.map(String)), [selectedSeatIds])

  const sectionSeats = useMemo(() => {
    const sourceSeats = ticketTypeId == null ? seats : seats.filter(seat => seat.ticketTypeId == null || seat.ticketTypeId === ticketTypeId)
    const seatsByPosition = sourceSeats.reduce<Record<string, typeof sourceSeats[number]>>((acc, seat) => {
      if (seat.layoutSectionId == null) return acc
      acc[`${seat.layoutSectionId}-${seat.rowNo}-${seat.seatNo}`] = seat
      return acc
    }, {})

    return layout.sections.reduce<Record<string, SeatCraftSeat[]>>((acc, section) => {
      const built = buildSeatsForSection({
        id: String(section.id),
        sectionKey: section.sectionKey,
        name: section.name,
        rows: section.rows,
        cols: section.cols,
        x: section.x,
        y: section.y,
        color: section.color,
        type: section.type,
        layout: section.layout,
        radius: section.radius,
        arcSpan: section.arcSpan,
        rotation: section.rotation,
        primeRowStart: section.primeRowStart,
        primeRowEnd: section.primeRowEnd,
        primeColStart: section.primeColStart,
        primeColEnd: section.primeColEnd,
        ticketTypeId: section.ticketTypeId,
      })

      acc[section.sectionKey] = built.map((seat) => {
        const sourceSeat = seatsByPosition[`${section.id}-${seat.row + 1}-${seat.col + 1}`]
        const sessionSeatId = sourceSeat?.id
        const selected = sessionSeatId != null && seatIds.has(String(sessionSeatId))
        return {
          ...seat,
          sessionSeatId,
          id: sessionSeatId != null ? String(sessionSeatId) : seat.id,
          status: selected ? 'selected' : sourceSeat?.status === 1 ? 'available' : 'occupied',
        } satisfies SeatCraftSeat
      })
      return acc
    }, {})
  }, [layout, seats, seatIds, ticketTypeId])

  const selectedKeys = useMemo(() => new Set(selectedSeatIds.map(String)), [selectedSeatIds])

  const toggleSeat = (seat: SeatCraftSeat) => {
    if (seat.sessionSeatId == null) return
    const next = new Set(selectedKeys)
    const key = String(seat.sessionSeatId)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    onChange(Array.from(next).map(Number))
  }

  return (
    <SeatCanvas
      sections={layout.sections.map((section) => ({
        id: String(section.id),
        sectionKey: section.sectionKey,
        name: section.name,
        rows: section.rows,
        cols: section.cols,
        x: section.x,
        y: section.y,
        color: section.color,
        type: section.type,
        layout: section.layout,
        radius: section.radius,
        arcSpan: section.arcSpan,
        rotation: section.rotation,
        primeRowStart: section.primeRowStart,
        primeRowEnd: section.primeRowEnd,
        primeColStart: section.primeColStart,
        primeColEnd: section.primeColEnd,
        ticketTypeId: section.ticketTypeId,
      }))}
      stage={{ title: layout.stageTitle, x: layout.stageX, y: layout.stageY }}
      selectedSeatIds={selectedSeatIds.map(String)}
      sectionSeats={sectionSeats}
      isDesignMode={false}
      stageTitle={layout.stageTitle}
      onSeatClick={toggleSeat}
    />
  )
}
