import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { GrabAdmissionService } from './grab-admission.service';
import { GrabQueueService } from './grab-queue.service';
import { GrabRepository } from './grab.repository';
import { GRAB_STATUS, isTerminalGrabStatus } from './grab-status';
import type { GrabAttemptSnapshot, GrabRequestRecord, GrabTicketPreference } from './grab.types';
import { OrderClientService } from './order-client.service';

type AttemptOutcome = 'ORDER_CREATED' | 'SOLD_OUT' | 'LIMITED' | 'FAILED' | 'CANCELLED' | 'PENDING_RECOVERY' | 'STALE_LEASE';
type IdempotentAdmissionOutcome = AttemptOutcome | 'CONTINUE';
type OrderLookupRecovery = 'RECOVERED' | 'MISSING' | 'UNKNOWN';

@Injectable()
export class GrabWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GrabWorkerService.name);
  private readonly requestTtlSeconds = 900;
  private readonly workerId = `grab-worker-${randomUUID()}`;
  private timer: NodeJS.Timeout | null = null;
  private pollInProgress = false;

  constructor(
    private readonly repository: GrabRepository,
    private readonly admissionService: GrabAdmissionService,
    private readonly orderClient: OrderClientService,
    private readonly queueService: GrabQueueService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.pollOnce().catch((error) => this.logger.error(error));
    }, 500);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async pollOnce(): Promise<void> {
    if (this.pollInProgress) return;
    this.pollInProgress = true;
    try {
      const sessionIds = await this.queueService.getActiveSessions();
      for (const sessionId of sessionIds) {
        const requestId = await this.queueService.dequeue(sessionId);
        if (requestId) {
          await this.processRequest(requestId, sessionId);
        }
        await this.queueService.removeActiveSessionIfQueueEmpty(sessionId);
      }
    } finally {
      this.pollInProgress = false;
    }
  }

  async processRequest(requestId: string, sessionId?: number): Promise<void> {
    const existing = await this.repository.findByRequestId(requestId);
    if (!existing) {
      if (sessionId != null) await this.queueService.ackOrphanInflight(sessionId, requestId);
      return;
    }

    const record = await this.repository.claimForProcessing(requestId, this.workerId);
    if (!record) {
      if (existing.expireTime <= new Date()) {
        await this.repository.expireActiveRequest(requestId, 'grab request expired before processing', [existing.progressStatus]);
        await this.ackIfQueued(existing);
        return;
      }
      if (isTerminalGrabStatus(existing.progressStatus) || existing.orderId) {
        await this.ackIfQueued(existing);
        return;
      }
      return;
    }

    let shouldAck = true;
    try {
      shouldAck = await this.processAttempts(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'grab processing failed';
      await this.repository.updateStatus(record.requestId, GRAB_STATUS.FAILED, message);
      this.logger.error(error);
    } finally {
      if (shouldAck) await this.ackIfQueued(record);
    }
  }

  private async processAttempts(record: GrabRequestRecord): Promise<boolean> {
    const preferences = this.preferencesFor(record);
    const effectivePreferences = preferences.length ? preferences : [{
      ticketTypeId: record.ticketTypeId,
      name: null,
      maxPrice: null,
    }];
    let attempts = this.initialAttempts(effectivePreferences);

    for (let index = 0; index < effectivePreferences.length; index += 1) {
      const preference = effectivePreferences[index];
      if (index > 0) {
        const previous = effectivePreferences[index - 1];
        const downgraded = await this.repository.updateProgress(record.requestId, {
          status: GRAB_STATUS.DOWNGRADING,
          message: `${this.ticketLabel(previous)} sold out, trying ${this.ticketLabel(preference)}`,
          currentTicketTypeId: preference.ticketTypeId,
          currentAttemptIndex: index,
          attempts,
          workerId: this.workerId,
        });
        if (!downgraded) return await this.isStillLeaseOwner(record.requestId);
      }

      const outcome = await this.tryTicketType(record, preference, index, attempts);
      if (outcome === 'STALE_LEASE') return false;
      if (outcome !== 'SOLD_OUT') return true;

      attempts = this.markAttempt(attempts, index, 'SOLD_OUT', 'ticket type sold out');
      if (index === effectivePreferences.length - 1) {
        return await this.finishTerminalAttempt(record, GRAB_STATUS.SOLD_OUT, 'ticket type sold out', preference, index, attempts, 'SOLD_OUT');
      }
    }
    return true;
  }

  private async tryTicketType(
    record: GrabRequestRecord,
    preference: GrabTicketPreference,
    index: number,
    attempts: GrabAttemptSnapshot[],
  ): Promise<AttemptOutcome> {
    const tryingAttempts = this.markAttempt(attempts, index, 'TRYING', `Trying ${this.ticketLabel(preference)}`);
    const tryingRecord = await this.repository.updateProgress(record.requestId, {
      status: GRAB_STATUS.TRYING_TICKET_TYPE,
      message: `Trying ${this.ticketLabel(preference)}`,
      currentTicketTypeId: preference.ticketTypeId,
      currentAttemptIndex: index,
      attempts: tryingAttempts,
      workerId: this.workerId,
    });
    if (!tryingRecord) return await this.missingProgressOutcome(record.requestId);

    const lockingAttempts = this.markAttempt(attempts, index, 'LOCKING', `Locking ${this.ticketLabel(preference)}`);
    const lockingRecord = await this.repository.updateProgress(record.requestId, {
      status: GRAB_STATUS.LOCKING,
      message: `Locking ${this.ticketLabel(preference)}`,
      currentTicketTypeId: preference.ticketTypeId,
      currentAttemptIndex: index,
      attempts: lockingAttempts,
      workerId: this.workerId,
    });
    if (!lockingRecord) return await this.missingProgressOutcome(record.requestId);

    const admission = await this.admissionService.admit({
      requestId: record.requestId,
      userId: record.userId,
      sessionId: record.sessionId,
      ticketTypeId: preference.ticketTypeId,
      quantity: record.quantity,
      seatIds: record.seatIds,
      idempotencyKey: record.idempotencyKey,
      ttlSeconds: this.requestTtlSeconds,
    });

    if (admission.outcome === 'SOLD_OUT') {
      return 'SOLD_OUT';
    }
    if (admission.outcome === 'LIMITED') {
      const finished = await this.finishTerminalAttempt(
        record,
        GRAB_STATUS.LIMITED,
        'purchase limit or seat lock conflict',
        preference,
        index,
        lockingAttempts,
        'LIMITED',
      );
      return finished ? 'LIMITED' : 'STALE_LEASE';
    }
    if (admission.outcome === 'STOCK_UNINITIALIZED') {
      const finished = await this.finishTerminalAttempt(
        record,
        GRAB_STATUS.FAILED,
        'grab stock is not initialized',
        preference,
        index,
        lockingAttempts,
        'FAILED',
      );
      return finished ? 'FAILED' : 'STALE_LEASE';
    }
    if (admission.outcome === 'IDEMPOTENT') {
      const idempotentOutcome = await this.handleIdempotentAdmission(
        record,
        preference,
        index,
        lockingAttempts,
        admission.existingRequestId,
      );
      if (idempotentOutcome !== 'CONTINUE') return idempotentOutcome;
    }

    const orderCreatingRecord = await this.repository.updateProgress(record.requestId, {
      status: GRAB_STATUS.ORDER_CREATING,
      message: `${this.ticketLabel(preference)} locked, creating order`,
      currentTicketTypeId: preference.ticketTypeId,
      currentAttemptIndex: index,
      attempts: this.markAttempt(lockingAttempts, index, 'LOCKING', `${this.ticketLabel(preference)} locked`),
      workerId: this.workerId,
    });
    if (!orderCreatingRecord) {
      if (await this.isStillLeaseOwner(record.requestId)) {
        await this.releaseAdmission(record, preference);
        return 'CANCELLED';
      }
      return 'STALE_LEASE';
    }

    const orderInput = {
      userId: record.userId,
      sessionId: record.sessionId,
      ticketTypeId: preference.ticketTypeId,
      quantity: record.quantity,
      seatIds: record.seatIds,
      allocateRandom: record.allocateRandom,
      authorizedMaxUnitPrice: preference.maxPrice,
      grabRequestId: record.requestId,
      requestedTicketTypeId: record.ticketTypeId,
      matchedTicketTypeId: preference.ticketTypeId,
      autoDowngraded: preference.ticketTypeId !== record.ticketTypeId,
    };

    try {
      const order = await this.orderClient.createOrder(orderInput);
      const persisted = await this.markOrderCreated(record, preference, index, lockingAttempts, order.id);
      return persisted ? 'ORDER_CREATED' : await this.markPendingRecovery(record, preference, index, lockingAttempts);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'order creation failed';
      if (this.isStockError(message)) {
        await this.releaseAdmission(record, preference);
        return 'SOLD_OUT';
      }
      if (this.isLimitError(message)) {
        await this.releaseAdmission(record, preference);
        const finished = await this.finishTerminalAttempt(record, GRAB_STATUS.LIMITED, message, preference, index, lockingAttempts, 'LIMITED');
        return finished ? 'LIMITED' : 'STALE_LEASE';
      }

      const recovery = await this.recoverOrderByLookup(record, preference, index, lockingAttempts);
      if (recovery === 'RECOVERED') return 'ORDER_CREATED';
      if (recovery === 'UNKNOWN') return await this.markPendingRecovery(record, preference, index, lockingAttempts);

      await this.releaseAdmission(record, preference);
      const finished = await this.finishTerminalAttempt(record, GRAB_STATUS.FAILED, message, preference, index, lockingAttempts, 'FAILED');
      return finished ? 'FAILED' : 'STALE_LEASE';
    }
  }

  private async handleIdempotentAdmission(
    record: GrabRequestRecord,
    preference: GrabTicketPreference,
    index: number,
    attempts: GrabAttemptSnapshot[],
    existingRequestId: string | null,
  ): Promise<IdempotentAdmissionOutcome> {
    if (existingRequestId !== record.requestId) {
      const finished = await this.finishTerminalAttempt(
        record,
        GRAB_STATUS.FAILED,
        'idempotency hold belongs to another request',
        preference,
        index,
        attempts,
        'FAILED',
      );
      return finished ? 'FAILED' : 'STALE_LEASE';
    }

    const recovery = await this.recoverOrderByLookup(record, preference, index, attempts, GRAB_STATUS.LOCKING);
    if (recovery === 'RECOVERED') return 'ORDER_CREATED';
    if (recovery === 'UNKNOWN') return await this.markPendingRecovery(record, preference, index, attempts);
    return 'CONTINUE';
  }

  private async markOrderCreated(
    record: GrabRequestRecord,
    preference: GrabTicketPreference,
    index: number,
    attempts: GrabAttemptSnapshot[],
    orderId: number,
  ): Promise<boolean> {
    const orderAttempts = this.markAttempt(attempts, index, 'ORDER_CREATED', `${this.ticketLabel(preference)} order created`);
    try {
      const marked = await this.repository.markOrderCreated(
        record.requestId,
        orderId,
        preference.ticketTypeId,
        orderAttempts,
        GRAB_STATUS.ORDER_CREATING,
        this.workerId,
      );
      if (marked) return true;
    } catch (error) {
      this.logger.error(error);
    }

    return await this.recoverOrderByLookup(record, preference, index, attempts, GRAB_STATUS.ORDER_CREATING) === 'RECOVERED';
  }

  private async recoverOrderByLookup(
    record: GrabRequestRecord,
    preference: GrabTicketPreference,
    index: number,
    attempts: GrabAttemptSnapshot[],
    expectedProgressStatus: typeof GRAB_STATUS.LOCKING | typeof GRAB_STATUS.ORDER_CREATING = GRAB_STATUS.ORDER_CREATING,
  ): Promise<OrderLookupRecovery> {
    try {
      const existingOrder = await this.orderClient.findByGrabRequestId(record.requestId);
      if (!existingOrder) return 'MISSING';
      const recovered = await this.repository.markOrderCreated(
        record.requestId,
        existingOrder.id,
        preference.ticketTypeId,
        this.markAttempt(attempts, index, 'ORDER_CREATED', `${this.ticketLabel(preference)} order created`),
        expectedProgressStatus,
        this.workerId,
      );
      return recovered ? 'RECOVERED' : 'UNKNOWN';
    } catch (error) {
      this.logger.error(error);
      return 'UNKNOWN';
    }
  }

  private async markPendingRecovery(
    record: GrabRequestRecord,
    preference: GrabTicketPreference,
    index: number,
    attempts: GrabAttemptSnapshot[],
  ): Promise<AttemptOutcome> {
    await this.repository.markPendingRecovery(record.requestId, {
      message: 'order confirmation pending',
      currentTicketTypeId: preference.ticketTypeId,
      currentAttemptIndex: index,
      attempts: this.markAttempt(attempts, index, 'LOCKING', 'order confirmation pending'),
      workerId: this.workerId,
    });
    return 'PENDING_RECOVERY';
  }

  private async releaseAdmission(record: GrabRequestRecord, preference: GrabTicketPreference): Promise<void> {
    await this.admissionService.release({
      requestId: record.requestId,
      userId: record.userId,
      sessionId: record.sessionId,
      ticketTypeId: preference.ticketTypeId,
      quantity: record.quantity,
      seatIds: record.seatIds,
      idempotencyKey: record.idempotencyKey,
      restoreStock: true,
    });
  }

  private async finishTerminalAttempt(
    record: GrabRequestRecord,
    status: typeof GRAB_STATUS.SOLD_OUT | typeof GRAB_STATUS.LIMITED | typeof GRAB_STATUS.FAILED,
    message: string,
    preference: GrabTicketPreference,
    index: number,
    attempts: GrabAttemptSnapshot[],
    attemptStatus: GrabAttemptSnapshot['status'],
  ): Promise<boolean> {
    const updated = await this.repository.updateProgress(record.requestId, {
      status,
      message,
      currentTicketTypeId: preference.ticketTypeId,
      currentAttemptIndex: index,
      attempts: this.markAttempt(attempts, index, attemptStatus, message),
      workerId: this.workerId,
    });
    if (!updated) return await this.isStillLeaseOwner(record.requestId);
    await this.repository.updateStatus(record.requestId, status, message);
    return true;
  }

  private preferencesFor(record: GrabRequestRecord): GrabTicketPreference[] {
    if (record.allowAutoDowngrade) return record.requestedTicketTypes;
    return record.requestedTicketTypes.slice(0, 1);
  }

  private initialAttempts(preferences: GrabTicketPreference[]): GrabAttemptSnapshot[] {
    return preferences.map((ticket) => ({
      ticketTypeId: ticket.ticketTypeId,
      name: ticket.name,
      status: 'PENDING',
      message: 'pending',
    }));
  }

  private markAttempt(
    attempts: GrabAttemptSnapshot[],
    index: number,
    status: GrabAttemptSnapshot['status'],
    message: string,
  ): GrabAttemptSnapshot[] {
    return attempts.map((attempt, attemptIndex) => (
      attemptIndex === index ? { ...attempt, status, message } : attempt
    ));
  }

  private async ackIfQueued(record: Pick<GrabRequestRecord, 'sessionId' | 'requestId' | 'queueSeq'>): Promise<void> {
    if (record.queueSeq == null) return;
    await this.queueService.ackProcessed(record.sessionId, record.requestId, record.queueSeq);
  }

  private async isStillLeaseOwner(requestId: string): Promise<boolean> {
    const latest = await this.repository.findByRequestId(requestId);
    return latest?.workerId === this.workerId;
  }

  private async missingProgressOutcome(requestId: string): Promise<AttemptOutcome> {
    return await this.isStillLeaseOwner(requestId) ? 'CANCELLED' : 'STALE_LEASE';
  }

  private isStockError(message: string): boolean {
    const normalized = message.toLowerCase();
    return normalized.includes('stock') || normalized.includes('sold out') || message.includes('\u5e93\u5b58') || message.includes('\u552e\u7f44');
  }

  private isLimitError(message: string): boolean {
    const normalized = message.toLowerCase();
    return normalized.includes('limit') || message.includes('\u9650\u8d2d');
  }

  private ticketLabel(preference: GrabTicketPreference): string {
    return preference.name ?? `ticket type ${preference.ticketTypeId}`;
  }
}
