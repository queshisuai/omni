'use client'

import { Copy, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SeatLayoutControlsProps } from './types'

const COLORS = [
  { name: 'Emerald', value: '#34d399' },
  { name: 'Blue', value: '#60a5fa' },
  { name: 'Purple', value: '#a78bfa' },
  { name: 'Amber', value: '#fbbf24' },
  { name: 'Rose', value: '#fb7185' },
]

const TYPES = [
  { id: 'core', label: '核心' },
  { id: 'stand', label: '看台' },
  { id: 'zone', label: '普通' },
] as const

export function SeatLayoutControls({
  layout,
  activeSectionKey,
  onSelectSection,
  onUpdateSection,
  onAddSection,
  onDuplicateSection,
  onDeleteSection,
  onUpdateStage,
}: SeatLayoutControlsProps) {
  const activeSection = layout.sections.find(section => section.sectionKey === activeSectionKey) || null

  return (
    <div className="flex h-full w-80 flex-col gap-6 overflow-y-auto border-l border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">SeatCraft 设计器</h2>
          <p className="text-xs text-zinc-500">本地编辑，不直接提交接口</p>
        </div>
        <button onClick={onAddSection} className="rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-zinc-100 transition-colors hover:bg-zinc-700" title="添加分区">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 rounded-xl border border-zinc-700/60 bg-zinc-800/50 p-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">舞台</div>
        <label className="space-y-1 text-[9px] uppercase text-zinc-500">
          标题
          <input
            value={layout.stage.title}
            onChange={(e) => onUpdateStage({ title: e.target.value })}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-[9px] uppercase text-zinc-500">
            X
            <input
              type="number"
              value={layout.stage.x}
              onChange={(e) => onUpdateStage({ x: Number(e.target.value) || 0 })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
          </label>
          <label className="space-y-1 text-[9px] uppercase text-zinc-500">
            Y
            <input
              type="number"
              value={layout.stage.y}
              onChange={(e) => onUpdateStage({ y: Number(e.target.value) || 0 })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">分区列表</div>
          <span className="text-[10px] text-zinc-600">{layout.sections.length} 个</span>
        </div>
        <div className="space-y-2">
          {layout.sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelectSection(section.sectionKey)}
              className={cn(
                'flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors',
                activeSectionKey === section.sectionKey ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600',
              )}
            >
              <div>
                <div className="text-sm font-semibold text-zinc-100">{section.name}</div>
                <div className="text-[11px] text-zinc-500">{section.rows}x{section.cols} · {section.layout === 'curved' ? '圆弧' : '方阵'}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicateSection(section.sectionKey) }} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-700 hover:text-emerald-500" title="复制分区">
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); onDeleteSection(section.sectionKey) }} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-700 hover:text-rose-500" title="删除分区">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </button>
          ))}
        </div>
      </div>

      {activeSection && (
        <div className="space-y-4 rounded-xl border border-zinc-700/60 bg-zinc-800/50 p-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">分区编辑</div>
            <span className="text-[10px] text-zinc-500">{activeSection.sectionKey}</span>
          </div>

          <label className="space-y-1 text-[9px] uppercase text-zinc-500">
            名称
            <input
              value={activeSection.name}
              onChange={(e) => onUpdateSection(activeSection.sectionKey, { name: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-[9px] uppercase text-zinc-500">
              行数
              <input type="number" min={1} value={activeSection.rows} onChange={(e) => onUpdateSection(activeSection.sectionKey, { rows: Math.max(1, Number(e.target.value) || 1) })} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
            </label>
            <label className="space-y-1 text-[9px] uppercase text-zinc-500">
              列数
              <input type="number" min={1} value={activeSection.cols} onChange={(e) => onUpdateSection(activeSection.sectionKey, { cols: Math.max(1, Number(e.target.value) || 1) })} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-[9px] uppercase text-zinc-500">
              X
              <input type="number" value={activeSection.x} onChange={(e) => onUpdateSection(activeSection.sectionKey, { x: Number(e.target.value) || 0 })} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
            </label>
            <label className="space-y-1 text-[9px] uppercase text-zinc-500">
              Y
              <input type="number" value={activeSection.y} onChange={(e) => onUpdateSection(activeSection.sectionKey, { y: Number(e.target.value) || 0 })} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-[9px] uppercase text-zinc-500">
              类型
              <div className="grid grid-cols-3 gap-1">
                {TYPES.map((type) => (
                  <button key={type.id} type="button" onClick={() => onUpdateSection(activeSection.sectionKey, { type: type.id })} className={cn('rounded-md px-2 py-1 text-[10px] font-bold', activeSection.type === type.id ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-700 text-zinc-400')}>
                    {type.label}
                  </button>
                ))}
              </div>
            </label>
            <label className="space-y-1 text-[9px] uppercase text-zinc-500">
              颜色
              <div className="flex gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => onUpdateSection(activeSection.sectionKey, { color: color.value })}
                    style={{ backgroundColor: color.value }}
                    className={cn('h-5 w-5 rounded-full ring-offset-2 ring-offset-zinc-900 transition-all', activeSection.color === color.value ? 'ring-2 ring-white' : 'opacity-50 hover:opacity-100')}
                    title={color.name}
                  />
                ))}
              </div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onUpdateSection(activeSection.sectionKey, { layout: 'grid' })} className={cn('rounded-lg px-3 py-2 text-[10px] font-bold', activeSection.layout === 'grid' ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-700 text-zinc-400')}>方阵</button>
            <button type="button" onClick={() => onUpdateSection(activeSection.sectionKey, { layout: 'curved' })} className={cn('rounded-lg px-3 py-2 text-[10px] font-bold', activeSection.layout === 'curved' ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-700 text-zinc-400')}>圆弧</button>
          </div>

          {activeSection.layout === 'curved' && (
            <div className="space-y-3 pt-1">
              <label className="space-y-1 text-[9px] uppercase text-zinc-500">
                半径
                <input type="number" value={activeSection.radius ?? 200} onChange={(e) => onUpdateSection(activeSection.sectionKey, { radius: Number(e.target.value) || 200 })} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
              </label>
              <label className="space-y-1 text-[9px] uppercase text-zinc-500">
                弯曲跨度
                <input type="number" value={activeSection.arcSpan ?? 120} onChange={(e) => onUpdateSection(activeSection.sectionKey, { arcSpan: Number(e.target.value) || 120 })} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
              </label>
            </div>
          )}

          {activeSection.layout === 'grid' && (
            <div className="space-y-3 pt-1 border-t border-zinc-700/50">
              <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">核心优选区</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-[9px] uppercase text-zinc-500">
                  始排
                  <input type="number" value={activeSection.primeRowStart ?? ''} onChange={(e) => onUpdateSection(activeSection.sectionKey, { primeRowStart: e.target.value ? Number(e.target.value) : null })} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
                </label>
                <label className="space-y-1 text-[9px] uppercase text-zinc-500">
                  末排
                  <input type="number" value={activeSection.primeRowEnd ?? ''} onChange={(e) => onUpdateSection(activeSection.sectionKey, { primeRowEnd: e.target.value ? Number(e.target.value) : null })} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
                </label>
                <label className="space-y-1 text-[9px] uppercase text-zinc-500">
                  始座
                  <input type="number" value={activeSection.primeColStart ?? ''} onChange={(e) => onUpdateSection(activeSection.sectionKey, { primeColStart: e.target.value ? Number(e.target.value) : null })} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
                </label>
                <label className="space-y-1 text-[9px] uppercase text-zinc-500">
                  末座
                  <input type="number" value={activeSection.primeColEnd ?? ''} onChange={(e) => onUpdateSection(activeSection.sectionKey, { primeColEnd: e.target.value ? Number(e.target.value) : null })} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500" />
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
