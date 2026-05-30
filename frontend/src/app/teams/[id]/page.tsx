'use client'

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Footer } from '@/components/Footer'
import { globalAlert, globalConfirm } from '@/components/GlobalDialog'
import { Header } from '@/components/Header'
import { AlipayQrPayModal } from '@/components/AlipayQrPayModal'
import { TeamMemberList } from '@/components/team-grab/TeamMemberList'
import { TeamStrategyPicker } from '@/components/team-grab/TeamStrategyPicker'
import {
  confirmTeamGrab,
  createAlipayQrPay,
  getGrabProgress,
  getTeamGrab,
  leaveTeamGrab,
  removeTeamGrabMember,
  syncTeamGrabPaid,
  triggerTeamGrab,
  updateTeamGrabStrategy,
} from '@/lib/api'
import { getUser, isAuthenticated } from '@/lib/auth'
import {
  canShowPayButton,
  canTriggerTeamGrab,
  confirmedMemberCount,
  teamMemberSeatAssignmentLabel,
  teamStatusLabel,
  triggerTeamGrabWithRecovery,
} from '@/lib/team-grab'
import type {
  GrabProgressResult,
  GrabStatus,
  QrPayResponse,
  TeamSeatStrategy,
  TeamStatus,
  TicketTeamDetailVO,
} from '@/types/api'

const EDITABLE_STATUSES = new Set<TeamStatus>(['DRAFT', 'READY', 'FAILED', 'EXPIRED'])
const TERMINAL_GRAB_STATUSES = new Set<GrabStatus>([
  'ORDER_CREATED',
  'FAILED',
  'SOLD_OUT',
  'LIMITED',
  'EXPIRED',
])

const GRAB_STATUS_LABELS: Record<GrabStatus, string> = {
  QUEUED: '排队中',
  WAITING: '等待处理',
  TRYING_TICKET_TYPE: '正在尝试票档',
  LOCKING: '正在锁票',
  DOWNGRADING: '正在尝试保底',
  PENDING: '待处理',
  ACCEPTED: '已受理',
  ORDER_CREATING: '正在生成订单',
  ORDER_CREATED: '已生成订单',
  SOLD_OUT: '已售罄',
  PENDING_RECOVERY: '订单确认中',
  LIMITED: '限购失败',
  FAILED: '抢票失败',
  EXPIRED: '已结束',
}

