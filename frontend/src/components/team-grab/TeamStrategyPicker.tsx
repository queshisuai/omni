'use client'

import { useEffect, useMemo, useState } from 'react'
import { defaultTeamFallbacks, normalizeFallbacks, strategyLabel } from '@/lib/team-grab'
import type { TeamSeatStrategy } from '@/types/api'

const PRIMARY_STRATEGIES = ['STRICT_CONTIGUOUS', 'SAME_BLOCK', 'SAME_TICKET_TYPE'] as const
const STRATEGY_RANK: Record<TeamSeatStrategy, number> = {
  STRICT_CONTIGUOUS: 0,
  SAME_BLOCK: 1,
  SAME_TICKET_TYPE: 2,
  FALLBACK: 3,
}

interface TeamStrategyPickerProps {
  strategy: TeamSeatStrategy
  fallbacks: TeamSeatStrategy[]
  disabled?: boolean
  saving?: boolean
  onUpdate: (strategy: TeamSeatStrategy, fallbacks: TeamSeatStrategy[]) => void | Promise<void>
}

export function TeamStrategyPicker({
  strategy,
  fallbacks,
  disabled = false,
  saving = false,
  onUpdate,
}: TeamStrategyPickerProps) {
  const [draftStrategy, setDraftStrategy] = useState<TeamSeatStrategy>(strategy)
  const [draftFallbacks, setDraftFallbacks] = useState<TeamSeatStrategy[]>(fallbacks)

  useEffect(() => {
    setDraftStrategy(strategy)
    setDraftFallbacks(fallbacks)
  }, [strategy, fallbacks])

  const normalizedDraftFallbacks = useMemo(
    () => normalizeFallbacks(draftStrategy, draftFallbacks),
    [draftStrategy, draftFallbacks],
  )
  const normalizedCurrentFallbacks = useMemo(
    () => normalizeFallbacks(strategy, fallbacks),
    [strategy, fallbacks],
  )
  const fallbackOptions = PRIMARY_STRATEGIES.filter(
    fallback => STRATEGY_RANK[fallback] > STRATEGY_RANK[draftStrategy],
  )
  const dirty = strategy !== draftStrategy || normalizedCurrentFallbacks.join(',') !== normalizedDraftFallbacks.join(',')

  const handlePrimaryChange = (nextStrategy: TeamSeatStrategy) => {
    setDraftStrategy(nextStrategy)
    setDraftFallbacks(defaultTeamFallbacks(nextStrategy))
  }

  const toggleFallback = (fallback: TeamSeatStrategy) => {
    setDraftFallbacks(current => (
      current.includes(fallback)
        ? current.filter(item => item !== fallback)
        : normalizeFallbacks(draftStrategy, [...current, fallback])
    ))
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-[13px] font-medium text-[#333]">主策略</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {PRIMARY_STRATEGIES.map(option => {
            const active = draftStrategy === option
            return (
              <button
                key={option}
                type="button"
                disabled={disabled || saving}
                onClick={() => handlePrimaryChange(option)}
                className={`min-h-10 rounded border px-3 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  active
                    ? 'border-[#ff1268] bg-[#fff0f5] text-[#ff1268]'
                    : 'border-[#e5e5e5] bg-white text-[#333] hover:border-[#ff1268]'
                }`}
              >
                {strategyLabel(option)}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[13px] font-medium text-[#333]">保底策略</div>
        {fallbackOptions.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {fallbackOptions.map(option => (
              <label
                key={option}
                className="flex min-h-9 items-center gap-2 rounded border border-[#e5e5e5] bg-white px-3 py-2 text-[13px] text-[#555]"
              >
                <input
                  type="checkbox"
                  disabled={disabled || saving}
                  checked={normalizedDraftFallbacks.includes(option)}
                  onChange={() => toggleFallback(option)}
                  className="h-4 w-4 accent-[#ff1268]"
                />
                <span>{strategyLabel(option)}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="rounded border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-[13px] text-[#999]">
            无可用保底
          </div>
        )}
      </div>

      {!disabled && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={() => onUpdate(draftStrategy, normalizedDraftFallbacks)}
            className="min-h-10 rounded bg-[#ff1268] px-5 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[#e01058] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      )}
    </div>
  )
}
