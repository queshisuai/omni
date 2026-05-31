import { Injectable, Logger, Optional } from '@nestjs/common';
import { GRAB_STATUS } from '../grab/grab-status';
import { GrabRepository } from '../grab/grab.repository';
import type { GrabRequestRecord } from '../grab/grab.types';
import { OrderClientService } from '../grab/order-client.service';
import type { CreateTeamOrderWithLockedSeatsInput } from '../grab/order-client.service';
import { TicketClientService } from '../grab/ticket-client.service';
import { NotificationClientService } from './notification-client.service';
import { TeamGrabRepository } from './team-grab.repository';
import type { TeamGrabRequestRecord, TeamSeatStrategy } from './team-grab.types';

@Injectable()
export class TeamGrabProcessorService {
  private readonly logger = new Logger(TeamGrabProcessorService.name);

  constructor(
    private readonly teamRepository: TeamGrabRepository,
    private readonly grabRepository: GrabRepository,
    private readonly ticketClient: TicketClientService,
    private readonly orderClient: OrderClientService,
    @Optional() private readonly notificationClient?: NotificationClientService,
  ) {}

  async process(record: GrabRequestRecord): Promise<boolean> {
    const teamGrab = await this.teamRepository.findTeamGrabByGrabRequestId(record.requestId);
    if (!teamGrab) {
      await this.grabRepository.updateStatus(record.requestId, GRAB_STATUS.FAILED, 'team grab request not found');
      return true;
    }

    const progressed = await this.grabRepository.updateProgress(record.requestId, {
      status: GRAB_STATUS.ORDER_CREATING,
      message: 'locking team seats',
      currentTicketTypeId: record.ticketTypeId,
      currentAttemptIndex: 0,
      attempts: record.attemptsSnapshot,
      workerId: record.workerId,
    });
    if (!progressed) return false;

    const grabbing = await this.teamRepository.updateTeamGrabStatus(teamGrab.requestId, 'GRABBING', ['PENDING', 'GRABBING']);
    if (!grabbing) return false;

    let lockedSeatIds: number[] = [];
    let lockedSeatLabels: string[] = [];
    let matchedStrategy: TeamSeatStrategy | null = null;
    let orderInput: CreateTeamOrderWithLockedSeatsInput;
    try {
      const lock = await this.ticketClient.lockTeamSeats({
        sessionId: teamGrab.sessionId,
        ticketTypeId: teamGrab.ticketTypeId,
        quantity: teamGrab.quantity,
        strategy: teamGrab.strategy,
        fallbacks: teamGrab.fallbacks,
        lockRequestId: teamGrab.requestId,
        lockExpireTime: this.formatLocalDateTime(record.expireTime),
      });
      lockedSeatIds = lock.lockedSeatIds;
      lockedSeatLabels = lock.seatLabels;
      matchedStrategy = lock.matchedStrategy as TeamSeatStrategy;

      const persisted = await this.teamRepository.persistLockedSeats(teamGrab.requestId, {
        lockedSeatIds: lock.lockedSeatIds,
        seatLabels: lock.seatLabels,
        matchedStrategy,
      });
      if (!persisted) {
        throw new Error('failed to persist team locked seats');
      }

      const authorizedMaxUnitPrice = await this.authorizedMaxUnitPrice(teamGrab);
      orderInput = {
        teamId: teamGrab.teamId,
        userId: teamGrab.payerUserId,
        payerUserId: teamGrab.payerUserId,
        sessionId: teamGrab.sessionId,
        ticketTypeId: teamGrab.ticketTypeId,
        quantity: teamGrab.quantity,
        seats: lock.lockedSeatIds.map((seatId, index) => ({
          sessionSeatId: seatId,
          seatLabel: lock.seatLabels[index],
        })),
        teamGrabRequestId: teamGrab.requestId,
        grabRequestId: record.requestId,
        matchedStrategy: lock.matchedStrategy,
        authorizedMaxUnitPrice,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'team grab processing failed';
      if (lockedSeatIds.length > 0) {
        const released = await this.releaseLockedSeats(teamGrab.requestId, lockedSeatIds);
        if (!released) {
          const releasePending = await this.markReleasePendingOrRetry(teamGrab, {
            lockedSeatIds,
            seatLabels: lockedSeatLabels,
            matchedStrategy: matchedStrategy ?? teamGrab.strategy,
          });
          if (!releasePending) return false;

          await this.markPendingRecovery(record, teamGrab);
          return false;
        }
      }
      await this.markFailed(record, teamGrab, message);
      return true;
    }

    try {
      const orderCreateClaim = await this.teamRepository.markTeamGrabOrderCreateInProgress(teamGrab.requestId);
      if (!orderCreateClaim) {
        await this.markPendingRecovery(record, teamGrab);
        return false;
      }
      const order = await this.orderClient.createTeamOrderWithLockedSeats(orderInput);
      return await this.finishOrderCreated(record, teamGrab, order.id);
    } catch (error) {
      this.logger.error(error);
      return await this.recoverAmbiguousOrderCreation(record, teamGrab);
    }
  }

  private async markReleasePendingOrRetry(
    teamGrab: TeamGrabRequestRecord,
    input: { lockedSeatIds: number[]; seatLabels: string[]; matchedStrategy: TeamSeatStrategy },
  ): Promise<boolean> {
    try {
      const pending = await this.teamRepository.markTeamGrabReleasePending(teamGrab.requestId, input);
      if (!pending) {
        this.logger.warn(`failed to persist team grab release pending for ${teamGrab.requestId}`);
        return false;
      }
      if (pending.status !== 'LOCKED' || !this.sameLockedSeats(pending.lockedSeatIds, input.lockedSeatIds)) {
        this.logger.warn(`team grab release pending persisted incomplete lock state for ${teamGrab.requestId}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  private sameLockedSeats(left: number[], right: number[]): boolean {
    return left.length === right.length && left.every((seatId, index) => seatId === right[index]);
  }

  private async releaseLockedSeats(requestId: string, lockedSeatIds: number[]): Promise<boolean> {
    try {
      const released = await this.ticketClient.releaseTeamSeatLock(requestId, lockedSeatIds);
      if (!released) {
        this.logger.warn(`team seat lock release returned false for ${requestId}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  private async finishOrderCreated(
    record: GrabRequestRecord,
    teamGrab: TeamGrabRequestRecord,
    orderId: number,
  ): Promise<boolean> {
    try {
      const teamOrderCreated = await this.teamRepository.markTeamGrabOrderCreated(teamGrab.requestId, orderId);
      if (!teamOrderCreated) throw new Error('failed to persist team grab order');

      const lockedTeam = await this.teamRepository.updateTeamStatus(teamGrab.teamId, 'LOCKED', ['GRABBING']);
      if (!lockedTeam) throw new Error('failed to mark team locked');

      const grabOrderCreated = await this.grabRepository.markOrderCreated(
        record.requestId,
        orderId,
        teamGrab.ticketTypeId,
        record.attemptsSnapshot,
        GRAB_STATUS.ORDER_CREATING,
        record.workerId,
      );
      if (!grabOrderCreated) throw new Error('failed to persist grab order');

      await this.notifyLocked(teamGrab, orderId);
      return true;
    } catch (error) {
      this.logger.error(error);
      await this.markPendingRecovery(record, teamGrab);
      return false;
    }
  }

  private async authorizedMaxUnitPrice(teamGrab: TeamGrabRequestRecord): Promise<number> {
    const visibleTypes = await this.ticketClient.listVisibleTicketTypes(teamGrab.sessionId, [teamGrab.ticketTypeId]);
    const ticketType = visibleTypes.find((item) => item.ticketTypeId === teamGrab.ticketTypeId);
    if (!ticketType) throw new Error('ticket type price not found');
    return ticketType.price;
  }

  private async markFailed(record: GrabRequestRecord, teamGrab: TeamGrabRequestRecord, message: string): Promise<void> {
    await this.grabRepository.updateStatus(record.requestId, GRAB_STATUS.FAILED, message);
    await this.teamRepository.markTeamGrabFailed(teamGrab.requestId, message);
    const failedTeam = await this.teamRepository.updateTeamStatus(teamGrab.teamId, 'FAILED', ['GRABBING', 'READY']);
    if (failedTeam) {
      await this.notifyFailed(teamGrab);
    }
  }

  private async markPendingRecovery(record: GrabRequestRecord, teamGrab: TeamGrabRequestRecord): Promise<void> {
    await this.grabRepository.markPendingRecovery(record.requestId, {
      message: 'team order confirmation pending',
      currentTicketTypeId: teamGrab.ticketTypeId,
      currentAttemptIndex: 0,
      attempts: record.attemptsSnapshot,
      workerId: record.workerId,
    }).catch((error) => this.logger.error(error));
  }

  private async recoverAmbiguousOrderCreation(
    record: GrabRequestRecord,
    teamGrab: TeamGrabRequestRecord,
  ): Promise<boolean> {
    try {
      const order = await this.orderClient.findByGrabRequestId(record.requestId);
      if (order?.id != null) {
        return await this.finishOrderCreated(record, teamGrab, order.id);
      }
    } catch (lookupError) {
      this.logger.error(lookupError);
    }

    await this.markPendingRecovery(record, teamGrab);
    return false;
  }

  private formatLocalDateTime(date: Date): string {
    const pad = (value: number) => value.toString().padStart(2, '0');
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
    ].join('-') + `T${[
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
    ].join(':')}`;
  }

  private async notifyLocked(teamGrab: TeamGrabRequestRecord, orderId: number): Promise<void> {
    if (!this.notificationClient) return;
    try {
      const members = await this.teamRepository.listConfirmedMembers(teamGrab.teamId);
      for (const member of members) {
        await this.notificationClient.sendLocked(member.userId, orderId).catch((error) => this.logger.warn(error));
      }
    } catch (error) {
      this.logger.warn(error);
    }
  }

  private async notifyFailed(teamGrab: TeamGrabRequestRecord): Promise<void> {
    if (!this.notificationClient) return;
    try {
      const members = await this.teamRepository.listConfirmedMembers(teamGrab.teamId);
      for (const member of members) {
        await this.notificationClient.sendFailed(member.userId, null).catch((error) => this.logger.warn(error));
      }
    } catch (error) {
      this.logger.warn(error);
    }
  }
}
