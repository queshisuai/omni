import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { GrabQueueService } from '../grab/grab-queue.service';
import { GrabService } from '../grab/grab.service';
import { isUniqueViolation, TeamGrabRepository } from './team-grab.repository';
import { TeamPaymentSyncService } from './team-payment-sync.service';
import type { GrabProgressResponse } from '../grab/grab.types';
import type {
  CreateTeamDto,
  TeamDetailServiceResponse,
  TeamPaymentSyncResponse,
  TeamSeatStrategy,
  TeamGrabTriggerResponse,
  TeamStatus,
  TicketTeamMemberRecord,
  TicketTeamRecord,
} from './team-grab.types';

const JOINABLE_TEAM_STATUSES = new Set<TeamStatus>(['DRAFT', 'READY', 'FAILED', 'EXPIRED']);
const TRIGGERABLE_TEAM_STATUSES: TeamStatus[] = ['READY', 'FAILED', 'EXPIRED'];
const TEAM_TRIGGER_LOCK_TTL_SECONDS = 30;
const TEAM_GRAB_REQUEST_TTL_SECONDS = 900;
const STRATEGY_RANK: Record<TeamSeatStrategy, number> = {
  STRICT_CONTIGUOUS: 0,
  SAME_BLOCK: 1,
  SAME_TICKET_TYPE: 2,
  FALLBACK: 3,
};

@Injectable()
export class TeamGrabService {
  constructor(
    private readonly repository: TeamGrabRepository,
    private readonly grabService: GrabService,
    private readonly queueService: GrabQueueService,
    @Optional() private readonly paymentSyncService?: TeamPaymentSyncService,
  ) {}

  async createTeam(leaderUserId: number, dto: CreateTeamDto): Promise<TicketTeamRecord> {
    this.validateCreateTeamDto(dto);
    const fallbacks = this.normalizeFallbacks(dto.strategy, dto.fallbacks);
    const active = await this.repository.findActiveTeamForUser(dto.sessionId, leaderUserId);
    if (active) throw new ConflictException('你已在该场次创建或加入小队');

    try {
      return await this.repository.createTeam({
        ...dto,
        leaderUserId,
        inviteCode: this.generateInviteCode(),
        fallbacks,
      });
    } catch (error) {
      this.throwConflictOnUniqueViolation(error, '小队创建失败');
    }
  }

  async joinTeam(teamId: number, userId: number, inviteCode: string): Promise<TicketTeamRecord> {
    const team = await this.getExistingTeam(teamId);
    this.validateInviteCode(team, inviteCode);
    if (!JOINABLE_TEAM_STATUSES.has(team.status)) throw new ForbiddenException('当前小队不可加入');
    const existingMember = await this.repository.findMember(teamId, userId);
    if (existingMember && existingMember.status !== 'LEFT') throw new ConflictException('你已在该小队中');
    const active = await this.repository.findActiveTeamForUser(team.sessionId, userId);
    if (active && active.id !== teamId) throw new ConflictException('你已在该场次创建或加入其他小队');

    let inserted: TicketTeamMemberRecord | null;
    try {
      inserted = await this.repository.insertMember(team.id, team.sessionId, userId);
    } catch (error) {
      this.throwConflictOnUniqueViolation(error, '加入小队失败');
    }
    if (!inserted) throw new ConflictException('加入小队失败');
    return this.refreshReadiness(team);
  }

  async confirmMember(teamId: number, userId: number): Promise<TicketTeamRecord> {
    const team = await this.getExistingTeam(teamId);
    const member = await this.repository.findMember(teamId, userId);
    if (!member || member.status === 'LEFT') throw new NotFoundException('小队成员不存在');
    if (member.status !== 'CONFIRMED') {
      let confirmed: TicketTeamMemberRecord | null;
      try {
        confirmed = await this.repository.confirmMember(teamId, userId);
      } catch (error) {
        this.throwConflictOnUniqueViolation(error, '确认小队成员失败');
      }
      if (!confirmed) throw new ConflictException('确认小队成员失败');
    }
    return this.refreshReadiness(team);
  }

  async leaveTeam(teamId: number, userId: number): Promise<TicketTeamRecord> {
    const team = await this.getExistingTeam(teamId);
    if (!JOINABLE_TEAM_STATUSES.has(team.status)) throw new ForbiddenException('当前小队状态不能退出');
    if (team.leaderUserId === userId) throw new BadRequestException('队长不能退出小队');
    const member = await this.repository.findMember(teamId, userId);
    if (!member || member.status === 'LEFT') throw new NotFoundException('小队成员不存在');

    const left = await this.repository.leaveMember(teamId, userId);
    if (!left) throw new ConflictException('退出小队失败');
    return this.refreshReadiness(team);
  }

