import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { GrabRepository } from '../grab/grab.repository';
import { GRAB_STATUS } from '../grab/grab-status';
import { TicketClientService } from '../grab/ticket-client.service';
import { NotificationClientService } from './notification-client.service';
import { TeamGrabRepository } from './team-grab.repository';
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
    private readonly ticketClient: TicketClientService,
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
    await this.ticketClient.releaseTeamSeatLock(teamGrab.requestId, teamGrab.lockedSeatIds);
    await this.repository.markTeamFailed(teamGrab.teamId, teamGrab.requestId, ORDER_CREATE_TIMEOUT);
    if (teamGrab.grabRequestId) {
      await this.grabRepository.updateStatus(teamGrab.grabRequestId, GRAB_STATUS.FAILED, ORDER_CREATE_TIMEOUT);
    }

    const members = await this.repository.listConfirmedMembers(teamGrab.teamId);
    for (const member of members) {
      await this.notificationClient.sendFailed(member.userId, null).catch((error) => this.logger.warn(error));
    }
  }
}
