import type { SeatCraftSeat, SeatCraftSection, SeatStatus } from './types'

const SEAT_SIZE = 12
const SEAT_GAP = 4
const SEAT_SPACING = SEAT_SIZE + SEAT_GAP

export function isPrimeSeat(section: SeatCraftSection, row: number, col: number) {
  if (
    section.primeRowStart == null ||
    section.primeRowEnd == null ||
    section.primeColStart == null ||
    section.primeColEnd == null
  ) {
    return false
  }
  return row >= section.primeRowStart - 1
    && row <= section.primeRowEnd - 1
    && col >= section.primeColStart - 1
    && col <= section.primeColEnd - 1
}

export function buildSeatsForSection(section: SeatCraftSection, selectedSeatIds: string[] = []): SeatCraftSeat[] {
  const seats: SeatCraftSeat[] = []
  const innerRadius = section.radius ?? 200
  const arcSpan = section.arcSpan ?? 120

  for (let row = 0; row < section.rows; row += 1) {
    const currentRadius = innerRadius + row * SEAT_SPACING
    const arcLengthRad = (arcSpan * Math.PI) / 180

    for (let col = 0; col < section.cols; col += 1) {
      const id = `${section.id}-${row}-${col}`
      let x = (col - (section.cols - 1) / 2) * SEAT_SPACING
      let y = row * SEAT_SPACING
      let angle = section.rotation ?? 0

      if (section.layout === 'curved') {
        const angleStep = section.cols > 1 ? arcLengthRad / (section.cols - 1) : 0
        const theta = (col - (section.cols - 1) / 2) * angleStep
        x = currentRadius * Math.sin(theta)
        y = -currentRadius * Math.cos(theta) + innerRadius
        angle += (theta * 180) / Math.PI
      }

      seats.push({
        id,
        row,
        col,
        x,
        y,
        angle,
        status: selectedSeatIds.includes(id) ? 'selected' : 'available' as SeatStatus,
        price: 0,
        sectionKey: section.sectionKey,
        sectionName: section.name,
        label: `${row + 1}排${col + 1}座`,
      })
    }
  }

  return seats
}

export function cloneSection(section: SeatCraftSection, nextId: string, nextKey: string): SeatCraftSection {
  return {
    ...section,
    id: nextId,
    sectionKey: nextKey,
    x: section.x + 24,
    y: section.y + 24,
  }
}
