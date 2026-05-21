'use client'

import { Copy, FlipHorizontal2, Grid3X3, LayoutGrid, MousePointer2, RotateCcw, Trash2, Users } from 'lucide-react'
import type { SeatBlockDraft, SeatBlockType, SeatLayoutControlsProps } from './types'

const COLORS = ['#34d399', '#60a5fa', '#a78bfa', '#fbbf24', '#fb7185']

export function SeatLayoutControls({
  layout,
  activeBlockKey,
  onSelectBlock,
  onUpdateBlock,
  onAddBlock,
  onDuplicateBlock,
  onMirrorBlock,
  onDeleteBlock,
  onUpdateTicketGroup,
  onUpdateStage,
  onAutoArrange,
}: SeatLayoutControlsProps) {
  const blocks = layout.blocks ?? []
  const activeBlock = blocks.find(block => block.blockKey === activeBlockKey) ?? null
  const activeGroup = activeBlock ? layout.ticketGroups?.find(group => group.groupKey === activeBlock.ticketGroupKey) ?? null : null

  return (
    <aside className="flex h-full w-80 flex-col gap-5 overflow-y-auto border-l border-zinc-800 bg-zinc-900 p-5 text-zinc-100">
      <section>
        <div className="mb-3">
          <div className="text-lg font-semibold">SeatCraft 设计器</div>
          <div className="text-xs text-zinc-500">自由画布编辑，不自动排版</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ToolButton icon={<LayoutGrid className="h-4 w-4" />} label="方阵" onClick={() => onAddBlock?.('gridBlock')} />
          <ToolButton icon={<RotateCcw className="h-4 w-4" />} label="剧场扇形" onClick={() => onAddBlock?.('arcBlock')} />
          <ToolButton icon={<Users className="h-4 w-4" />} label="站区" onClick={() => onAddBlock?.('standingBlock')} />
          <ToolButton icon={<MousePointer2 className="h-4 w-4" />} label="选择" onClick={() => undefined} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-700/70 bg-zinc-800/50 p-4">
        <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#ff1268]">快捷操作</div>
        <div className="grid grid-cols-2 gap-2">
          <ToolButton icon={<Grid3X3 className="h-4 w-4" />} label="一键排版" onClick={onAutoArrange} />
          <ToolButton icon={<Copy className="h-4 w-4" />} label="复制" disabled={!activeBlock} onClick={() => activeBlock && onDuplicateBlock?.(activeBlock.blockKey)} />
          <ToolButton icon={<FlipHorizontal2 className="h-4 w-4" />} label="镜像" disabled={!activeBlock} onClick={() => activeBlock && onMirrorBlock?.(activeBlock.blockKey)} />
          <ToolButton icon={<Trash2 className="h-4 w-4" />} label="删除" disabled={!activeBlock} onClick={() => activeBlock && onDeleteBlock?.(activeBlock.blockKey)} />
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
          <span>图层</span>
          <span>{blocks.length} 个</span>
        </div>
        <div className="space-y-2">
          {blocks.map(block => (
            <button key={block.blockKey} type="button" onClick={() => onSelectBlock?.(block.blockKey)} className={`w-full rounded-xl border px-3 py-3 text-left transition ${activeBlockKey === block.blockKey ? 'border-[#ff1268] bg-[#ff1268]/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-500'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{block.name}</div>
                <span className="text-[10px] text-zinc-500">{labelForType(block.blockType)}</span>
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">{summary(block)}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-700/70 bg-zinc-800/50 p-4">
        <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#ff1268]">舞台</div>
        <TextField label="标题" value={layout.stage.title} onChange={value => onUpdateStage({ title: value })} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <NumberField label="X" value={layout.stage.x} onChange={value => onUpdateStage({ x: value })} />
          <NumberField label="Y" value={layout.stage.y} onChange={value => onUpdateStage({ y: value })} />
        </div>
      </section>

      {activeBlock && (
        <section className="rounded-xl border border-zinc-700/70 bg-zinc-800/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#ff1268]">属性</div>
            <span className="text-[10px] text-zinc-500">{activeBlock.blockKey}</span>
          </div>
          <TextField label="名称" value={activeBlock.name} onChange={value => onUpdateBlock?.(activeBlock.blockKey, { name: value })} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <NumberField label="X" value={activeBlock.x} onChange={value => onUpdateBlock?.(activeBlock.blockKey, { x: value })} />
            <NumberField label="Y" value={activeBlock.y} onChange={value => onUpdateBlock?.(activeBlock.blockKey, { y: value })} />
            <NumberField label="旋转" value={activeBlock.rotation} onChange={value => onUpdateBlock?.(activeBlock.blockKey, { rotation: value })} />
            <ColorField value={activeBlock.color} onChange={value => onUpdateBlock?.(activeBlock.blockKey, { color: value })} />
          </div>
          <BlockSpecificFields block={activeBlock} onUpdate={updates => onUpdateBlock?.(activeBlock.blockKey, updates)} />
          {activeGroup && (
            <div className="mt-4 space-y-3 rounded-lg border border-zinc-700 bg-zinc-900/70 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">票档绑定</div>
              <TextField label="票档组名称" value={activeGroup.name} onChange={value => onUpdateTicketGroup?.(activeGroup.groupKey, { name: value })} />
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="默认价" value={activeGroup.defaultPrice ?? 0} min={0} onChange={value => onUpdateTicketGroup?.(activeGroup.groupKey, { defaultPrice: value })} />
                <NumberField label="活动价" value={activeGroup.activityPrice ?? 0} min={0} onChange={value => onUpdateTicketGroup?.(activeGroup.groupKey, { activityPrice: value })} />
              </div>
            </div>
          )}
        </section>
      )}
    </aside>
  )
}

function BlockSpecificFields({ block, onUpdate }: { block: SeatBlockDraft; onUpdate: (updates: Partial<SeatBlockDraft>) => void }) {
  if (block.blockType === 'standingBlock') {
    return <div className="mt-3 grid grid-cols-3 gap-3"><NumberField label="容量" value={block.capacity ?? 1} min={1} onChange={capacity => onUpdate({ capacity })} /><NumberField label="宽" value={block.width ?? 180} min={1} onChange={width => onUpdate({ width })} /><NumberField label="高" value={block.height ?? 90} min={1} onChange={height => onUpdate({ height })} /></div>
  }
  if (block.blockType === 'arcBlock') {
    return <div className="mt-3 grid grid-cols-2 gap-3"><NumberField label="排数" value={block.rows ?? 1} min={1} onChange={rows => onUpdate({ rows })} /><NumberField label="每排座数" value={block.seatsPerRow ?? 1} min={1} onChange={seatsPerRow => onUpdate({ seatsPerRow })} /><NumberField label="内半径" value={block.innerRadius ?? 120} min={1} onChange={innerRadius => onUpdate({ innerRadius })} /><NumberField label="排距" value={block.rowSpacing ?? 24} min={1} onChange={rowSpacing => onUpdate({ rowSpacing })} /><NumberField label="起始角" value={block.arcStartAngle ?? -60} onChange={arcStartAngle => onUpdate({ arcStartAngle })} /><NumberField label="结束角" value={block.arcEndAngle ?? 60} onChange={arcEndAngle => onUpdate({ arcEndAngle })} /></div>
  }
  return <div className="mt-3 grid grid-cols-2 gap-3"><NumberField label="排数" value={block.rows ?? 1} min={1} onChange={rows => onUpdate({ rows })} /><NumberField label="列数" value={block.cols ?? 1} min={1} onChange={cols => onUpdate({ cols })} /><NumberField label="排距" value={block.rowSpacing ?? 24} min={1} onChange={rowSpacing => onUpdate({ rowSpacing })} /><NumberField label="座距" value={block.seatSpacing ?? 24} min={1} onChange={seatSpacing => onUpdate({ seatSpacing })} /></div>
}

function ToolButton({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="flex items-center justify-center gap-2 rounded-lg bg-zinc-800 px-2 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40">{icon}{label}</button>
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block space-y-1 text-[10px] uppercase text-zinc-500">{label}<input value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#ff1268]" /></label>
}

function NumberField({ label, value, min, onChange }: { label: string; value: number; min?: number; onChange: (value: number) => void }) {
  return <label className="block space-y-1 text-[10px] uppercase text-zinc-500">{label}<input type="number" min={min} value={value} onChange={event => onChange(min != null ? Math.max(min, Number(event.target.value) || min) : Number(event.target.value) || 0)} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#ff1268]" /></label>
}

function ColorField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="block space-y-1 text-[10px] uppercase text-zinc-500">颜色<div className="flex gap-1.5 pt-2">{COLORS.map(color => <button key={color} type="button" onClick={() => onChange(color)} style={{ backgroundColor: color }} className={`h-5 w-5 rounded-full ${value === color ? 'ring-2 ring-white' : 'opacity-60'}`} />)}</div></label>
}

function labelForType(type: SeatBlockType) {
  if (type === 'arcBlock') return '剧场扇形'
  if (type === 'standingBlock') return '站区'
  return '方阵'
}

function summary(block: SeatBlockDraft) {
  if (block.blockType === 'standingBlock') return `容量 ${block.capacity ?? 0} · ${block.width ?? 0}x${block.height ?? 0}`
  if (block.blockType === 'arcBlock') return `${block.rows ?? 0} 排 · 每排 ${block.seatsPerRow ?? 0} 座`
  return `${block.rows ?? 0} 排 · ${block.cols ?? 0} 列`
}
