import { Injectable, Logger } from '@nestjs/common';
import { GRAB_STATUS } from '../grab/grab-status';
import { GrabRepository } from '../grab/grab.repository';
import type { GrabRequestRecord } from '../grab/grab.types';
import { OrderClientService } from '../grab/order-client.service';
import { TicketClientService } from '../grab/ticket-client.service';
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

      const persisted = await this.teamRepository.persistLockedSeats(teamGrab.requestId, {
        lockedSeatIds: lock.lockedSeatIds,
        seatLabels: lock.seatLabels,
        matchedStrategy: lock.matchedStrategy as TeamSeatStrategy,
      });
      if (!persisted) {
        throw new Error('failed to persist team locked seats');
      }

      const authorizedMaxUnitPrice = await this.authorizedMaxUnitPrice(teamGrab);
      const order = await this.orderClient.createTeamOrderWithLockedSeats({
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
      });

      return await this.finishOrderCreated(record, teamGrab, order.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'team grab processing failed';
      if (lockedSeatIds.length > 0) {
        await this.ticketClient.releaseTeamSeatLock(teamGrab.requestId, lockedSeatIds).catch((releaseError) => {
          this.logger.error(releaseError);
          return false;
        });
      }
      await this.markFailed(record, teamGrab, message);
      return true;
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
    await this.teamRepository.updateTeamStatus(teamGrab.teamId, 'FAILED', ['GRABBING', 'READY']);
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
}
