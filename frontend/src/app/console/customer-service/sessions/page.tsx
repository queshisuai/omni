'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRightLeft,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  FileUp,
  History,
  Inbox,
  MessageSquareText,
  RefreshCw,
  Route,
  Search,
  Send,
  Star,
  Ticket,
  UserPlus,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import {
  addCsInternalNote,
  auditCsSession,
  claimCsSession,
  escalateCsSession,
  getCsOrgTree,
  getRecentTicketOrderContext,
  listCsUserSessionHistory,
  listCsSessionMessages,
  listCsSessions,
  transferCsSession,
} from '@/lib/api'
import { getUser } from '@/lib/auth'
import { hasConsolePermission, isPlatformAdminRole } from '@/lib/console-auth'
import {
  filterCustomerServiceOrgTree,
  buildCustomerServiceSelectionQuery,
  groupCustomerServiceSessionsByUser,
  getCustomerServiceAssignmentLabel,
  getCustomerServiceSlaMeta,
  getCustomerServiceGroup,
  type CustomerServiceOrgSelection,
} from '@/lib/customer-service-workbench'
import type {
  CsAuditRequest,
  CsInternalNoteVO,
  CsOrgTreeVO,
  CsRecentOrderContextVO,
  CsSessionMessageVO,
  CsSessionSort,
  CsSessionStatus,
  CsSessionVO,
  CsSkillGroupVO,
  CsUserSessionHistoryVO,
  PageResult,
} from '@/types/api'

const EMPTY_PAGE: PageResult<CsSessionVO> = {
  records: [],
  total: 0,
  size: 30,
  current: 1,
  pages: 0,
}

type ActionDialog =
  | { type: 'transfer'; groupId: string; agentId: string; note: string }
  | { type: 'escalate'; groupId: string; agentId: string; note: string }

