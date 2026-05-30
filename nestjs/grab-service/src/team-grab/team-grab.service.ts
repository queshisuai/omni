import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { TeamGrabRepository } from './team-grab.repository';
import type {
  CreateTeamDto,
  TeamSeatStrategy,
  TeamStatus,
  TicketTeamRecord,
} from './team-grab.types';

const READY_MIN_SIZE = 2;
const READY_MAX_SIZE = 6;
const JOINABLE_TEAM_STATUSES = new Set<TeamStatus>(['DRAFT', 'READY', 'FAILED', 'EXPIRED']);
const ACTIVE_TEAM_STATUSES = new Set<TeamStatus>(['DRAFT', 'READY', 'GRABBING', 'LOCKED']);
const STRATEGY_RANK: Record<TeamSeatStrategy, number> = {
  STRICT_CONTIGUOUS: 0,
  SAME_BLOCK: 1,
  SAME_TICKET_TYPE: 2,
  FALLBACK: 3,
};

@Injectable()
export class TeamGrabService {
  constructor(private readonly repository: TeamGrabRepository) {}

  async createTeam(leaderUserId: number, dto: CreateTeamDto): Promise<TicketTeamRecord> {
    this.validateCreateTeamDto(dto);
    const fallbacks = this.normalizeFallbacks(dto.strategy, dto.fallbacks);
    const active = await this.repository.findActiveTeamForUser(dto.sessionId, leaderUserId);
    if (active) throw new ConflictException('user already has an active team for this session');

    const team = await this.repository.createTeam({
      ...dto,
      leaderUserId,
      inviteCode: this.generateInviteCode(),
      fallbacks,
    });
    await this.repository.insertLeaderMember(team.id, team.sessionId, leaderUserId);
    return (await this.repository.refreshTeamSize(team.id)) ?? team;
  }

  async joinTeam(teamId: number, userId: number): Promise<TicketTeamRecord> {
    const team = await this.getExistingTeam(teamId);
    if (!JOINABLE_TEAM_STATUSES.has(team.status)) throw new ForbiddenException('team is not joinable');
    const existingMember = await this.repository.findMember(teamId, userId);
    if (existingMember && existingMember.status !== 'LEFT') throw new ConflictException('user is already in this team');
    const active = await this.repository.findActiveTeamForUser(team.sessionId, userId);
    if (active && active.id !== teamId) throw new ConflictException('user already has an active team for this session');

    const inserted = await this.repository.insertMember(team.id, team.sessionId, userId);
    if (!inserted) throw new ConflictException('unable to join team');
    return (await this.repository.refreshTeamSize(team.id)) ?? team;
  }

  async confirmMember(teamId: number, userId: number): Promise<TicketTeamRecord> {
    const team = await this.getExistingTeam(teamId);
    const member = await this.repository.findMember(teamId, userId);
    if (!member || member.status === 'LEFT') throw new NotFoundException('team member not found');
    if (member.status !== 'CONFIRMED') {
      const confirmed = await this.repository.confirmMember(teamId, userId);
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
    const refreshed = await this.repository.refreshTeamSize(teamId);
    return this.refreshReadiness(refreshed ?? team);
  }

  async removeMember(teamId: number, leaderUserId: number, memberUserId: number): Promise<TicketTeamRecord> {
    const team = await this.getExistingTeam(teamId);
    if (team.leaderUserId !== leaderUserId) throw new ForbiddenException('only leader can remove members');
    if (!JOINABLE_TEAM_STATUSES.has(team.status)) throw new ForbiddenException('team cannot be changed in its current status');
    if (leaderUserId === memberUserId) throw new BadRequestException('leader cannot remove self');

    const removed = await this.repository.removeMember(teamId, memberUserId);
    if (!removed) throw new NotFoundException('team member not found');
    const refreshed = await this.repository.refreshTeamSize(teamId);
    return this.refreshReadiness(refreshed ?? team);
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

  async getTeamDetail(teamId: number, userId: number): Promise<{ team: TicketTeamRecord; members: Awaited<ReturnType<TeamGrabRepository['listMembers']>> }> {
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

  private async getExistingTeam(teamId: number): Promise<TicketTeamRecord> {
    const team = await this.repository.findTeamById(teamId);
    if (!team) throw new NotFoundException('team not found');
    return team;
  }

  private async refreshReadiness(team: TicketTeamRecord): Promise<TicketTeamRecord> {
    const members = await this.repository.listMembers(team.id);
    const confirmedCount = members.filter((member) => member.status === 'CONFIRMED').length;
    const refreshed = await this.repository.refreshTeamSize(team.id);
    const current = refreshed ?? { ...team, size: confirmedCount };
    const shouldBeReady =
      ACTIVE_TEAM_STATUSES.has(current.status) &&
      current.status !== 'GRABBING' &&
      current.status !== 'LOCKED' &&
      current.strategy !== 'FALLBACK' &&
      confirmedCount >= READY_MIN_SIZE &&
      confirmedCount <= READY_MAX_SIZE;

    if (shouldBeReady && current.status !== 'READY') {
      return (await this.repository.updateTeamStatus(current.id, 'READY')) ?? current;
    }
    if (!shouldBeReady && current.status === 'READY') {
      return (await this.repository.updateTeamStatus(current.id, 'DRAFT')) ?? current;
    }
    return current;
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
}
