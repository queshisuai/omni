'use client'

import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Headphones, MessageSquareText, RefreshCcw, UserRound } from 'lucide-react'
import { listAgentSupportConversations, listSupportAudits, listSupportMessages, listSupportNotes } from '@/lib/api'
import { filterSupportConversations, formatSupportAuditAction, formatSupportConversationStatus, formatSupportSender, formatSupportSlaText, formatSupportTagLabel, shouldPollSupportConversation, type SupportConversationFilter } from '@/lib/support-tools'
import type { SupportAuditVO, SupportConversationVO, SupportMessageVO, SupportNoteVO } from '@/types/api'

function formatTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getUserDisplay(conversation: SupportConversationVO) {
  return conversation.userNickname || conversation.userPhoneMask || `用户 ${conversation.userId}`
}

function mergeConversations(items: SupportConversationVO[]) {
  const map = new Map<number, SupportConversationVO>()
  for (const item of items) map.set(item.id, item)
  return Array.from(map.values()).sort((a, b) => {
    const left = new Date(a.updateTime || a.createTime || 0).getTime()
    const right = new Date(b.updateTime || b.createTime || 0).getTime()
    return right - left
  })
}

export default function ConsoleSupportConversationsPage() {
  const [conversations, setConversations] = useState<SupportConversationVO[]>([])
  const [active, setActive] = useState<SupportConversationVO | null>(null)
  const [messages, setMessages] = useState<SupportMessageVO[]>([])
  const [notes, setNotes] = useState<SupportNoteVO[]>([])
  const [audits, setAudits] = useState<SupportAuditVO[]>([])
  const [filter, setFilter] = useState<SupportConversationFilter>('active')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [error, setError] = useState('')

  const visibleConversations = useMemo(
    () => filterSupportConversations(conversations, filter),
    [conversations, filter],
  )

  const filterTabs: Array<{ value: SupportConversationFilter; label: string; count: number }> = [
    { value: 'active', label: '处理中', count: filterSupportConversations(conversations, 'active').length },
    { value: 'closed', label: '已结束', count: filterSupportConversations(conversations, 'closed').length },
    { value: 'all', label: '全部', count: conversations.length },
  ]

  const loadConversations = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError('')
    try {
      const [activeItems, closedItems] = await Promise.all([
        listAgentSupportConversations(),
        listAgentSupportConversations('CLOSED'),
      ])
      const next = mergeConversations([...(activeItems || []), ...(closedItems || [])])
      setConversations(next)
      setActive(current => current ? next.find(item => item.id === current.id) || next[0] || null : next[0] || null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载客服会话失败')
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    void loadConversations()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadConversations(false)
      if (active && shouldPollSupportConversation(active.status)) {
        listSupportMessages(active.id)
          .then(data => setMessages(data || []))
          .catch(() => undefined)
      }
    }, 5000)
    return () => window.clearInterval(timer)
  }, [active?.id, active?.status])

  useEffect(() => {
    if (visibleConversations.length === 0) {
      setActive(null)
      return
    }
    setActive(current => current && visibleConversations.some(item => item.id === current.id) ? current : visibleConversations[0])
  }, [filter, conversations])

  useLayoutEffect(() => {
    if (!active) {
      setMessages([])
      setNotes([])
      setAudits([])
      setMessagesLoading(false)
      return
    }
    let cancelled = false
    setMessagesLoading(true)
    setMessages([])
    setNotes([])
    setAudits([])
    Promise.all([
      listSupportMessages(active.id),
      listSupportNotes(active.id),
      listSupportAudits(active.id),
    ])
      .then(([messageData, noteData, auditData]) => {
        if (!cancelled) {
          setMessages(messageData || [])
          setNotes(noteData || [])
          setAudits(auditData || [])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessages([])
          setNotes([])
          setAudits([])
        }
      })
      .finally(() => { if (!cancelled) setMessagesLoading(false) })
    return () => { cancelled = true }
  }, [active?.id])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a2e]">客服会话记录</h1>
          <p className="mt-1 text-[13px] text-[#999]">按用户会话查看完整对话记录，包含用户、AI 客服、人工客服和系统消息。</p>
        </div>
        <button
          type="button"
          onClick={() => void loadConversations()}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-[13px] text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268]"
        >
          <RefreshCcw className="h-4 w-4" />
          刷新
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-500">{error}</div>}

      <div className="grid min-h-[620px] overflow-hidden rounded-xl border border-gray-200 bg-white lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="border-b border-gray-200 lg:border-b-0 lg:border-r">
          <div className="flex gap-2 border-b border-gray-100 px-4 py-3">
            {filterTabs.map(tab => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
                className={`rounded-lg border px-3 py-1.5 text-[12px] ${
                  filter === tab.value
                    ? 'border-[#ff1268] bg-[#fff0f5] text-[#ff1268]'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-[#ff1268] hover:text-[#ff1268]'
                }`}
              >
                {tab.label} {tab.count}
              </button>
            ))}
          </div>
          <div className="max-h-[620px] overflow-y-auto">
            {loading ? (
              <div className="px-5 py-10 text-center text-[13px] text-gray-400">正在加载会话...</div>
            ) : visibleConversations.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px] text-gray-400">暂无会话记录</div>
            ) : visibleConversations.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item)}
                className={`block w-full border-b border-gray-100 px-4 py-4 text-left hover:bg-[#fff7fb] ${active?.id === item.id ? 'bg-[#fff7fb]' : 'bg-white'}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-semibold text-[#111]">{getUserDisplay(item)}</span>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">{formatSupportConversationStatus(item.status)}</span>
                </div>
                <div className="truncate text-[12px] text-gray-500">{item.subject}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(item.tags || []).map(tag => (
                    <span key={tag} className="rounded-full bg-[#fff0f5] px-2 py-0.5 text-[11px] text-[#ff1268]">{formatSupportTagLabel(tag)}</span>
                  ))}
                  {item.escalatedToAdmin && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] text-orange-600">已升级</span>}
                </div>
                <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-gray-400">{item.lastMessage || '暂无消息'}</div>
                <div className={`mt-2 text-[12px] ${item.slaOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                  {formatSupportSlaText(item)}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          {active ? (
            <>
              <div className="border-b border-gray-100 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-[16px] font-bold text-[#111]">
                      <UserRound className="h-4 w-4 text-[#ff1268]" />
                      {getUserDisplay(active)}
                    </div>
                    <div className="mt-1 text-[12px] text-gray-500">
                      用户 ID：{active.userId} · {formatSupportConversationStatus(active.status)} · {active.sourceType === 'AI' ? 'AI 客服' : '人工客服'}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(active.tags || []).map(tag => (
                        <span key={tag} className="rounded-full bg-[#fff0f5] px-2 py-0.5 text-[11px] text-[#ff1268]">{formatSupportTagLabel(tag)}</span>
                      ))}
                      {active.escalatedToAdmin && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] text-orange-600">已升级</span>}
                    </div>
                    {active.closeRequestReason && (
                      <div className="mt-2 text-[12px] leading-5 text-gray-500">结束原因：{active.closeRequestReason}</div>
                    )}
                    <div className={`mt-1 text-[12px] ${active.slaOverdue ? 'text-red-500' : 'text-gray-500'}`}>{formatSupportSlaText(active)}</div>
                  </div>
                  <div className="text-[12px] text-gray-400">{formatTime(active.updateTime || active.createTime)}</div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[#f8f9fc] px-5 py-5">
                {messagesLoading ? (
                  <div className="py-20 text-center text-[13px] text-gray-400">正在加载消息...</div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-[13px] text-gray-400">
                    <MessageSquareText className="h-6 w-6" />
                    暂无消息记录
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map(item => {
                      const mine = item.senderType === 'AGENT' || item.senderType === 'SYSTEM'
                      return (
                        <div key={item.id || `${item.senderType}-${item.content}`} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[72%] rounded-2xl px-4 py-3 text-[13px] leading-6 ${
                            mine
                              ? 'bg-[#1a1a2e] text-white'
                              : item.senderType === 'AI'
                                ? 'bg-[#fff0f5] text-gray-700'
                                : 'bg-white text-gray-700 shadow-sm'
                          }`}>
                            <div className={`mb-1 flex items-center justify-between gap-3 text-[11px] ${mine ? 'text-white/70' : 'text-gray-400'}`}>
                              <span>{formatSupportSender(item.senderType)}</span>
                              <span>{formatTime(item.createTime)}</span>
                            </div>
                            <div className="whitespace-pre-line">{item.content}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="grid border-t border-gray-100 bg-white md:grid-cols-2">
                <section className="border-b border-gray-100 p-4 md:border-b-0 md:border-r">
                  <div className="mb-3 text-[14px] font-semibold text-[#111]">内部备注</div>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {notes.length === 0 ? (
                      <div className="rounded-lg bg-gray-50 px-3 py-3 text-[12px] text-gray-400">暂无内部备注</div>
                    ) : notes.map(note => (
                      <div key={note.id} className="rounded-lg bg-gray-50 px-3 py-2">
                        <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-gray-400">
                          <span className="truncate">{note.authorDisplayName || '客服'}</span>
                          <span className="shrink-0">{formatTime(note.createTime)}</span>
                        </div>
                        <div className="whitespace-pre-line text-[12px] leading-5 text-gray-600">{note.content}</div>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="p-4">
                  <div className="mb-3 text-[14px] font-semibold text-[#111]">质检审计</div>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {audits.length === 0 ? (
                      <div className="rounded-lg bg-gray-50 px-3 py-3 text-[12px] text-gray-400">暂无审计记录</div>
                    ) : audits.map(audit => (
                      <div key={audit.id} className="rounded-lg bg-gray-50 px-3 py-2">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-[12px] font-medium text-[#111]">{formatSupportAuditAction(audit.action)}</span>
                          <span className="text-[11px] text-gray-400">{formatTime(audit.createTime)}</span>
                        </div>
                        <div className="text-[11px] text-gray-400">{audit.actorDisplayName || '系统'}</div>
                        {audit.detail && <div className="mt-1 whitespace-pre-line text-[12px] leading-5 text-gray-600">{audit.detail}</div>}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-[14px] text-gray-400">
              <Headphones className="mr-2 h-5 w-5" />
              请选择左侧会话
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
