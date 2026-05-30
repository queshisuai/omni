import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { GrabRepository } from '../grab/grab.repository';
import { GrabQueueService } from '../grab/grab-queue.service';
import { OrderClientService } from '../grab/order-client.service';
import { GRAB_STATUS } from '../grab/grab-status';
import { TicketClientService } from '../grab/ticket-client.service';
import { NotificationClientService } from './notification-client.service';
import {
  ORDER_CREATE_TIMEOUT_CLAIMED,
  ORDER_CREATE_TIMEOUT_RELEASING,
  TeamGrabRepository,
} from './team-grab.repository';
import type { TeamGrabRequestRecord } from './team-grab.types';

const RECOVERY_LIMIT = 100;
const STALE_PRE_ORDER_SECONDS = 30;
const ORDER_CREATE_TIMEOUT = 'ORDER_CREATE_TIMEOUT';

@Injectable()
export class TeamLockRecoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TeamLockRecoveryService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly repository: TeamGrabRepository,
    private readonly grabRepository: GrabRepository,
    private readonly orderClient: OrderClientService,
    private readonly ticketClient: TicketClientService,
    private readonly queueService: GrabQueueService,
    private readonly notificationClient: NotificationClientService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.recoverStaleLocks().catch((error) => this.logger.error(error));
    }, 30_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async recoverStaleLocks(): Promise<void> {
    const staleTeamGrabs = await this.repository.findStalePreOrderTeamGrabRequests(
      RECOVERY_LIMIT,
      STALE_PRE_ORDER_SECONDS,
    );
    for (const teamGrab of staleTeamGrabs) {
      await this.recoverTeamGrab(teamGrab).catch((error) => this.logger.error(error));
    }
  }

  private async recoverTeamGrab(teamGrab: TeamGrabRequestRecord): Promise<void> {
    if (teamGrab.grabRequestId) {
      const existingOrder = await this.lookupOrder(teamGrab.grabRequestId);
      if (existingOrder === 'UNKNOWN') return;
      if (existingOrder) {
        await this.recoverFoundOrder(teamGrab, existingOrder.id);
        return;
      }
    }

    if (!this.hasReleaseClaimMarker(teamGrab)) {
      await this.repository.claimStalePreOrderRecovery(teamGrab.requestId, STALE_PRE_ORDER_SECONDS);
      return;
    }

    const releaseClaim = await this.repository.claimStalePreOrderRelease(teamGrab.requestId, STALE_PRE_ORDER_SECONDS);
    if (!releaseClaim) return;

    if (releaseClaim.grabRequestId) {
      const existingOrder = await this.lookupOrder(releaseClaim.grabRequestId);
      if (existingOrder === 'UNKNOWN') return;
      if (existingOrder) {
        await this.recoverFoundOrder(releaseClaim, existingOrder.id);
        return;
      }
    }

    await this.ticketClient.releaseTeamSeatLock(releaseClaim.requestId, releaseClaim.lockedSeatIds);
    const transitioned = await this.repository.markTeamFailed(
      releaseClaim.teamId,
      releaseClaim.requestId,
      ORDER_CREATE_TIMEOUT,
    );
    if (!transitioned) return;

    if (releaseClaim.grabRequestId) {
      await this.grabRepository.updateStatus(releaseClaim.grabRequestId, GRAB_STATUS.FAILED, ORDER_CREATE_TIMEOUT);
      await this.queueService
        .removeQueuedRequest(releaseClaim.sessionId, releaseClaim.grabRequestId)
        .catch((error) => this.logger.warn(error));
    }

    const members = await this.repository.listConfirmedMembers(releaseClaim.teamId);
    for (const member of members) {
      await this.notificationClient.sendFailed(member.userId, null).catch((error) => this.logger.warn(error));
    }
  }

  private async recoverFoundOrder(teamGrab: TeamGrabRequestRecord, orderId: number): Promise<void> {
    if (!teamGrab.grabRequestId) return;

    const grabOrderCreated = await this.grabRepository.markOrderCreatedFromProgressStatuses(
      teamGrab.grabRequestId,
      orderId,
      teamGrab.ticketTypeId,
      [],
      [GRAB_STATUS.ORDER_CREATING, GRAB_STATUS.PENDING_RECOVERY],
    );
    if (!grabOrderCreated) {
      const existingGrab = await this.grabRepository.findByRequestId(teamGrab.grabRequestId);
      if (
        !existingGrab
        || existingGrab.orderId !== orderId
        || existingGrab.progressStatus !== GRAB_STATUS.ORDER_CREATED
      ) {
        return;
      }
    }

    const teamOrderCreated = await this.repository.repairTeamGrabOrderCreated(teamGrab.requestId, orderId);
    if (!teamOrderCreated) return;
    await this.repository.updateTeamStatus(teamGrab.teamId, 'LOCKED', ['GRABBING', 'LOCKED']);
  }

  private async lookupOrder(grabRequestId: string): Promise<{ id: number } | null | 'UNKNOWN'> {
    try {
      return await this.orderClient.findByGrabRequestId(grabRequestId);
    } catch (error) {
      this.logger.warn(error);
      return 'UNKNOWN';
    }
  }

  private hasReleaseClaimMarker(teamGrab: TeamGrabRequestRecord): boolean {
    return teamGrab.failReason === ORDER_CREATE_TIMEOUT_CLAIMED
      || teamGrab.failReason === ORDER_CREATE_TIMEOUT_RELEASING;
  }
}
