'use client'

import { Copy, FlipHorizontal2, Grid3X3, LayoutGrid, MousePointer2, RotateCcw, Trash2, Users } from 'lucide-react'
import { seatEditDisabledReason } from './seat-selection'
import type { ActiveSeatDetails, ActiveSeatKey, SeatBlockDraft, SeatBlockType, SeatLayoutControlsProps } from './types'
import { buildSeatsForBlock, getSeatCraftPrimaryBindingValue } from './block-layout'
import { useMemo } from 'react'

const COLORS = ['#34d399', '#60a5fa', '#a78bfa', '#fbbf24', '#fb7185']

export function SeatLayoutControls({
  layout,
  activeBlockKey,
  canEditBlockBinding = true,
  onSelectBlock,
  onUpdateBlock,
  onUpdateBlockPrimaryBinding,
  onAddBlock,
  onDuplicateBlock,
  onMirrorBlock,
  onDeleteBlock,
  onUpdateTicketGroup,
  onUpdateStage,
  onAutoArrange,
  activeSeat,
  onSelectSeat,
  onUpdateSeatPosition,
}: SeatLayoutControlsProps) {
  const blocks = layout.blocks ?? []
  const canEditBinding = canEditBlockBinding && activeBlockKey != null
  const activeBlock = blocks.find(block => block.blockKey === activeBlockKey) ?? null
  const primaryGroupKey = getSeatCraftPrimaryBindingValue(layout, activeBlock?.blockKey, canEditBinding)
  const activeGroup = primaryGroupKey ? layout.ticketGroups?.find(group => group.groupKey === primaryGroupKey) ?? null : null
  return (
    <aside className="flex h-full w-full flex-col gap-4 p-4 text-zinc-100">
      {!activeBlock && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">舞台设置</span>
          </div>
          <div className="space-y-3 rounded-lg bg-white/[0.02] p-3 border border-white/5">
            <TextField label="舞台标题" value={layout.stage.title} onChange={value => onUpdateStage({ title: value })} />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <NumberField label="X坐标" value={layout.stage.x} onChange={value => onUpdateStage({ x: value })} />
              <NumberField label="Y坐标" value={layout.stage.y} onChange={value => onUpdateStage({ y: value })} />
            </div>
          </div>
          <div className="text-xs text-zinc-500 mt-4 px-2">请在左侧或画布中选中一个区域以查看其详细属性。</div>
        </section>
      )}

      {activeBlock && (
        <section className="space-y-4">
          {/* Header */}
          <div className="border-b border-white/5 pb-4">
            <TextField label="区域名称" value={activeBlock.name} onChange={value => onUpdateBlock?.(activeBlock.blockKey, { name: value })} />
          </div>

          {/* Info List */}
          <div className="space-y-2.5 text-[11px] text-zinc-400">
            <div className="flex justify-between">
              <span>层级</span>
              <span className="text-zinc-200">看台 {'>'} {activeBlock.name}</span>
            </div>
             <div className="flex justify-between">
               <span>预估容量</span>
               <span className="text-zinc-200">{estimatedCapacity(activeBlock)}</span>
             </div>
            {activeGroup && (
              <div className="flex justify-between">
                <span>票价档位</span>
                <span className="text-zinc-200">{activeGroup.name} (¥{activeGroup.activityPrice ?? activeGroup.defaultPrice ?? 0})</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>类型</span>
              <span className="text-zinc-200">{labelForType(activeBlock.blockType)}</span>
            </div>
          </div>

          {activeSeat && activeSeat.key.blockKey === activeBlock.blockKey && (
            <SeatPositionEditor
              activeSeat={activeSeat}
              onClear={() => onSelectSeat?.(null)}
              onUpdatePosition={onUpdateSeatPosition}
            />
          )}

          <div className="h-px w-full bg-white/5" />

          {/* Quick Actions */}
          <div className="grid grid-cols-4 gap-2">
            <ToolButton icon={<Copy className="h-3.5 w-3.5" />} onClick={() => onDuplicateBlock?.(activeBlock.blockKey)} />
            <ToolButton icon={<FlipHorizontal2 className="h-3.5 w-3.5" />} onClick={() => onMirrorBlock?.(activeBlock.blockKey)} />
            <ToolButton icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => onDeleteBlock?.(activeBlock.blockKey)} />
            <ColorField value={activeBlock.color} onChange={value => onUpdateBlock?.(activeBlock.blockKey, { color: value })} />
          </div>

          {/* Ticket Group Settings */}
          {canEditBinding && (layout.ticketGroups?.length ?? 0) > 0 && (
            <div>
              <div className="mb-3 text-[11px] font-semibold text-zinc-500">票档绑定</div>
              <select
                value={primaryGroupKey}
                onChange={event => onUpdateBlockPrimaryBinding?.(activeBlock.blockKey, event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none transition-all focus:border-[#ff1268] focus:bg-black/40 focus:ring-1 focus:ring-[#ff1268]/50"
              >
                <option value="">未绑定</option>
                {(layout.ticketGroups ?? []).map(group => (
                  <option key={group.groupKey} value={group.groupKey}>{group.name}</option>
                ))}
              </select>
            </div>
          )}

          {activeGroup && (
            <div>
              <div className="mb-3 text-[11px] font-semibold text-zinc-500">票档设置</div>
              <div className="space-y-3 rounded-lg bg-white/[0.02] p-3 border border-white/5">
                <TextField label="票档名称" value={activeGroup.name} onChange={value => onUpdateTicketGroup?.(activeGroup.groupKey, { name: value })} />
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <NumberField label="原价(元)" value={activeGroup.defaultPrice ?? 0} onChange={value => onUpdateTicketGroup?.(activeGroup.groupKey, { defaultPrice: value })} />
                  <NumberField label="活动价(元)" value={activeGroup.activityPrice ?? 0} onChange={value => onUpdateTicketGroup?.(activeGroup.groupKey, { activityPrice: value })} />
                </div>
              </div>
            </div>
          )}

          <div className="h-px w-full bg-white/5" />

          {/* Advanced Properties */}
          <div>
            <div className="mb-3 text-[11px] font-semibold text-zinc-500">高级属性</div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">X / Y</span>
                <div className="flex gap-1 w-32">
                  <input type="number" value={activeBlock.x} onChange={e => onUpdateBlock?.(activeBlock.blockKey, { x: Number(e.target.value) || 0 })} className="w-full bg-white/5 rounded px-2 py-1 text-xs text-white outline-none" />
                  <input type="number" value={activeBlock.y} onChange={e => onUpdateBlock?.(activeBlock.blockKey, { y: Number(e.target.value) || 0 })} className="w-full bg-white/5 rounded px-2 py-1 text-xs text-white outline-none" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">旋转角度</span>
                <input type="number" value={activeBlock.rotation} onChange={e => onUpdateBlock?.(activeBlock.blockKey, { rotation: Number(e.target.value) || 0 })} className="w-32 bg-white/5 rounded px-2 py-1 text-xs text-white outline-none" />
              </div>
              <BlockSpecificFields block={activeBlock} onUpdate={updates => onUpdateBlock?.(activeBlock.blockKey, updates)} />
            </div>
          </div>

          {/* Mini map */}
          <div className="mt-8 pt-4 border-t border-white/5">
            <div className="mb-2 text-[10px] text-zinc-500">缩略图</div>
            <div className="h-32 w-full rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center overflow-hidden">
              <MiniMap block={activeBlock} />
            </div>
          </div>

        </section>
      )}
    </aside>
  )
}

function BlockSpecificFields({ block, onUpdate }: { block: SeatBlockDraft; onUpdate: (updates: Partial<SeatBlockDraft>) => void }) {
  const row = (label: string, val: number | null | undefined, key: keyof SeatBlockDraft) => (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-zinc-400">{label}</span>
      <input type="number" value={val ?? 0} onChange={e => onUpdate({ [key]: Number(e.target.value) || 0 })} className="w-32 bg-white/5 rounded px-2 py-1 text-xs text-white outline-none" />
    </div>
  )
  if (block.blockType === 'standingBlock') {
    return <>{row('容量', block.capacity, 'capacity')}{row('宽', block.width, 'width')}{row('高', block.height, 'height')}</>
  }
  if (block.blockType === 'arcBlock') {
    return <>{row('排数', block.rows, 'rows')}{row('每排座数', block.seatsPerRow, 'seatsPerRow')}{row('排距', block.rowSpacing, 'rowSpacing')}{row('座距', block.seatSpacing, 'seatSpacing')}{row('内半径', block.innerRadius, 'innerRadius')}{row('起始角', block.arcStartAngle, 'arcStartAngle')}{row('结束角', block.arcEndAngle, 'arcEndAngle')}</>
  }
  if (block.blockType === 'polygonBlock') {
    return <>{row('排距', block.rowSpacing, 'rowSpacing')}{row('座距', block.seatSpacing, 'seatSpacing')}<ReadonlyRow label="顶点数" value={`${block.polygonPoints?.length ?? 0}`} /></>
  }
  return <>{row('排数', block.rows, 'rows')}{row('列数', block.cols, 'cols')}{row('排距', block.rowSpacing, 'rowSpacing')}{row('座距', block.seatSpacing, 'seatSpacing')}</>
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="text-[11px] text-zinc-400">{label}</span><span className="w-32 rounded bg-white/5 px-2 py-1 text-xs text-zinc-300">{value}</span></div>
}

function SeatPositionEditor({
  activeSeat,
  onClear,
  onUpdatePosition,
}: {
  activeSeat: ActiveSeatDetails
  onClear: () => void
  onUpdatePosition?: (seatKey: ActiveSeatKey, x: number, y: number) => void
}) {
  const { key, blockName, seat } = activeSeat
  const reason = seatEditDisabledReason(seat)
  const editable = reason == null
  const dx = seat.baseX == null ? 0 : seat.x - seat.baseX
  const dy = seat.baseY == null ? 0 : seat.y - seat.baseY

  const updateX = (value: number) => {
    if (!editable) return
    onUpdatePosition?.(key, value, seat.y)
  }
  const updateY = (value: number) => {
    if (!editable) return
    onUpdatePosition?.(key, seat.x, value)
  }

  return (
    <div className="rounded-lg border border-[#ff1268]/25 bg-[#ff1268]/5 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold text-white">座位属性</div>
          <div className="mt-0.5 text-[10px] text-zinc-500">{blockName} · 第 {key.rowNo} 排 · 第 {key.seatNo} 座</div>
        </div>
        <button type="button" onClick={onClear} className="text-[10px] text-zinc-500 hover:text-white">取消</button>
      </div>
      <div className="space-y-2 text-[11px] text-zinc-400">
        <div className="flex justify-between"><span>状态</span><span className="text-zinc-200">{formatSeatStatus(seat.status)}</span></div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X坐标" value={Math.round(seat.x)} disabled={!editable} onChange={updateX} />
          <NumberField label="Y坐标" value={Math.round(seat.y)} disabled={!editable} onChange={updateY} />
        </div>
        {!editable && <div className="rounded-md bg-black/20 px-2 py-1 text-[10px] text-amber-300">{reason}</div>}
        <div className="grid grid-cols-2 gap-2">
          <ReadonlyRow label="基准X" value={`${Math.round(seat.baseX ?? 0)}`} />
          <ReadonlyRow label="基准Y" value={`${Math.round(seat.baseY ?? 0)}`} />
          <ReadonlyRow label="偏移X" value={`${Math.round(dx)}`} />
          <ReadonlyRow label="偏移Y" value={`${Math.round(dy)}`} />
        </div>
      </div>
    </div>
  )
}

function ToolButton({ icon, onClick, disabled }: { icon: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="flex h-8 w-full items-center justify-center rounded-md border border-white/5 bg-white/5 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40">{icon}</button>
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block space-y-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">{label}<input value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none transition-all focus:border-[#ff1268] focus:bg-black/40 focus:ring-1 focus:ring-[#ff1268]/50" /></label>
}

function NumberField({ label, value, min, disabled, onChange }: { label: string; value: number; min?: number; disabled?: boolean; onChange: (value: number) => void }) {
  return <label className="block space-y-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">{label}<input type="number" min={min} disabled={disabled} value={value} onChange={event => onChange(min != null ? Math.max(min, Number(event.target.value) || min) : Number(event.target.value) || 0)} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none transition-all focus:border-[#ff1268] focus:bg-black/40 focus:ring-1 focus:ring-[#ff1268]/50 disabled:cursor-not-allowed disabled:opacity-50" /></label>
}

function ColorField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="flex items-center justify-center gap-1 rounded-md border border-white/5 bg-white/5">{COLORS.map(color => <button key={color} type="button" onClick={() => onChange(color)} style={{ backgroundColor: color }} className={`h-3 w-3 rounded-full transition-all ${value === color ? 'ring-1 ring-white ring-offset-1 ring-offset-[#1a1a1a] scale-110' : 'opacity-60 hover:opacity-100'}`} />)}</div>
}

function labelForType(type: SeatBlockType) {
  if (type === 'arcBlock') return '剧场扇形'
  if (type === 'standingBlock') return '站区'
  if (type === 'polygonBlock') return '多边形区'
  return '方阵'
}

function formatSeatStatus(status: string | null | undefined) {
  if (status === 'available') return '可售'
  if (status === 'reserved') return '已锁定'
  if (status === 'selected') return '已选中'
  if (status === 'occupied') return '已占用'
  if (status === 'deleted') return '已删除'
  return '未知座位状态'
}

function estimatedCapacity(block: SeatBlockDraft) {
  if (block.blockType === 'polygonBlock') return buildSeatsForBlock(block, [], true).length
  return block.capacity ?? ((block.rows ?? 0) * (block.cols ?? block.seatsPerRow ?? 0))
}

function summary(block: SeatBlockDraft) {
  if (block.blockType === 'standingBlock') return `容量 ${block.capacity ?? 0} · ${block.width ?? 0}x${block.height ?? 0}`
  if (block.blockType === 'arcBlock') return `${block.rows ?? 0} 排`
  if (block.blockType === 'polygonBlock') return `${buildSeatsForBlock(block, [], true).length} 座 · ${block.polygonPoints?.length ?? 0} 顶点`
  return `${block.rows ?? 0} 排 · ${block.cols ?? 0} 列`
}

function MiniMap({ block }: { block: SeatBlockDraft }) {
  const seats = useMemo(() => buildSeatsForBlock(block, [], true), [block])

  const viewBox = useMemo(() => {
    if (block.blockType === 'polygonBlock') {
      const points = block.polygonPoints ?? []
      if (points.length >= 3) {
        const worldPoints = points.map(point => polygonLocalToWorld(block, point.x, point.y))
        const minX = Math.min(...worldPoints.map(point => point.x))
        const maxX = Math.max(...worldPoints.map(point => point.x))
        const minY = Math.min(...worldPoints.map(point => point.y))
        const maxY = Math.max(...worldPoints.map(point => point.y))
        return `${minX - 20} ${minY - 20} ${maxX - minX + 40} ${maxY - minY + 40}`
      }
    }
    if (block.blockType === 'standingBlock') {
      const w = (block.width ?? 180) + 40
      const h = (block.height ?? 90) + 40
      return `${block.x - 20} ${block.y - 20} ${w} ${h}`
    }
    if (seats.length === 0) return `${block.x - 50} ${block.y - 50} 100 100`

    let minX = seats[0].x, maxX = seats[0].x, minY = seats[0].y, maxY = seats[0].y
    seats.forEach(s => {
      minX = Math.min(minX, s.x)
      maxX = Math.max(maxX, s.x)
      minY = Math.min(minY, s.y)
      maxY = Math.max(maxY, s.y)
    })

    const corners = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: minX, y: maxY },
      { x: maxX, y: maxY },
    ]

    const angleRad = (block.rotation || 0) * Math.PI / 180
    const cos = Math.cos(angleRad)
    const sin = Math.sin(angleRad)

    let rMinX = Infinity, rMaxX = -Infinity, rMinY = Infinity, rMaxY = -Infinity
    corners.forEach(c => {
      const dx = c.x - block.x
      const dy = c.y - block.y
      const rx = block.x + dx * cos - dy * sin
      const ry = block.y + dx * sin + dy * cos
      rMinX = Math.min(rMinX, rx)
      rMaxX = Math.max(rMaxX, rx)
      rMinY = Math.min(rMinY, ry)
      rMaxY = Math.max(rMaxY, ry)
    })

    const w = rMaxX - rMinX + 40
    const h = rMaxY - rMinY + 40
    return `${rMinX - 20} ${rMinY - 20} ${w} ${h}`
  }, [block, seats])

  return (
    <svg viewBox={viewBox} className="w-full h-full p-2">
      <g transform={block.blockType === 'polygonBlock' ? undefined : `rotate(${block.rotation || 0} ${block.x} ${block.y})`}>
        {block.blockType === 'polygonBlock' && (block.polygonPoints?.length ?? 0) >= 3 ? (
          <>
            <polygon points={(block.polygonPoints ?? []).map(point => polygonLocalToWorld(block, point.x, point.y)).map(point => `${point.x},${point.y}`).join(' ')} fill={block.color} fillOpacity={0.15} stroke={block.color} strokeWidth={4} />
            {seats.map(seat => <circle key={seat.id} cx={seat.x} cy={seat.y} r={(block.seatSpacing ?? 24) * 0.25} fill={seat.status === 'deleted' ? 'transparent' : block.color} stroke={seat.status === 'deleted' ? '#555' : 'none'} strokeWidth={1.5} />)}
          </>
        ) : block.blockType === 'standingBlock' ? (
          <rect x={block.x} y={block.y} width={block.width ?? 180} height={block.height ?? 90} fill={block.color} fillOpacity={0.2} stroke={block.color} strokeWidth={4} rx={8} />
        ) : (
          seats.map(seat => (
            <circle
              key={seat.id}
              cx={seat.x}
              cy={seat.y}
              r={(block.seatSpacing ?? 24) * 0.35}
              fill={seat.status === 'deleted' ? 'transparent' : block.color}
              stroke={seat.status === 'deleted' ? '#555' : 'none'}
              strokeWidth={1.5}
            />
          ))
        )}
      </g>
    </svg>
  )
}

function polygonLocalToWorld(block: SeatBlockDraft, x: number, y: number) {
  const points = block.polygonPoints ?? []
  if ((block.rotation || 0) === 0 || points.length < 3) {
    return { x: block.x + x, y: block.y + y }
  }
  const minX = Math.min(...points.map(point => point.x))
  const maxX = Math.max(...points.map(point => point.x))
  const minY = Math.min(...points.map(point => point.y))
  const maxY = Math.max(...points.map(point => point.y))
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const radians = (block.rotation || 0) * Math.PI / 180
  const dx = x - cx
  const dy = y - cy
  return {
    x: block.x + cx + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: block.y + cy + dx * Math.sin(radians) + dy * Math.cos(radians),
  }
}
