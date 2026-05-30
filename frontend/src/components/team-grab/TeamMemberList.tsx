'use client'

import type { TeamMemberStatus, TicketTeamMemberVO } from '@/types/api'

const MEMBER_STATUS_LABELS: Record<TeamMemberStatus, string> = {
  INVITED: '已邀请',
  JOINED: '已加入',
  CONFIRMED: '已确认',
  LEFT: '已离队',
}

interface TeamMemberListProps {
  members: TicketTeamMemberVO[]
  leaderUserId: number
  currentUserId?: number | null
}

export function TeamMemberList({ members, leaderUserId, currentUserId }: TeamMemberListProps) {
  const sortedMembers = [...members].sort((a, b) => {
    if (a.userId === leaderUserId) return -1
    if (b.userId === leaderUserId) return 1
    return a.id - b.id
  })

  return (
    <div className="overflow-hidden rounded border border-[#e5e5e5] bg-white">
      <div className="hidden grid-cols-[1fr_120px_120px_1.2fr] border-b border-[#e5e5e5] bg-[#fafafa] px-4 py-3 text-[12px] font-medium text-[#777] sm:grid">
        <div>成员</div>
        <div>角色</div>
        <div>状态</div>
        <div>座位分配</div>
      </div>
      {sortedMembers.map(member => {
        const isLeader = member.userId === leaderUserId
        const isCurrent = currentUserId === member.userId
        const assignment = [
          member.seatId != null ? `seatId ${member.seatId}` : null,
          member.orderSeatId != null ? `orderSeatId ${member.orderSeatId}` : null,
        ].filter(Boolean).join(' / ')

        return (
          <div
            key={member.id}
            className="grid gap-2 border-b border-[#f0f0f0] px-4 py-3 text-[13px] text-[#333] last:border-b-0 sm:grid-cols-[1fr_120px_120px_1.2fr] sm:items-center"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">用户 {member.userId}</span>
                {isCurrent && (
                  <span className="rounded-full bg-[#fff0f5] px-2 py-0.5 text-[12px] text-[#ff1268]">我</span>
                )}
              </div>
              <div className="mt-1 text-[12px] text-[#999] sm:hidden">
                {isLeader ? '队长' : '成员'} - {MEMBER_STATUS_LABELS[member.status]}
              </div>
            </div>
            <div className="hidden text-[#666] sm:block">{isLeader ? '队长' : '成员'}</div>
            <div className="hidden text-[#666] sm:block">{MEMBER_STATUS_LABELS[member.status]}</div>
            <div className="text-[12px] text-[#777] sm:text-[13px]">
              {assignment || '未分配'}
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
