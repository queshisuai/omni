import { Injectable, Logger, Optional } from '@nestjs/common';
import { GRAB_STATUS } from '../grab/grab-status';
import { GrabRepository } from '../grab/grab.repository';
import type { GrabRequestRecord } from '../grab/grab.types';
import { OrderClientService } from '../grab/order-client.service';
import type { CreateTeamOrderWithLockedSeatsInput } from '../grab/order-client.service';
import { TicketClientService } from '../grab/ticket-client.service';
import { NotificationClientService } from './notification-client.service';
import { ORDER_CREATE_RELEASE_PENDING, TeamGrabRepository } from './team-grab.repository';
import type { TeamGrabRequestRecord, TeamSeatStrategy } from './team-grab.types';

type TeamGrabLatencyPhase = 'lock' | 'price' | 'order' | 'confirm' | 'notification';

class TeamGrabLatencyTrace {
  private readonly startedAt = Date.now();
  private readonly phases: Record<TeamGrabLatencyPhase, number> = {
    lock: 0,
    price: 0,
    order: 0,
    confirm: 0,
    notification: 0,
  };

  async measure<T>(phase: TeamGrabLatencyPhase, action: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    try {
      return await action();
    } finally {
      this.phases[phase] += Math.max(0, Date.now() - startedAt);
    }
  }

