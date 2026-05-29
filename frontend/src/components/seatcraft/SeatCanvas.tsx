'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { buildSeatsForBlock } from './block-layout'
import { isSeatKeyMatch } from './seat-selection'
import type { ActiveSeatKey, SeatBlockDraft, SeatCanvasProps, SeatCanvasToolMode, SeatCraftSeat } from './types'

function rotatePoint(x: number, y: number, cx: number, cy: number, angleDeg: number) {
  const angleRad = angleDeg * Math.PI / 180
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)
  const dx = x - cx
  const dy = y - cy
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
}

function getPolygonBounds(points: { x: number; y: number }[]) {
  return {
    minX: Math.min(...points.map(point => point.x)),
    maxX: Math.max(...points.map(point => point.x)),
    minY: Math.min(...points.map(point => point.y)),
    maxY: Math.max(...points.map(point => point.y)),
  }
}

function getPolygonCenter(points: { x: number; y: number }[]) {
  const bounds = getPolygonBounds(points)
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  }
}

function polygonLocalToWorld(block: SeatBlockDraft, x: number, y: number) {
  const points = block.polygonPoints ?? []
  if ((block.rotation || 0) === 0 || points.length < 3) {
    return { x: block.x + x, y: block.y + y }
  }
  const center = getPolygonCenter(points)
  const rotated = rotatePoint(x, y, center.x, center.y, block.rotation || 0)
  return { x: block.x + rotated.x, y: block.y + rotated.y }
}

function worldToPolygonLocal(block: SeatBlockDraft, x: number, y: number) {
  const points = block.polygonPoints ?? []
  const localX = x - block.x
  const localY = y - block.y
  if ((block.rotation || 0) === 0 || points.length < 3) {
    return { x: localX, y: localY }
  }
  const center = getPolygonCenter(points)
  return rotatePoint(localX, localY, center.x, center.y, -(block.rotation || 0))
}

function getPolygonWorldPoints(block: SeatBlockDraft) {
  return (block.polygonPoints ?? []).map(point => polygonLocalToWorld(block, point.x, point.y))
}

type DragTarget =
  | { type: 'block'; key: string; startX: number; startY: number; originX: number; originY: number; multiPositions?: { key: string; x: number; y: number }[] }
  | { type: 'rotate'; key: string; startX: number; startY: number; originAngle: number; centerX: number; centerY: number }
  | { type: 'resize'; key: string; corner: string; startX: number; startY: number; block: SeatBlockDraft; centerX: number; centerY: number }
  | { type: 'seat'; blockKey: string; rowNo: number; seatNo: number; startX: number; startY: number; originX: number; originY: number; baseX: number; baseY: number }
  | { type: 'polygonPoint'; blockKey: string; pointIndex: number }
  | { type: 'stage'; startX: number; startY: number; originX: number; originY: number }
  | { type: 'marquee'; startX: number; startY: number; currentX: number; currentY: number; bounds: { key: string; minX: number; maxX: number; minY: number; maxY: number }[] }
  | { type: 'canvas'; startX: number; startY: number; originX: number; originY: number }

type RenderBlockOptions = {
  block: SeatBlockDraft
  seats: SeatCraftSeat[]
  mode: string
  active: boolean
  onBlockPointerDown: (event: PointerEvent<SVGGElement>, block: SeatBlockDraft) => void
  onBlockRotateDown: (event: PointerEvent<SVGElement>, block: SeatBlockDraft, cx: number, cy: number) => void
  onBlockResizeDown: (event: PointerEvent<SVGElement>, block: SeatBlockDraft, corner: string, cx: number, cy: number) => void
  onSeatPointerDown: (event: PointerEvent<SVGGElement>, block: SeatBlockDraft, seat: SeatCraftSeat) => void
  onPolygonPointDown: (event: PointerEvent<SVGElement>, block: SeatBlockDraft, pointIndex: number) => void
  onSeatClick?: (seat: SeatCraftSeat) => void
  toolMode?: SeatCanvasToolMode
  activeSeatKey?: ActiveSeatKey | null
  onSeatSelect?: (seatKey: ActiveSeatKey | null) => void
  onBlockDoubleClick?: (block: SeatBlockDraft) => void
  suppressNextSeatClickRef: React.MutableRefObject<boolean>
}

type RenderSeatOptions = {
  block: SeatBlockDraft
  seat: SeatCraftSeat
  mode: string
  canSelectSeat: boolean
  toolMode: SeatCanvasToolMode
  onSeatPointerDown: (event: PointerEvent<SVGGElement>, block: SeatBlockDraft, seat: SeatCraftSeat) => void
  onSeatClick?: (seat: SeatCraftSeat) => void
  activeSeatKey?: ActiveSeatKey | null
  onSeatSelect?: (seatKey: ActiveSeatKey | null) => void
  suppressNextSeatClickRef: React.MutableRefObject<boolean>
}

const STATUS_COLOR: Record<string, string> = {
  available: '#34d399',
  selected: '#ff1268',
  occupied: '#71717a',
  reserved: '#f59e0b',
  deleted: 'transparent',
}

