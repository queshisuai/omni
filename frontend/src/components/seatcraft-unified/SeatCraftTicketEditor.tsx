'use client'

import { useMemo } from 'react'
import { SeatCraftCanvas } from './SeatCraftCanvas'
import { toUnifiedSeatCraftLayout } from './adapters'
import type { SeatCraftTicketEditorProps } from './types'

export function SeatCraftTicketEditor({
  layout,
  ticketDrafts,
  selectedSectionIds,
  onSelectedSectionIdsChange,
  ticketName,
  ticketPrice,
  onTicketNameChange,
  onTicketPriceChange,
  estimatedStock,
  onSubmit,
}: SeatCraftTicketEditorProps) {
  const unifiedLayout = useMemo(() => toUnifiedSeatCraftLayout(layout), [layout])
  const selectedIdSet = useMemo(() => new Set(selectedSectionIds), [selectedSectionIds])
  const selectedSectionKeys = useMemo(() => unifiedLayout.sections.filter(section => section.id != null && selectedIdSet.has(section.id)).map(section => section.sectionKey), [selectedIdSet, unifiedLayout.sections])
  const boundSectionIds = useMemo(() => new Set(ticketDrafts.filter(section => section.ticketTypeId != null).map(section => section.id)), [ticketDrafts])

  const toggleSection = (sectionKey: string) => {
    const section = unifiedLayout.sections.find(item => item.sectionKey === sectionKey)
    if (!section?.id || boundSectionIds.has(section.id)) return
    const next = new Set(selectedIdSet)
    if (next.has(section.id)) {
      next.delete(section.id)
    } else {
      next.add(section.id)
    }
    onSelectedSectionIdsChange(Array.from(next))
  }

  return (
    <div className="grid min-h-[640px] gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <SeatCraftCanvas
        layout={unifiedLayout}
        mode="ticket"
        selectedSectionKeys={selectedSectionKeys}
        onSectionClick={toggleSection}
      />
      <aside className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff1268]">票档绑定模式</div>
          <h3 className="mt-2 text-xl font-semibold">创建票档</h3>
          <p className="mt-2 text-sm text-zinc-500">在左侧座位图选择一个或多个未绑定分区，再填写票档信息。</p>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block space-y-2 text-sm text-zinc-400">
            票档名称
            <input value={ticketName} onChange={(event) => onTicketNameChange(event.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 outline-none focus:border-[#ff1268]" placeholder="如 VIP 票、看台 A 区" />
          </label>
          <label className="block space-y-2 text-sm text-zinc-400">
            票价
            <input value={ticketPrice} onChange={(event) => onTicketPriceChange(event.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 outline-none focus:border-[#ff1268]" placeholder="如 399" inputMode="decimal" />
          </label>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">已选分区</span>
            <span className="font-semibold text-zinc-100">{selectedSectionIds.length} 个</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-zinc-500">预计库存</span>
            <span className="font-semibold text-[#ff1268]">{estimatedStock}</span>
          </div>
        </div>

        <button type="button" onClick={onSubmit} disabled={selectedSectionIds.length === 0 || !ticketName.trim() || !ticketPrice.trim()} className="mt-6 w-full rounded-xl bg-[#ff1268] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#e60f5d] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400">
          保存票档
        </button>
      </aside>
    </div>
  )
}