  async removeMember(teamId: number, leaderUserId: number, memberUserId: number): Promise<TicketTeamRecord> {
    const team = await this.getExistingTeam(teamId);
    if (team.leaderUserId !== leaderUserId) throw new ForbiddenException('只有队长可以移除成员');
    if (!JOINABLE_TEAM_STATUSES.has(team.status)) throw new ForbiddenException('当前小队状态不能调整成员');
    if (leaderUserId === memberUserId) throw new BadRequestException('队长不能移除自己');

    const removed = await this.repository.removeMember(teamId, memberUserId);
    if (!removed) throw new NotFoundException('小队成员不存在');
    return this.refreshReadiness(team);
  }

  async updateStrategy(
    teamId: number,
    leaderUserId: number,
    strategy: TeamSeatStrategy,
    fallbacks: TeamSeatStrategy[],
  ): Promise<TicketTeamRecord> {
    const team = await this.getExistingTeam(teamId);
    if (team.leaderUserId !== leaderUserId) throw new ForbiddenException('只有队长可以修改抢票策略');
    if (!JOINABLE_TEAM_STATUSES.has(team.status)) throw new ForbiddenException('当前小队状态不能修改抢票策略');
    this.validateStrategy(strategy);
    const normalizedFallbacks = this.normalizeFallbacks(strategy, fallbacks);
    const updated = await this.repository.updateStrategy(teamId, strategy, normalizedFallbacks);
    if (!updated) throw new ConflictException('小队抢票策略更新失败');
    return this.refreshReadiness(updated);
  }

  async getTeamDetail(teamId: number, userId: number): Promise<TeamDetailServiceResponse> {
    const team = await this.getExistingTeam(teamId);
    const members = await this.repository.listMembers(teamId);
    const currentMember = members.find((member) => member.userId === userId && member.status !== 'LEFT') ?? null;
    if (team.leaderUserId !== userId && !currentMember) throw new ForbiddenException('不能查看其他小队');

    const confirmedMembers = members.filter((member) => member.status === 'CONFIRMED');
    const latestGrabRequest = await this.repository.findLatestTeamGrabRequestByTeamId(teamId);
    const latestOrderId = latestGrabRequest?.orderId ?? null;

    return {
      team,
      members,
      canTriggerGrab: TRIGGERABLE_TEAM_STATUSES.includes(team.status)
        && currentMember?.status === 'CONFIRMED'
        && confirmedMembers.length >= 2
        && confirmedMembers.length <= 6,
      canPay: team.status === 'LOCKED' && team.leaderUserId === userId && latestOrderId != null,
      latestGrabRequestId: latestGrabRequest?.grabRequestId ?? null,
      latestOrderId,
    };
  }

  async triggerTeamGrab(teamId: number, triggerUserId: number): Promise<TeamGrabTriggerResponse> {
    const team = await this.getExistingTeam(teamId);
    if (!TRIGGERABLE_TEAM_STATUSES.includes(team.status)) throw new ForbiddenException('小队尚未满足抢票条件');

    const queuedGrabRequestId = `GRAB-${randomUUID()}`;
    const teamGrabRequestId = `TEAM-GRAB-${randomUUID()}`;
    const lockAcquired = await this.queueService.acquireTeamTriggerLock(
      team.id,
      team.sessionId,
      team.ticketTypeId,
      queuedGrabRequestId,
      TEAM_TRIGGER_LOCK_TTL_SECONDS,
    );
    if (!lockAcquired) throw new ConflictException('小队抢票正在进行中');

    let teamGrabCommitted = false;
    try {
      const queueResult = await this.queueService.reserveQueueSeq(team.sessionId);
      const requestedTicketTypes = [{
        ticketTypeId: team.ticketTypeId,
        name: null,
        maxPrice: null,
      }];
      const expireTime = new Date(Date.now() + TEAM_GRAB_REQUEST_TTL_SECONDS * 1000);
      const beginResult = await this.repository.beginTeamGrab({
        teamId: team.id,
        triggerUserId,
        requestId: teamGrabRequestId,
        grabRequestId: queuedGrabRequestId,
        idempotencyKey: `team:${team.id}:${teamGrabRequestId}`,
        queueSeq: queueResult.queueSeq,
        expireTime,
        requestedTicketTypes,
      });
      teamGrabCommitted = true;
      const frozenTeam = beginResult.team;

      await this.queueService.publishReserved({
        requestId: queuedGrabRequestId,
        sessionId: frozenTeam.sessionId,
        userId: frozenTeam.leaderUserId,
        queueSeq: queueResult.queueSeq,
        ttlSeconds: TEAM_GRAB_REQUEST_TTL_SECONDS,
      });

      return {
        requestId: beginResult.teamGrabRequest.grabRequestId ?? queuedGrabRequestId,
        queueSeq: queueResult.queueSeq,
        queueRank: queueResult.queueRank,
        teamStatus: frozenTeam.status,
      };
    } catch (error) {
      await this.queueService.releaseTeamTriggerLock(team.id, team.sessionId, team.ticketTypeId, queuedGrabRequestId).catch(() => undefined);
      if (!teamGrabCommitted) this.throwConflictOnUniqueViolation(error, '小队抢票正在进行中');
      throw error;
    }
  }

