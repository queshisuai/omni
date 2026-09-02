'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, Gift, Loader2, QrCode, RefreshCw, RotateCcw, Ticket, XCircle } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { globalAlert, globalConfirm } from '@/components/GlobalDialog'
import { TicketWalletSkeleton } from '@/components/Skeleton'
import { SafeImage } from '@/components/SafeImage'
import { claimTicketTransfer, createTicketEntryCode, createTicketTransfer, listMyTickets, revokeTicketTransfer } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import { getTicketWalletStatusCopy } from '@/lib/ticket-wallet-experience'
import type { TicketEntryCodeVO, TicketTransferCreateVO, TicketWalletItemVO } from '@/types/api'

type TicketTab = 'all' | 'unused' | 'checked' | 'transferred' | 'invalid'

const STATUS_META: Record<number, { label: string; className: string }> = {
  1: { label: '未入场', className: 'border-[#1677ff]/20 bg-[#eff6ff] text-[#1677ff]' },
  2: { label: '已验票', className: 'border-[#52c41a]/20 bg-[#f6ffed] text-[#389e0d]' },
  3: { label: '已失效', className: 'border-[#ddd] bg-[#f7f7f7] text-[#777]' },
  4: { label: '已转赠', className: 'border-[#fa8c16]/25 bg-[#fff7e6] text-[#ad6800]' },
}
const UNKNOWN_STATUS_META = { label: '状态同步中', className: 'border-[#ddd] bg-[#f7f7f7] text-[#777]' }

function formatDateTime(value?: string | null) {
  if (!value) return '时间待定'
  return value.replace('T', ' ').slice(0, 16)
}

function statusMeta(status: number) {
  return STATUS_META[status] || UNKNOWN_STATUS_META
}

function normalizeTicket(ticket: TicketWalletItemVO): TicketWalletItemVO {
  return {
    ...ticket,
    activityName: ticket.activityName || '未命名演出',
    venueName: ticket.venueName || '场馆待定',
    ticketName: ticket.ticketName || '票档信息待同步',
    seatLabel: ticket.seatLabel || '未分配座位',
  }
}

