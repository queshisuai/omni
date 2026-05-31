import type { GrabStatus } from './grab-status';

export interface TicketTypePreferenceDto {
  ticketTypeId: number;
  name?: string;
  maxPrice?: number;
}

export interface SubmitGrabRequestDto {
  sessionId: number;
  ticketTypeId?: number;
  quantity: number;
  seatIds?: number[];
  attendeeIds?: number[];
  allocateRandom?: boolean;
  idempotencyKey: string;
  ticketTypePreferences?: TicketTypePreferenceDto[];
  allowAutoDowngrade?: boolean;
}

export interface GrabTicketPreference {
  ticketTypeId: number;
  name: string | null;
  maxPrice: number | null;
}

export interface GrabAttemptSnapshot {
  ticketTypeId: number;
  name: string | null;
  status: 'PENDING' | 'TRYING' | 'LOCKING' | 'SOLD_OUT' | 'LIMITED' | 'FAILED' | 'ORDER_CREATED';
  message: string;
}

export interface VisibleStockSnapshot {
  ticketTypeId: number;
  visibleStock: number | null;
  level: 'AVAILABLE' | 'LOW' | 'HOT' | 'SOLD_OUT' | 'UNKNOWN';
  snapshotTime: string;
}

export interface GrabRequestRecord {
  id: number;
  requestId: string;
  idempotencyKey: string;
  userId: number;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  seatIds: number[];
  attendeeIds?: number[];
  allocateRandom: boolean;
  status: GrabStatus;
  progressStatus: GrabStatus;
  progressMessage: string | null;
  orderId: number | null;
  failReason: string | null;
  requestType: 'NORMAL_GRAB' | 'TEAM_GRAB' | 'WAITLIST_OFFER';
  queueSeq: number | null;
  requestedTicketTypes: GrabTicketPreference[];
  allowAutoDowngrade: boolean;
  currentTicketTypeId: number | null;
  currentAttemptIndex: number;
  matchedTicketTypeId: number | null;
  attemptsSnapshot: GrabAttemptSnapshot[];
  workerId: string | null;
  workerClaimedAt: Date | null;
  processingStartedAt: Date | null;
  completedAt: Date | null;
  expireTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePendingGrabRequestInput {
  requestId: string;
  idempotencyKey: string;
  userId: number;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  seatIds: number[];
  attendeeIds?: number[];
  allocateRandom: boolean;
  expireTime: Date;
}

export interface CreateQueuedGrabRequestInput {
  requestId: string;
  idempotencyKey: string;
  userId: number;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  seatIds: number[];
  attendeeIds?: number[];
  allocateRandom: boolean;
  expireTime: Date;
  queueSeq: number;
  requestedTicketTypes: GrabTicketPreference[];
  allowAutoDowngrade: boolean;
  requestType?: 'NORMAL_GRAB' | 'TEAM_GRAB' | 'WAITLIST_OFFER';
}

export interface FindActiveGrabIntentInput {
  userId: number;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  seatIds: number[];
  attendeeIds?: number[];
  allocateRandom: boolean;
  requestedTicketTypes: GrabTicketPreference[];
  allowAutoDowngrade: boolean;
}

export interface GrabRequestResponse {
  requestId: string;
  status: GrabStatus;
  orderId: number | null;
  failReason: string | null;
  queueSeq?: number | null;
  queueRank?: number | null;
  estimatedWaitSeconds?: number | null;
  message?: string | null;
}

export interface GrabProgressResponse extends GrabRequestResponse {
  sessionId: number;
  currentTicketTypeId: number | null;
  currentAttemptIndex: number;
  requestedTicketTypes: GrabTicketPreference[];
  attempts: GrabAttemptSnapshot[];
  visibleStock: VisibleStockSnapshot | null;
  matchedTicketTypeId: number | null;
  updateTime: string;
}
