import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { GrabQueueService } from '../grab/grab-queue.service';
import { GrabRepository } from '../grab/grab.repository';
import { GRAB_STATUS } from '../grab/grab-status';
import { isUniqueViolation, TeamGrabRepository } from './team-grab.repository';
import type {
  CreateTeamDto,
  TeamDetailServiceResponse,
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
    private readonly grabRepository: GrabRepository,
    private readonly queueService: GrabQueueService,
  ) {}

  async createTeam(leaderUserId: number, dto: CreateTeamDto): Promise<TicketTeamRecord> {
    this.validateCreateTeamDto(dto);
    const fallbacks = this.normalizeFallbacks(dto.strategy, dto.fallbacks);
    const active = await this.repository.findActiveTeamForUser(dto.sessionId, leaderUserId);
    if (active) throw new ConflictException('user already has an active team for this session');

    try {
      return await this.repository.createTeam({
        ...dto,
        leaderUserId,
        inviteCode: this.generateInviteCode(),
        fallbacks,
      });
    } catch (error) {
      this.throwConflictOnUniqueViolation(error, 'unable to create team');
    }
  }

  async joinTeam(teamId: number, userId: number): Promise<TicketTeamRecord> {
    const team = await this.getExistingTeam(teamId);
    if (!JOINABLE_TEAM_STATUSES.has(team.status)) throw new ForbiddenException('team is not joinable');
    const existingMember = await this.repository.findMember(teamId, userId);
    if (existingMember && existingMember.status !== 'LEFT') throw new ConflictException('user is already in this team');
    const active = await this.repository.findActiveTeamForUser(team.sessionId, userId);
    if (active && active.id !== teamId) throw new ConflictException('user already has an active team for this session');

    let inserted: TicketTeamMemberRecord | null;
    try {
      inserted = await this.repository.insertMember(team.id, team.sessionId, userId);
    } catch (error) {
      this.throwConflictOnUniqueViolation(error, 'unable to join team');
    }
    if (!inserted) throw new ConflictException('unable to join team');
    return this.refreshReadiness(team);
  }

  async confirmMember(teamId: number, userId: number): Promise<TicketTeamRecord> {
    const team = await this.getExistingTeam(teamId);
    const member = await this.repository.findMember(teamId, userId);
    if (!member || member.status === 'LEFT') throw new NotFoundException('team member not found');
    if (member.status !== 'CONFIRMED') {
      let confirmed: TicketTeamMemberRecord | null;
      try {
        confirmed = await this.repository.confirmMember(teamId, userId);
      } catch (error) {
        this.throwConflictOnUniqueViolation(error, 'unable to confirm team member');
      }
      if (!confirmed) throw new ConflictException('unable to confirm team member');
    }
    return this.refreshReadiness(team);
  }

  async leaveTeam(teamId: number, userId: number): Promise<TicketTeamRecord> {
    const team = await this.getExistingTeam(teamId);
    if (!JOINABLE_TEAM_STATUSES.has(team.status)) throw new ForbiddenException('team cannot be left in its current status');
    if (team.leaderUserId === userId) throw new BadRequestException('leader cannot leave team');
    const member = await this.repository.findMember(teamId, userId);
    if (!member || member.status === 'LEFT') throw new NotFoundException('team member not found');

    const left = await this.repository.leaveMember(teamId, userId);
    if (!left) throw new ConflictException('unable to leave team');
    return this.refreshReadiness(team);
  }

  async removeMember(teamId: number, leaderUserId: number, memberUserId: number): Promise<TicketTeamRecord> {
    const team = await this.getExistingTeam(teamId);
    if (team.leaderUserId !== leaderUserId) throw new ForbiddenException('only leader can remove members');
    if (!JOINABLE_TEAM_STATUSES.has(team.status)) throw new ForbiddenException('team cannot be changed in its current status');
    if (leaderUserId === memberUserId) throw new BadRequestException('leader cannot remove self');

    const removed = await this.repository.removeMember(teamId, memberUserId);
    if (!removed) throw new NotFoundException('team member not found');
    return this.refreshReadiness(team);
  }

  async updateStrategy(
    teamId: number,
    leaderUserId: number,
    strategy: TeamSeatStrategy,
    fallbacks: TeamSeatStrategy[],
  ): Promise<TicketTeamRecord> {
    const team = await this.getExistingTeam(teamId);
    if (team.leaderUserId !== leaderUserId) throw new ForbiddenException('only leader can update strategy');
    if (!JOINABLE_TEAM_STATUSES.has(team.status)) throw new ForbiddenException('team strategy cannot be changed in its current status');
    this.validateStrategy(strategy);
    const normalizedFallbacks = this.normalizeFallbacks(strategy, fallbacks);
    const updated = await this.repository.updateStrategy(teamId, strategy, normalizedFallbacks);
    if (!updated) throw new ConflictException('unable to update team strategy');
    return this.refreshReadiness(updated);
  }

  async getTeamDetail(teamId: number, userId: number): Promise<TeamDetailServiceResponse> {
    const team = await this.getExistingTeam(teamId);
    if (team.leaderUserId !== userId) {
      const member = await this.repository.findMember(teamId, userId);
      if (!member || member.status === 'LEFT') throw new ForbiddenException('cannot view another team');
    }
    return {
      team,
      members: await this.repository.listMembers(teamId),
    };
  }

  async triggerTeamGrab(teamId: number, triggerUserId: number): Promise<TeamGrabTriggerResponse> {
    const team = await this.getExistingTeam(teamId);
    if (!TRIGGERABLE_TEAM_STATUSES.includes(team.status)) throw new ForbiddenException('team is not ready to grab');

    const members = await this.repository.listMembers(teamId);
    const confirmedMembers = members.filter((member) => member.status === 'CONFIRMED');
    if (!confirmedMembers.some((member) => member.userId === triggerUserId)) {
      throw new ForbiddenException('trigger user must be a confirmed member');
    }
    const quantity = confirmedMembers.length;
    if (quantity < 2 || quantity > 6) throw new BadRequestException('team must have 2-6 confirmed members');

    const queuedGrabRequestId = `GRAB-${randomUUID()}`;
    const teamGrabRequestId = `TEAM-GRAB-${randomUUID()}`;
    const lockAcquired = await this.queueService.acquireTeamTriggerLock(
      team.id,
      team.sessionId,
      team.ticketTypeId,
      queuedGrabRequestId,
      TEAM_TRIGGER_LOCK_TTL_SECONDS,
    );
    if (!lockAcquired) throw new ConflictException('team grab is already in progress');

    let queued = false;
    let grabRequestCreated = false;
    try {
      const queueResult = await this.queueService.enqueue({
        requestId: queuedGrabRequestId,
        sessionId: team.sessionId,
        userId: team.leaderUserId,
        ttlSeconds: TEAM_GRAB_REQUEST_TTL_SECONDS,
      });
      queued = true;

      const requestedTicketTypes = [{
        ticketTypeId: team.ticketTypeId,
        name: null,
        maxPrice: null,
      }];
      const expireTime = new Date(Date.now() + TEAM_GRAB_REQUEST_TTL_SECONDS * 1000);
      const grabRequest = await this.grabRepository.createQueued({
        requestId: queuedGrabRequestId,
        idempotencyKey: `team:${team.id}:${teamGrabRequestId}`,
        userId: team.leaderUserId,
        sessionId: team.sessionId,
        ticketTypeId: team.ticketTypeId,
        quantity,
        seatIds: [],
        allocateRandom: true,
        expireTime,
        queueSeq: queueResult.queueSeq,
        requestedTicketTypes,
        allowAutoDowngrade: false,
        requestType: 'TEAM_GRAB',
      });
      grabRequestCreated = true;

      await this.repository.createTeamGrabRequest({
        requestId: teamGrabRequestId,
        grabRequestId: grabRequest.requestId,
        teamId: team.id,
        triggerUserId,
        payerUserId: team.leaderUserId,
        sessionId: team.sessionId,
        ticketTypeId: team.ticketTypeId,
        quantity,
        strategy: team.strategy,
        fallbacks: team.fallbacks,
      });

      const updatedTeam = await this.repository.updateTeamStatus(team.id, 'GRABBING', TRIGGERABLE_TEAM_STATUSES);
      if (!updatedTeam) throw new ConflictException('team grab is already in progress');

      return {
        requestId: grabRequest.requestId,
        queueSeq: queueResult.queueSeq,
        queueRank: queueResult.queueRank,
        teamStatus: updatedTeam.status,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'team grab trigger failed';
      if (queued) {
        await this.queueService.removeQueuedRequest(team.sessionId, queuedGrabRequestId).catch(() => undefined);
      }
      if (grabRequestCreated) {
        await this.grabRepository.updateStatus(queuedGrabRequestId, GRAB_STATUS.FAILED, message).catch(() => undefined);
      }
      await this.queueService.releaseTeamTriggerLock(team.id, team.sessionId, team.ticketTypeId, queuedGrabRequestId).catch(() => undefined);
      this.throwConflictOnUniqueViolation(error, 'team grab is already in progress');
    }
  }

  private async getExistingTeam(teamId: number): Promise<TicketTeamRecord> {
    const team = await this.repository.findTeamById(teamId);
    if (!team) throw new NotFoundException('team not found');
    return team;
  }

  private async refreshReadiness(team: TicketTeamRecord): Promise<TicketTeamRecord> {
    const refreshed = await this.repository.refreshTeamReadiness(team.id);
    if (refreshed) return refreshed;
    return (await this.repository.findTeamById(team.id)) ?? team;
  }

  private validateCreateTeamDto(dto: CreateTeamDto): void {
    if (!Number.isInteger(dto.activityId) || dto.activityId <= 0) throw new BadRequestException('invalid activity');
    if (!Number.isInteger(dto.sessionId) || dto.sessionId <= 0) throw new BadRequestException('invalid session');
    if (!Number.isInteger(dto.ticketTypeId) || dto.ticketTypeId <= 0) throw new BadRequestException('invalid ticket type');
    this.validateStrategy(dto.strategy);
  }

  private validateStrategy(strategy: TeamSeatStrategy): void {
    if (!Object.prototype.hasOwnProperty.call(STRATEGY_RANK, strategy)) throw new BadRequestException('invalid team strategy');
    if (strategy === 'FALLBACK') throw new BadRequestException('FALLBACK cannot be primary strategy');
  }

  private normalizeFallbacks(strategy: TeamSeatStrategy, fallbacks: TeamSeatStrategy[]): TeamSeatStrategy[] {
    const normalized: TeamSeatStrategy[] = [];
    let previousRank = STRATEGY_RANK[strategy];
    for (const fallback of fallbacks ?? []) {
      if (!Object.prototype.hasOwnProperty.call(STRATEGY_RANK, fallback)) {
        throw new BadRequestException('invalid fallback strategy');
      }
      const rank = STRATEGY_RANK[fallback];
      if (rank < STRATEGY_RANK[strategy] || rank < previousRank) {
        throw new BadRequestException('fallback strategy cannot be stricter than primary');
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
