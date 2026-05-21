'use client'

import { Armchair, Edit3, Tags } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SeatCraftControlsProps, SelectionMode } from './types'

const MODES: Array<{ mode: SelectionMode; label: string; description: string; icon: typeof Edit3 }> = [
  { mode: 'design', label: '设计', description: '编辑场地图形', icon: Edit3 },
  { mode: 'selection', label: '选座', description: 'C 端购票选座', icon: Armchair },
  { mode: 'ticket', label: '票档', description: '绑定分区票档', icon: Tags },
]

export function SeatCraftControls({ mode, onModeChange, summary, children }: SeatCraftControlsProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/95 p-2">
      <div className="flex flex-wrap gap-2">
        {MODES.map((item) => {
          const Icon = item.icon
          const active = item.mode === mode
          return (
            <button
              key={item.mode}
              type="button"
              onClick={() => onModeChange(item.mode)}
              className={cn('flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors', active ? 'bg-[#ff1268] text-white shadow-lg shadow-[#ff1268]/20' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100')}
            >
              <Icon className="h-4 w-4" />
              <span>
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className={cn('block text-[11px]', active ? 'text-white/75' : 'text-zinc-500')}>{item.description}</span>
              </span>
            </button>
          )
        })}
      </div>
      {summary && <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 text-sm text-zinc-300">{summary}</div>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}