export default function TicketsPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<TicketWalletItemVO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TicketTab>('all')
  const [entryCode, setEntryCode] = useState<TicketEntryCodeVO | null>(null)
  const [entryTicket, setEntryTicket] = useState<TicketWalletItemVO | null>(null)
  const [entrySeconds, setEntrySeconds] = useState(0)
  const [codeLoading, setCodeLoading] = useState<number | null>(null)
  const [transferLoading, setTransferLoading] = useState<number | null>(null)
  const [revokeLoading, setRevokeLoading] = useState<number | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [claimCode, setClaimCode] = useState('')
  const [activeTransfers, setActiveTransfers] = useState<Record<number, TicketTransferCreateVO>>({})
  const loadRef = useRef(() => {})

  const loadTickets = () => {
    if (!isAuthenticated()) {
      router.replace('/login?ru=/tickets')
      return
    }
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await listMyTickets()
        setTickets(data.map(normalizeTicket))
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载票夹失败')
      } finally {
        setLoading(false)
      }
    })()
  }

  loadRef.current = loadTickets

  useEffect(() => {
    loadTickets()
  }, [router])

  useEffect(() => {
    if (!entryCode) return
    const tick = () => {
      const expiresAt = new Date(entryCode.expiresAt).getTime()
      setEntrySeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)))
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [entryCode])

  const filteredTickets = useMemo(() => {
    if (activeTab === 'all') return tickets
    const status = activeTab === 'unused' ? 1 : activeTab === 'checked' ? 2 : activeTab === 'invalid' ? 3 : 4
    return tickets.filter((ticket) => ticket.status === status)
  }, [activeTab, tickets])

  const counts = useMemo(() => ({
    all: tickets.length,
    unused: tickets.filter((ticket) => ticket.status === 1).length,
    checked: tickets.filter((ticket) => ticket.status === 2).length,
    transferred: tickets.filter((ticket) => ticket.status === 4).length,
    invalid: tickets.filter((ticket) => ticket.status === 3).length,
  }), [tickets])

  const openEntryCode = async (ticket: TicketWalletItemVO) => {
    setCodeLoading(ticket.ticketId)
    try {
      const code = await createTicketEntryCode(ticket.ticketId)
      setEntryCode(code)
      setEntryTicket(ticket)
    } catch (err) {
      await globalAlert(err instanceof Error ? err.message : '生成入场码失败')
    } finally {
      setCodeLoading(null)
    }
  }

  const startTransfer = async (ticket: TicketWalletItemVO) => {
    setTransferLoading(ticket.ticketId)
    try {
      const transfer = await createTicketTransfer(ticket.ticketId)
      setActiveTransfers((prev) => ({ ...prev, [ticket.ticketId]: transfer }))
    } catch (err) {
      await globalAlert(err instanceof Error ? err.message : '发起转赠失败')
    } finally {
      setTransferLoading(null)
    }
  }

  const revokeTransfer = async (ticket: TicketWalletItemVO) => {
    if (!(await globalConfirm('确定撤回这张票的转赠吗？'))) return
    setRevokeLoading(ticket.ticketId)
    try {
      await revokeTicketTransfer(ticket.ticketId)
      setActiveTransfers((prev) => {
        const next = { ...prev }
        delete next[ticket.ticketId]
        return next
      })
    } catch (err) {
      await globalAlert(err instanceof Error ? err.message : '撤回转赠失败')
    } finally {
      setRevokeLoading(null)
    }
  }

  const claimTransfer = async () => {
    const code = claimCode.trim()
    if (!code) {
      await globalAlert('请输入转赠码')
      return
    }
    setClaiming(true)
    try {
      await claimTicketTransfer(code)
      setClaimCode('')
      loadRef.current()
      await globalAlert('领取成功，电子票已放入票夹')
    } catch (err) {
      await globalAlert(err instanceof Error ? err.message : '领取转赠失败')
    } finally {
      setClaiming(false)
    }
  }

  const copyTransferCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      await globalAlert('转赠码已复制')
    } catch {
      await globalAlert('复制失败，请手动选择转赠码')
    }
  }

  const tabs: Array<{ key: TicketTab; label: string; count: number }> = [
    { key: 'all', label: '全部', count: counts.all },
    { key: 'unused', label: '未入场', count: counts.unused },
    { key: 'checked', label: '已验票', count: counts.checked },
    { key: 'transferred', label: '已转赠', count: counts.transferred },
    { key: 'invalid', label: '已失效', count: counts.invalid },
  ]

  return (
    <>
      <Header />
      <main className="mx-auto min-h-[calc(100vh-200px)] w-full max-w-[1200px] px-5 py-8">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-[24px] font-medium text-[#111]">我的票夹</h1>
            <p className="mt-2 text-[13px] text-[#666]">电子票、入场状态和转赠记录</p>
          </div>
          <button
            onClick={loadTickets}
            disabled={loading}
            className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#ddd] bg-white px-4 text-[14px] text-[#555] outline-none hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        <div className="mb-5 grid gap-3 rounded-lg border border-[#eee] bg-white p-4 md:grid-cols-[40px_minmax(0,1fr)_auto] md:items-end">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#fff0f5] text-[#ff1268] md:mb-0">
            <Gift className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-medium text-[#111]">领取转赠</div>
            <input
              value={claimCode}
              onChange={(event) => setClaimCode(event.target.value)}
              placeholder="输入好友分享的转赠码"
              className="mt-2 h-10 w-full rounded-lg border border-[#ddd] px-3 text-[14px] text-[#333] outline-none focus:border-[#ff1268]"
            />
          </div>
          <button
            onClick={claimTransfer}
            disabled={claiming}
            className="inline-flex h-10 w-full min-w-[112px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#ff1268] bg-[#ff1268] px-4 text-[14px] font-medium text-white outline-none hover:bg-[#e0105a] disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
          >
            {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            领取
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 border-b border-[#e5e5e5] pb-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`h-9 cursor-pointer rounded-lg border px-4 text-[13px] outline-none transition-colors ${
                activeTab === tab.key
                  ? 'border-[#ff1268] bg-[#fff0f5] text-[#ff1268]'
                  : 'border-[#e5e5e5] bg-white text-[#666] hover:bg-[#fafafa]'
              }`}
            >
              {tab.label} {tab.count}
            </button>
          ))}
        </div>

        {loading ? (
          <TicketWalletSkeleton />
        ) : error ? (
          <div className="rounded-lg border border-[#ffd9e6] bg-white py-16 text-center text-[14px] text-[#ff4d4f]">{error}</div>
        ) : filteredTickets.length === 0 ? (
          <div className="rounded-lg border border-[#eee] bg-white px-6 py-16 text-center">
            <Ticket className="mx-auto mb-3 h-9 w-9 text-[#ccc]" />
            <div className="text-[14px] text-[#999]">暂无电子票</div>
            <button onClick={() => router.push('/orders')} className="mt-4 rounded-lg border border-[#ff1268] bg-white px-4 py-2 text-[13px] text-[#ff1268]">
              查看订单
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredTickets.map((ticket) => {
              const meta = statusMeta(ticket.status)
              const transfer = activeTransfers[ticket.ticketId]
              const statusCopy = getTicketWalletStatusCopy(ticket, transfer)
              const canUse = ticket.status === 1
              return (
                <div key={ticket.ticketId} className="rounded-lg border border-[#eee] bg-white p-4 shadow-sm">
                  <div className="grid gap-4 md:grid-cols-[88px_1fr_auto]">
                    <SafeImage
                      src={ticket.activityPoster}
                      alt={ticket.activityName || '演出海报'}
                      className="h-[118px] w-[88px] rounded-lg object-cover"
                    />
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[12px] font-medium ${meta.className}`}>
                          {ticket.statusText || meta.label}
                        </span>
                        <span className="text-[12px] text-[#999]">票号 {ticket.ticketNo}</span>
                      </div>
                      <button
                        onClick={() => ticket.orderId && router.push(`/orders/${ticket.orderId}`)}
                        className="block max-w-full truncate border-none bg-transparent p-0 text-left text-[17px] font-semibold text-[#111] outline-none hover:text-[#ff1268]"
                      >
                        {ticket.activityName}
                      </button>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#666]">
                        <span>{formatDateTime(ticket.sessionTime)}</span>
                        <span>{ticket.venueName}</span>
                        <span>{ticket.ticketName}</span>
                        <span>{ticket.seatLabel}</span>
                      </div>
                      <div className="mt-3 grid gap-2 text-[13px] text-[#666] sm:grid-cols-2">
                        <div className="rounded-lg bg-[#fafafa] px-3 py-2">
                          观演人：<span className="text-[#333]">{ticket.realName || '-'}</span>
                        </div>
                        <div className="rounded-lg bg-[#fafafa] px-3 py-2">
                          证件：<span className="text-[#333]">{ticket.idNoMask || '-'}</span>
                        </div>
                      </div>
                      <div className="mt-3 rounded-lg border border-[#eef2ff] bg-[#f8fbff] px-3 py-3 text-[13px] text-[#555]">
                        <div className="font-medium text-[#1f2a44]">{statusCopy.title}</div>
                        <div className="mt-1 leading-5">{statusCopy.description}</div>
                      </div>
                      {transfer && (
                        <div className="mt-3 rounded-lg border border-[#ffe0ea] bg-[#fff7fa] px-3 py-3 text-[13px] text-[#666]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>转赠码：</span>
                            <code className="rounded bg-white px-2 py-1 text-[#ff1268]">{transfer.transferCode}</code>
                            <button onClick={() => copyTransferCode(transfer.transferCode)} className="rounded border border-[#ff1268] bg-white px-2 py-1 text-[12px] text-[#ff1268]">
                              复制
                            </button>
                          </div>
                          <div className="mt-2 text-[12px] text-[#999]">过期时间：{formatDateTime(transfer.expiresAt)}</div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-start gap-2 md:w-[156px] md:flex-col">
                      {canUse && (
                        <>
                          <button
                            onClick={() => openEntryCode(ticket)}
                            disabled={codeLoading === ticket.ticketId}
                            className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#ff1268] bg-[#ff1268] px-4 text-[14px] font-medium text-white outline-none hover:bg-[#e0105a] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {codeLoading === ticket.ticketId ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                            入场码
                          </button>
                          {transfer ? (
                            <button
                              onClick={() => revokeTransfer(ticket)}
                              disabled={revokeLoading === ticket.ticketId}
                              className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#ddd] bg-white px-4 text-[14px] text-[#666] outline-none hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {revokeLoading === ticket.ticketId ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                              撤回
                            </button>
                          ) : (
                            <button
                              onClick={() => startTransfer(ticket)}
                              disabled={transferLoading === ticket.ticketId}
                              className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#ff1268] bg-white px-4 text-[14px] text-[#ff1268] outline-none hover:bg-[#fff0f5] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {transferLoading === ticket.ticketId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                              转赠
                            </button>
                          )}
                        </>
                      )}
                      {ticket.status === 2 && (
                        <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#52c41a]/20 bg-[#f6ffed] px-3 py-2 text-[13px] text-[#389e0d]">
                          <CheckCircle2 className="h-4 w-4" />
                          {ticket.checkedInAt ? formatDateTime(ticket.checkedInAt) : '已验票'}
                        </div>
                      )}
                      {(ticket.status === 3 || ticket.status === 4) && (
                        <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-[13px] text-[#777]">
                          <XCircle className="h-4 w-4" />
                          {ticket.statusText || meta.label}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {entryCode && entryTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-[360px] rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-medium text-[#111]">入场码</h2>
                <p className="mt-1 text-[13px] text-[#666]">{entryTicket.activityName}</p>
              </div>
              <button onClick={() => { setEntryCode(null); setEntryTicket(null) }} className="rounded-lg border border-[#ddd] bg-white px-2 py-1 text-[12px] text-[#666]">
                关闭
              </button>
            </div>
            <div className="flex justify-center rounded-lg border border-[#eee] bg-white p-5">
              <QRCodeSVG value={entryCode.entryCode} size={220} />
            </div>
            <div className="mt-4 rounded-lg bg-[#fafafa] px-3 py-3 text-center text-[13px] text-[#666]">
              剩余 {entrySeconds} 秒
            </div>
            <button
              onClick={() => openEntryCode(entryTicket)}
              disabled={codeLoading === entryTicket.ticketId}
              className="mt-4 inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#ff1268] bg-[#ff1268] px-4 text-[14px] font-medium text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {codeLoading === entryTicket.ticketId ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              刷新入场码
            </button>
          </div>
        </div>
      )}
      <Footer />
    </>
  )
}
