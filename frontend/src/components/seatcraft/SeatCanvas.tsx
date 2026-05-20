'use client'

import { useMemo } from 'react'
import { Move } from 'lucide-react'
import { motion } from 'motion/react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { cn } from '@/lib/utils'
import { buildSeatsForBlock } from './block-layout'
import { buildSeatsForSection, isPrimeSeat } from './layout'
import type { SeatBlockDraft, SeatCanvasProps, SeatCraftSeat, SeatCraftSection } from './types'

function Seat({ seat, onClick, color, isPrime }: { seat: SeatCraftSeat; onClick?: (seat: SeatCraftSeat) => void; color: string; isPrime?: boolean }) {
  const selected = seat.status === 'selected'
  const occupied = seat.status === 'occupied' || seat.status === 'reserved'
  const fill = selected ? '#ffffff' : occupied ? '#27272a' : isPrime ? '#fbbf24' : color
  const stroke = selected ? '#ffffff' : occupied ? '#3f3f46' : color

  return (
    <motion.rect
      x={seat.x - 6}
      y={seat.y - 6}
      width={12}
      height={12}
      rx={3}
      fill={fill}
      stroke={stroke}
      strokeWidth={selected ? 1.5 : 1}
      transform={`rotate(${seat.angle}, ${seat.x}, ${seat.y})`}
      className={cn(
        'transition-all duration-300',
        occupied ? 'pointer-events-none opacity-40' : 'cursor-pointer',
        selected && 'drop-shadow-[0_0_12px_rgba(255,255,255,1)]',
      )}
      onClick={() => onClick?.(seat)}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.25 }}
      whileTap={{ scale: 0.85 }}
    >
      <title>{`${seat.sectionName} - ${seat.label}`}</title>
    </motion.rect>
  )
}

function buildCurvedPath(section: SeatCraftSection) {
  const innerRadius = section.radius ?? 200
  const seatSpacing = 16
  const r1 = innerRadius - 20
  const r2 = r1 + section.rows * seatSpacing + 30
  const span = section.arcSpan ?? 120
  const rad = ((span + 2) / 2) * Math.PI / 180
  const shiftY = innerRadius

  const x1 = r1 * Math.sin(-rad)
  const y1 = -r1 * Math.cos(-rad) + shiftY
  const x2 = r1 * Math.sin(rad)
  const y2 = -r1 * Math.cos(rad) + shiftY
  const x3 = r2 * Math.sin(rad)
  const y3 = -r2 * Math.cos(rad) + shiftY
  const x4 = r2 * Math.sin(-rad)
  const y4 = -r2 * Math.cos(-rad) + shiftY
  const largeArc = span > 180 ? 1 : 0

  return `M ${x1} ${y1} A ${r1} ${r1} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${r2} ${r2} 0 ${largeArc} 0 ${x4} ${y4} Z`
}

