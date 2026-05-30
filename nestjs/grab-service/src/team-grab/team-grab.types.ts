export type TeamStatus = 'DRAFT' | 'READY' | 'GRABBING' | 'LOCKED' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
export type TeamMemberRole = 'LEADER' | 'MEMBER';
export type TeamMemberStatus = 'INVITED' | 'JOINED' | 'CONFIRMED' | 'LEFT';
export type TeamSeatStrategy = 'STRICT_CONTIGUOUS' | 'SAME_BLOCK' | 'SAME_TICKET_TYPE' | 'FALLBACK';

export interface CreateTeamDto {
  activityId: number;
  sessionId: number;
  ticketTypeId: number;
  strategy: TeamSeatStrategy;
  fallbacks: TeamSeatStrategy[];
}

export interface TicketTeamRecord {
  id: number;
  inviteCode: string;
  leaderUserId: number;
  activityId: number;
  sessionId: number;
  ticketTypeId: number;
  size: number;
  strategy: TeamSeatStrategy;
  fallbacks: TeamSeatStrategy[];
  status: TeamStatus;
  createTime: Date;
  updateTime: Date;
}

export interface TicketTeamMemberRecord {
  id: number;
  teamId: number;
  sessionId: number;
  userId: number;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  seatId: number | null;
  orderSeatId: number | null;
  joinTime: Date;
}

export interface TeamDetailServiceResponse {
  team: TicketTeamRecord;
  members: TicketTeamMemberRecord[];
  canTriggerGrab?: boolean;
  canPay?: boolean;
  latestGrabRequestId?: string | null;
  latestOrderId?: number | null;
}

export interface CreateTeamInput extends CreateTeamDto {
  leaderUserId: number;
  inviteCode: string;
}

export interface TeamGrabRequestRecord {
  id: number;
  requestId: string;
  grabRequestId: string | null;
  teamId: number;
  triggerUserId: number;
  payerUserId: number;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  strategy: TeamSeatStrategy;
  fallbacks: TeamSeatStrategy[];
  matchedStrategy: TeamSeatStrategy | null;
  status: 'PENDING' | 'GRABBING' | 'LOCKED' | 'ORDER_CREATED' | 'FAILED' | 'EXPIRED';
  orderId: number | null;
  lockedSeatIds: number[];
  seatLabels: string[];
  failReason: string | null;
  createTime: Date;
  updateTime: Date;
}

export interface CreateTeamGrabRequestInput {
  requestId: string;
  grabRequestId: string;
  teamId: number;
  triggerUserId: number;
  payerUserId: number;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  strategy: TeamSeatStrategy;
  fallbacks: TeamSeatStrategy[];
}

export interface TeamGrabTriggerResponse {
  requestId: string;
  queueSeq: number;
  queueRank: number;
  teamStatus: TeamStatus;
}
