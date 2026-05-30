import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/authenticated-request';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TeamGrabService } from './team-grab.service';
import type {
  CreateTeamDto,
  TeamDetailServiceResponse,
  TeamGrabTriggerResponse,
  TeamPaymentSyncResponse,
  TeamSeatStrategy,
  TicketTeamMemberRecord,
  TicketTeamRecord,
} from './team-grab.types';

interface ApiResult<T> {
  code: number;
  message: string;
  data: T;
}

interface UpdateStrategyDto {
  strategy: TeamSeatStrategy;
  fallbacks?: TeamSeatStrategy[];
}

interface JoinTeamDto {
  inviteCode?: string;
}

interface TeamDetailResponse {
  team: TicketTeamRecord;
  members: TicketTeamMemberRecord[];
  canTriggerGrab: boolean;
  canPay: boolean;
  latestGrabRequestId: string | null;
  latestOrderId: number | null;
}

function success<T>(data: T): ApiResult<T> {
  return { code: 200, message: 'success', data };
}

function parsePositiveInt(value: string, label: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new BadRequestException(`invalid ${label}`);
  }
  return Number(value);
}

function toTeamDetailResponse(detail: TeamDetailServiceResponse): TeamDetailResponse {
  return {
    team: detail.team,
    members: detail.members,
    canTriggerGrab: detail.canTriggerGrab ?? false,
    canPay: detail.canPay ?? false,
    latestGrabRequestId: detail.latestGrabRequestId ?? null,
    latestOrderId: detail.latestOrderId ?? null,
  };
}

@Controller('api/grab/teams')
@UseGuards(JwtAuthGuard)
export class TeamGrabController {
  constructor(private readonly teamGrabService: TeamGrabService) {}

  @Post()
  async create(@Req() request: AuthenticatedRequest, @Body() body: CreateTeamDto): Promise<ApiResult<TicketTeamRecord>> {
    return success(await this.teamGrabService.createTeam(request.user.userId, body));
  }

  @Get(':teamId')
  async get(@Req() request: AuthenticatedRequest, @Param('teamId') teamId: string): Promise<ApiResult<TeamDetailResponse>> {
    const parsedTeamId = parsePositiveInt(teamId, 'team');
    const detail = await this.teamGrabService.getTeamDetail(parsedTeamId, request.user.userId);
    return success(toTeamDetailResponse(detail));
  }

  @Post(':teamId/join')
  async join(
    @Req() request: AuthenticatedRequest,
    @Param('teamId') teamId: string,
    @Body() body: JoinTeamDto,
  ): Promise<ApiResult<TicketTeamRecord>> {
    return success(await this.teamGrabService.joinTeam(parsePositiveInt(teamId, 'team'), request.user.userId, body?.inviteCode ?? ''));
  }

  @Post(':teamId/confirm')
  async confirm(@Req() request: AuthenticatedRequest, @Param('teamId') teamId: string): Promise<ApiResult<TicketTeamRecord>> {
    return success(await this.teamGrabService.confirmMember(parsePositiveInt(teamId, 'team'), request.user.userId));
  }

  @Post(':teamId/trigger')
  async trigger(@Req() request: AuthenticatedRequest, @Param('teamId') teamId: string): Promise<ApiResult<TeamGrabTriggerResponse>> {
    return success(await this.teamGrabService.triggerTeamGrab(parsePositiveInt(teamId, 'team'), request.user.userId));
  }

  @Post(':teamId/sync-paid')
  async syncPaid(@Req() request: AuthenticatedRequest, @Param('teamId') teamId: string): Promise<ApiResult<TeamPaymentSyncResponse>> {
    return success(await this.teamGrabService.syncPaidTeam(parsePositiveInt(teamId, 'team'), request.user.userId));
  }

  @Post(':teamId/leave')
  async leave(@Req() request: AuthenticatedRequest, @Param('teamId') teamId: string): Promise<ApiResult<TicketTeamRecord>> {
    return success(await this.teamGrabService.leaveTeam(parsePositiveInt(teamId, 'team'), request.user.userId));
  }

  @Delete(':teamId/members/:userId')
  async removeMember(
    @Req() request: AuthenticatedRequest,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
  ): Promise<ApiResult<TicketTeamRecord>> {
    return success(await this.teamGrabService.removeMember(
      parsePositiveInt(teamId, 'team'),
      request.user.userId,
      parsePositiveInt(userId, 'user'),
    ));
  }

  @Put(':teamId/strategy')
  async updateStrategy(
    @Req() request: AuthenticatedRequest,
    @Param('teamId') teamId: string,
    @Body() body: UpdateStrategyDto,
  ): Promise<ApiResult<TicketTeamRecord>> {
    return success(await this.teamGrabService.updateStrategy(
      parsePositiveInt(teamId, 'team'),
      request.user.userId,
      body.strategy,
      body.fallbacks ?? [],
    ));
  }
}
