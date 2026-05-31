import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OrderClientService, OrderSeatResponse } from '../grab/order-client.service';
import { NotificationClientService } from './notification-client.service';
import { TeamGrabRepository } from './team-grab.repository';
import type {
  TeamGrabRequestRecord,
  TeamPaymentSyncResponse,
  TeamSeatAssignmentInput,
  TicketTeamMemberRecord,
} from './team-grab.types';

const ORDER_STATUS_PAID = 2;
const ORDER_STATUS_CANCELLED = 3;
const PAID_SEAT_STATUS = 2;
const SYNC_LIMIT = 100;

@Injectable()
export class TeamPaymentSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TeamPaymentSyncService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly repository: TeamGrabRepository,
    private readonly orderClient: OrderClientService,
    private readonly notificationClient: NotificationClientService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.syncLockedTeams().catch((error) => this.logger.error(error));
    }, 10_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async syncLockedTeams(): Promise<void> {
    const teamGrabs = await this.repository.findLockedTeamGrabRequests(SYNC_LIMIT);
    for (const teamGrab of teamGrabs) {
      await this.syncTeamGrab(teamGrab).catch((error) => this.logger.error(error));
    }
  }

  async syncTeam(teamId: number): Promise<TeamPaymentSyncResponse> {
    const teamGrab = await this.repository.findLockedTeamGrabRequestByTeamId(teamId);
    if (!teamGrab) return { teamId, synced: false };
    await this.syncTeamGrab(teamGrab);
    return { teamId, synced: true };
  }

  private async syncTeamGrab(teamGrab: TeamGrabRequestRecord): Promise<void> {
    if (teamGrab.orderId == null) return;

    const order = await this.orderClient.getOrder(teamGrab.orderId);
    if (order.status === ORDER_STATUS_PAID) {
      await this.assignPaidOrder(teamGrab, order.quantity);
      return;
    }

    if (order.status === ORDER_STATUS_CANCELLED) {
      const members = await this.orderedConfirmedMembers(teamGrab.teamId);
      const transitioned = await this.repository.markTeamExpired(teamGrab.teamId, '订单已取消');
      if (!transitioned) return;
      await this.notifyMembers(members, (member) => this.notificationClient.sendExpired(member.userId, teamGrab.orderId));
    }
  }

  private async assignPaidOrder(teamGrab: TeamGrabRequestRecord, orderQuantity: number): Promise<void> {
    if (teamGrab.orderId == null) return;

    const members = await this.orderedConfirmedMembers(teamGrab.teamId);
    const orderSeats = await this.orderClient.listOrderSeats(teamGrab.orderId);
    const paidSeats = orderSeats.filter((seat) => seat.status === PAID_SEAT_STATUS);
    if (orderQuantity !== members.length || paidSeats.length !== members.length) {
      this.logger.warn(`小队 ${teamGrab.teamId} 已支付订单座位数量不一致`);
      return;
    }

    const assignments = this.buildAssignments(members, paidSeats);
    const transitioned = await this.repository.assignPaidTeamSeats(teamGrab.teamId, teamGrab.orderId, assignments);
    if (!transitioned) return;
    await this.notifyMembers(members, (member) => this.notificationClient.sendPaid(member.userId, teamGrab.orderId as number));
  }

  private async orderedConfirmedMembers(teamId: number): Promise<TicketTeamMemberRecord[]> {
    const members = await this.repository.listConfirmedMembers(teamId);
    return [...members].sort((a, b) => {
      if (a.role !== b.role) return a.role === 'LEADER' ? -1 : 1;
      const byJoinTime = a.joinTime.getTime() - b.joinTime.getTime();
      return byJoinTime !== 0 ? byJoinTime : a.id - b.id;
    });
  }

  private buildAssignments(
    members: TicketTeamMemberRecord[],
    orderSeats: OrderSeatResponse[],
  ): TeamSeatAssignmentInput[] {
    return members.map((member, index) => ({
      userId: member.userId,
      orderSeatId: orderSeats[index].orderSeatId,
      sessionSeatId: orderSeats[index].sessionSeatId,
      seatLabel: orderSeats[index].seatLabel,
    }));
  }

  private async notifyMembers(
    members: TicketTeamMemberRecord[],
    send: (member: TicketTeamMemberRecord) => Promise<void>,
  ): Promise<void> {
    for (const member of members) {
      await send(member).catch((error) => this.logger.warn(error));
    }
  }
}