export function SeatCanvas({
  sections,
  blocks = [],
  stage,
  selectedSeatIds = [],
  sectionSeats,
  isDesignMode,
  onSeatClick,
  onSectionMove,
  onBlockMove,
  onStageMove,
  activeSectionKey,
  activeBlockKey,
  stageTitle = '舞台',
}: SeatCanvasProps) {
  const hasPrimeArea = useMemo(() => sections.some(section => section.primeRowStart != null && section.primeColStart != null), [sections])
  const uniqueColors = useMemo(() => Array.from(new Set([...sections.map(section => section.color), ...blocks.map(block => block.color)])), [blocks, sections])

  const renderBlock = (block: SeatBlockDraft) => {
    const seats = buildSeatsForBlock(block, selectedSeatIds)
    const width = block.width ?? Math.max(120, (block.cols ?? block.seatsPerRow ?? 1) * (block.seatSpacing ?? 24))
    const height = block.height ?? Math.max(80, (block.rows ?? 1) * (block.rowSpacing ?? 24))
    const selected = activeBlockKey === block.blockKey

    return (
      <motion.g
        key={block.id}
        drag={isDesignMode}
        dragMomentum={false}
        onDragEnd={(_, info) => onBlockMove?.(block.blockKey, block.x + info.offset.x, block.y + info.offset.y)}
        initial={false}
        animate={{ rotate: block.rotation || 0 }}
        className={cn('group transition-none', isDesignMode ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none')}
      >
        {block.blockType === 'standingBlock' ? (
          <rect
            x={block.x - width / 2}
            y={block.y - height / 2}
            width={width}
            height={height}
            rx={16}
            fill={block.color}
            className={cn('opacity-35 stroke-zinc-800/80 transition-all duration-300', selected && 'stroke-emerald-500/90')}
          />
        ) : (
          <rect
            x={block.x - 18}
            y={block.y - 34}
            width={width + 36}
            height={height + 48}
            rx={12}
            className={cn('fill-zinc-900/30 stroke-zinc-800/80 transition-all duration-300', selected && 'stroke-emerald-500/90')}
          />
        )}

        <text
          x={block.x}
          y={block.blockType === 'standingBlock' ? block.y + 4 : block.y - 18}
          textAnchor="middle"
          className="pointer-events-none select-none text-[10px] font-bold font-mono uppercase tracking-widest fill-zinc-300"
        >
          {block.name}{block.blockType === 'standingBlock' && block.capacity ? ` · ${block.capacity}人` : ''}
        </text>

        <g className={cn(!isDesignMode && 'pointer-events-auto')}>
          {seats.map(seat => (
            <Seat key={seat.id} seat={seat} onClick={onSeatClick} color={block.color} />
          ))}
        </g>
      </motion.g>
    )
  }

  const renderSection = (section: SeatCraftSection) => {
    const seats = sectionSeats?.[section.sectionKey] ?? buildSeatsForSection(section, selectedSeatIds)
    const width = section.cols * 16
    const height = section.rows * 16

    return (
      <motion.g
        key={section.id}
        drag={isDesignMode}
        dragMomentum={false}
        onDragEnd={(_, info) => onSectionMove?.(section.sectionKey, section.x + info.offset.x, section.y + info.offset.y)}
        initial={false}
        animate={{ x: section.x, y: section.y, rotate: section.rotation || 0 }}
        className={cn('group transition-none', isDesignMode ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none')}
      >
        {section.layout !== 'curved' ? (
          <rect
            x={-width / 2 - 12}
            y={-35}
            width={width + 24}
            height={height + 45}
            rx={12}
            className={cn(
              'fill-zinc-900/40 stroke-zinc-800/80 transition-all duration-300',
              activeSectionKey === section.sectionKey ? 'stroke-emerald-500/90' : isDesignMode ? 'hover:stroke-emerald-500/50' : 'group-hover:stroke-zinc-700',
            )}
          />
        ) : (
          <path
            d={buildCurvedPath(section)}
            className={cn(
              'fill-zinc-900/40 stroke-zinc-800/80 transition-all duration-300',
              activeSectionKey === section.sectionKey ? 'stroke-emerald-500/90' : isDesignMode ? 'hover:stroke-emerald-500/50' : 'group-hover:stroke-zinc-700',
            )}
          />
        )}

        {section.layout !== 'curved' && (
          <path
            d={`M ${-width / 2 - 12} -35 L ${width / 2 + 12} -35`}
            className={cn(
              'stroke-[2px] opacity-50',
              section.type === 'core' ? 'stroke-emerald-500' : section.type === 'stand' ? 'stroke-blue-500' : 'stroke-purple-500',
            )}
          />
        )}

        <text
          x={0}
          y={section.layout === 'curved' ? -35 : -18}
          textAnchor="middle"
          className="pointer-events-none select-none text-[10px] font-bold font-mono uppercase tracking-widest fill-zinc-400"
        >
          {section.name}
        </text>

        <g className={cn(!isDesignMode && 'pointer-events-auto')}>
          {seats.map(seat => (
            <Seat
              key={seat.id}
              seat={seat}
              onClick={onSeatClick}
              color={section.color}
              isPrime={isPrimeSeat(section, seat.row, seat.col)}
            />
          ))}
        </g>
      </motion.g>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
      <TransformWrapper initialScale={1} minScale={0.5} maxScale={4} centerOnInit disabled={isDesignMode}>
        <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full flex items-center justify-center">
          <svg viewBox="0 0 1000 800" className="h-full w-full select-none p-12">
            {isDesignMode && (
              <defs>
                <pattern id="seatcraft-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                </pattern>
              </defs>
            )}
            {isDesignMode && <rect width="100%" height="100%" fill="url(#seatcraft-grid)" />}

            <motion.g
              drag={isDesignMode}
              dragMomentum={false}
              onDragEnd={(_, info) => onStageMove?.(stage.x + info.offset.x, stage.y + info.offset.y)}
              initial={false}
              animate={{ x: stage.x, y: stage.y }}
              className={cn(isDesignMode ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none')}
            >
              <defs>
                <linearGradient id="seatcraft-stage-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stageTitle.includes('银幕') || stageTitle.includes('SCREEN') ? '#f8fafc' : '#3f3f46'} />
                  <stop offset="100%" stopColor={stageTitle.includes('银幕') || stageTitle.includes('SCREEN') ? '#cbd5e1' : '#09090b'} />
                </linearGradient>
              </defs>
              <rect
                x={-200}
                y={0}
                width={400}
                height={80}
                rx={8}
                fill="url(#seatcraft-stage-gradient)"
                className={cn('stroke-zinc-700 stroke-[2px]', (stageTitle.includes('银幕') || stageTitle.includes('SCREEN')) && 'stroke-zinc-400 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]')}
              />
              {!(stageTitle.includes('银幕') || stageTitle.includes('SCREEN')) && (
                <path d="M -160 80 L 160 80" fill="none" className="stroke-emerald-500/50 stroke-[3px]" />
              )}
              <text
                x={0}
                y={55}
                textAnchor="middle"
                className={cn('font-mono uppercase tracking-[0.5em]', (stageTitle.includes('银幕') || stageTitle.includes('SCREEN')) ? 'fill-zinc-400 text-[8px]' : 'fill-zinc-500 text-[10px]')}
              >
                {stageTitle.includes('银幕') || stageTitle.includes('SCREEN') ? 'PROJECTION ZONE' : '舞台中心'}
              </text>
              <text
                x={0}
                y={35}
                textAnchor="middle"
                className={cn('text-xl font-bold tracking-[0.2em]', (stageTitle.includes('银幕') || stageTitle.includes('SCREEN')) ? 'fill-zinc-950' : 'fill-zinc-100')}
              >
                {stageTitle}
              </text>
            </motion.g>

            <g>{sections.map(section => renderSection(section))}</g>
            <g>{blocks.map(block => renderBlock(block))}</g>
          </svg>
        </TransformComponent>
      </TransformWrapper>

      {isDesignMode && (
        <div className="absolute right-6 top-6 flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 animate-pulse">
          <Move className="h-3 w-3" /> 设计模式已开启
        </div>
      )}

      <div className="absolute bottom-10 left-1/2 z-20 flex -translate-x-1/2 items-center gap-8 whitespace-nowrap rounded-2xl border border-white/5 bg-zinc-900/90 px-8 py-3 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex -space-x-1">
            {uniqueColors.map((color, index) => (
              <div key={color} className="h-3.5 w-3.5 rounded-sm ring-2 ring-zinc-950 shadow-sm" style={{ backgroundColor: color, zIndex: uniqueColors.length - index }} />
            ))}
          </div>
          <span className="pl-1 text-[11px] font-bold uppercase tracking-widest text-zinc-400">可选</span>
        </div>

        {hasPrimeArea && (
          <div className="flex items-center gap-2.5">
            <div className="h-3.5 w-3.5 rounded-sm bg-[#fbbf24] ring-1 ring-[#f59e0b]/50 shadow-[0_0_10px_rgba(251,191,36,0.3)]" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">优选</span>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <div className="h-3.5 w-3.5 rounded-sm bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-200">已选</span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="h-3.5 w-3.5 rounded-sm border border-zinc-700 bg-zinc-800 opacity-60" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">售罄</span>
        </div>
      </div>
    </div>
  )
}
