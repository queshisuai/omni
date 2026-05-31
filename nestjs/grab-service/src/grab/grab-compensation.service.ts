import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GrabAdmissionService } from './grab-admission.service';
import { GrabQueueService } from './grab-queue.service';
import { GrabRepository } from './grab.repository';
import { GRAB_STATUS, GrabStatus, isTerminalGrabStatus } from './grab-status';
import type { GrabAttemptSnapshot, GrabRequestRecord } from './grab.types';
import { OrderClientService } from './order-client.service';

const RELEASEABLE_PROGRESS_STATUSES = new Set(['LOCKING', 'ORDER_CREATING']);
const REQUEUEABLE_PROGRESS_STATUSES = new Set(['QUEUED', 'WAITING']);
const EXPIRED_MESSAGE = '抢票请求已过期';
type OrderRecoveryResult = 'RECOVERED' | 'MISSING' | 'UNKNOWN';

@Injectable()
export class GrabCompensationService implements OnModuleInit {
  private readonly logger = new Logger(GrabCompensationService.name);
  private readonly staleInflightMillis = 60_000;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly repository: GrabRepository,
    private readonly admissionService: GrabAdmissionService,
    private readonly orderClient: OrderClientService,
    private readonly queueService: GrabQueueService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.sweepExpiredRequests().catch((error) => this.logger.error(error));
    }, 60_000);
  }

  async sweepExpiredRequests(): Promise<void> {
    const expiredRequests = await this.repository.findExpiredInFlight(new Date(), 100);
    for (const request of expiredRequests) {
      await this.expireRequest(request);
    }
    const pendingRecoveryRequests = await this.repository.findPendingRecovery(100);
    for (const request of pendingRecoveryRequests) {
      const recovery = await this.recoverCreatedOrder(request);
      if (recovery === 'RECOVERED') {
        await this.ackRecord(request, null);
      }
    }
    await this.sweepStaleInflight();
  }

  private async sweepStaleInflight(): Promise<void> {
    const staleBefore = Date.now() - this.staleInflightMillis;
    const now = new Date();
    const sessionIds = await this.queueService.getActiveSessions();
    for (const sessionId of sessionIds) {
      const requestIds = await this.queueService.listInflightRequestIds(sessionId);
      for (const requestId of requestIds) {
        const metadata = await this.queueService.getRequestMetadata(requestId);
        if (metadata?.inflightAt != null && metadata.inflightAt > staleBefore) continue;

        const record = await this.repository.findByRequestId(requestId);
        if (!record) {
          await this.queueService.ackOrphanInflight(sessionId, requestId);
          continue;
        }

        if (isTerminalGrabStatus(record.progressStatus)) {
          await this.ackRecord(record, metadata?.queueSeq ?? null);
          continue;
        }

        if (record.progressStatus === GRAB_STATUS.ORDER_CREATING) {
          const recovery = await this.recoverCreatedOrder(record);
          if (recovery === 'RECOVERED') {
            await this.ackRecord(record, metadata?.queueSeq ?? null);
          }
          continue;
        }

        if (record.expireTime <= now) {
          await this.expireRequest(record);
          continue;
        }

        if (REQUEUEABLE_PROGRESS_STATUSES.has(record.progressStatus)) {
          await this.queueService.requeueInflight(record.sessionId, record.requestId);
        }
      }
      await this.queueService.removeActiveSessionIfQueueEmpty(sessionId);
    }
  }

  private async expireRequest(request: GrabRequestRecord): Promise<void> {
    const progressStatus = request.progressStatus;
    if (progressStatus === GRAB_STATUS.ORDER_CREATING) {
      const recovery = await this.recoverCreatedOrder(request);
      if (recovery === 'RECOVERED') {
        await this.ackRecord(request, null);
        return;
      }
      if (recovery === 'UNKNOWN') return;
    }

    const expired = await this.repository.expireActiveRequest(request.requestId, EXPIRED_MESSAGE, [progressStatus as GrabStatus]);
    if (!expired) return;

    if (!request.orderId && RELEASEABLE_PROGRESS_STATUSES.has(progressStatus)) {
      await this.admissionService.release({
        requestId: request.requestId,
        userId: request.userId,
        sessionId: request.sessionId,
        ticketTypeId: request.currentTicketTypeId ?? request.ticketTypeId,
        quantity: request.quantity,
        seatIds: request.seatIds,
        idempotencyKey: request.idempotencyKey,
      });
    }
    await this.ackRecord(request, null);
  }

  private async recoverCreatedOrder(request: GrabRequestRecord): Promise<OrderRecoveryResult> {
    try {
      const order = await this.orderClient.findByGrabRequestId(request.requestId);
      if (!order) return 'MISSING';
      const matchedTicketTypeId = request.currentTicketTypeId ?? request.matchedTicketTypeId ?? request.ticketTypeId;
      const recovered = await this.repository.markOrderCreated(
        request.requestId,
        order.id,
        matchedTicketTypeId,
        this.markRecoveredAttempt(request.attemptsSnapshot, matchedTicketTypeId),
        request.progressStatus,
      );
      return recovered ? 'RECOVERED' : 'UNKNOWN';
    } catch (error) {
      this.logger.error(error);
      return 'UNKNOWN';
    }
  }

  private markRecoveredAttempt(attempts: GrabAttemptSnapshot[], matchedTicketTypeId: number): GrabAttemptSnapshot[] {
    if (attempts.length === 0) return attempts;
    return attempts.map((attempt) => (
      attempt.ticketTypeId === matchedTicketTypeId
        ? { ...attempt, status: 'ORDER_CREATED', message: '已创建订单' }
        : attempt
    ));
  }

  private async ackRecord(
    record: Pick<GrabRequestRecord, 'sessionId' | 'requestId' | 'queueSeq'>,
    fallbackQueueSeq: number | null,
  ): Promise<void> {
    const queueSeq = record.queueSeq ?? fallbackQueueSeq;
    if (queueSeq == null) return;
    await this.queueService.ackProcessed(record.sessionId, record.requestId, queueSeq);
  }
}
