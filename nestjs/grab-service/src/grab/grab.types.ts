import type { GrabStatus } from './grab-status';

export interface SubmitGrabRequestDto {
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  seatIds?: number[];
  allocateRandom?: boolean;
  idempotencyKey: string;
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
  allocateRandom: boolean;
  status: GrabStatus;
  orderId: number | null;
  failReason: string | null;
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
  allocateRandom: boolean;
  expireTime: Date;
}

export interface FindActiveGrabIntentInput {
  userId: number;
  sessionId: number;
  ticketTypeId: number;
  quantity: number;
  seatIds: number[];
  allocateRandom: boolean;
}

export interface GrabRequestResponse {
  requestId: string;
  status: GrabStatus;
  orderId: number | null;
  failReason: string | null;
}
