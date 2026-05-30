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

    await this.grabRepository.updateProgress(record.requestId, {
      status: GRAB_STATUS.ORDER_CREATING,
      message: 'locking team seats',
      currentTicketTypeId: record.ticketTypeId,
      currentAttemptIndex: 0,
      attempts: record.attemptsSnapshot,
      workerId: record.workerId,
    });
    await this.teamRepository.updateTeamGrabStatus(teamGrab.requestId, 'GRABBING', ['PENDING', 'GRABBING']);

    let lockedSeatIds: number[] = [];
    try {
      const lock = await this.ticketClient.lockTeamSeats({
        sessionId: teamGrab.sessionId,
        ticketTypeId: teamGrab.ticketTypeId,
        quantity: teamGrab.quantity,
        strategy: teamGrab.strategy,
        fallbacks: teamGrab.fallbacks,
        lockRequestId: teamGrab.requestId,
        lockExpireTime: record.expireTime.toISOString(),
      });
      lockedSeatIds = lock.lockedSeatIds;

      const persisted = await this.teamRepository.persistLockedSeats(teamGrab.requestId, {
        lockedSeatIds: lock.lockedSeatIds,
        seatLabels: lock.seatLabels,
        matchedStrategy: lock.matchedStrategy as TeamSeatStrategy,
      });

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
        authorizedMaxUnitPrice: await this.authorizedMaxUnitPrice(teamGrab),
      });

      await this.grabRepository.markOrderCreated(
        record.requestId,
        order.id,
        teamGrab.ticketTypeId,
        record.attemptsSnapshot,
        GRAB_STATUS.ORDER_CREATING,
        record.workerId,
      );
      await this.teamRepository.markTeamGrabOrderCreated(teamGrab.requestId, order.id);
      await this.teamRepository.updateTeamStatus(teamGrab.teamId, 'LOCKED', ['GRABBING']);
      return true;
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
}