export default function TeamRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const teamId = Number(id)
  const [detail, setDetail] = useState<TicketTeamDetailVO | null>(null)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [removingUserId, setRemovingUserId] = useState<number | null>(null)
  const [strategySaving, setStrategySaving] = useState(false)
  const [syncingPaid, setSyncingPaid] = useState(false)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [progress, setProgress] = useState<GrabProgressResult | null>(null)
  const [qrPay, setQrPay] = useState<QrPayResponse | null>(null)
  const pollTickRef = useRef(0)
  const stoppedRequestIdsRef = useRef(new Set<string>())

  const loadTeam = useCallback(async () => {
    if (!Number.isSafeInteger(teamId) || teamId <= 0) {
      setError('小队不存在')
      setLoading(false)
      return
    }
    if (!isAuthenticated()) {
      router.replace(`/login?ru=/teams/${id}`)
      return
    }

    const user = getUser()
    setCurrentUserId(user?.userId ?? null)
    setError('')
    try {
      const data = await getTeamGrab(teamId)
      setDetail(data)
      if (data.latestGrabRequestId && !requestId && !stoppedRequestIdsRef.current.has(data.latestGrabRequestId)) {
        setRequestId(data.latestGrabRequestId)
      }
    } catch (err: unknown) {
      setDetail(null)
      setError(err instanceof Error ? err.message : '加载小队失败')
    } finally {
      setLoading(false)
    }
  }, [id, requestId, router, teamId])

  useEffect(() => {
    void loadTeam()
  }, [loadTeam])

  useEffect(() => {
    if (!requestId) return

    let cancelled = false
    const poll = async () => {
      try {
        const nextProgress = await getGrabProgress(requestId)
        if (cancelled) return
        setProgress(nextProgress)
        pollTickRef.current += 1
        if (TERMINAL_GRAB_STATUSES.has(nextProgress.status)) {
          stoppedRequestIdsRef.current.add(requestId)
          await loadTeam()
          setRequestId(null)
          return
        }
        if (pollTickRef.current % 5 === 0) {
          await loadTeam()
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '抢票进度查询失败')
        }
      }
    }

    void poll()
    const timer = window.setInterval(() => {
      void poll()
    }, 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [loadTeam, requestId])

  const team = detail?.team
  const currentMember = useMemo(
    () => detail?.members.find(member => member.userId === currentUserId) ?? null,
    [currentUserId, detail?.members],
  )
  const isLeader = Boolean(team && currentUserId === team.leaderUserId)
  const canEditStrategy = Boolean(team && isLeader && EDITABLE_STATUSES.has(team.status))
  const canRemoveMembers = Boolean(team && isLeader && EDITABLE_STATUSES.has(team.status))
  const canLeave = Boolean(team && currentMember && !isLeader && EDITABLE_STATUSES.has(team.status))
  const confirmedCount = detail ? confirmedMemberCount(detail.members) : 0
  const assignedMembers = detail?.members.filter(member => teamMemberSeatAssignmentLabel(member)) ?? []
  const inviteLink = team ? `/teams/${team.id}` : ''
  const canPay = Boolean(team && currentUserId && detail?.latestOrderId && canShowPayButton(team, currentUserId))
  const canTrigger = Boolean(detail && currentUserId && canTriggerTeamGrab(detail, currentUserId))
  const terminalProgress = progress ? TERMINAL_GRAB_STATUSES.has(progress.status) : false

  const handleUpdateStrategy = async (strategy: TeamSeatStrategy, fallbacks: TeamSeatStrategy[]) => {
    if (!team) return
    setStrategySaving(true)
    try {
      await updateTeamGrabStrategy(team.id, { strategy, fallbacks })
      await loadTeam()
      await globalAlert('策略已保存')
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '保存策略失败')
    } finally {
      setStrategySaving(false)
    }
  }

  const handleConfirm = async () => {
    if (!team) return
    setActionLoading(true)
    try {
      await confirmTeamGrab(team.id)
      await loadTeam()
      await globalAlert('已确认参与')
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '确认参与失败')
    } finally {
      setActionLoading(false)
    }
  }

  const handleTrigger = async () => {
    if (!team) return
    setActionLoading(true)
    try {
      await triggerTeamGrabWithRecovery({
        teamId: team.id,
        triggerTeamGrab,
        loadTeam,
        setRequestId,
        clearProgress: () => setProgress(null),
        showError: (message) => globalAlert(message),
        fallbackErrorMessage: '发起小队抢票失败',
      })
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '发起小队抢票失败')
    } finally {
      setActionLoading(false)
    }
  }

  const handleOpenPay = async () => {
    if (!detail?.latestOrderId) return
    setActionLoading(true)
    try {
      const pay = await createAlipayQrPay(detail.latestOrderId)
      setQrPay(pay)
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '创建支付二维码失败')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSyncPaid = async () => {
    if (!team) return
    setSyncingPaid(true)
    try {
      await syncTeamGrabPaid(team.id)
      await loadTeam()
      await globalAlert('支付状态已同步')
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '同步支付状态失败')
    } finally {
      setSyncingPaid(false)
    }
  }

  const handleLeave = async () => {
    if (!team) return
    if (!(await globalConfirm('确认退出该小队？'))) return
    setActionLoading(true)
    try {
      await leaveTeamGrab(team.id)
      router.push(team.activityId ? `/activity/${team.activityId}` : '/')
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '退出小队失败')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveMember = async (memberUserId: number) => {
    if (!team) return
    if (!(await globalConfirm('确认移除该成员？'))) return
    setRemovingUserId(memberUserId)
    try {
      await removeTeamGrabMember(team.id, memberUserId)
      await loadTeam()
    } catch (err: unknown) {
      await globalAlert(err instanceof Error ? err.message : '移除成员失败')
    } finally {
      setRemovingUserId(null)
    }
  }

  const copyInvite = async () => {
    if (!team) return
    const text = `小队 ID：${team.id}\n邀请码：${team.inviteCode}\n链接：${inviteLink}`
    try {
      await navigator.clipboard.writeText(text)
      await globalAlert('邀请信息已复制')
    } catch {
      await globalAlert(text, '邀请信息')
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <main className="mx-auto w-full max-w-[1120px] px-5 py-16 text-center text-[14px] text-[#999]">加载中...</main>
        <Footer />
      </>
    )
  }

  if (error || !detail || !team) {
    return (
      <>
        <Header />
        <main className="mx-auto w-full max-w-[1120px] px-5 py-16 text-center">
          <p className="mb-5 text-[14px] text-[#999]">{error || '小队不存在'}</p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="rounded border border-[#ddd] bg-white px-5 py-2 text-[14px] text-[#666]"
            >
              返回首页
            </button>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-[1120px] px-5 py-8">
        <div className="mb-5 flex flex-col gap-4 border-b border-[#e5e5e5] bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-medium text-[#111]">小队房间 #{team.id}</h1>
              <span className="rounded-full bg-[#fff0f5] px-3 py-1 text-[12px] font-medium text-[#ff1268]">
                {teamStatusLabel(team.status)}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-[#777]">
              <span>活动 {team.activityId}</span>
              <span>场次 {team.sessionId}</span>
              <span>票档 {team.ticketTypeId}</span>
              <span>已确认 {confirmedCount}/{team.size}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {currentMember?.status === 'JOINED' && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={actionLoading}
                className="min-h-10 rounded bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                确认参与
              </button>
            )}
            {canTrigger && (
              <button
                type="button"
                onClick={handleTrigger}
                disabled={actionLoading || Boolean(progress && !terminalProgress)}
                className="min-h-10 rounded bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                为小队抢票
              </button>
            )}
            {canLeave && (
              <button
                type="button"
                onClick={handleLeave}
                disabled={actionLoading}
                className="min-h-10 rounded border border-[#ddd] bg-white px-4 py-2 text-[14px] text-[#666] disabled:cursor-not-allowed disabled:opacity-60"
              >
                退出小队
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[16px] font-medium text-[#111]">成员</h2>
              <span className="text-[13px] text-[#999]">{confirmedCount} 人已确认</span>
            </div>
            <TeamMemberList
              members={detail.members}
              leaderUserId={team.leaderUserId}
              currentUserId={currentUserId}
              canRemoveMembers={canRemoveMembers}
              removingUserId={removingUserId}
              onRemoveMember={handleRemoveMember}
            />
          </section>

          <section className="bg-white p-5">
            <h2 className="mb-4 text-[16px] font-medium text-[#111]">策略</h2>
            <TeamStrategyPicker
              strategy={team.strategy}
              fallbacks={team.fallbacks}
              disabled={!canEditStrategy}
              saving={strategySaving}
              onUpdate={handleUpdateStrategy}
            />
          </section>

          <section className="bg-white p-5">
            <h2 className="mb-4 text-[16px] font-medium text-[#111]">邀请</h2>
            <div className="space-y-3 text-[13px] text-[#555]">
              <div className="flex flex-wrap justify-between gap-3 border-b border-[#f0f0f0] pb-3">
                <span className="text-[#999]">小队 ID</span>
                <span className="font-medium text-[#333]">{team.id}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-3 border-b border-[#f0f0f0] pb-3">
                <span className="text-[#999]">邀请码</span>
                <span className="font-medium text-[#333]">{team.inviteCode}</span>
              </div>
              <div className="break-all border-b border-[#f0f0f0] pb-3">
                <div className="mb-1 text-[#999]">链接</div>
                <div className="text-[#333]">{inviteLink}</div>
              </div>
              <button
                type="button"
                onClick={copyInvite}
                className="min-h-10 rounded border border-[#ff1268] bg-white px-4 py-2 text-[14px] font-medium text-[#ff1268] hover:bg-[#fff0f5]"
              >
                复制邀请信息
              </button>
            </div>
          </section>

          <section className="bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[16px] font-medium text-[#111]">锁票订单</h2>
              {(team.status === 'LOCKED' || team.status === 'PAID') && (
                <button
                  type="button"
                  onClick={handleSyncPaid}
                  disabled={syncingPaid}
                  className="min-h-9 rounded border border-[#ddd] bg-white px-3 py-1.5 text-[13px] text-[#666] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {syncingPaid ? '同步中...' : '同步支付状态'}
                </button>
              )}
            </div>
            <div className="rounded border border-[#e5e5e5] bg-[#fafafa] p-4 text-[13px] text-[#555]">
              {team.status === 'LOCKED' && detail.latestOrderId ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium text-[#333]">订单 {detail.latestOrderId}</div>
                    <div className="mt-1 text-[#999]">{isLeader ? '请完成支付' : '队长待支付'}</div>
                  </div>
                  {canPay && (
                    <button
                      type="button"
                      onClick={handleOpenPay}
                      disabled={actionLoading}
                      className="min-h-10 rounded bg-[#ff1268] px-4 py-2 text-[14px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      支付
                    </button>
                  )}
                </div>
              ) : team.status === 'PAID' ? (
                <div className="font-medium text-[#22c55e]">已支付</div>
              ) : (
                <div className="text-[#999]">暂无锁票订单</div>
              )}
            </div>
          </section>

          <section className="bg-white p-5 lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[16px] font-medium text-[#111]">抢票进度</h2>
              {requestId && <span className="text-[12px] text-[#999]">requestId {requestId}</span>}
            </div>
            {progress ? (
              <div className="grid gap-3 text-[13px] sm:grid-cols-3">
                <div className="rounded border border-[#e5e5e5] p-3">
                  <div className="text-[#999]">状态</div>
                  <div className="mt-1 font-medium text-[#333]">{GRAB_STATUS_LABELS[progress.status]}</div>
                </div>
                <div className="rounded border border-[#e5e5e5] p-3">
                  <div className="text-[#999]">排队</div>
                  <div className="mt-1 text-[#333]">
                    {progress.queueRank != null ? `前方 ${progress.queueRank} 人` : `序号 ${progress.queueSeq ?? '-'}`}
                  </div>
                </div>
                <div className="rounded border border-[#e5e5e5] p-3">
                  <div className="text-[#999]">消息</div>
                  <div className="mt-1 text-[#333]">{progress.message || progress.failReason || '-'}</div>
                </div>
              </div>
            ) : (
              <div className="rounded border border-[#e5e5e5] bg-[#fafafa] px-4 py-5 text-[13px] text-[#999]">
                暂无进行中的抢票
              </div>
            )}
          </section>

          <section className="bg-white p-5 lg:col-span-2">
            <h2 className="mb-4 text-[16px] font-medium text-[#111]">座位分配</h2>
            {assignedMembers.length > 0 ? (
              <div className="overflow-hidden rounded border border-[#e5e5e5]">
                {assignedMembers.map(member => (
                  <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f0f0] px-4 py-3 text-[13px] last:border-b-0">
                    <span className="font-medium text-[#333]">用户 {member.userId}</span>
                    <span className="text-[#666]">{teamMemberSeatAssignmentLabel(member)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded border border-[#e5e5e5] bg-[#fafafa] px-4 py-5 text-[13px] text-[#999]">
                暂无座位分配
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />

      {qrPay && (
        <AlipayQrPayModal
          pay={qrPay}
          productName={`小队订单 ${team.id}`}
          onClose={() => setQrPay(null)}
          onPaid={() => {
            setQrPay(null)
            void handleSyncPaid()
          }}
        />
      )}
    </>
  )
}
