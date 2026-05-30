import { BadRequestException } from '@nestjs/common';
import { TeamGrabController } from './team-grab.controller';
import type { TeamGrabService } from './team-grab.service';
import type { CreateTeamDto, TicketTeamMemberRecord, TicketTeamRecord } from './team-grab.types';

const now = new Date('2026-05-30T12:00:00.000Z');

function request(userId = 100): any {
  return { user: { userId } };
}

function team(overrides: Partial<TicketTeamRecord> = {}): TicketTeamRecord {
  return {
    id: 1,
    inviteCode: 'TEAM1234',
    leaderUserId: 100,
    activityId: 10,
    sessionId: 20,
    ticketTypeId: 30,
    size: 2,
    strategy: 'SAME_BLOCK',
    fallbacks: [],
    status: 'DRAFT',
    createTime: now,
    updateTime: now,
    ...overrides,
  };
}

function member(overrides: Partial<TicketTeamMemberRecord> = {}): TicketTeamMemberRecord {
  return {
    id: 1,
    teamId: 1,
    sessionId: 20,
    userId: 100,
    role: 'LEADER',
    status: 'CONFIRMED',
    seatId: null,
    orderSeatId: null,
    joinTime: now,
    ...overrides,
  };
}

function createController(service: Partial<Record<keyof TeamGrabService, jest.Mock>>): TeamGrabController {
  return new TeamGrabController(service as unknown as TeamGrabService);
}

describe('TeamGrabController', () => {
  it('creates a team for the authenticated user', async () => {
    const created = team({ id: 7, leaderUserId: 100 });
    const service = { createTeam: jest.fn().mockResolvedValue(created) };
    const controller = createController(service);
    const dto: CreateTeamDto = {
      activityId: 10,
      sessionId: 20,
      ticketTypeId: 30,
      strategy: 'SAME_BLOCK',
      fallbacks: ['SAME_TICKET_TYPE'],
    };

    await expect(controller.create(request(100), dto)).resolves.toEqual({
      code: 200,
      message: 'success',
      data: created,
    });
    expect(service.createTeam).toHaveBeenCalledWith(100, dto);
  });

  it('preserves service-supplied task 3 state fields in team detail', async () => {
    const currentTeam = team({ id: 7, status: 'READY', leaderUserId: 100 });
    const members = [member({ teamId: 7, userId: 100, role: 'LEADER', status: 'CONFIRMED' })];
    const service = {
      getTeamDetail: jest.fn().mockResolvedValue({
        team: currentTeam,
        members,
        canTriggerGrab: true,
        canPay: true,
        latestGrabRequestId: 'grab-7',
        latestOrderId: 99,
      }),
    };
    const controller = createController(service);

    await expect(controller.get(request(100), '7')).resolves.toEqual({
      code: 200,
      message: 'success',
      data: {
        team: currentTeam,
        members,
        canTriggerGrab: true,
        canPay: true,
        latestGrabRequestId: 'grab-7',
        latestOrderId: 99,
      },
    });
    expect(service.getTeamDetail).toHaveBeenCalledWith(7, 100);
  });

  it('uses conservative task 3 state defaults when service omits them', async () => {
    const currentTeam = team({ id: 7, status: 'READY', leaderUserId: 100 });
    const members = [member({ teamId: 7, userId: 100, role: 'LEADER', status: 'CONFIRMED' })];
    const service = { getTeamDetail: jest.fn().mockResolvedValue({ team: currentTeam, members }) };
    const controller = createController(service);

    await expect(controller.get(request(100), '7')).resolves.toEqual({
      code: 200,
      message: 'success',
      data: {
        team: currentTeam,
        members,
        canTriggerGrab: false,
        canPay: false,
        latestGrabRequestId: null,
        latestOrderId: null,
      },
    });
    expect(service.getTeamDetail).toHaveBeenCalledWith(7, 100);
  });

  it('does not let a non-member bypass detail authorization in the controller', async () => {
    const service = { getTeamDetail: jest.fn().mockResolvedValue({ team: team(), members: [] }) };
    const controller = createController(service);

    await controller.get(request(300), '1');

    expect(service.getTeamDetail).toHaveBeenCalledWith(1, 300);
  });

  it('joins a team as the authenticated user', async () => {
    const joined = team({ id: 7, size: 2 });
    const service = { joinTeam: jest.fn().mockResolvedValue(joined) };
    const controller = createController(service);

    await expect(controller.join(request(200), '7', { inviteCode: 'TEAM1234' })).resolves.toEqual({
      code: 200,
      message: 'success',
      data: joined,
    });
    expect(service.joinTeam).toHaveBeenCalledWith(7, 200);
  });

  it('confirms the authenticated member', async () => {
    const confirmed = team({ id: 7, status: 'READY' });
    const service = { confirmMember: jest.fn().mockResolvedValue(confirmed) };
    const controller = createController(service);

    await expect(controller.confirm(request(200), '7')).resolves.toEqual({
      code: 200,
      message: 'success',
      data: confirmed,
    });
    expect(service.confirmMember).toHaveBeenCalledWith(7, 200);
  });

  it('leaves a team as the authenticated user', async () => {
    const remaining = team({ id: 7, size: 1 });
    const service = { leaveTeam: jest.fn().mockResolvedValue(remaining) };
    const controller = createController(service);

    await expect(controller.leave(request(200), '7')).resolves.toEqual({
      code: 200,
      message: 'success',
      data: remaining,
    });
    expect(service.leaveTeam).toHaveBeenCalledWith(7, 200);
  });

  it('passes the authenticated user as leader when deleting a member', async () => {
    const updated = team({ id: 7, size: 1 });
    const service = { removeMember: jest.fn().mockResolvedValue(updated) };
    const controller = createController(service);

    await expect(controller.removeMember(request(100), '7', '200')).resolves.toEqual({
      code: 200,
      message: 'success',
      data: updated,
    });
    expect(service.removeMember).toHaveBeenCalledWith(7, 100, 200);
  });

  it('passes the authenticated user as leader when updating strategy', async () => {
    const updated = team({ id: 7, strategy: 'SAME_TICKET_TYPE', fallbacks: ['FALLBACK'] });
    const service = { updateStrategy: jest.fn().mockResolvedValue(updated) };
    const controller = createController(service);

    await expect(controller.updateStrategy(request(100), '7', {
      strategy: 'SAME_TICKET_TYPE',
      fallbacks: ['FALLBACK'],
    })).resolves.toEqual({
      code: 200,
      message: 'success',
      data: updated,
    });
    expect(service.updateStrategy).toHaveBeenCalledWith(7, 100, 'SAME_TICKET_TYPE', ['FALLBACK']);
  });

  it.each(['abc', ' 1', '1e2', '1.5', '0', '-1'])('rejects invalid team id %p', async (teamId) => {
    const service = { getTeamDetail: jest.fn() };
    const controller = createController(service);

    await expect(controller.get(request(100), teamId)).rejects.toBeInstanceOf(BadRequestException);
    expect(service.getTeamDetail).not.toHaveBeenCalled();
  });

  it('rejects invalid numeric route params', async () => {
    const service = { getTeamDetail: jest.fn(), removeMember: jest.fn() };
    const controller = createController(service);

    await expect(controller.removeMember(request(100), '1', '0')).rejects.toBeInstanceOf(BadRequestException);
    expect(service.getTeamDetail).not.toHaveBeenCalled();
    expect(service.removeMember).not.toHaveBeenCalled();
  });
});
