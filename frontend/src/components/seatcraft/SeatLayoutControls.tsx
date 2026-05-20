'use client'

import { Copy, FlipHorizontal2, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SeatLayoutControlsProps } from './types'

const COLORS = [
  { name: 'Emerald', value: '#34d399' },
  { name: 'Blue', value: '#60a5fa' },
  { name: 'Purple', value: '#a78bfa' },
  { name: 'Amber', value: '#fbbf24' },
  { name: 'Rose', value: '#fb7185' },
]

export function SeatLayoutControls({
  layout,
  activeSectionKey,
  activeBlockKey,
  onSelectSection,
  onSelectBlock,
  onUpdateSection,
  onUpdateBlock,
  onAddSection,
  onAddBlock,
  onDuplicateSection,
  onDuplicateBlock,
  onMirrorBlock,
  onDeleteSection,
  onDeleteBlock,
  onUpdateTicketGroup,
  onUpdateStage,
}: SeatLayoutControlsProps) {
  const blocks = layout.blocks ?? []
  const activeSection = layout.sections.find(section => section.sectionKey === activeSectionKey) || null
  const activeBlock = blocks.find(block => block.blockKey === activeBlockKey) || null

  return (
    <div className="flex h-full w-80 flex-col gap-6 overflow-y-auto border-l border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">SeatCraft 设计器</h2>
          <p className="text-xs text-zinc-500">自由座位块编辑，旧分区暂兼容</p>
        </div>
        <button onClick={() => onAddBlock?.('gridBlock') ?? onAddSection()} className="rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-zinc-100 transition-colors hover:bg-zinc-700" title="添加座位块">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 rounded-xl border border-zinc-700/60 bg-zinc-800/50 p-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">舞台</div>
        <label className="space-y-1 text-[9px] uppercase text-zinc-500">
          标题
          <input value={layout.stage.title} onChange={(e) => onUpdateStage({ title: e.target.value })} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-[9px] uppercase text-zinc-500">
            X
            <input type="number" value={layout.stage.x} onChange={(e) => onUpdateStage({ x: Number(e.target.value) || 0 })} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
          </label>
          <label className="space-y-1 text-[9px] uppercase text-zinc-500">
            Y
            <input type="number" value={layout.stage.y} onChange={(e) => onUpdateStage({ y: Number(e.target.value) || 0 })} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">座位块列表</div>
          <span className="text-[10px] text-zinc-600">{blocks.length} 个</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => onAddBlock?.('gridBlock')} className="rounded-lg bg-zinc-800 px-2 py-2 text-[10px] font-bold text-zinc-300 hover:bg-zinc-700">方阵</button>
          <button type="button" onClick={() => onAddBlock?.('arcBlock')} className="rounded-lg bg-zinc-800 px-2 py-2 text-[10px] font-bold text-zinc-300 hover:bg-zinc-700">圆弧</button>
          <button type="button" onClick={() => onAddBlock?.('standingBlock')} className="rounded-lg bg-zinc-800 px-2 py-2 text-[10px] font-bold text-zinc-300 hover:bg-zinc-700">站区</button>
        </div>
        <div className="space-y-2">
          {blocks.map(block => (
            <button key={block.id} type="button" onClick={() => onSelectBlock?.(block.blockKey)} className={cn('flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors', activeBlockKey === block.blockKey ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600')}>
              <div>
                <div className="text-sm font-semibold text-zinc-100">{block.name}</div>
                <div className="text-[11px] text-zinc-500">{block.blockType === 'standingBlock' ? `${block.capacity ?? 0}人` : block.blockType === 'arcBlock' ? `${block.rows ?? 0}x${block.seatsPerRow ?? 0} · 圆弧` : `${block.rows ?? 0}x${block.cols ?? 0} · 方阵`}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicateBlock?.(block.blockKey) }} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-700 hover:text-emerald-500" title="复制座位块"><Copy className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={(e) => { e.stopPropagation(); onMirrorBlock?.(block.blockKey) }} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-700 hover:text-emerald-500" title="水平镜像"><FlipHorizontal2 className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={(e) => { e.stopPropagation(); onDeleteBlock?.(block.blockKey) }} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-700 hover:text-rose-500" title="删除座位块"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </button>
          ))}
        </div>
      </div>

      {activeBlock && (
        <div className="space-y-4 rounded-xl border border-zinc-700/60 bg-zinc-800/50 p-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">座位块编辑</div>
            <span className="text-[10px] text-zinc-500">{activeBlock.blockKey}</span>
          </div>
          <label className="space-y-1 text-[9px] uppercase text-zinc-500">
            名称
            <input value={activeBlock.name} onChange={(e) => onUpdateBlock?.(activeBlock.blockKey, { name: e.target.value })} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="X" value={activeBlock.x} onChange={value => onUpdateBlock?.(activeBlock.blockKey, { x: value })} />
            <NumberField label="Y" value={activeBlock.y} onChange={value => onUpdateBlock?.(activeBlock.blockKey, { y: value })} />
            <NumberField label="旋转" value={activeBlock.rotation} onChange={value => onUpdateBlock?.(activeBlock.blockKey, { rotation: value })} />
            <label className="space-y-1 text-[9px] uppercase text-zinc-500">
              颜色
              <div className="flex gap-2 pt-2">
                {COLORS.map(color => <button key={color.value} type="button" onClick={() => onUpdateBlock?.(activeBlock.blockKey, { color: color.value })} style={{ backgroundColor: color.value }} className={cn('h-5 w-5 rounded-full ring-offset-2 ring-offset-zinc-900 transition-all', activeBlock.color === color.value ? 'ring-2 ring-white' : 'opacity-50 hover:opacity-100')} title={color.name} />)}
              </div>
            </label>
          </div>
          {activeBlock.blockType !== 'standingBlock' ? (
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="排数" value={activeBlock.rows ?? 1} min={1} onChange={value => onUpdateBlock?.(activeBlock.blockKey, { rows: value })} />
              <NumberField label={activeBlock.blockType === 'arcBlock' ? '每排座数' : '列数'} value={activeBlock.blockType === 'arcBlock' ? activeBlock.seatsPerRow ?? 1 : activeBlock.cols ?? 1} min={1} onChange={value => onUpdateBlock?.(activeBlock.blockKey, activeBlock.blockType === 'arcBlock' ? { seatsPerRow: value } : { cols: value })} />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <NumberField label="容量" value={activeBlock.capacity ?? 1} min={1} onChange={value => onUpdateBlock?.(activeBlock.blockKey, { capacity: value })} />
              <NumberField label="宽" value={activeBlock.width ?? 180} min={1} onChange={value => onUpdateBlock?.(activeBlock.blockKey, { width: value })} />
              <NumberField label="高" value={activeBlock.height ?? 90} min={1} onChange={value => onUpdateBlock?.(activeBlock.blockKey, { height: value })} />
            </div>
          )}
          {activeBlock.blockType === 'arcBlock' && (
            <div className="grid grid-cols-3 gap-3">
              <NumberField label="半径" value={activeBlock.innerRadius ?? 120} min={1} onChange={value => onUpdateBlock?.(activeBlock.blockKey, { innerRadius: value })} />
              <NumberField label="起始角" value={activeBlock.arcStartAngle ?? 15} onChange={value => onUpdateBlock?.(activeBlock.blockKey, { arcStartAngle: value })} />
              <NumberField label="结束角" value={activeBlock.arcEndAngle ?? 165} onChange={value => onUpdateBlock?.(activeBlock.blockKey, { arcEndAngle: value })} />
            </div>
          )}
        </div>
      )}

      {(layout.ticketGroups?.length ?? 0) > 0 && (
        <div className="space-y-3 rounded-xl border border-zinc-700/60 bg-zinc-800/50 p-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">票档价格</div>
            <p className="mt-1 text-[11px] text-zinc-500">按票档组配置默认价和活动价。</p>
          </div>
          <div className="space-y-3">
            {(layout.ticketGroups ?? []).map(group => (
              <div key={group.groupKey} className="rounded-lg border border-zinc-700 bg-zinc-900/70 p-3">
                <label className="space-y-1 text-[9px] uppercase text-zinc-500">
                  名称
                  <input value={group.name} onChange={(e) => onUpdateTicketGroup?.(group.groupKey, { name: e.target.value })} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
                </label>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <NumberField label="默认价" value={group.defaultPrice ?? 0} min={0} onChange={value => onUpdateTicketGroup?.(group.groupKey, { defaultPrice: value })} />
                  <NumberField label="活动价" value={group.activityPrice ?? 0} min={0} onChange={value => onUpdateTicketGroup?.(group.groupKey, { activityPrice: value })} />
                </div>
                <div className="mt-2 text-[10px] text-zinc-600">来源：{group.sourceBlockKeys.join(', ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {layout.sections.length > 0 && (
        <div className="space-y-3 border-t border-zinc-800 pt-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">旧分区列表</div>
            <span className="text-[10px] text-zinc-600">{layout.sections.length} 个</span>
          </div>
          <div className="space-y-2">
            {layout.sections.map(section => (
              <button key={section.id} type="button" onClick={() => onSelectSection(section.sectionKey)} className={cn('flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors', activeSectionKey === section.sectionKey ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600')}>
                <div>
                  <div className="text-sm font-semibold text-zinc-100">{section.name}</div>
                  <div className="text-[11px] text-zinc-500">{section.rows}x{section.cols} · {section.layout === 'curved' ? '圆弧' : '方阵'}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicateSection(section.sectionKey) }} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-700 hover:text-emerald-500" title="复制分区"><Copy className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); onDeleteSection(section.sectionKey) }} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-700 hover:text-rose-500" title="删除分区"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeSection && (
        <div className="space-y-4 rounded-xl border border-zinc-700/60 bg-zinc-800/50 p-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">旧分区编辑</div>
            <span className="text-[10px] text-zinc-500">{activeSection.sectionKey}</span>
          </div>
          <label className="space-y-1 text-[9px] uppercase text-zinc-500">
            名称
            <input value={activeSection.name} onChange={(e) => onUpdateSection(activeSection.sectionKey, { name: e.target.value })} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="行数" value={activeSection.rows} min={1} onChange={value => onUpdateSection(activeSection.sectionKey, { rows: value })} />
            <NumberField label="列数" value={activeSection.cols} min={1} onChange={value => onUpdateSection(activeSection.sectionKey, { cols: value })} />
            <NumberField label="X" value={activeSection.x} onChange={value => onUpdateSection(activeSection.sectionKey, { x: value })} />
            <NumberField label="Y" value={activeSection.y} onChange={value => onUpdateSection(activeSection.sectionKey, { y: value })} />
          </div>
        </div>
      )}
    </div>
  )
}

function NumberField({ label, value, min, onChange }: { label: string; value: number; min?: number; onChange: (value: number) => void }) {
  return (
    <label className="space-y-1 text-[9px] uppercase text-zinc-500">
      {label}
      <input type="number" min={min} value={value} onChange={(e) => onChange(min ? Math.max(min, Number(e.target.value) || min) : Number(e.target.value) || 0)} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
    </label>
  )
}
