'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock3, Loader2, RefreshCw, Ticket, Trash2 } from 'lucide-react'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { globalConfirm } from '@/components/GlobalDialog'
import { cancelWaitlistEntry, listMyWaitlistEntries } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import {
  canCancelWaitlistEntry,
  getWaitlistChanceStyle,
  getWaitlistEntryDisplay,
  getWaitlistPrimaryAction,
  getWaitlistStatusLabel,
} from '@/lib/waitlist'
import type { WaitlistEntryVO } from '@/types/api'

function formatTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function statusStyle(status: string) {
  if (status === 'OFFERED') return 'border-[#ff1268]/30 bg-[#fff0f5] text-[#ff1268]'
  if (status === 'WAITING' || status === 'ALLOCATING') return 'border-[#1677ff]/20 bg-[#eff6ff] text-[#1677ff]'
  if (status === 'PAID') return 'border-[#52c41a]/20 bg-[#f6ffed] text-[#389e0d]'
  return 'border-[#ddd] bg-[#f7f7f7] text-[#777]'
}

export default function WaitlistPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<WaitlistEntryVO[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [actingId, setActingId] = useState<number | null>(null)

  const loadEntries = useCallback(async (silent = false) => {
    if (!isAuthenticated()) {
      router.replace('/login?ru=/waitlist')
      return
    }
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const data = await listMyWaitlistEntries()
      setEntries(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '候补记录加载失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  const stats = useMemo(() => {
    const active = entries.filter((entry) => entry.status === 'WAITING' || entry.status === 'ALLOCATING').length
    const offered = entries.filter((entry) => entry.status === 'OFFERED').length
    return { active, offered, total: entries.length }
  }, [entries])

  const handleCancel = async (entry: WaitlistEntryVO) => {
    const confirmed = await globalConfirm('确认取消这条候补记录？取消后需要重新排队。', '取消候补')
    if (!confirmed) return
    setActingId(entry.id)
    setError('')
    try {
      const next = await cancelWaitlistEntry(entry.id)
      setEntries((prev) => prev.map((item) => (item.id === entry.id ? next : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消候补失败')
    } finally {
      setActingId(null)
    }
  }

  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-200px)] bg-[#f7f8fa] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-[28px] font-semibold text-[#111]">我的候补</h1>
              <p className="mt-2 text-sm text-[#666]">查看排队、待支付和已结束的候补记录。</p>
            </div>
            <button
              type="button"
              onClick={() => void loadEntries(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#ff1268] bg-white px-4 py-2 text-sm font-medium text-[#ff1268] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              刷新
            </button>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <Summary label="全部候补" value={stats.total} />
            <Summary label="排队中" value={stats.active} />
            <Summary label="待支付" value={stats.offered} />
          </div>

          {error && <div className="mb-4 rounded-lg border border-[#ffd6d6] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">{error}</div>}

          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-[#eee] bg-white text-[#666]">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#ff1268]" />
              正在加载候补记录...
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-lg border border-[#eee] bg-white px-6 py-12 text-center">
              <Ticket className="mx-auto mb-3 h-9 w-9 text-[#ff1268]" />
              <div className="text-[16px] font-medium text-[#111]">暂无候补记录</div>
              <p className="mt-2 text-sm text-[#777]">遇到售罄或抢票失败的场次时，可以在活动详情页加入候补。</p>
              <button
                type="button"
                onClick={() => router.push('/search')}
                className="mt-5 rounded-full bg-[#ff1268] px-5 py-2 text-sm font-medium text-white"
              >
                去找活动
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {entries.map((entry) => {
                const action = getWaitlistPrimaryAction(entry.status, entry.offerOrderId)
                const display = getWaitlistEntryDisplay(entry)
                return (
                  <div key={entry.id} className="rounded-lg border border-[#eee] bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusStyle(entry.status)}`}>
                            {getWaitlistStatusLabel(entry.status)}
                          </span>
                          {entry.rank != null && <span className="text-xs text-[#777]">当前约第 {entry.rank} 位</span>}
                          {entry.estimatedChanceText && (
                            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getWaitlistChanceStyle(entry.estimatedChance)}`}>
                              {entry.estimatedChanceText}
                            </span>
                          )}
                        </div>
                        <h2 className="mt-3 truncate text-[17px] font-semibold text-[#111]">{display.title}</h2>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#555]">
                          {display.meta.map((item) => (
                            <span key={item}>{item}</span>
                          ))}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#999]">
                          <Clock3 className="h-3.5 w-3.5" />
                          待支付截止：{formatTime(entry.offerExpireTime)}
                        </div>
                        {entry.estimatedWaitText && <div className="mt-2 text-xs text-[#777]">预计机会：{entry.estimatedWaitText}</div>}
                        {entry.failReason && <div className="mt-2 text-xs text-[#b91c1c]">失败原因：{entry.failReason}</div>}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {action === '去支付' && (
                          <button
                            type="button"
                            onClick={() => router.push('/orders')}
                            className="inline-flex items-center gap-2 rounded-full bg-[#ff1268] px-4 py-2 text-sm font-medium text-white"
                          >
                            <Ticket className="h-4 w-4" />
                            去支付
                          </button>
                        )}
                        {canCancelWaitlistEntry(entry.status) && (
                          <button
                            type="button"
                            onClick={() => void handleCancel(entry)}
                            disabled={actingId === entry.id}
                            className="inline-flex items-center gap-2 rounded-full border border-[#ddd] bg-white px-4 py-2 text-sm font-medium text-[#666] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {actingId === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            取消候补
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#eee] bg-white px-5 py-4">
      <div className="text-xs text-[#777]">{label}</div>
      <div className="mt-1 text-[24px] font-semibold text-[#111]">{value}</div>
    </div>
  )
}
