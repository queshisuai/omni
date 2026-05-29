import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { GrabAdmissionService } from './grab-admission.service';
import { GrabQueueService } from './grab-queue.service';
import { ACTIVE_ASYNC_PROGRESS_STATUSES, GrabRepository, isUniqueViolation } from './grab.repository';
import { GRAB_STATUS } from './grab-status';
import type { GrabProgressResponse, GrabRequestRecord, GrabRequestResponse, GrabTicketPreference, SubmitGrabRequestDto } from './grab.types';
import { OrderClientService } from './order-client.service';

const ACTIVE_ASYNC_PROGRESS_STATUS_SET = new Set<string>(ACTIVE_ASYNC_PROGRESS_STATUSES);
const RELEASEABLE_PROGRESS_STATUSES = new Set(['LOCKING', 'ORDER_CREATING']);
const TERMINAL_CANCEL_STATUSES = new Set<string>([
  GRAB_STATUS.ORDER_CREATED,
  GRAB_STATUS.SOLD_OUT,
  GRAB_STATUS.LIMITED,
  GRAB_STATUS.FAILED,
  GRAB_STATUS.EXPIRED,
]);

@Injectable()
export class GrabService {
  private readonly requestTtlSeconds = 900;

  constructor(
    private readonly repository: GrabRepository,
    private readonly admissionService: GrabAdmissionService,
    private readonly orderClient: OrderClientService,
    private readonly queueService: GrabQueueService,
  ) {}

