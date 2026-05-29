import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { GrabAdmissionService, AdmissionOutcome } from './grab-admission.service';
import { GrabQueueService } from './grab-queue.service';
import { GrabRepository } from './grab.repository';
import { GRAB_STATUS } from './grab-status';
import type { GrabAttemptSnapshot, GrabRequestRecord, GrabTicketPreference } from './grab.types';
import { OrderClientService } from './order-client.service';

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
    const preference = preferences[0] ?? {
      ticketTypeId: record.ticketTypeId,
      name: null,
      maxPrice: null,
    };
    const attempts = this.initialAttempts(preferences.length ? preferences : [preference]);

    await this.repository.updateProgress(record.requestId, {
      status: GRAB_STATUS.TRYING_TICKET_TYPE,
      message: `Trying ${this.ticketLabel(preference)}`,
      currentTicketTypeId: preference.ticketTypeId,
      currentAttemptIndex: 0,
      attempts: this.markAttempt(attempts, 0, 'TRYING', `Trying ${this.ticketLabel(preference)}`),
    });

    await this.trySingleTicket(record, preference, 0, attempts);
  }

  private async trySingleTicket(
    record: GrabRequestRecord,
    preference: GrabTicketPreference,
    index: number,
    attempts: GrabAttemptSnapshot[],
  ): Promise<void> {
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

    if (admission.outcome !== 'ACCEPTED' && admission.outcome !== 'IDEMPOTENT') {
      await this.markAdmissionFailure(record, admission.outcome, preference, index, lockingAttempts);
      return;
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
      const status = message.includes('stock') ? GRAB_STATUS.SOLD_OUT : message.includes('limit') ? GRAB_STATUS.LIMITED : GRAB_STATUS.FAILED;
      await this.repository.updateStatus(record.requestId, status, message);
    }
  }

  private async markAdmissionFailure(
    record: GrabRequestRecord,
    outcome: AdmissionOutcome,
    preference: GrabTicketPreference,
    index: number,
    attempts: GrabAttemptSnapshot[],
  ): Promise<void> {
    const status =
      outcome === 'SOLD_OUT' ? GRAB_STATUS.SOLD_OUT :
      outcome === 'LIMITED' ? GRAB_STATUS.LIMITED :
      GRAB_STATUS.FAILED;
    const message =
      outcome === 'SOLD_OUT' ? 'ticket type sold out' :
      outcome === 'LIMITED' ? 'purchase limit or seat lock conflict' :
      'grab stock is not initialized';
    const attemptStatus: GrabAttemptSnapshot['status'] =
      outcome === 'SOLD_OUT' ? 'SOLD_OUT' :
      outcome === 'LIMITED' ? 'LIMITED' :
      'FAILED';

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

  private ticketLabel(preference: GrabTicketPreference): string {
    return preference.name ?? `ticket type ${preference.ticketTypeId}`;
  }
}
