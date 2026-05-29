import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { GrabAdmissionService } from './grab-admission.service';
import { GrabQueueService } from './grab-queue.service';
import { GrabRepository } from './grab.repository';
import { GRAB_STATUS } from './grab-status';
import type { GrabAttemptSnapshot, GrabRequestRecord, GrabTicketPreference } from './grab.types';
import { OrderClientService } from './order-client.service';

type AttemptOutcome = 'ORDER_CREATED' | 'SOLD_OUT' | 'LIMITED' | 'FAILED';

@Injectable()
export class GrabWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GrabWorkerService.name);
  private readonly requestTtlSeconds = 900;
  private readonly workerId = `grab-worker-${randomUUID()}`;
  private timer: NodeJS.Timeout | null = null;

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
    const sessionIds = await this.queueService.getActiveSessions();
    for (const sessionId of sessionIds) {
      const requestId = await this.queueService.dequeue(sessionId);
      if (requestId) {
        await this.processRequest(requestId);
      }
      await this.queueService.removeActiveSessionIfQueueEmpty(sessionId);
    }
  }

  async processRequest(requestId: string): Promise<void> {
    const existing = await this.repository.findByRequestId(requestId);
    if (!existing) return;

    const record = await this.repository.claimForProcessing(requestId, this.workerId);
    if (!record) {
      await this.ackIfQueued(existing);
      return;
    }

    try {
      await this.processAttempts(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'grab processing failed';
      await this.repository.updateStatus(record.requestId, GRAB_STATUS.FAILED, message);
      this.logger.error(error);
    } finally {
      await this.ackIfQueued(record);
    }
  }

  private async processAttempts(record: GrabRequestRecord): Promise<void> {
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
        await this.repository.updateProgress(record.requestId, {
          status: GRAB_STATUS.DOWNGRADING,
          message: `${this.ticketLabel(previous)} sold out, trying ${this.ticketLabel(preference)}`,
          currentTicketTypeId: preference.ticketTypeId,
          currentAttemptIndex: index,
          attempts,
        });
      }

      const outcome = await this.tryTicketType(record, preference, index, attempts);
      if (outcome === 'ORDER_CREATED' || outcome === 'LIMITED' || outcome === 'FAILED') return;

      attempts = this.markAttempt(attempts, index, 'SOLD_OUT', 'ticket type sold out');
      if (index === effectivePreferences.length - 1) {
        await this.finishTerminalAttempt(record, GRAB_STATUS.SOLD_OUT, 'ticket type sold out', preference, index, attempts, 'SOLD_OUT');
        return;
      }
    }
  }

  private async tryTicketType(
    record: GrabRequestRecord,
    preference: GrabTicketPreference,
    index: number,
    attempts: GrabAttemptSnapshot[],
  ): Promise<AttemptOutcome> {
    const tryingAttempts = this.markAttempt(attempts, index, 'TRYING', `Trying ${this.ticketLabel(preference)}`);
    await this.repository.updateProgress(record.requestId, {
      status: GRAB_STATUS.TRYING_TICKET_TYPE,
      message: `Trying ${this.ticketLabel(preference)}`,
      currentTicketTypeId: preference.ticketTypeId,
      currentAttemptIndex: index,
      attempts: tryingAttempts,
    });

    const lockingAttempts = this.markAttempt(attempts, index, 'LOCKING', `Locking ${this.ticketLabel(preference)}`);
    await this.repository.updateProgress(record.requestId, {
      status: GRAB_STATUS.LOCKING,
      message: `Locking ${this.ticketLabel(preference)}`,
      currentTicketTypeId: preference.ticketTypeId,
      currentAttemptIndex: index,
      attempts: lockingAttempts,
    });

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
      await this.finishTerminalAttempt(
        record,
        GRAB_STATUS.LIMITED,
        'purchase limit or seat lock conflict',
        preference,
        index,
        lockingAttempts,
        'LIMITED',
      );
      return 'LIMITED';
    }
    if (admission.outcome === 'STOCK_UNINITIALIZED') {
      await this.finishTerminalAttempt(
        record,
        GRAB_STATUS.FAILED,
        'grab stock is not initialized',
        preference,
        index,
        lockingAttempts,
        'FAILED',
      );
      return 'FAILED';
    }

    await this.repository.updateProgress(record.requestId, {
      status: GRAB_STATUS.ORDER_CREATING,
      message: `${this.ticketLabel(preference)} locked, creating order`,
      currentTicketTypeId: preference.ticketTypeId,
      currentAttemptIndex: index,
      attempts: this.markAttempt(lockingAttempts, index, 'LOCKING', `${this.ticketLabel(preference)} locked`),
    });

    try {
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
      const order = await this.orderClient.createOrder(orderInput);
      await this.repository.markOrderCreated(
        record.requestId,
        order.id,
        preference.ticketTypeId,
        this.markAttempt(lockingAttempts, index, 'ORDER_CREATED', `${this.ticketLabel(preference)} order created`),
      );
      return 'ORDER_CREATED';
    } catch (error) {
      await this.admissionService.release({
        userId: record.userId,
        sessionId: record.sessionId,
        ticketTypeId: preference.ticketTypeId,
        quantity: record.quantity,
        seatIds: record.seatIds,
        idempotencyKey: record.idempotencyKey,
        restoreStock: true,
      });
      const message = error instanceof Error ? error.message : 'order creation failed';
      if (this.isStockError(message)) {
        return 'SOLD_OUT';
      }
      const status = this.isLimitError(message) ? GRAB_STATUS.LIMITED : GRAB_STATUS.FAILED;
      const attemptStatus = status === GRAB_STATUS.LIMITED ? 'LIMITED' : 'FAILED';
      await this.finishTerminalAttempt(record, status, message, preference, index, lockingAttempts, attemptStatus);
      return status === GRAB_STATUS.LIMITED ? 'LIMITED' : 'FAILED';
    }
  }

  private async finishTerminalAttempt(
    record: GrabRequestRecord,
    status: typeof GRAB_STATUS.SOLD_OUT | typeof GRAB_STATUS.LIMITED | typeof GRAB_STATUS.FAILED,
    message: string,
    preference: GrabTicketPreference,
    index: number,
    attempts: GrabAttemptSnapshot[],
    attemptStatus: GrabAttemptSnapshot['status'],
  ): Promise<void> {
    await this.repository.updateProgress(record.requestId, {
      status,
      message,
      currentTicketTypeId: preference.ticketTypeId,
      currentAttemptIndex: index,
      attempts: this.markAttempt(attempts, index, attemptStatus, message),
    });
    await this.repository.updateStatus(record.requestId, status, message);
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