function canClickSeat(mode: string, status: string) {
  return mode === 'selection' && (status === 'available' || status === 'selected')
}

export function SeatCanvas({
  sections: _sections,
  blocks = [],
  stage,
  selectedSeatIds = [],
  sectionSeats,
  isDesignMode,
  interactionMode = isDesignMode ? 'design' : 'selection',
  onSeatClick,
  onBlockClick,
  onBlockMove,
  onBlockMoveMultiple,
  onBlockRotate,
  onBlockResize,
  onSeatMove,
  onPolygonPointMove,
  onStageMove,
  activeBlockKey,
  activeBlockKeys: controlledActiveBlockKeys,
  onBlockSelect,
  focusTarget,
  stageTitle,
  toolMode = 'pointer',
  activeSeatKey = null,
  onSeatSelect,
}: SeatCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const suppressNextSeatClickRef = useRef(false)
  const [drag, setDrag] = useState<DragTarget | null>(null)
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 1000, height: 800 })
  const [hasCentered, setHasCentered] = useState(false)
  const canvasWidth = 2000
  const canvasHeight = 1600

  const activeKeys = useMemo(() => controlledActiveBlockKeys ?? (activeBlockKey ? [activeBlockKey] : []), [controlledActiveBlockKeys, activeBlockKey])
  const selectedKeys = useMemo(() => new Set(selectedSeatIds.map(String)), [selectedSeatIds])
  const seatsByBlock = useMemo(() => {
    const provided = sectionSeats ?? {}
    return Object.fromEntries(blocks.map(block => [block.blockKey, (provided[block.blockKey] ?? buildSeatsForBlock(block, [], isDesignMode)).map(seat => ({
      ...seat,
      status: !isDesignMode && selectedKeys.has(String(seat.sessionSeatId ?? seat.id)) ? 'selected' : seat.status,
    }))]))
  }, [blocks, sectionSeats, selectedKeys, isDesignMode])

  useEffect(() => {
    if (focusTarget) {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return

      const padding = 120
      const targetW = Math.max(200, focusTarget.width + padding)
      const targetH = Math.max(200, focusTarget.height + padding)

      const containerRatio = rect.width / rect.height
      const targetRatio = targetW / targetH

      let finalW = targetW
      let finalH = targetH

      if (targetRatio > containerRatio) {
        finalH = targetW / containerRatio
      } else {
        finalW = targetH * containerRatio
      }

      const x = focusTarget.x - finalW / 2
      const y = focusTarget.y - finalH / 2
      setViewBox({ x, y, width: finalW, height: finalH })
      return
    }

    if (hasCentered) return

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return

      let minX = stage.x - 100
      let maxX = stage.x + 100
      let minY = stage.y - 100
      let maxY = stage.y + 100

      blocks.forEach(b => {
        const s = seatsByBlock[b.blockKey] ?? []
        if (s.length > 0) {
          minX = Math.min(minX, ...s.map(seat => seat.x))
          maxX = Math.max(maxX, ...s.map(seat => seat.x))
          minY = Math.min(minY, ...s.map(seat => seat.y))
          maxY = Math.max(maxY, ...s.map(seat => seat.y))
        } else {
          minX = Math.min(minX, b.x)
          maxX = Math.max(maxX, b.x + (b.width ?? 180))
          minY = Math.min(minY, b.y)
          maxY = Math.max(maxY, b.y + (b.height ?? 90))
        }
      })

      const padding = 100
      minX -= padding
      maxX += padding
      minY -= padding
      maxY += padding

      const contentWidth = maxX - minX
      const contentHeight = maxY - minY
      const contentCenterX = minX + contentWidth / 2
      const contentCenterY = minY + contentHeight / 2

      const containerRatio = rect.width / rect.height
      const contentRatio = contentWidth / contentHeight

      let finalWidth = contentWidth
      let finalHeight = contentHeight

      if (contentRatio > containerRatio) {
        finalHeight = contentWidth / containerRatio
      } else {
        finalWidth = contentHeight * containerRatio
      }

      const minViewWidth = Math.max(1000, rect.width)
      if (finalWidth < minViewWidth) {
        finalWidth = minViewWidth
        finalHeight = minViewWidth / containerRatio
      }

      setViewBox({
        x: contentCenterX - finalWidth / 2,
        y: contentCenterY - finalHeight / 2,
        width: finalWidth,
        height: finalHeight
      })
      setHasCentered(true)
    }
  }, [focusTarget, stage, blocks, seatsByBlock, hasCentered])

  const pointFromEvent = (event: PointerEvent<SVGElement>) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const transformed = point.matrixTransform(svg.getScreenCTM()?.inverse())
    return { x: transformed.x, y: transformed.y }
  }

  const startBlockDrag = (event: PointerEvent<SVGGElement>, block: SeatBlockDraft) => {
    event.stopPropagation()
    if (!isDesignMode) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointFromEvent(event)

    let nextActiveKeys = activeKeys
    if (!activeKeys.includes(block.blockKey)) {
      nextActiveKeys = [block.blockKey]
      onBlockSelect?.(nextActiveKeys)
    }

    const multiPositions = nextActiveKeys.map(k => {
      const b = blocks.find(x => x.blockKey === k)
      return { key: k, x: b?.x || 0, y: b?.y || 0 }
    })

    setDrag({ type: 'block', key: block.blockKey, startX: point.x, startY: point.y, originX: block.x, originY: block.y, multiPositions })
  }

  const startBlockRotate = (event: PointerEvent<SVGElement>, block: SeatBlockDraft, cx: number, cy: number) => {
    event.stopPropagation()
    if (!isDesignMode) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointFromEvent(event)
    setDrag({ type: 'rotate', key: block.blockKey, startX: point.x, startY: point.y, originAngle: block.rotation || 0, centerX: cx, centerY: cy })
  }

  const startBlockResize = (event: PointerEvent<SVGElement>, block: SeatBlockDraft, corner: string, cx: number, cy: number) => {
    event.stopPropagation()
    if (!isDesignMode) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointFromEvent(event)
    setDrag({ type: 'resize', key: block.blockKey, corner, startX: point.x, startY: point.y, block, centerX: cx, centerY: cy })
  }

  const startSeatDrag = (event: PointerEvent<SVGGElement>, block: SeatBlockDraft, seat: SeatCraftSeat) => {
    event.stopPropagation()
    if (!isDesignMode || toolMode !== 'seatMove') return
    if (seat.status === 'occupied' || seat.status === 'deleted') return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointFromEvent(event)
    setDrag({
      type: 'seat',
      blockKey: block.blockKey,
      rowNo: seat.row + 1,
      seatNo: seat.col + 1,
      startX: point.x,
      startY: point.y,
      originX: seat.x,
      originY: seat.y,
      baseX: seat.baseX ?? seat.x,
      baseY: seat.baseY ?? seat.y,
    })
  }

  const startPolygonPointDrag = (event: PointerEvent<SVGElement>, block: SeatBlockDraft, pointIndex: number) => {
    event.stopPropagation()
    if (!isDesignMode || toolMode !== 'pointer') return
    if ((block.rotation || 0) !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    if (!activeKeys.includes(block.blockKey)) {
      onBlockSelect?.([block.blockKey])
    }
    setDrag({ type: 'polygonPoint', blockKey: block.blockKey, pointIndex })
  }

  const startStageDrag = (event: PointerEvent<SVGGElement>) => {
    event.stopPropagation()
    if (!isDesignMode) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointFromEvent(event)

    let nextActiveKeys = activeKeys
    if (!activeKeys.includes('STAGE')) {
      nextActiveKeys = ['STAGE']
      onBlockSelect?.(nextActiveKeys)
    }

    const multiPositions = nextActiveKeys.map(k => {
      if (k === 'STAGE') return { key: 'STAGE', x: stage.x, y: stage.y }
      const b = blocks.find(x => x.blockKey === k)
      return { key: k, x: b?.x || 0, y: b?.y || 0 }
    })

    setDrag({ type: 'block', key: 'STAGE', startX: point.x, startY: point.y, originX: stage.x, originY: stage.y, multiPositions })
  }

  const startCanvasDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (drag) return
    event.currentTarget.setPointerCapture(event.pointerId)
    if (event.button === 0 && toolMode === 'pointer' && isDesignMode) {
      const point = pointFromEvent(event)
        const bounds = blocks.map(b => {
          const seats = seatsByBlock[b.blockKey] || []
          if (b.blockType === 'polygonBlock') {
            const points = getPolygonWorldPoints(b)
            if (points.length > 0) {
              return {
                key: b.blockKey,
                minX: Math.min(...points.map(point => point.x)),
                maxX: Math.max(...points.map(point => point.x)),
                minY: Math.min(...points.map(point => point.y)),
                maxY: Math.max(...points.map(point => point.y)),
              }
            }
          }
          if (seats.length > 0) {
          return {
            key: b.blockKey,
            minX: Math.min(...seats.map(s => s.x)),
            maxX: Math.max(...seats.map(s => s.x)),
            minY: Math.min(...seats.map(s => s.y)),
            maxY: Math.max(...seats.map(s => s.y))
          }
        }
        return {
          key: b.blockKey,
          minX: b.x,
          maxX: b.x + (b.width || ((b.cols || 1) * (b.seatSpacing || 24))),
          minY: b.y,
          maxY: b.y + (b.height || ((b.rows || 1) * (b.rowSpacing || 24)))
        }
      })
      setDrag({ type: 'marquee', startX: point.x, startY: point.y, currentX: point.x, currentY: point.y, bounds })
    } else {
      setDrag({ type: 'canvas', startX: event.clientX, startY: event.clientY, originX: viewBox.x, originY: viewBox.y })
    }
  }

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag) return
    if (drag.type === 'canvas') {
      const scale = viewBox.width / (containerRef.current?.getBoundingClientRect().width || 1000)
      const dx = (event.clientX - drag.startX) * scale
      const dy = (event.clientY - drag.startY) * scale
      setViewBox(prev => ({ ...prev, x: drag.originX - dx, y: drag.originY - dy }))
      return
    }
    if (drag.type === 'rotate') {
      const point = pointFromEvent(event)
      const angle1 = Math.atan2(drag.startY - drag.centerY, drag.startX - drag.centerX)
      const angle2 = Math.atan2(point.y - drag.centerY, point.x - drag.centerX)
      let deltaAngle = (angle2 - angle1) * 180 / Math.PI
      while (deltaAngle > 180) deltaAngle -= 360
      while (deltaAngle < -180) deltaAngle += 360

      const newAngle = Math.round(drag.originAngle + deltaAngle)
      onBlockRotate?.(drag.key, newAngle)
      return
    }
    if (drag.type === 'resize') {
      const point = pointFromEvent(event)
      const dx = point.x - drag.startX
      const dy = point.y - drag.startY

      const b = drag.block
      const rot = b.rotation || 0
      const angleRad = -rot * Math.PI / 180
      const localDx = dx * Math.cos(angleRad) - dy * Math.sin(angleRad)
      const localDy = dx * Math.sin(angleRad) + dy * Math.cos(angleRad)

      let widthDelta = 0
      let heightDelta = 0
      if (drag.corner.includes('e')) widthDelta = localDx
      if (drag.corner.includes('w')) widthDelta = -localDx
      if (drag.corner.includes('s')) heightDelta = localDy
      if (drag.corner.includes('n')) heightDelta = -localDy

      const updates: Partial<SeatBlockDraft> = {}

      if (b.blockType === 'arcBlock') {
        if (drag.corner === 'se' || drag.corner === 'sw') {
          updates.rows = Math.max(1, (b.rows || 1) + Math.round(heightDelta / (b.rowSpacing || 24)))
        }
        onBlockResize?.(drag.key, updates)
        return
      }

      let sX = 0, sY = 0, w = 0, h = 0
      const sSpacing = b.seatSpacing || 24, rSpacing = b.rowSpacing || 24

      if (b.blockType === 'standingBlock') {
        w = b.width || 180; h = b.height || 90
      } else {
        w = ((b.cols || 1) - 1) * sSpacing; h = ((b.rows || 1) - 1) * rSpacing
      }
      sX = drag.corner.includes('e') ? 0 : w
      sY = drag.corner.includes('s') ? 0 : h

      const vOld = rotatePoint(b.x + sX, b.y + sY, drag.centerX, drag.centerY, rot)

      let bx_temp = b.x, by_temp = b.y
      let newW = w, newH = h

      if (b.blockType === 'standingBlock') {
        const newWidth = Math.max(20, (b.width || 180) + widthDelta)
        const newHeight = Math.max(20, (b.height || 90) + heightDelta)
        if (drag.corner.includes('w')) bx_temp = b.x - (newWidth - (b.width || 180))
        if (drag.corner.includes('n')) by_temp = b.y - (newHeight - (b.height || 90))
        updates.width = newWidth; updates.height = newHeight
        newW = newWidth; newH = newHeight
      } else {
        const colDelta = Math.round(widthDelta / sSpacing)
        const rowDelta = Math.round(heightDelta / rSpacing)
        const newCols = Math.max(1, (b.cols || 1) + colDelta)
        const newRows = Math.max(1, (b.rows || 1) + rowDelta)
        if (drag.corner.includes('w')) bx_temp = b.x - (newCols - (b.cols || 1)) * sSpacing
        if (drag.corner.includes('n')) by_temp = b.y - (newRows - (b.rows || 1)) * rSpacing
        updates.cols = newCols; updates.rows = newRows
        newW = (newCols - 1) * sSpacing; newH = (newRows - 1) * rSpacing
      }

      const newSx = drag.corner.includes('e') ? 0 : newW
      const newSy = drag.corner.includes('s') ? 0 : newH
      const cx_temp = bx_temp + newW / 2
      const cy_temp = by_temp + newH / 2

      const vTemp = rotatePoint(bx_temp + newSx, by_temp + newSy, cx_temp, cy_temp, rot)

      updates.x = Math.round(bx_temp + (vOld.x - vTemp.x))
      updates.y = Math.round(by_temp + (vOld.y - vTemp.y))

      onBlockResize?.(drag.key, updates)
      return
    }
    if (drag.type === 'marquee') {
      const point = pointFromEvent(event)
      setDrag({ ...drag, currentX: point.x, currentY: point.y })

      const minX = Math.min(drag.startX, point.x)
      const maxX = Math.max(drag.startX, point.x)
      const minY = Math.min(drag.startY, point.y)
      const maxY = Math.max(drag.startY, point.y)

      const stageMinX = stage.x - 100
      const stageMaxX = stage.x + 100
      const stageMinY = stage.y - 30
      const stageMaxY = stage.y + 30
      const stageSelected = !(stageMaxX < minX || stageMinX > maxX || stageMaxY < minY || stageMinY > maxY)

      const selected = drag.bounds.filter(b => {
        return !(b.maxX < minX || b.minX > maxX || b.maxY < minY || b.minY > maxY)
      }).map(b => b.key)

      if (stageSelected) selected.push('STAGE')

      onBlockSelect?.(selected)
      return
    }
    if (drag.type === 'seat') {
      const point = pointFromEvent(event)
      const x = Math.round(drag.originX + point.x - drag.startX)
      const y = Math.round(drag.originY + point.y - drag.startY)
      onSeatMove?.(drag.blockKey, drag.rowNo, drag.seatNo, x, y, drag.baseX, drag.baseY)
      return
    }
    if (drag.type === 'polygonPoint') {
      const block = blocks.find(item => item.blockKey === drag.blockKey)
      if (!block) return
      const point = pointFromEvent(event)
      const local = worldToPolygonLocal(block, point.x, point.y)
      onPolygonPointMove?.(drag.blockKey, drag.pointIndex, Math.round(local.x), Math.round(local.y))
      return
    }
    const point = pointFromEvent(event)
    const x = Math.round(drag.originX + point.x - drag.startX)
    const y = Math.round(drag.originY + point.y - drag.startY)
    const dx = x - drag.originX
    const dy = y - drag.originY
    if (drag.type === 'block') {
      if (drag.multiPositions && drag.multiPositions.length > 1 && activeKeys.includes(drag.key)) {
        onBlockMoveMultiple?.(drag.multiPositions.map(p => ({
          blockKey: p.key,
          x: Math.round(p.x + dx),
          y: Math.round(p.y + dy)
        })))
      } else {
        if (drag.key === 'STAGE') onStageMove?.(x, y)
        else onBlockMove?.(drag.key, x, y)
      }
    }
  }
  // Moved handleWheel to useEffect to ensure { passive: false } can prevent default browser zoom
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const handleWheelNative = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9
        setViewBox(prev => {
          const newWidth = prev.width * zoomFactor
          const newHeight = prev.height * zoomFactor
          const dx = (prev.width - newWidth) / 2
          const dy = (prev.height - newHeight) / 2
          return { x: prev.x + dx, y: prev.y + dy, width: newWidth, height: newHeight }
        })
      }
    }

    svg.addEventListener('wheel', handleWheelNative, { passive: false })
    return () => svg.removeEventListener('wheel', handleWheelNative)
  }, [])

  return (
    <div ref={containerRef} className="h-full min-h-[520px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 relative select-none">
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        className={`h-full min-h-[520px] w-full transition-all duration-75 ${drag?.type === 'canvas' ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={startCanvasDrag}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        <defs>
          <pattern id="canvas-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#ffffff" fillOpacity="0.1" />
          </pattern>
          <linearGradient id="stage-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
          <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <rect x={-50000} y={-50000} width={100000} height={100000} fill="#0a0a0a" />
        <rect x={-50000} y={-50000} width={100000} height={100000} fill="url(#canvas-grid)" />

        <g
          onPointerDown={(e) => { e.stopPropagation(); startStageDrag(e) }}
          onDoubleClick={(e) => { e.stopPropagation(); onBlockSelect?.(['STAGE']) }}
          className={isDesignMode ? 'cursor-move' : ''}
        >
          {activeKeys.includes('STAGE') && isDesignMode && (
            <rect x={stage.x - 110} y={stage.y - 40} width={220} height={80} rx={8} fill="transparent" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" className="pointer-events-none opacity-50" />
          )}
          {/* 梯形主舞台轮廓 */}
          <polygon points={`${stage.x - 100},${stage.y + 30} ${stage.x + 100},${stage.y + 30} ${stage.x + 60},${stage.y - 30} ${stage.x - 60},${stage.y - 30}`} fill="#000000" stroke="url(#stage-grad)" strokeWidth={2} filter="url(#neon-glow)" />
          <text x={stage.x} y={stage.y} textAnchor="middle" className="fill-white text-[16px] font-bold tracking-[0.2em]">{stageTitle ?? stage.title}</text>
          {/* 音波装饰 */}
          <g transform={`translate(${stage.x}, ${stage.y + 15})`} fill="url(#stage-grad)">
            <rect x={-20} y={-4} width={2} height={8} rx={1} />
            <rect x={-15} y={-8} width={2} height={16} rx={1} />
            <rect x={-10} y={-12} width={2} height={24} rx={1} />
            <rect x={-5} y={-16} width={2} height={32} rx={1} />
            <rect x={0} y={-10} width={2} height={20} rx={1} />
            <rect x={5} y={-18} width={2} height={36} rx={1} />
            <rect x={10} y={-14} width={2} height={28} rx={1} />
            <rect x={15} y={-6} width={2} height={12} rx={1} />
            <rect x={20} y={-3} width={2} height={6} rx={1} />
          </g>
        </g>
        {blocks.map(block => renderBlock({
          block,
          seats: seatsByBlock[block.blockKey] ?? [],
          mode: interactionMode,
          active: activeKeys.includes(block.blockKey),
          onBlockPointerDown: startBlockDrag,
          onBlockRotateDown: startBlockRotate,
          onBlockResizeDown: startBlockResize,
          onSeatPointerDown: startSeatDrag,
          onPolygonPointDown: startPolygonPointDrag,
          onSeatClick,
          toolMode,
          activeSeatKey,
          onSeatSelect,
          onBlockDoubleClick: (b) => onBlockSelect?.([b.blockKey]),
          suppressNextSeatClickRef,
        }))}
        {drag?.type === 'marquee' && (
          <rect
            x={Math.min(drag.startX, drag.currentX)}
            y={Math.min(drag.startY, drag.currentY)}
            width={Math.abs(drag.currentX - drag.startX)}
            height={Math.abs(drag.currentY - drag.startY)}
            fill="#3b82f6"
            fillOpacity={0.2}
            stroke="#3b82f6"
            strokeWidth={1}
            className="pointer-events-none"
          />
        )}
      </svg>
      {/* Zoom controls hint */}
      <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md rounded-lg px-3 py-2 text-[12px] text-white/50 border border-white/10 pointer-events-none">
        按住 Ctrl/Cmd + 滚轮缩放画布 • 拖拽空白处平移
      </div>
    </div>
  )
}

function renderBlock({
  block,
  seats,
  mode,
  active,
  onBlockPointerDown,
  onBlockRotateDown,
  onBlockResizeDown,
  onSeatPointerDown,
  onPolygonPointDown,
  onSeatClick,
  toolMode = 'pointer',
  activeSeatKey = null,
  onSeatSelect,
  onBlockDoubleClick,
  suppressNextSeatClickRef,
}: RenderBlockOptions) {
  const canSelectSeat = mode === 'selection'

  if (block.blockType === 'polygonBlock') {
    const polygonPoints = block.polygonPoints ?? []
    const worldPoints = getPolygonWorldPoints(block)
    let minX = block.x, maxX = block.x, minY = block.y, maxY = block.y
    if (worldPoints.length > 0) {
      minX = Math.min(...worldPoints.map(point => point.x))
      maxX = Math.max(...worldPoints.map(point => point.x))
      minY = Math.min(...worldPoints.map(point => point.y))
      maxY = Math.max(...worldPoints.map(point => point.y))
    } else if (seats.length > 0) {
      minX = Math.min(...seats.map(seat => seat.x))
      maxX = Math.max(...seats.map(seat => seat.x))
      minY = Math.min(...seats.map(seat => seat.y))
      maxY = Math.max(...seats.map(seat => seat.y))
    }
    const w = maxX - minX + 40
    const h = maxY - minY + 40
    const cx = minX - 20 + w / 2
    const cy = minY - 20 + h / 2
    const labelY = minY - 18
    const canEditPolygonPoints = (block.rotation || 0) === 0

    return (
      <g
        key={block.blockKey}
        onPointerDown={(event) => onBlockPointerDown(event, block)}
        onDoubleClick={(event) => { event.stopPropagation(); onBlockDoubleClick?.(block) }}
        className={canSelectSeat ? 'cursor-pointer' : ''}
      >
        {polygonPoints.length >= 3 && (
          <polygon
            points={worldPoints.map(point => `${point.x},${point.y}`).join(' ')}
            fill={block.color}
            fillOpacity={0.05}
            stroke={block.color}
            strokeWidth={active ? 3 : 1.5}
            strokeDasharray={active ? 'none' : '6 4'}
            filter={active ? 'url(#neon-glow)' : 'none'}
          />
        )}
        {active && mode === 'design' && (
          <rect
            x={minX - 20}
            y={minY - 20}
            width={w}
            height={h}
            rx={16}
            fill="transparent"
            stroke={block.color}
            strokeWidth={2}
            strokeDasharray="4 4"
            filter="url(#neon-glow)"
            className="pointer-events-none opacity-50"
          />
        )}
        {seats.map(seat => renderSeat({
          block,
          seat,
          mode,
          canSelectSeat,
          toolMode,
          onSeatPointerDown,
          onSeatClick,
          activeSeatKey,
          onSeatSelect,
          suppressNextSeatClickRef,
        }))}
        {active && mode === 'design' && (
          <>
            <g transform={`translate(${cx}, ${minY - 40})`}>
              <line x1={0} y1={0} x2={0} y2={20} stroke="#ffffff" strokeWidth={2} className="opacity-50 pointer-events-none" />
              <circle cx={0} cy={0} r={6} fill="#ffffff" className="cursor-crosshair hover:scale-125 transition-transform" onPointerDown={(e) => onBlockRotateDown(e, block, cx, cy)} />
            </g>
            {worldPoints.map((point, index) => (
              <circle
                key={`${block.blockKey}-vertex-${index}`}
                cx={point.x}
                cy={point.y}
                r={7}
                fill="#ffffff"
                stroke={block.color}
                strokeWidth={2}
                className={canEditPolygonPoints ? 'cursor-move' : 'cursor-not-allowed opacity-60'}
                aria-label={canEditPolygonPoints ? `拖拽多边形顶点 ${index + 1}` : '旋转后请先将角度归零再编辑顶点'}
                onPointerDown={(event) => onPolygonPointDown(event, block, index)}
              />
            ))}
          </>
        )}
        <rect x={cx - 40} y={labelY - 14} width={80} height={20} rx={4} fill="#0a0a0a" stroke="#333" strokeWidth={1} />
        <text x={cx} y={labelY} textAnchor="middle" className="fill-white text-[11px] font-bold">{block.name}</text>
      </g>
    )
  }

  if (block.blockType === 'standingBlock') {
    const standingWidth = block.width ?? 180
    const standingHeight = block.height ?? 90
    const cx = block.x + standingWidth / 2
    const cy = block.y + standingHeight / 2

    return (
      <g
        key={block.blockKey}
        transform={`rotate(${block.rotation || 0} ${cx} ${cy})`}
        onPointerDown={(event) => onBlockPointerDown(event, block)}
        onDoubleClick={(event) => { event.stopPropagation(); onBlockDoubleClick?.(block) }}
        className={canSelectSeat ? 'cursor-pointer' : ''}
      >
        <rect x={block.x} y={block.y} width={standingWidth} height={standingHeight} rx={16} fill="transparent" stroke={block.color} strokeWidth={active ? 3 : 1} filter={active ? 'url(#neon-glow)' : 'none'} />
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-white text-[15px] font-bold tracking-wider">{block.name}</text>
        <text x={cx} y={cy + 18} textAnchor="middle" className="fill-zinc-400 text-[12px]">容纳 {block.capacity ?? 0} 人</text>
        {active && mode === 'design' && (
          <>
            <g transform={`translate(${cx}, ${block.y - 20})`}>
              <line x1={0} y1={0} x2={0} y2={20} stroke="#ffffff" strokeWidth={2} className="opacity-50 pointer-events-none" />
              <circle cx={0} cy={0} r={6} fill="#ffffff" className="cursor-crosshair hover:scale-125 transition-transform" onPointerDown={(e) => onBlockRotateDown(e, block, cx, cy)} />
            </g>
            <rect x={block.x - 4} y={block.y - 4} width={8} height={8} fill="#ffffff" className="cursor-nwse-resize" onPointerDown={(e) => onBlockResizeDown(e, block, 'nw', cx, cy)} />
            <rect x={block.x + standingWidth - 4} y={block.y - 4} width={8} height={8} fill="#ffffff" className="cursor-nesw-resize" onPointerDown={(e) => onBlockResizeDown(e, block, 'ne', cx, cy)} />
            <rect x={block.x - 4} y={block.y + standingHeight - 4} width={8} height={8} fill="#ffffff" className="cursor-nesw-resize" onPointerDown={(e) => onBlockResizeDown(e, block, 'sw', cx, cy)} />
            <rect x={block.x + standingWidth - 4} y={block.y + standingHeight - 4} width={8} height={8} fill="#ffffff" className="cursor-nwse-resize" onPointerDown={(e) => onBlockResizeDown(e, block, 'se', cx, cy)} />
          </>
        )}
      </g>
    )
  }

  let minX = block.x, maxX = block.x, minY = block.y, maxY = block.y
  if (seats.length > 0) {
    minX = Math.min(...seats.map(s => s.x))
    maxX = Math.max(...seats.map(s => s.x))
    minY = Math.min(...seats.map(s => s.y))
    maxY = Math.max(...seats.map(s => s.y))
  }
  const w = maxX - minX + 40
  const h = maxY - minY + 40
  let cx = minX - 20 + w / 2
  let cy = minY - 20 + h / 2

  if (block.blockType === 'gridBlock') {
    const sSpacing = block.seatSpacing || 24
    const rSpacing = block.rowSpacing || 24
    const bw = ((block.cols || 1) - 1) * sSpacing
    const bh = ((block.rows || 1) - 1) * rSpacing
    cx = block.x + bw / 2
    cy = block.y + bh / 2
  }

  return (
    <g
      key={block.blockKey}
      transform={`rotate(${block.rotation || 0} ${cx} ${cy})`}
      onPointerDown={(event) => onBlockPointerDown(event, block)}
      onDoubleClick={(event) => { event.stopPropagation(); onBlockDoubleClick?.(block) }}
      className={canSelectSeat ? 'cursor-pointer' : ''}
    >
      {active && mode === 'design' && (
        <rect
          x={minX - 20}
          y={minY - 20}
          width={w}
          height={h}
          rx={16}
          fill="transparent"
          stroke={block.color}
          strokeWidth={2}
          strokeDasharray="4 4"
          filter="url(#neon-glow)"
          className="pointer-events-none opacity-50"
        />
      )}
      {active && mode === 'design' && (
        <>
          <g transform={`translate(${cx}, ${minY - 40})`}>
            <line x1={0} y1={0} x2={0} y2={20} stroke="#ffffff" strokeWidth={2} className="opacity-50 pointer-events-none" />
            <circle cx={0} cy={0} r={6} fill="#ffffff" className="cursor-crosshair hover:scale-125 transition-transform" onPointerDown={(e) => onBlockRotateDown(e, block, cx, cy)} />
          </g>
          <rect x={minX - 24} y={minY - 24} width={8} height={8} fill="#ffffff" className="cursor-nwse-resize" onPointerDown={(e) => onBlockResizeDown(e, block, 'nw', cx, cy)} />
          <rect x={minX - 20 + w - 4} y={minY - 24} width={8} height={8} fill="#ffffff" className="cursor-nesw-resize" onPointerDown={(e) => onBlockResizeDown(e, block, 'ne', cx, cy)} />
          <rect x={minX - 24} y={minY - 20 + h - 4} width={8} height={8} fill="#ffffff" className="cursor-nesw-resize" onPointerDown={(e) => onBlockResizeDown(e, block, 'sw', cx, cy)} />
          <rect x={minX - 20 + w - 4} y={minY - 20 + h - 4} width={8} height={8} fill="#ffffff" className="cursor-nwse-resize" onPointerDown={(e) => onBlockResizeDown(e, block, 'se', cx, cy)} />
        </>
      )}
      {seats.map(seat => {
        return renderSeat({
          block,
          seat,
          mode,
          canSelectSeat,
          toolMode,
          onSeatPointerDown,
          onSeatClick,
          activeSeatKey,
          onSeatSelect,
          suppressNextSeatClickRef,
        })
      })}
      {/* 区块名内联显示 */}
      <rect x={cx - 30} y={minY - 32} width={60} height={20} rx={4} fill="#0a0a0a" stroke="#333" strokeWidth={1} />
      <text x={cx} y={minY - 18} textAnchor="middle" className="fill-white text-[11px] font-bold">{block.name}</text>
    </g>
  )
}
function renderSeat({
  block,
  seat,
  mode,
  canSelectSeat,
  toolMode,
  onSeatPointerDown,
  onSeatClick,
  activeSeatKey = null,
  onSeatSelect,
  suppressNextSeatClickRef,
}: RenderSeatOptions) {
  const fill = STATUS_COLOR[seat.status] ?? '#34d399'
  const isSelected = seat.status === 'selected'
  const isDeleted = seat.status === 'deleted'
  const movableSeat = seat.status !== 'occupied' && seat.status !== 'deleted'
  const selectableSeat = canClickSeat(mode, seat.status)
  const activeInDesign = mode === 'design' && isSeatKeyMatch(activeSeatKey, seat)
  return (
    <g
      key={seat.id}
      transform={`translate(${seat.x}, ${seat.y})`}
      onPointerDown={(event) => {
        if (mode !== 'design') {
          if (canSelectSeat) event.stopPropagation()
          return
        }
        if (toolMode === 'seatMove') {
          if (movableSeat) suppressNextSeatClickRef.current = true
          onSeatPointerDown(event, block, seat)
          return
        }
        if (toolMode === 'eraser') {
          event.stopPropagation()
        }
      }}
      onPointerEnter={(event) => {
        if (mode === 'design' && toolMode === 'eraser' && event.buttons === 1) {
          suppressNextSeatClickRef.current = true
          onSeatClick?.(seat)
        }
      }}
      onClick={(event) => {
        if (suppressNextSeatClickRef.current) {
          suppressNextSeatClickRef.current = false
          event.stopPropagation()
          return
        }
        if (mode === 'design') {
          event.stopPropagation()
          if (toolMode === 'eraser') {
            onSeatClick?.(seat)
            return
          }
          onSeatSelect?.({ blockKey: seat.sectionKey, rowNo: seat.row + 1, seatNo: seat.col + 1 })
          if (toolMode !== 'seatMove') onSeatClick?.(seat)
        } else if (selectableSeat) {
          onSeatClick?.(seat)
        }
      }}
      className={mode === 'design' ? (toolMode === 'seatMove' ? 'cursor-move' : 'cursor-pointer') : selectableSeat ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}
    >
      {/* 发光方形座位 */}
      {activeInDesign && (
        <rect x={-9} y={-9} width={18} height={18} rx={4} fill="transparent" stroke="#ffffff" strokeWidth={2} className="pointer-events-none" />
      )}
      <rect
        x={-6} y={-6} width={12} height={12} rx={2}
        fill={fill} fillOpacity={isDeleted ? 0.05 : 0.15}
        stroke={isDeleted ? '#555' : fill} strokeWidth={isSelected ? 2 : 1.5}
        strokeDasharray={isDeleted ? '2 2' : 'none'}
        filter={isDeleted ? 'none' : 'url(#neon-glow)'}
      />
    </g>
  )
}
