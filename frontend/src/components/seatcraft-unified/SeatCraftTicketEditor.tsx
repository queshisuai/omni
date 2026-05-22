'use client'

import { useMemo } from 'react'
import { SeatCraftCanvas } from './SeatCraftCanvas'
import { toUnifiedSeatCraftLayout } from './adapters'
import type { SeatCraftTicketEditorProps } from './types'
import { buildSeatsForBlock } from '@/components/seatcraft/block-layout'

export function SeatCraftTicketEditor({
  layout,
  selectedSectionIds,
  onSelectedSectionIdsChange,
  ticketName,
  ticketPrice,
  onTicketNameChange,
  onTicketPriceChange,
  estimatedSeatCount,
  onSubmit,
  allowSubmitWithoutSelection = false,
  submitLabel = '保存票档',
}: SeatCraftTicketEditorProps) {
  const unifiedLayout = useMemo(() => toUnifiedSeatCraftLayout(layout), [layout])
  const selectedIdSet = useMemo(() => new Set(selectedSectionIds), [selectedSectionIds])
  const selectedBlockKeys = useMemo(() => unifiedLayout.blocks.filter((_, index) => selectedIdSet.has(index + 1)).map(block => block.blockKey), [selectedIdSet, unifiedLayout.blocks])
  const selectedBlocks = useMemo(() => unifiedLayout.blocks.filter(block => selectedBlockKeys.includes(block.blockKey)), [selectedBlockKeys, unifiedLayout.blocks])
  const blockStock = useMemo(() => selectedBlocks.reduce((sum, block) => sum + (block.blockType === 'standingBlock' ? block.capacity ?? 0 : buildSeatsForBlock(block).length), 0), [selectedBlocks])

  const toggleBlock = (blockKey: string) => {
    const index = unifiedLayout.blocks.findIndex(item => item.blockKey === blockKey)
    if (index < 0) return
    const id = index + 1
    const next = new Set(selectedIdSet)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    onSelectedSectionIdsChange(Array.from(next))
  }

  if (unifiedLayout.blocks.length === 0 && layout.sections.length > 0) {
    return <div className="rounded-2xl border border-dashed border-[#ffd9e6] bg-white p-8 text-center text-[14px] text-[#999]">请进入场次座位设计器重新创建座位图。</div>
  }

  return (
    <div className="grid min-h-[640px] gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <SeatCraftCanvas
        layout={unifiedLayout}
        mode="ticket"
        selectedBlockKeys={selectedBlockKeys}
        onBlockClick={toggleBlock}
      />
      <aside className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff1268]">票档绑定模式</div>
          <h3 className="mt-2 text-xl font-semibold">{selectedSectionIds.length === 0 ? '创建/编辑票档' : '创建票档'}</h3>
          <p className="mt-2 text-sm text-zinc-500">在左侧座位图选择一个或多个方阵、剧场扇形或站区，再填写票档信息。</p>
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
            <span className="text-zinc-500">已选座位块</span>
            <span className="font-semibold text-zinc-100">{selectedSectionIds.length} 个</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-zinc-500">绑定容量预览</span>
            <span className="font-semibold text-[#ff1268]">{blockStock || estimatedSeatCount}</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-zinc-500">真实库存保存后由后端根据可售座位生成。</p>
        </div>

        <button type="button" onClick={onSubmit} disabled={(!allowSubmitWithoutSelection && selectedSectionIds.length === 0) || !ticketName.trim() || !ticketPrice.trim()} className="mt-6 w-full rounded-xl bg-[#ff1268] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#e60f5d] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400">
          {submitLabel}
        </button>
      </aside>
    </div>
  )
}