  format(record: GrabRequestRecord, teamGrab: TeamGrabRequestRecord, outcome: string): string {
    return [
      '小队抢票链路耗时:',
      `teamGrabRequestId=${teamGrab.requestId}`,
      `grabRequestId=${record.requestId}`,
      `teamId=${teamGrab.teamId}`,
      `sessionId=${teamGrab.sessionId}`,
      `ticketTypeId=${teamGrab.ticketTypeId}`,
      `outcome=${outcome}`,
      `lockMs=${this.phases.lock}`,
      `priceMs=${this.phases.price}`,
      `orderMs=${this.phases.order}`,
      `confirmMs=${this.phases.confirm}`,
      `notificationMs=${this.phases.notification}`,
      `totalMs=${Math.max(0, Date.now() - this.startedAt)}`,
    ].join(' ');
  }
}

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
      await this.grabRepository.updateStatus(record.requestId, GRAB_STATUS.FAILED, '小队抢票请求不存在');
      return true;
    }

    const latencyTrace = new TeamGrabLatencyTrace();
    let outcome = 'FAILED';
    try {
      const progressed = await this.grabRepository.updateProgress(record.requestId, {
        status: GRAB_STATUS.ORDER_CREATING,
        message: '正在锁定小队座位',
        currentTicketTypeId: record.ticketTypeId,
        currentAttemptIndex: 0,
        attempts: record.attemptsSnapshot,
        workerId: record.workerId,
      });
      if (!progressed) {
        outcome = 'PROGRESS_RETRY';
        return false;
      }

      const grabbing = await this.teamRepository.updateTeamGrabStatus(teamGrab.requestId, 'GRABBING', ['PENDING', 'GRABBING']);
      if (!grabbing) {
        outcome = 'TEAM_STATUS_RETRY';
        return false;
      }

      let lockedSeatIds: number[] = [];
      let lockedSeatLabels: string[] = [];
      let matchedStrategy: TeamSeatStrategy | null = null;
      let orderInput: CreateTeamOrderWithLockedSeatsInput;
      try {
        const lock = await latencyTrace.measure('lock', () => this.ticketClient.lockTeamSeats({
          sessionId: teamGrab.sessionId,
          ticketTypeId: teamGrab.ticketTypeId,
          quantity: teamGrab.quantity,
          strategy: teamGrab.strategy,
          fallbacks: teamGrab.fallbacks,
          lockRequestId: teamGrab.requestId,
          lockExpireTime: this.formatLocalDateTime(record.expireTime),
        }));
        lockedSeatIds = lock.lockedSeatIds;
        lockedSeatLabels = lock.seatLabels;
        matchedStrategy = lock.matchedStrategy as TeamSeatStrategy;

        const persisted = await this.teamRepository.persistLockedSeats(teamGrab.requestId, {
          lockedSeatIds: lock.lockedSeatIds,
          seatLabels: lock.seatLabels,
          matchedStrategy,
        });
        if (!persisted) {
          throw new Error('保存小队锁座结果失败');
        }

        const authorizedMaxUnitPrice = await latencyTrace.measure('price', () => this.authorizedMaxUnitPrice(teamGrab));
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
        const message = error instanceof Error ? error.message : '小队抢票处理失败';
        if (lockedSeatIds.length > 0) {
          const released = await this.releaseLockedSeats(teamGrab.requestId, lockedSeatIds);
          if (!released) {
            const releasePending = await this.markReleasePendingOrRetry(teamGrab, {
              lockedSeatIds,
              seatLabels: lockedSeatLabels,
              matchedStrategy: matchedStrategy ?? teamGrab.strategy,
            });
            if (!releasePending) {
              const requestIdReleasePending = await this.markRequestIdReleasePendingOrRetry(teamGrab);
              if (!requestIdReleasePending) {
                outcome = 'RELEASE_PENDING_RETRY';
                return false;
              }
            }

            await this.markPendingRecovery(record, teamGrab);
            outcome = 'RELEASE_PENDING';
            return false;
          }
        } else {
          const released = await this.releaseLockedSeats(teamGrab.requestId, []);
          if (!released) {
            const requestIdReleasePending = await this.markRequestIdReleasePendingOrRetry(teamGrab);
            if (!requestIdReleasePending) {
              outcome = 'REQUEST_ID_RELEASE_RETRY';
              return false;
            }

            await this.markPendingRecovery(record, teamGrab);
            outcome = 'REQUEST_ID_RELEASE_PENDING';
            return false;
          }
        }
        await this.markFailed(record, teamGrab, message);
        outcome = 'FAILED';
        return true;
      }

      try {
        const orderCreateClaim = await this.teamRepository.markTeamGrabOrderCreateInProgress(teamGrab.requestId);
        if (!orderCreateClaim) {
          await this.markPendingRecovery(record, teamGrab);
          outcome = 'PENDING_RECOVERY';
          return false;
        }
        const order = await latencyTrace.measure('order', () => this.orderClient.createTeamOrderWithLockedSeats(orderInput));
        const finished = await this.finishOrderCreated(record, teamGrab, order.id, latencyTrace);
        outcome = finished ? 'ORDER_CREATED' : 'PENDING_RECOVERY';
        return finished;
      } catch (error) {
        this.logger.error(error);
        const recovered = await this.recoverAmbiguousOrderCreation(record, teamGrab, latencyTrace);
        outcome = recovered ? 'ORDER_CREATED' : 'PENDING_RECOVERY';
        return recovered;
      }
    } finally {
      this.logger.log(latencyTrace.format(record, teamGrab, outcome));
    }
  }

  private async markRequestIdReleasePendingOrRetry(teamGrab: TeamGrabRequestRecord): Promise<boolean> {
    try {
      const pending = await this.teamRepository.markTeamGrabRequestIdReleasePending(teamGrab.requestId);
      if (!pending) {
        this.logger.warn(`保存小队抢票请求释放待处理状态失败：${teamGrab.requestId}`);
        return false;
      }
      if (pending.failReason !== ORDER_CREATE_RELEASE_PENDING || pending.lockedSeatIds.length > 0) {
        this.logger.warn(`小队抢票请求释放待处理状态异常：${teamGrab.requestId}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }

  private async markReleasePendingOrRetry(
    teamGrab: TeamGrabRequestRecord,
    input: { lockedSeatIds: number[]; seatLabels: string[]; matchedStrategy: TeamSeatStrategy },
  ): Promise<boolean> {
    try {
      const pending = await this.teamRepository.markTeamGrabReleasePending(teamGrab.requestId, input);
      if (!pending) {
        this.logger.warn(`保存小队抢票释放待处理状态失败：${teamGrab.requestId}`);
        return false;
      }
      if (pending.status !== 'LOCKED' || !this.sameLockedSeats(pending.lockedSeatIds, input.lockedSeatIds)) {
        this.logger.warn(`小队抢票释放待处理锁定状态不完整：${teamGrab.requestId}`);
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
        this.logger.warn(`小队座位锁释放失败：${requestId}`);
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
    latencyTrace: TeamGrabLatencyTrace,
  ): Promise<boolean> {
    try {
      await latencyTrace.measure('confirm', async () => {
        const teamOrderCreated = await this.teamRepository.markTeamGrabOrderCreatedAndLockTeam(
          teamGrab.requestId,
          teamGrab.teamId,
          orderId,
        );
        if (!teamOrderCreated) throw new Error('保存小队抢票订单失败');

        const grabOrderCreated = await this.grabRepository.markOrderCreated(
          record.requestId,
          orderId,
          teamGrab.ticketTypeId,
          record.attemptsSnapshot,
          GRAB_STATUS.ORDER_CREATING,
          record.workerId,
        );
        if (!grabOrderCreated) throw new Error('保存抢票订单失败');
      });

      await latencyTrace.measure('notification', () => this.notifyLocked(teamGrab, orderId));
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
    if (!ticketType) throw new Error('票档价格不存在');
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
      message: '小队订单确认中，请稍后刷新',
      currentTicketTypeId: teamGrab.ticketTypeId,
      currentAttemptIndex: 0,
      attempts: record.attemptsSnapshot,
      workerId: record.workerId,
    }).catch((error) => this.logger.error(error));
  }

  private async recoverAmbiguousOrderCreation(
    record: GrabRequestRecord,
    teamGrab: TeamGrabRequestRecord,
    latencyTrace: TeamGrabLatencyTrace,
  ): Promise<boolean> {
    try {
      const order = await this.orderClient.findByGrabRequestId(record.requestId);
      if (order?.id != null) {
        return await this.finishOrderCreated(record, teamGrab, order.id, latencyTrace);
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
