'use client'

import { useState } from 'react'
import type { SessionTicketBindingRequest } from '@/types/api'

type TicketBinding = SessionTicketBindingRequest['bindings'][number]

interface SeatCraftTicketManagementPanelProps {
  selectedBlockKeys: string[]
  saving?: boolean
  onSaveBindings: (bindings: TicketBinding[]) => void | Promise<void>
}

export function SeatCraftTicketManagementPanel({ selectedBlockKeys, saving = false, onSaveBindings }: SeatCraftTicketManagementPanelProps) {
  const [ticketTypeId, setTicketTypeId] = useState('')
  const [error, setError] = useState('')

  const handleSave = () => {
    const id = Number(ticketTypeId)
    if (selectedBlockKeys.length === 0) {
      setError('请先在左侧座位图中选择一个座位块')
      return
    }
    if (!Number.isInteger(id) || id <= 0) {
      setError('请输入有效的票档 ID')
      return
    }
    setError('')
    onSaveBindings([{ ticketTypeId: id, blockKeys: selectedBlockKeys }])
  }

  return (
    <aside className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-xl">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff1268]">票档管理模式</div>
      <h3 className="mt-2 text-xl font-semibold">SeatCraft 票档绑定</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-500">当前入口已切换到 SeatCraft 票档模式，后续可在这里把票档绑定到座位块。</p>

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">已选座位块</span>
          <span className="font-semibold text-zinc-100">{selectedBlockKeys.length} 个</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-zinc-500">点击左侧座位块后填写票档 ID，即可把该座位块绑定到票档。</p>
      </div>

      <label className="mt-4 block text-sm text-zinc-300">
        票档 ID
        <input
          value={ticketTypeId}
          onChange={event => {
            setTicketTypeId(event.target.value)
            setError('')
          }}
          inputMode="numeric"
          placeholder="例如 1001"
          className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-[#ff1268]"
        />
      </label>
      {error && <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || selectedBlockKeys.length === 0 || !Number.isInteger(Number(ticketTypeId)) || Number(ticketTypeId) <= 0}
        className="mt-6 w-full rounded-xl bg-[#ff1268] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#e60f5d] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
      >
        {saving ? '保存中...' : '保存票档绑定'}
      </button>
    </aside>
  )
}
