'use client'

import { teamMemberDisplayName, teamMemberSeatAssignmentLabel } from '@/lib/team-grab'
import type { TeamMemberStatus, TicketTeamMemberVO } from '@/types/api'

const MEMBER_STATUS_LABELS: Record<TeamMemberStatus, string> = {
  INVITED: '已邀请',
  JOINED: '已加入',
  CONFIRMED: '已确认',
  LEFT: '已离队',
}

function formatTeamMemberStatus(status: string) {
  return MEMBER_STATUS_LABELS[status as TeamMemberStatus] || '状态同步中'
}

interface TeamMemberListProps {
  members: TicketTeamMemberVO[]
  leaderUserId: number
  currentUserId?: number | null
  canRemoveMembers?: boolean
  removingUserId?: number | null
  onRemoveMember?: (userId: number) => void
}

export function TeamMemberList({
  members,
  leaderUserId,
  currentUserId,
  canRemoveMembers = false,
  removingUserId = null,
  onRemoveMember,
}: TeamMemberListProps) {
  const sortedMembers = [...members].sort((a, b) => {
    if (a.userId === leaderUserId) return -1
    if (b.userId === leaderUserId) return 1
    return a.id - b.id
  })

  return (
    <div className="overflow-hidden rounded border border-[#e5e5e5] bg-white">
      <div className="hidden grid-cols-[1fr_120px_120px_1.2fr_80px] border-b border-[#e5e5e5] bg-[#fafafa] px-4 py-3 text-[12px] font-medium text-[#777] sm:grid">
        <div>成员</div>
        <div>角色</div>
        <div>状态</div>
        <div>座位分配</div>
        <div></div>
      </div>
      {sortedMembers.map((member, index) => {
        const isLeader = member.userId === leaderUserId
        const isCurrent = currentUserId === member.userId
        const displayName = teamMemberDisplayName(member, { leaderUserId, currentUserId, index })
        const assignment = teamMemberSeatAssignmentLabel(member)
        const statusLabel = formatTeamMemberStatus(member.status)
        const canRemove = canRemoveMembers && !isLeader && member.status !== 'LEFT'

        return (
          <div
            key={member.id}
            className="grid gap-2 border-b border-[#f0f0f0] px-4 py-3 text-[13px] text-[#333] last:border-b-0 sm:grid-cols-[1fr_120px_120px_1.2fr_80px] sm:items-center"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{displayName}</span>
                {isCurrent && displayName !== '我' && (
                  <span className="rounded-full bg-[#fff0f5] px-2 py-0.5 text-[12px] text-[#ff1268]">我</span>
                )}
              </div>
              <div className="mt-1 text-[12px] text-[#999] sm:hidden">
                {isLeader ? '队长' : '成员'} - {statusLabel}
              </div>
            </div>
            <div className="hidden text-[#666] sm:block">{isLeader ? '队长' : '成员'}</div>
            <div className="hidden text-[#666] sm:block">{statusLabel}</div>
            <div className="text-[12px] text-[#777] sm:text-[13px]">
              {assignment || '未分配'}
            </div>
            <div className="flex justify-start sm:justify-end">
              {canRemove && (
                <button
                  type="button"
                  onClick={() => onRemoveMember?.(member.userId)}
                  disabled={removingUserId === member.userId}
                  className="min-h-8 rounded border border-[#ddd] bg-white px-3 py-1 text-[12px] text-[#666] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {removingUserId === member.userId ? '移除中...' : '移除'}
                </button>
              )}
            </div>
          </div>
        )
      })}
      {sortedMembers.length === 0 && (
        <div className="px-4 py-8 text-center text-[13px] text-[#999]">暂无成员</div>
      )}
    </div>
  )
}
