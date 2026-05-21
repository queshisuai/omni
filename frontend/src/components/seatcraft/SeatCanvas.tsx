'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { buildSeatsForBlock } from './block-layout'
import type { SeatBlockDraft, SeatCanvasProps, SeatCraftSeat } from './types'

type DragTarget =
  | { type: 'block'; key: string; startX: number; startY: number; originX: number; originY: number }
  | { type: 'stage'; startX: number; startY: number; originX: number; originY: number }

const STATUS_COLOR: Record<string, string> = {
  available: '#34d399',
  selected: '#ff1268',
  occupied: '#71717a',
  reserved: '#f59e0b',
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
  onStageMove,
  activeBlockKey,
  focusTarget,
  stageTitle,
}: SeatCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [drag, setDrag] = useState<DragTarget | null>(null)
  const [viewBox, setViewBox] = useState(() => `0 0 1000 800`)
  const canvasWidth = 1000
  const canvasHeight = 800

  const selectedKeys = useMemo(() => new Set(selectedSeatIds.map(String)), [selectedSeatIds])
  const seatsByBlock = useMemo(() => {
    const provided = sectionSeats ?? {}
    return Object.fromEntries(blocks.map(block => [block.blockKey, (provided[block.blockKey] ?? buildSeatsForBlock(block)).map(seat => ({
      ...seat,
      status: selectedKeys.has(String(seat.sessionSeatId ?? seat.id)) ? 'selected' : seat.status,
    }))]))
  }, [blocks, sectionSeats, selectedKeys])

  useEffect(() => {
    if (!focusTarget) {
      setViewBox(`0 0 ${canvasWidth} ${canvasHeight}`)
      return
    }
    const padding = 80
    const width = Math.max(180, focusTarget.width + padding)
    const height = Math.max(160, focusTarget.height + padding)
    const x = focusTarget.x - width / 2
    const y = focusTarget.y - height / 2
    setViewBox(`${x} ${y} ${width} ${height}`)
  }, [focusTarget])

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
    onBlockClick?.(block)
    if (!isDesignMode) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointFromEvent(event)
    setDrag({ type: 'block', key: block.blockKey, startX: point.x, startY: point.y, originX: block.x, originY: block.y })
  }

  const startStageDrag = (event: PointerEvent<SVGGElement>) => {
    if (!isDesignMode) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointFromEvent(event)
    setDrag({ type: 'stage', startX: point.x, startY: point.y, originX: stage.x, originY: stage.y })
  }

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag) return
    const point = pointFromEvent(event)
    const x = Math.round(drag.originX + point.x - drag.startX)
    const y = Math.round(drag.originY + point.y - drag.startY)
    if (drag.type === 'block') onBlockMove?.(drag.key, x, y)
    if (drag.type === 'stage') onStageMove?.(x, y)
  }

  return (
    <div className="h-full min-h-[520px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <svg ref={svgRef} viewBox={viewBox} className="h-full min-h-[520px] w-full transition-all duration-500 ease-out" onPointerMove={handlePointerMove} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
        <rect x={0} y={0} width={canvasWidth} height={canvasHeight} fill="#020617" />
        <Grid width={canvasWidth} height={canvasHeight} />
        <g onPointerDown={startStageDrag} className={isDesignMode ? 'cursor-move' : ''}>
          <rect x={stage.x - 90} y={stage.y - 18} width={180} height={36} rx={18} fill="#f97316" />
          <text x={stage.x} y={stage.y + 5} textAnchor="middle" className="fill-white text-[13px] font-semibold">{stageTitle ?? stage.title}</text>
        </g>
        {blocks.map(block => renderBlock(block, seatsByBlock[block.blockKey] ?? [], interactionMode, activeBlockKey === block.blockKey, startBlockDrag, onSeatClick))}
      </svg>
    </div>
  )
}

function Grid({ width, height }: { width: number; height: number }) {
  const lines = []
  for (let x = 0; x <= width; x += 40) lines.push(<line key={`x-${x}`} x1={x} y1={0} x2={x} y2={height} stroke="#1e293b" strokeWidth={1} />)
  for (let y = 0; y <= height; y += 40) lines.push(<line key={`y-${y}`} x1={0} y1={y} x2={width} y2={y} stroke="#1e293b" strokeWidth={1} />)
  return <g opacity={0.45}>{lines}</g>
}

function renderBlock(
  block: SeatBlockDraft,
  seats: SeatCraftSeat[],
  mode: string,
  active: boolean,
  onBlockPointerDown: (event: PointerEvent<SVGGElement>, block: SeatBlockDraft) => void,
  onSeatClick?: (seat: SeatCraftSeat) => void,
) {
  const canSelectSeat = mode === 'selection'
  const standingWidth = block.width ?? 180
  const standingHeight = block.height ?? 90
  return (
    <g key={block.blockKey} transform={`rotate(${block.rotation || 0} ${block.x} ${block.y})`} onPointerDown={(event) => onBlockPointerDown(event, block)} className="cursor-pointer">
      {block.blockType === 'standingBlock' ? (
        <g>
          <rect x={block.x} y={block.y} width={standingWidth} height={standingHeight} rx={14} fill={block.color} fillOpacity={0.25} stroke={active ? '#ff1268' : block.color} strokeWidth={active ? 3 : 2} />
          <text x={block.x + standingWidth / 2} y={block.y + standingHeight / 2 - 4} textAnchor="middle" className="fill-zinc-100 text-[13px] font-semibold">{block.name}</text>
          <text x={block.x + standingWidth / 2} y={block.y + standingHeight / 2 + 16} textAnchor="middle" className="fill-zinc-400 text-[11px]">容量 {block.capacity ?? 0}</text>
        </g>
      ) : (
        <g>
          {seats.map(seat => (
            <circle
              key={seat.id}
              cx={seat.x}
              cy={seat.y}
              r={7}
              fill={STATUS_COLOR[seat.status] ?? '#34d399'}
              stroke={active ? '#ff1268' : '#0f172a'}
              strokeWidth={active ? 2 : 1}
              onPointerDown={(event) => {
                if (canSelectSeat) event.stopPropagation()
              }}
              onClick={() => canSelectSeat && onSeatClick?.(seat)}
              className={canSelectSeat ? 'cursor-pointer' : ''}
            />
          ))}
          <text x={block.x} y={block.y - 16} textAnchor="middle" className="fill-zinc-200 text-[12px] font-semibold">{block.name}</text>
        </g>
      )}
    </g>
  )
}
