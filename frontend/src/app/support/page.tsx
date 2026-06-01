'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Headphones, LogOut, Send } from 'lucide-react'
import {
  claimSupportConversation,
  closeSupportConversation,
  getUserInfo,
  listAgentSupportConversations,
  listSupportMessages,
  sendSupportMessage,
} from '@/lib/api'
import { logout } from '@/lib/auth'
import { filterSupportConversations, formatSupportConversationStatus, formatSupportSender, type SupportConversationFilter } from '@/lib/support-tools'
import type { SupportConversationVO, SupportMessageVO } from '@/types/api'

function getConversationUserDisplay(conversation: SupportConversationVO) {
  return conversation.userNickname || conversation.userPhoneMask || `用户 ${conversation.userId}`
}

export default function SupportWorkbenchPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [conversations, setConversations] = useState<SupportConversationVO[]>([])
  const [active, setActive] = useState<SupportConversationVO | null>(null)
  const [messages, setMessages] = useState<SupportMessageVO[]>([])
  const [conversationFilter, setConversationFilter] = useState<SupportConversationFilter>('active')
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const loadConversations = async () => {
    const data = await listAgentSupportConversations()
    setConversations(data)
    setActive(current => current ? data.find(item => item.id === current.id) || current : data[0] || null)
  }

  const visibleConversations = useMemo(
    () => filterSupportConversations(conversations, conversationFilter),
    [conversations, conversationFilter],
  )

  const filterTabs: Array<{ value: SupportConversationFilter; label: string; count: number }> = [
    { value: 'active', label: '处理中', count: filterSupportConversations(conversations, 'active').length },
    { value: 'closed', label: '已结束', count: filterSupportConversations(conversations, 'closed').length },
    { value: 'all', label: '全部', count: conversations.length },
  ]

  const loadMessages = async (conversationId: number) => {
    const data = await listSupportMessages(conversationId)
    setMessages(data)
  }

  useEffect(() => {
    getUserInfo()
      .then(info => {
        if (info.role !== 'support' && info.role !== 'admin') {
          router.replace('/')
          return
        }
        return loadConversations()
      })
      .catch(() => router.replace('/login?ru=/support'))
      .finally(() => setChecking(false))
  }, [router])

  useEffect(() => {
    if (active) {
      loadMessages(active.id).catch(() => setMessages([]))
    } else {
      setMessages([])
    }
  }, [active?.id])

  useEffect(() => {
    if (visibleConversations.length === 0) {
      setActive(null)
      return
    }
    setActive(current => current && visibleConversations.some(item => item.id === current.id) ? current : visibleConversations[0])
  }, [conversationFilter, conversations])

  const claim = async () => {
    if (!active) return
    setStatus('')
    setError('')
    try {
      const updated = await claimSupportConversation(active.id)
      setActive(updated)
      await loadConversations()
      await loadMessages(updated.id)
      setStatus('已接入该会话')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '接入失败')
    }
  }

  const send = async () => {
    if (!active || !text.trim()) return
    setStatus('')
    setError('')
    try {
      await sendSupportMessage(active.id, text.trim())
      setText('')
      await loadMessages(active.id)
      await loadConversations()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '发送失败')
    }
  }

  const close = async () => {
    if (!active) return
    setStatus('')
    setError('')
    try {
      const updated = await closeSupportConversation(active.id)
      setActive(updated)
      await loadConversations()
      await loadMessages(updated.id)
      setStatus('会话已结束')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '结束会话失败')
    }
  }

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center bg-gray-50 text-[14px] text-gray-500">正在进入客服工作台...</div>
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f7fb]">
      <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0f5] text-[#ff1268]">
            <Headphones className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[18px] font-bold text-[#111]">客服工作台</div>
            <div className="text-[12px] text-gray-500">人工客服只处理在线咨询，不进入平台后台或主办方后台</div>
          </div>
        </div>
        <button onClick={logout} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-gray-600 hover:border-[#ff1268] hover:text-[#ff1268]">
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[320px_1fr]">
        <aside className="min-h-0 border-r border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3 text-[13px] font-medium text-gray-500">待处理会话</div>
          <div className="flex gap-2 border-b border-gray-100 px-4 py-3">
            {filterTabs.map(tab => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setConversationFilter(tab.value)}
                className={`rounded-lg border px-3 py-1.5 text-[12px] ${
                  conversationFilter === tab.value
                    ? 'border-[#ff1268] bg-[#fff0f5] text-[#ff1268]'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-[#ff1268] hover:text-[#ff1268]'
                }`}
              >
                {tab.label} {tab.count}
              </button>
            ))}
          </div>
          <div className="h-[calc(100vh-166px)] overflow-y-auto">
            {visibleConversations.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px] text-gray-400">暂无待处理会话</div>
            ) : visibleConversations.map(item => (
              <button
                key={item.id}
                onClick={() => setActive(item)}
                className={`block w-full border-b border-gray-100 px-4 py-4 text-left hover:bg-[#fff7fb] ${active?.id === item.id ? 'bg-[#fff7fb]' : 'bg-white'}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-semibold text-[#111]">{getConversationUserDisplay(item)}</span>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">{formatSupportConversationStatus(item.status)}</span>
                </div>
                <div className="truncate text-[12px] text-gray-500">{item.subject}</div>
                <div className="line-clamp-2 text-[12px] leading-5 text-gray-500">{item.lastMessage || '暂无消息'}</div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          {active ? (
            <>
              <div className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
                <div>
                  <div className="text-[16px] font-bold text-[#111]">{active.subject}</div>
                  <div className="mt-1 text-[12px] text-gray-500">用户：{getConversationUserDisplay(active)} · ID：{active.userId} · {formatSupportConversationStatus(active.status)}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={claim} disabled={active.status === 'CLOSED'} className="rounded-lg bg-[#ff1268] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">接入</button>
                  <button onClick={close} disabled={active.status === 'CLOSED'} className="rounded-lg border border-gray-200 px-4 py-2 text-[13px] text-gray-600 hover:border-red-300 hover:text-red-500 disabled:opacity-50">结束</button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="space-y-4">
                  {messages.map(item => {
                    const mine = item.senderType === 'AGENT' || item.senderType === 'SYSTEM'
                    return (
                      <div key={item.id || `${item.senderType}-${item.content}`} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[68%] rounded-2xl px-4 py-3 text-[13px] leading-6 ${mine ? 'bg-[#1a1a2e] text-white' : item.senderType === 'AI' ? 'bg-[#fff0f5] text-gray-700' : 'bg-white text-gray-700 shadow-sm'}`}>
                          <div className={`mb-1 text-[11px] ${mine ? 'text-white/70' : 'text-gray-400'}`}>{formatSupportSender(item.senderType)}</div>
                          {item.content}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="border-t border-gray-200 bg-white p-4">
                {(status || error) && <div className={`mb-3 rounded-lg px-3 py-2 text-[12px] ${error ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>{error || status}</div>}
                <div className="flex gap-2">
                  <input
                    value={text}
                    onChange={event => setText(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter') send() }}
                    disabled={active.status === 'CLOSED'}
                    placeholder="输入回复内容"
                    className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 px-3 text-[14px] outline-none focus:border-[#ff1268] disabled:bg-gray-100"
                  />
                  <button onClick={send} disabled={active.status === 'CLOSED' || !text.trim()} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ff1268] text-white disabled:opacity-50" title="发送">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-[14px] text-gray-400">请选择左侧会话</div>
          )}
        </section>
      </main>
    </div>
  )
}