  async getTeamGrabProgress(teamId: number, userId: number, requestId: string): Promise<GrabProgressResponse> {
    await this.getTeamDetail(teamId, userId);
    const teamGrab = await this.repository.findTeamGrabByGrabRequestId(requestId);
    if (!teamGrab) throw new NotFoundException('小队抢票请求不存在');
    if (teamGrab.teamId !== teamId) throw new ForbiddenException('抢票请求不属于当前小队');
    return this.grabService.getProgressForVerifiedRequest(requestId);
  }

  async syncPaidTeam(teamId: number, userId: number): Promise<TeamPaymentSyncResponse> {
    await this.getTeamDetail(teamId, userId);
    if (!this.paymentSyncService) throw new Error('小队支付同步服务未配置');
    return this.paymentSyncService.syncTeam(teamId);
  }

  private async getExistingTeam(teamId: number): Promise<TicketTeamRecord> {
    const team = await this.repository.findTeamById(teamId);
    if (!team) throw new NotFoundException('小队不存在');
    return team;
  }

  private async refreshReadiness(team: TicketTeamRecord): Promise<TicketTeamRecord> {
    const refreshed = await this.repository.refreshTeamReadiness(team.id);
    if (refreshed) return refreshed;
    return (await this.repository.findTeamById(team.id)) ?? team;
  }

  private validateCreateTeamDto(dto: CreateTeamDto): void {
    if (!Number.isInteger(dto.activityId) || dto.activityId <= 0) throw new BadRequestException('活动无效');
    if (!Number.isInteger(dto.sessionId) || dto.sessionId <= 0) throw new BadRequestException('场次无效');
    if (!Number.isInteger(dto.ticketTypeId) || dto.ticketTypeId <= 0) throw new BadRequestException('票档无效');
    this.validateStrategy(dto.strategy);
  }

  private validateInviteCode(team: TicketTeamRecord, inviteCode: string | undefined): void {
    const normalizedInput = this.normalizeInviteCode(inviteCode);
    if (!normalizedInput) throw new BadRequestException('邀请码不能为空');
    if (normalizedInput !== this.normalizeInviteCode(team.inviteCode)) {
      throw new ForbiddenException('邀请码无效');
    }
  }

  private normalizeInviteCode(inviteCode: string | undefined): string {
    return (inviteCode ?? '').trim().toUpperCase();
  }

  private validateStrategy(strategy: TeamSeatStrategy): void {
    if (!Object.prototype.hasOwnProperty.call(STRATEGY_RANK, strategy)) throw new BadRequestException('小队抢票策略无效');
    if (strategy === 'FALLBACK') throw new BadRequestException('兜底策略不能作为首选策略');
  }

  private normalizeFallbacks(strategy: TeamSeatStrategy, fallbacks: TeamSeatStrategy[]): TeamSeatStrategy[] {
    const normalized: TeamSeatStrategy[] = [];
    let previousRank = STRATEGY_RANK[strategy];
    for (const fallback of fallbacks ?? []) {
      if (!Object.prototype.hasOwnProperty.call(STRATEGY_RANK, fallback)) {
        throw new BadRequestException('兜底策略无效');
      }
      const rank = STRATEGY_RANK[fallback];
      if (rank < STRATEGY_RANK[strategy] || rank < previousRank) {
        throw new BadRequestException('兜底策略不能比首选策略更严格');
      }
      previousRank = rank;
      if (!normalized.includes(fallback)) normalized.push(fallback);
    }
    return normalized;
  }

  private generateInviteCode(): string {
    return randomBytes(5).toString('hex').toUpperCase().slice(0, 8);
  }

  private throwConflictOnUniqueViolation(error: unknown, message: string): never {
    if (isUniqueViolation(error)) throw new ConflictException(message);
    throw error;
  }
}