  async submitRequest(userId: number, dto: SubmitGrabRequestDto): Promise<GrabRequestResponse> {
    this.validateSubmitRequest(dto);
    const requestedTicketTypes = this.normalizePreferences(dto);
    const firstPreference = requestedTicketTypes[0];

    const existing = await this.repository.findByUserAndIdempotency(userId, dto.idempotencyKey);
    if (existing) return this.toResponse(existing);

    const requestId = this.generateRequestId();
    const seatIds = [...(dto.seatIds ?? [])].sort((a, b) => a - b);
    const allocateRandom = Boolean(dto.allocateRandom);
    const active = await this.repository.findActiveByIntent({
      userId,
      sessionId: dto.sessionId,
      ticketTypeId: firstPreference.ticketTypeId,
      quantity: dto.quantity,
      seatIds,
      allocateRandom,
    });
    if (active) return this.toResponse(active);

    const queued = await this.queueService.enqueue({ requestId, sessionId: dto.sessionId, userId });

    let created: GrabRequestRecord;
    try {
      created = await this.repository.createQueued({
        requestId,
        idempotencyKey: dto.idempotencyKey,
        userId,
        sessionId: dto.sessionId,
        ticketTypeId: firstPreference.ticketTypeId,
        quantity: dto.quantity,
        seatIds,
        allocateRandom,
        expireTime: new Date(Date.now() + this.requestTtlSeconds * 1000),
        queueSeq: queued.queueSeq,
        requestedTicketTypes,
        allowAutoDowngrade: Boolean(dto.allowAutoDowngrade) && requestedTicketTypes.length > 1,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const record = await this.repository.findByUserAndIdempotency(userId, dto.idempotencyKey);
        if (record) return this.toResponse(record);
      }
      throw error;
    }

    return this.toResponse(created, queued.queueRank);
  }

  async getRequest(userId: number, requestId: string): Promise<GrabRequestResponse> {
    const record = await this.repository.findByRequestId(requestId);
    if (!record) throw new NotFoundException('grab request not found');
    if (record.userId !== userId) throw new ForbiddenException('cannot view another user grab request');
    return this.toResponse(record);
  }

  async getProgress(userId: number, requestId: string): Promise<GrabProgressResponse> {
    const record = await this.repository.findByRequestId(requestId);
    if (!record) throw new NotFoundException('grab request not found');
    if (record.userId !== userId) throw new ForbiddenException('cannot view another user grab request');
    const queueRank = record.queueSeq == null ? null : await this.queueService.calculateQueueRank(record.sessionId, record.queueSeq);

    return {
      requestId: record.requestId,
      sessionId: record.sessionId,
      status: record.progressStatus,
      orderId: record.orderId,
      failReason: record.failReason,
      queueSeq: record.queueSeq,
      queueRank,
      estimatedWaitSeconds: null,
      currentTicketTypeId: record.currentTicketTypeId,
      currentAttemptIndex: record.currentAttemptIndex,
      requestedTicketTypes: record.requestedTicketTypes,
      attempts: record.attemptsSnapshot,
      visibleStock: null,
      message: record.progressMessage,
      matchedTicketTypeId: record.matchedTicketTypeId,
      updateTime: record.updatedAt.toISOString(),
    };
  }

  async cancelRequest(userId: number, requestId: string): Promise<GrabRequestResponse> {
    const record = await this.repository.findByRequestId(requestId);
    if (!record) throw new NotFoundException('grab request not found');
    if (record.userId !== userId) throw new ForbiddenException('cannot cancel another user grab request');
    if (TERMINAL_CANCEL_STATUSES.has(record.status)) return this.toResponse(record);
    if (record.orderId) return this.toResponse(record);
    const progressStatus = record.progressStatus;
    const hasCancelableProgress = ACTIVE_ASYNC_PROGRESS_STATUS_SET.has(progressStatus);
    const hasLegacyCancelableStatus = record.status === GRAB_STATUS.ACCEPTED || record.status === GRAB_STATUS.ORDER_CREATING;
    if (!hasCancelableProgress && !hasLegacyCancelableStatus) return this.toResponse(record);
    if (RELEASEABLE_PROGRESS_STATUSES.has(progressStatus) || (!hasCancelableProgress && hasLegacyCancelableStatus)) {
      await this.admissionService.release(record);
    }
    return this.toResponse(await this.repository.updateStatus(requestId, GRAB_STATUS.EXPIRED, 'grab request cancelled'));
  }

  private validateSubmitRequest(dto: SubmitGrabRequestDto): void {
    if (!Number.isInteger(dto.sessionId) || dto.sessionId <= 0) throw new BadRequestException('invalid session');
    if (!Number.isInteger(dto.quantity) || dto.quantity <= 0) throw new BadRequestException('invalid quantity');
    if (!dto.idempotencyKey?.trim()) throw new BadRequestException('idempotency key is required');
    if (dto.seatIds && dto.seatIds.length > 0 && dto.seatIds.length !== dto.quantity) throw new BadRequestException('invalid seat quantity');
  }

  private normalizePreferences(dto: SubmitGrabRequestDto): GrabTicketPreference[] {
    const preferences = dto.ticketTypePreferences?.length
      ? dto.ticketTypePreferences
      : dto.ticketTypeId == null
        ? []
        : [{ ticketTypeId: dto.ticketTypeId }];

    if (preferences.length === 0) throw new BadRequestException('ticket type is required');

    const normalized = preferences.map((preference) => {
      if (!Number.isInteger(preference.ticketTypeId) || preference.ticketTypeId <= 0) {
        throw new BadRequestException('invalid ticket type');
      }

      return {
        ticketTypeId: preference.ticketTypeId,
        name: preference.name ?? null,
        maxPrice: preference.maxPrice ?? null,
      };
    });

    if (dto.seatIds?.length && normalized.length > 1) {
      throw new BadRequestException('seat selection does not support auto downgrade');
    }

    if (!dto.allowAutoDowngrade) return [normalized[0]];

    return normalized;
  }

  private generateRequestId(): string {
    return `GRAB${randomBytes(12).toString('hex')}`;
  }

  private async toResponse(
    record: Pick<GrabRequestRecord, 'requestId' | 'status' | 'orderId' | 'failReason'> &
      Partial<Pick<GrabRequestRecord, 'sessionId' | 'progressStatus' | 'progressMessage' | 'queueSeq'>>,
    queueRank?: number | null,
  ): Promise<GrabRequestResponse> {
    const rank = queueRank ?? (
      record.queueSeq != null && record.sessionId != null
        ? await this.queueService.calculateQueueRank(record.sessionId, record.queueSeq)
        : null
    );

    return {
      requestId: record.requestId,
      status: record.progressStatus ?? record.status,
      orderId: record.orderId,
      failReason: record.failReason,
      queueSeq: record.queueSeq ?? null,
      queueRank: rank,
      estimatedWaitSeconds: null,
      message: record.progressMessage ?? null,
    };
  }
}