function formatTime(value?: string | null) {
  if (!value) return '暂无时间'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (number: number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatWaiting(seconds?: number | null) {
  if (!seconds || seconds <= 0) return '等待时长 0 分钟'
  const minutes = Math.floor(seconds / 60)
  return minutes < 60 ? `等待时长 ${minutes} 分钟` : `等待时长 ${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`
}

function getUserLabel(session: CsSessionVO) {
  return session.userNickname || session.userPhoneMask || `用户编号：${session.userId}`
}

function getStatusLabel(status: string) {
  if (status === 'CLOSED') return '已结束'
  if (status === 'NEED_AUDIT') return '待质检'
  return '进行中'
}

function getSenderLabel(message: CsSessionMessageVO) {
  if (message.senderType === 'AI') return 'AI 客服'
  if (message.senderType === 'AGENT') return message.senderDisplayName || '人工客服'
  if (message.senderType === 'SYSTEM') return '系统事件'
  return message.senderDisplayName || '用户'
}

function getAgentStatusLabel(status: number) {
  if (status === 1) return '在线'
  if (status === 2) return '忙碌'
  return '离线'
}

function getAgentStatusClassName(status: number) {
  if (status === 1) return 'bg-emerald-500'
  if (status === 2) return 'bg-amber-400'
  return 'bg-gray-300'
}

function getOrderStatusLabel(order: CsRecentOrderContextVO) {
  if (order.fulfillmentStatus) return order.fulfillmentStatus
  if (order.status === 2) return '出票成功'
  if (order.status === 4) return '退票中'
  if (order.status === 3) return '已取消'
  return '状态待同步'
}

export default function CustomerServiceSessionsPage() {
  const [orgTree, setOrgTree] = useState<CsOrgTreeVO | null>(null)
  const [selection, setSelection] = useState<CustomerServiceOrgSelection>({ type: 'all' })
  const [expandedGroups, setExpandedGroups] = useState<number[]>([])
  const [treeKeyword, setTreeKeyword] = useState('')
  const [status, setStatus] = useState<CsSessionStatus>('ACTIVE')
  const [sort, setSort] = useState<CsSessionSort>('latest')
  const [slaTimeoutOnly, setSlaTimeoutOnly] = useState(false)
  const [sessionPage, setSessionPage] = useState(1)
  const [sessionResult, setSessionResult] = useState<PageResult<CsSessionVO>>(EMPTY_PAGE)
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  const [expandedUserIds, setExpandedUserIds] = useState<number[]>([])
  const [messages, setMessages] = useState<CsSessionMessageVO[]>([])
  const [notes, setNotes] = useState<CsInternalNoteVO[]>([])
  const [orders, setOrders] = useState<CsRecentOrderContextVO[]>([])
  const [history, setHistory] = useState<CsUserSessionHistoryVO[]>([])
  const [activeRightTab, setActiveRightTab] = useState<'orders' | 'history'>('orders')
  const [noteDraft, setNoteDraft] = useState('')
  const [auditScore, setAuditScore] = useState(0)
  const [auditComments, setAuditComments] = useState('')
  const [auditResolved, setAuditResolved] = useState(true)
  const [actionDialog, setActionDialog] = useState<ActionDialog | null>(null)
  const [loadingOrgTree, setLoadingOrgTree] = useState(true)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')

  const user = getUser()
  const canManage = Boolean(
    user && (isPlatformAdminRole(user.role) || hasConsolePermission(user.role, user.permissionCodes || [], 'cs.manage')),
  )
  const canReview = Boolean(
    user && (
      isPlatformAdminRole(user.role)
      || hasConsolePermission(user.role, user.permissionCodes || [], 'cs.manage')
      || hasConsolePermission(user.role, user.permissionCodes || [], 'cs.review')
    ),
  )
  const canAudit = Boolean(
    user && (
      isPlatformAdminRole(user.role)
      || hasConsolePermission(user.role, user.permissionCodes || [], 'cs.manage')
    ),
  )

  const filteredOrgTree = useMemo(
    () => orgTree ? filterCustomerServiceOrgTree(orgTree, treeKeyword) : null,
    [orgTree, treeKeyword],
  )

  const selectedSession = useMemo(
    () => sessionResult.records.find(session => session.id === selectedSessionId) || null,
    [selectedSessionId, sessionResult.records],
  )

  const groupedSessions = useMemo(
    () => groupCustomerServiceSessionsByUser(sessionResult.records),
    [sessionResult.records],
  )

  const selectedGroup = actionDialog?.groupId && orgTree
    ? getCustomerServiceGroup(orgTree, Number(actionDialog.groupId))
    : null

  const transferAgents = selectedGroup?.agents || []

  const loadOrgTree = async () => {
    setLoadingOrgTree(true)
    try {
      setOrgTree(await getCsOrgTree())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载客服组织树失败')
    } finally {
      setLoadingOrgTree(false)
    }
  }

  const loadSessions = async (nextPage = sessionPage) => {
    setLoadingSessions(true)
    setError('')
    try {
      const query = {
        status,
        sort,
        slaTimeoutOnly,
        page: nextPage,
        size: 30,
        ...buildCustomerServiceSelectionQuery(selection),
      }
      const result = await listCsSessions(query)
      setSessionResult(result)
      setExpandedUserIds([])
      setSelectedSessionId(current => current && result.records.some(item => item.id === current) ? current : result.records[0]?.id || null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载客服会话失败')
      setSessionResult(EMPTY_PAGE)
      setSelectedSessionId(null)
    } finally {
      setLoadingSessions(false)
    }
  }

  useEffect(() => {
    void loadOrgTree()
  }, [])

  useEffect(() => {
    void loadSessions(sessionPage)
  }, [selection, status, sort, slaTimeoutOnly, sessionPage])

  useEffect(() => {
    if (!selectedSession) {
      setMessages([])
      setOrders([])
      setHistory([])
      setNotes([])
      setAuditScore(0)
      setAuditComments('')
      setDetailError('')
      return
    }

    let cancelled = false
    setLoadingMessages(true)
    setDetailError('')
    setMessages([])
    setNotes([])
    setAuditScore(selectedSession.latestAuditScore || 0)
    setAuditComments('')
    setAuditResolved(true)
    void listCsSessionMessages(selectedSession.id)
      .then(data => {
        if (!cancelled) setMessages(data || [])
      })
      .catch(err => {
        if (!cancelled) setDetailError(err instanceof Error ? err.message : '加载会话消息失败')
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false)
      })

    setLoadingOrders(true)
    setOrders([])
    void getRecentTicketOrderContext(selectedSession.userId)
      .then(data => {
        if (!cancelled) setOrders(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setOrders([])
      })
      .finally(() => {
        if (!cancelled) setLoadingOrders(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedSession?.id])

  useEffect(() => {
    if (!selectedSession || activeRightTab !== 'history') {
      setLoadingHistory(false)
      return
    }
    let cancelled = false
    setLoadingHistory(true)
    void listCsUserSessionHistory(selectedSession.userId)
      .then(data => {
        if (!cancelled) setHistory(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setHistory([])
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeRightTab, selectedSession?.userId])

  const refreshAll = async () => {
    await Promise.all([loadOrgTree(), loadSessions(sessionPage)])
  }

  const updateSessionInList = (updated: CsSessionVO) => {
    setSessionResult(current => ({
      ...current,
      records: current.records.map(item => item.id === updated.id ? updated : item),
    }))
  }

  const handleClaim = async () => {
    if (!selectedSession) return
    setSubmitting(true)
    setError('')
    try {
      const updated = await claimCsSession(selectedSession.id)
      updateSessionInList(updated)
      await loadOrgTree()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '认领会话失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitAction = async () => {
    if (!selectedSession || !actionDialog) return
    const note = actionDialog.note.trim()
    if (actionDialog.type === 'transfer' && (!actionDialog.groupId || !actionDialog.agentId || !note)) {
      setDetailError('请选择目标技能组、目标坐席并填写转接附言')
      return
    }
    setSubmitting(true)
    setDetailError('')
    try {
      const updated = actionDialog.type === 'transfer'
        ? await transferCsSession(selectedSession.id, {
          targetGroupId: Number(actionDialog.groupId),
          targetAgentId: Number(actionDialog.agentId),
          transferNote: note,
        })
        : await escalateCsSession(selectedSession.id, note)
      updateSessionInList(updated)
      setActionDialog(null)
      await loadOrgTree()
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : '会话操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveNote = async () => {
    if (!selectedSession || !noteDraft.trim()) {
      setDetailError('内部备注不能为空')
      return
    }
    setSubmitting(true)
    setDetailError('')
    try {
      const saved = await addCsInternalNote(selectedSession.id, { content: noteDraft })
      setNotes(current => [...current, {
        ...saved,
        id: saved.id || Date.now(),
        sessionId: selectedSession.id,
        content: saved.content || noteDraft.trim(),
        authorUserId: saved.authorUserId || user?.userId,
        authorDisplayName: saved.authorDisplayName || user?.nickname || '当前客服',
        createTime: saved.createTime || new Date().toISOString(),
      }])
      setNoteDraft('')
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : '保存内部备注失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAudit = async () => {
    if (!selectedSession || !canAudit) return
    if (auditScore < 1 || auditScore > 5) {
      setDetailError('请选择1至5星质检评分')
      return
    }
    setSubmitting(true)
    setDetailError('')
    const body: CsAuditRequest = {
      score: auditScore,
      comments: auditComments.trim(),
      isResolved: auditResolved,
    }
    try {
      const updated = await auditCsSession(selectedSession.id, body)
      updateSessionInList(updated)
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : '保存质检结果失败')
    } finally {
      setSubmitting(false)
    }
  }

  const selectTreeNode = (next: CustomerServiceOrgSelection) => {
    setSelection(next)
    if (next.type === 'ai-resolved') setStatus('CLOSED')
    if (next.type === 'ai-human' || next.type === 'pool') setStatus('ACTIVE')
    setSessionPage(1)
  }

  const toggleGroup = (groupId: number) => {
    setExpandedGroups(current => current.includes(groupId)
      ? current.filter(item => item !== groupId)
      : [...current, groupId])
  }

  const toggleUser = (userId: number) => {
    setExpandedUserIds(current => current.includes(userId)
      ? current.filter(item => item !== userId)
      : [...current, userId])
  }

  return (
    <div className="h-full flex overflow-hidden bg-[#f8f9fc]" data-testid="customer-service-workbench">
      <aside className="flex w-[250px] shrink-0 flex-col overflow-hidden border-r border-[#e5e7eb] bg-white" data-testid="org-tree">
        <div className="border-b border-[#edf0f3] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-[16px] font-bold text-[#111827]">客服组织树</h1>
              <p className="mt-1 text-[12px] text-[#9ca3af]">按技能组和坐席分层管理</p>
            </div>
            <button
              type="button"
              onClick={() => void refreshAll()}
              title="刷新组织树和会话"
              aria-label="刷新组织树和会话"
              className="rounded-md p-2 text-[#6b7280] hover:bg-[#fff0f5] hover:text-[#ff1268]"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <label className="mt-4 flex h-9 items-center gap-2 rounded-md border border-[#e5e7eb] px-3 text-[#9ca3af] focus-within:border-[#ff1268]">
            <Search className="h-4 w-4 shrink-0" />
            <input
              value={treeKeyword}
              onChange={event => setTreeKeyword(event.target.value)}
              placeholder="搜索技能组、主管或坐席"
              className="min-w-0 flex-1 bg-transparent text-[12px] text-[#374151] outline-none"
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {loadingOrgTree ? (
            <div className="px-3 py-8 text-center text-[12px] text-[#9ca3af]">正在加载组织树...</div>
          ) : filteredOrgTree ? (
            <div className="space-y-1">
              <TreeButton
                active={selection.type === 'all'}
                icon={<UsersRound className="h-4 w-4" />}
                label="全平台全部会话"
                activeCount={filteredOrgTree.activeCount}
                totalCount={filteredOrgTree.totalCount}
                onClick={() => selectTreeNode({ type: 'all' })}
              />
              <TreeButton
                active={selection.type === 'pool'}
                icon={<Inbox className="h-4 w-4" />}
                label="公共待认领池"
                activeCount={filteredOrgTree.publicPoolCount}
                totalCount={0}
                warningCount={filteredOrgTree.publicPoolTimeoutCount}
                onClick={() => selectTreeNode({ type: 'pool' })}
              />
              <TreeButton
                active={selection.type === 'ai-resolved'}
                icon={<Bot className="h-4 w-4" />}
                label="AI 独立接待已办结"
                activeCount={0}
                totalCount={filteredOrgTree.aiResolvedCount}
                onClick={() => selectTreeNode({ type: 'ai-resolved' })}
              />
              <TreeButton
                active={selection.type === 'ai-human'}
                icon={<Route className="h-4 w-4" />}
                label="AI 转人工队列"
                activeCount={filteredOrgTree.aiHumanCount}
                totalCount={0}
                onClick={() => selectTreeNode({ type: 'ai-human' })}
              />
              <div className="mt-3 border-t border-[#f1f3f5] pt-3">
                <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">业务技能组</div>
                {filteredOrgTree.groups.map(group => (
                  <SkillGroupTreeNode
                    key={group.id}
                    group={group}
                    expanded={expandedGroups.includes(group.id)}
                    selection={selection}
                    onToggle={() => toggleGroup(group.id)}
                    onSelectGroup={() => selectTreeNode({ type: 'group', groupId: group.id })}
                    onSelectAgent={agentId => selectTreeNode({ type: 'agent', groupId: group.id, agentId })}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="px-3 py-8 text-center text-[12px] text-[#9ca3af]">暂无组织树数据</div>
          )}
        </div>
      </aside>

      <section className="flex w-[320px] shrink-0 flex-col overflow-hidden border-r border-[#e5e7eb] bg-white">
        <div className="border-b border-[#edf0f3] px-3 py-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {([
              ['ACTIVE', '进行中'],
              ['CLOSED', '已结束'],
              ['NEED_AUDIT', '待主管质检'],
            ] as Array<[CsSessionStatus, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => { setStatus(value); setSessionPage(1) }}
                className={`shrink-0 rounded-md px-2.5 py-1.5 text-[12px] font-medium ${status === value ? 'bg-[#fff0f5] text-[#ff1268]' : 'text-[#6b7280] hover:bg-[#f8f9fb]'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <select
              value={sort}
              onChange={event => { setSort(event.target.value as CsSessionSort); setSessionPage(1) }}
              className="h-8 min-w-0 flex-1 rounded-md border border-[#e5e7eb] bg-white px-2 text-[12px] text-[#4b5563] outline-none focus:border-[#ff1268]"
              aria-label="会话排序"
            >
              <option value="latest">按最新咨询时间</option>
              <option value="sla_waiting">按用户等待时长</option>
              <option value="quality">按质检评分</option>
            </select>
            <button
              type="button"
              onClick={() => { setSlaTimeoutOnly(current => !current); setSessionPage(1) }}
              className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] ${slaTimeoutOnly ? 'border-[#fca5a5] bg-[#fef2f2] text-[#dc2626]' : 'border-[#e5e7eb] text-[#6b7280] hover:border-[#ff1268] hover:text-[#ff1268]'}`}
              title="只看SLA超时会话"
            >
              <CircleAlert className="h-3.5 w-3.5" />
              超时
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingSessions ? (
            <div className="px-4 py-12 text-center text-[12px] text-[#9ca3af]">正在加载会话队列...</div>
          ) : error ? (
            <div className="px-4 py-12 text-center text-[12px] text-[#dc2626]">{error}</div>
          ) : sessionResult.records.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-5 text-center text-[12px] text-[#9ca3af]">
              <MessageSquareText className="h-7 w-7 text-[#d1d5db]" />
              当前切片暂无会话
            </div>
          ) : groupedSessions.map(group => {
            const latestSession = group.latestSession
            const expanded = expandedUserIds.includes(group.userId)
            const selectedUser = group.historyList.some(session => session.id === selectedSessionId)
            const sla = getCustomerServiceSlaMeta(latestSession)
            return (
              <div key={group.userId} className="border-b border-[#f1f3f5]">
                <button
                  type="button"
                  onClick={() => group.historyList.length === 1 ? setSelectedSessionId(latestSession.id) : toggleUser(group.userId)}
                  aria-expanded={group.historyList.length > 1 ? expanded : undefined}
                  className={`block w-full px-4 py-3 text-left transition-colors ${selectedUser ? 'bg-[#fff7fa]' : 'hover:bg-[#fafafa]'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] text-[#6b7280]">
                        <UserRound className="h-3.5 w-3.5" />
                      </div>
                      <span className="truncate text-[13px] font-semibold text-[#1f2937]">{group.userName}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="rounded-full bg-[#f3f4f6] px-1.5 py-0.5 text-[10px] text-[#6b7280]">{group.historyList.length} 次咨询</span>
                      {group.historyList.length > 1 ? (
                        <ChevronDown className={`h-4 w-4 text-[#9ca3af] transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-[#ff1268]">{getCustomerServiceAssignmentLabel(latestSession)}</span>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${sla.tone === 'danger' ? 'bg-[#fef2f2] text-[#dc2626]' : sla.tone === 'warning' ? 'bg-[#fffbeb] text-[#d97706]' : 'bg-[#f0fdf4] text-[#15803d]'}`}>
                      {sla.label}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[12px] text-[#6b7280]">{latestSession.lastMessage || latestSession.subject || '暂无消息摘要'}</div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[#9ca3af]">
                    <span>最近咨询</span>
                    <span>{formatTime(latestSession.updateTime || latestSession.createTime)}</span>
                  </div>
                </button>
                {expanded ? (
                  <div className="border-t border-[#f1f3f5] bg-[#fafbfc] px-3 py-1.5">
                    {group.historyList.map(session => (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => setSelectedSessionId(session.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-[11px] transition-colors ${selectedSessionId === session.id ? 'bg-[#fff0f5] text-[#ff1268]' : 'text-[#6b7280] hover:bg-white'}`}
                      >
                        <span className="min-w-0 truncate">会话 #{session.id} | {formatTime(session.updateTime || session.createTime).slice(5)} | 状态: {getStatusLabel(session.status)}</span>
                        {session.id === latestSession.id ? <span className="shrink-0 text-[10px] text-[#9ca3af]">最近</span> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-between border-t border-[#edf0f3] px-3 py-2 text-[11px] text-[#9ca3af]">
          <span>当前页 {groupedSessions.length} 位用户 / 共 {sessionResult.total} 条会话</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSessionPage(current => Math.max(1, current - 1))}
              disabled={sessionPage <= 1 || loadingSessions}
              className="rounded p-1.5 hover:bg-[#f3f4f6] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="上一页"
              title="上一页"
            >
              ‹
            </button>
            <span>{sessionPage} / {Math.max(1, sessionResult.pages || 1)}</span>
            <button
              type="button"
              onClick={() => setSessionPage(current => current + 1)}
              disabled={loadingSessions || sessionResult.pages <= sessionPage}
              className="rounded p-1.5 hover:bg-[#f3f4f6] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="下一页"
              title="下一页"
            >
              ›
            </button>
          </div>
        </div>
      </section>

      <section className="flex min-w-0 flex-1 overflow-hidden">
        {!selectedSession ? (
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 text-[#9ca3af]">
            <HeadsetEmptyIcon />
            <div className="text-[13px]">请选择左侧会话查看工作台</div>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f8f9fc]">
              <div className="shrink-0 border-b border-[#e5e7eb] bg-white px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fff0f5] text-[#ff1268]">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-[16px] font-bold text-[#111827]">{getUserLabel(selectedSession)}</h2>
                        <div className="mt-1 truncate text-[11px] text-[#9ca3af]">
                          UID：{selectedSession.userId} · 电话：{selectedSession.userPhoneMask || '暂无'} · 渠道：{selectedSession.sourceType === 'AI' ? 'AI 分流' : '人工客服'}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-[#6b7280]">
                      <span className="rounded bg-[#f3f4f6] px-2 py-1">路由：{selectedSession.skillGroupName || '公共队列'}</span>
                      <span className="rounded bg-[#f3f4f6] px-2 py-1">接待：{getCustomerServiceAssignmentLabel(selectedSession)}</span>
                      {selectedSession.escalatedToAdmin ? <span className="rounded bg-[#fff7ed] px-2 py-1 text-[#c2410c]">已转工单</span> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {!selectedSession.assignedAgentId && selectedSession.status === 'ACTIVE' ? (
                      <button
                        type="button"
                        onClick={() => void handleClaim()}
                        disabled={submitting}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[#ff1268] px-3 py-2 text-[12px] font-medium text-white hover:bg-[#e8115e] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        认领会话
                      </button>
                    ) : null}
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setActionDialog({ type: 'transfer', groupId: '', agentId: '', note: '' })}
                          disabled={submitting}
                          className="inline-flex items-center gap-1.5 rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-[12px] font-medium text-[#4b5563] hover:border-[#ff1268] hover:text-[#ff1268] disabled:opacity-50"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                          转接客服组
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionDialog({ type: 'escalate', groupId: '', agentId: '', note: '' })}
                          disabled={submitting || Boolean(selectedSession.escalatedToAdmin)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-[#fed7aa] bg-white px-3 py-2 text-[12px] font-medium text-[#c2410c] hover:bg-[#fff7ed] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <FileUp className="h-3.5 w-3.5" />
                          升级工单
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                {loadingMessages ? (
                  <div className="py-16 text-center text-[12px] text-[#9ca3af]">正在加载消息流...</div>
                ) : detailError && messages.length === 0 ? (
                  <div className="py-16 text-center text-[12px] text-[#dc2626]">{detailError}</div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-[12px] text-[#9ca3af]">
                    <MessageSquareText className="h-7 w-7 text-[#d1d5db]" />
                    暂无消息记录
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map(message => {
                      if (message.senderType === 'SYSTEM') {
                        return (
                          <div key={message.id} className="flex justify-center">
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#374151] px-3 py-1 text-[10px] text-white">
                              <History className="h-3 w-3" />
                              {message.content} · {formatTime(message.createTime)}
                            </div>
                          </div>
                        )
                      }
                      const agent = message.senderType === 'AGENT'
                      const ai = message.senderType === 'AI'
                      return (
                        <div key={message.id} className={`flex ${agent || ai ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-lg rounded-2xl px-4 py-3 text-[13px] leading-6 shadow-sm ${agent ? 'bg-[#ff1268] text-white' : ai ? 'bg-[#f3e8ff] text-[#6b21a8]' : 'bg-white text-[#374151]'}`}>
                            <div className={`mb-1 flex items-center justify-between gap-4 text-[10px] ${agent ? 'text-white/75' : ai ? 'text-[#9333ea]' : 'text-[#9ca3af]'}`}>
                              <span>{getSenderLabel(message)}</span>
                              <span>{formatTime(message.createTime)}</span>
                            </div>
                            <div className="whitespace-pre-wrap">{message.content}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-[#e5e7eb] bg-white px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#374151]">
                    <ClipboardCheck className="h-4 w-4 text-[#ff1268]" />
                    内部经办备注
                  </div>
                  <span className="text-[10px] text-[#9ca3af]">仅客服与主管可见</span>
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    value={noteDraft}
                    onChange={event => setNoteDraft(event.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="记录处理结论、待跟进事项或交接信息"
                    className="min-h-[54px] min-w-0 flex-1 resize-none rounded-md border border-[#e5e7eb] px-3 py-2 text-[12px] text-[#374151] outline-none focus:border-[#ff1268]"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveNote()}
                    disabled={submitting || !noteDraft.trim()}
                    title="保存内部备注"
                    aria-label="保存内部备注"
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-[#111827] px-3 text-[12px] font-medium text-white hover:bg-[#374151] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                    保存
                  </button>
                </div>
              </div>
            </div>

            <aside className="w-[300px] shrink-0 overflow-y-auto border-l border-[#e5e7eb] bg-white">
              <div className="sticky top-0 z-10 flex border-b border-[#edf0f3] bg-white px-3 py-2">
                <button
                  type="button"
                  onClick={() => setActiveRightTab('orders')}
                  className={`flex-1 rounded-md px-2 py-2 text-[12px] font-medium ${activeRightTab === 'orders' ? 'bg-[#fff0f5] text-[#ff1268]' : 'text-[#6b7280] hover:bg-[#f8f9fb]'}`}
                >
                  订单与质检
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightTab('history')}
                  className={`flex-1 rounded-md px-2 py-2 text-[12px] font-medium ${activeRightTab === 'history' ? 'bg-[#fff0f5] text-[#ff1268]' : 'text-[#6b7280] hover:bg-[#f8f9fb]'}`}
                >
                  用户全历史轨迹
                </button>
              </div>
              {activeRightTab === 'orders' ? (
                <>
              <section className="border-b border-[#edf0f3] px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#111827]">
                    <Ticket className="h-4 w-4 text-[#ff1268]" />
                    关联演出与订单
                  </div>
                  {loadingOrders ? <span className="text-[10px] text-[#9ca3af]">加载中</span> : null}
                </div>
                {orders.length === 0 ? (
                  <div className="mt-3 rounded-md bg-[#f8f9fb] px-3 py-4 text-center text-[11px] text-[#9ca3af]">暂无近期订单</div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {orders.slice(0, 2).map((order, index) => (
                      <div key={`${order.orderId || order.orderNo || index}`} className="border-b border-[#f1f3f5] pb-3 last:border-0 last:pb-0">
                        <div className="truncate text-[12px] font-medium text-[#374151]">{order.activityName || '暂无演出名称'}</div>
                        <div className="mt-1 text-[11px] text-[#6b7280]">{order.sessionTime || '暂无场次'} · {order.ticketName || '暂无票档'}</div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[#9ca3af]">
                          <span className="truncate">订单：{order.orderNo || order.orderId || '暂无编号'}</span>
                          <span className="shrink-0 text-[#15803d]">{getOrderStatusLabel(order)}</span>
                        </div>
                        {order.seatLabels ? <div className="mt-1 truncate text-[10px] text-[#9ca3af]">座位：{order.seatLabels}</div> : null}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="border-b border-[#edf0f3] px-4 py-4">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#111827]">
                  <Star className="h-4 w-4 text-[#f59e0b]" />
                  主管质检
                </div>
                <div className="mt-3 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(value => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAuditScore(value)}
                      disabled={!canAudit || submitting}
                      title={`${value} 星`}
                      aria-label={`${value} 星`}
                      className="rounded p-1 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Star className={`h-5 w-5 ${value <= auditScore ? 'fill-[#f59e0b] text-[#f59e0b]' : 'text-[#d1d5db]'}`} />
                    </button>
                  ))}
                  <span className="ml-1 text-[11px] text-[#9ca3af]">{auditScore ? `${auditScore} 星` : '未评分'}</span>
                </div>
                <textarea
                  value={auditComments}
                  onChange={event => setAuditComments(event.target.value)}
                  disabled={!canAudit || submitting}
                  rows={3}
                  placeholder="填写质检评语"
                  className="mt-3 w-full resize-none rounded-md border border-[#e5e7eb] px-3 py-2 text-[12px] text-[#374151] outline-none focus:border-[#ff1268] disabled:bg-[#f8f9fb]"
                />
                <label className="mt-3 flex items-center gap-2 text-[11px] text-[#6b7280]">
                  <input
                    type="checkbox"
                    checked={auditResolved}
                    onChange={event => setAuditResolved(event.target.checked)}
                    disabled={!canAudit || submitting}
                    className="accent-[#ff1268]"
                  />
                  服务已解决
                </label>
                <button
                  type="button"
                  onClick={() => void handleAudit()}
                  disabled={!canAudit || submitting || !auditScore}
                  className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-[#111827] text-[12px] font-medium text-white hover:bg-[#374151] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  保存质检结果
                </button>
                {!canReview ? <div className="mt-2 text-[10px] text-[#9ca3af]">当前账号暂无质检查看权限</div> : !canAudit ? <div className="mt-2 text-[10px] text-[#9ca3af]">当前账号暂无质检写入权限</div> : null}
              </section>

              <section className="px-4 py-4">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#111827]">
                  <Clock3 className="h-4 w-4 text-[#6b7280]" />
                  生命周期轨迹
                </div>
                <div className="mt-4 space-y-4">
                  <TimelineItem label="会话接入" time={selectedSession.createTime} />
                  <TimelineItem label={selectedSession.sourceType === 'AI' ? 'AI 分流' : '人工路由'} time={selectedSession.updateTime || selectedSession.createTime} />
                  {selectedSession.assignedAgentName ? <TimelineItem label={`转接至 ${selectedSession.assignedAgentName}`} time={selectedSession.updateTime} /> : null}
                  {selectedSession.slaOverdue ? <TimelineItem label="触发 SLA 超时预警" time={selectedSession.updateTime} danger={Boolean(selectedSession.slaOverdue)} /> : null}
                  {selectedSession.closedAt ? <TimelineItem label="会话关闭" time={selectedSession.closedAt} /> : null}
                </div>
                {notes.length > 0 ? (
                  <div className="mt-5 border-t border-[#f1f3f5] pt-4">
                    <div className="mb-2 text-[11px] font-semibold text-[#6b7280]">最近内部备注</div>
                    <div className="space-y-2">
                      {notes.slice(-3).reverse().map(note => (
                        <div key={note.id} className="rounded-md bg-[#f8f9fb] px-3 py-2">
                          <div className="text-[10px] text-[#9ca3af]">{note.authorDisplayName || '客服'} · {formatTime(note.createTime)}</div>
                          <div className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-[#4b5563]">{note.content}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
                </>
              ) : (
                <section className="px-4 py-4">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#111827]">
                    <History className="h-4 w-4 text-[#6b7280]" />
                    用户全历史轨迹
                  </div>
                  {loadingHistory ? (
                    <div className="py-10 text-center text-[11px] text-[#9ca3af]">正在加载用户历史轨迹...</div>
                  ) : history.length === 0 ? (
                    <div className="mt-4 rounded-md bg-[#f8f9fb] px-3 py-5 text-center text-[11px] text-[#9ca3af]">暂无可见历史会话</div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {history.map(item => (
                        <div key={item.sessionId} className="relative flex gap-3">
                          <div className="relative z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white bg-[#ff1268]" />
                          <div className="min-w-0 flex-1 border-b border-[#f1f3f5] pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 truncate text-[12px] font-medium text-[#374151]">
                                {item.category || '客服会话'}
                              </div>
                              <span className={`shrink-0 text-[10px] ${item.status === 'CLOSED' ? 'text-[#15803d]' : 'text-[#ff1268]'}`}>
                                {item.status === 'CLOSED' ? '已办结' : '进行中'}
                              </span>
                            </div>
                            <div className="mt-1 text-[10px] text-[#9ca3af]">
                              会话 #{item.sessionId} · {formatTime(item.createdAt)}
                            </div>
                            <div className="mt-1 text-[11px] text-[#6b7280]">
                              负责坐席：{item.agentName || '未分配'}
                            </div>
                            {item.closedAt || item.closeReason ? (
                              <div className="mt-1 text-[11px] text-[#6b7280]">
                                结单：{formatTime(item.closedAt)}{item.closeReason ? ` · ${item.closeReason}` : ''}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </aside>
          </>
        )}
      </section>

      <Modal
        open={Boolean(actionDialog)}
        onClose={() => { if (!submitting) setActionDialog(null) }}
        title={actionDialog?.type === 'transfer' ? '转接客服组' : '升级工单'}
        size="lg"
        loading={submitting}
        footer={(
          <>
            <button
              type="button"
              onClick={() => setActionDialog(null)}
              disabled={submitting}
              className="rounded-md border border-[#e5e7eb] px-4 py-2 text-[13px] text-[#6b7280] disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleSubmitAction()}
              disabled={submitting}
              className="rounded-md bg-[#ff1268] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
            >
              {actionDialog?.type === 'transfer' ? '确认转接' : '确认升级'}
            </button>
          </>
        )}
      >
        {actionDialog?.type === 'transfer' ? (
          <div className="space-y-4">
            <p className="text-[13px] leading-6 text-[#6b7280]">选择目标技能组和坐席，转接附言会同步写入会话事件和操作审计。</p>
            <label className="block text-[13px] font-medium text-[#374151]">
              目标技能组
              <select
                value={actionDialog.groupId}
                onChange={event => setActionDialog({ ...actionDialog, groupId: event.target.value, agentId: '' })}
                className="mt-1 h-10 w-full rounded-md border border-[#e5e7eb] px-3 text-[13px] outline-none focus:border-[#ff1268]"
              >
                <option value="">请选择技能组</option>
                {orgTree?.groups.map(group => <option key={group.id} value={group.id}>{group.groupName}</option>)}
              </select>
            </label>
            <label className="block text-[13px] font-medium text-[#374151]">
              目标坐席
              <select
                value={actionDialog.agentId}
                onChange={event => setActionDialog({ ...actionDialog, agentId: event.target.value })}
                disabled={!actionDialog.groupId}
                className="mt-1 h-10 w-full rounded-md border border-[#e5e7eb] px-3 text-[13px] outline-none focus:border-[#ff1268] disabled:bg-[#f8f9fb]"
              >
                <option value="">请选择坐席</option>
                {transferAgents.map(agent => <option key={agent.userId} value={agent.userId}>{agent.agentName}（{getAgentStatusLabel(agent.agentStatus)}）</option>)}
              </select>
            </label>
            <label className="block text-[13px] font-medium text-[#374151]">
              转接附言
              <textarea
                value={actionDialog.note}
                onChange={event => setActionDialog({ ...actionDialog, note: event.target.value })}
                rows={4}
                placeholder="请填写转接背景和待跟进事项"
                className="mt-1 w-full resize-none rounded-md border border-[#e5e7eb] px-3 py-2 text-[13px] outline-none focus:border-[#ff1268]"
              />
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[13px] leading-6 text-[#6b7280]">升级后将当前会话标记为疑难工单，并记录主管操作审计。</p>
            <label className="block text-[13px] font-medium text-[#374151]">
              升级说明
              <textarea
                value={actionDialog?.note || ''}
                onChange={event => setActionDialog(current => current ? { ...current, note: event.target.value } : current)}
                rows={4}
                placeholder="请输入需要二线处理的原因（选填）"
                className="mt-1 w-full resize-none rounded-md border border-[#e5e7eb] px-3 py-2 text-[13px] outline-none focus:border-[#ff1268]"
              />
            </label>
          </div>
        )}
        {detailError ? <div className="mt-4 rounded-md bg-[#fef2f2] px-3 py-2 text-[12px] text-[#dc2626]">{detailError}</div> : null}
      </Modal>
    </div>
  )
}

function TreeButton({
  active,
  icon,
  label,
  activeCount,
  totalCount,
  warningCount,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  activeCount: number
  totalCount: number
  warningCount?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-[12px] ${active ? 'bg-[#fff0f5] text-[#ff1268]' : 'text-[#4b5563] hover:bg-[#f8f9fb]'}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-[10px] text-[#6b7280]">{activeCount} 待办 / {totalCount} 结单</span>
      {warningCount ? <span className="shrink-0 rounded-full bg-[#fef2f2] px-1.5 py-0.5 text-[10px] text-[#dc2626]">{warningCount}</span> : null}
    </button>
  )
}

function SkillGroupTreeNode({
  group,
  expanded,
  selection,
  onToggle,
  onSelectGroup,
  onSelectAgent,
}: {
  group: CsSkillGroupVO
  expanded: boolean
  selection: CustomerServiceOrgSelection
  onToggle: () => void
  onSelectGroup: () => void
  onSelectAgent: (agentId: number) => void
}) {
  return (
    <div className="mb-1">
      <div className={`flex items-center rounded-md ${selection.type === 'group' && selection.groupId === group.id ? 'bg-[#fff0f5]' : 'hover:bg-[#f8f9fb]'}`}>
        <button
          type="button"
          onClick={onToggle}
          title={expanded ? '收起技能组' : '展开技能组'}
          aria-label={expanded ? '收起技能组' : '展开技能组'}
          className="p-2 text-[#9ca3af]"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? '' : '-rotate-90'}`} />
        </button>
        <button type="button" onClick={onSelectGroup} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left">
          <UsersRound className="h-4 w-4 shrink-0 text-[#6b7280]" />
          <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#374151]">{group.groupName}</span>
          <span className="shrink-0 text-[10px] text-[#6b7280]">{group.activeCount} / {group.totalCount}</span>
        </button>
      </div>
      {expanded ? (
        <div className="ml-7 border-l border-[#edf0f3] pl-2">
          <div className="px-2 py-1 text-[10px] text-[#9ca3af]">主管：{group.leaderName || '未配置'} · 待认领 {group.waitingCount}</div>
          {group.agents.map(agent => (
            <button
              key={agent.userId}
              type="button"
              onClick={() => onSelectAgent(agent.userId)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left ${selection.type === 'agent' && selection.agentId === agent.userId ? 'bg-[#fff0f5]' : 'hover:bg-[#f8f9fb]'}`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${getAgentStatusClassName(agent.agentStatus)}`} />
              <span className="min-w-0 flex-1 truncate text-[11px] text-[#4b5563]">{agent.agentName}</span>
              <span className="shrink-0 text-[10px] text-[#6b7280]">{agent.activeSessionCount} / {agent.totalCount}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function TimelineItem({ label, time, danger = false }: { label: string; time?: string | null; danger?: boolean }) {
  return (
    <div className="relative flex gap-3">
      <div className={`relative z-10 mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white ${danger ? 'bg-[#ef4444]' : 'bg-[#ff1268]'}`} />
      <div className="min-w-0">
        <div className={`text-[11px] font-medium ${danger ? 'text-[#dc2626]' : 'text-[#4b5563]'}`}>{label}</div>
        <div className="mt-0.5 text-[10px] text-[#9ca3af]">{formatTime(time)}</div>
      </div>
    </div>
  )
}

function HeadsetEmptyIcon() {
  return <MessageSquareText className="h-10 w-10 text-[#d1d5db]" />
}
