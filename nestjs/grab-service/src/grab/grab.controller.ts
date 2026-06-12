import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/authenticated-request';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GrabService } from './grab.service';
import type { GrabProgressResponse, GrabRequestResponse, SubmitGrabRequestDto } from './grab.types';
import { VisibleStockService, SessionVisibleStockResponse } from './visible-stock.service';

interface ApiResult<T> {
  code: number;
  message: string;
  data: T;
}

function success<T>(data: T): ApiResult<T> {
  return { code: 200, message: '成功', data };
}

@Controller('api/grab/requests')
@UseGuards(JwtAuthGuard)
export class GrabController {
  constructor(private readonly grabService: GrabService) {}

  @Post()
  async submit(@Req() request: AuthenticatedRequest, @Body() body: SubmitGrabRequestDto): Promise<ApiResult<GrabRequestResponse>> {
    return success(await this.grabService.submitRequest(request.user.userId, body));
  }

  @Get(':requestId')
  async get(@Req() request: AuthenticatedRequest, @Param('requestId') requestId: string): Promise<ApiResult<GrabRequestResponse>> {
    return success(await this.grabService.getRequest(request.user.userId, requestId));
  }

  @Get(':requestId/progress')
  async progress(@Req() request: AuthenticatedRequest, @Param('requestId') requestId: string): Promise<ApiResult<GrabProgressResponse>> {
    return success(await this.grabService.getProgress(request.user.userId, requestId));
  }

  @Post(':requestId/cancel')
  async cancel(@Req() request: AuthenticatedRequest, @Param('requestId') requestId: string): Promise<ApiResult<GrabRequestResponse>> {
    return success(await this.grabService.cancelRequest(request.user.userId, requestId));
  }
}

@Controller('api/grab/internal')
export class GrabInternalController {
  private readonly internalToken = process.env.INTERNAL_API_TOKEN || '';

  constructor(private readonly grabService: GrabService) {}

  @Get('users/:userId/requests')
  async internalListByUser(
    @Headers('x-internal-token') token: string | undefined,
    @Param('userId') userId: string,
    @Query('limit') limit = '5',
  ): Promise<ApiResult<GrabRequestResponse[]>> {
    this.requireInternalToken(token);
    return success(await this.grabService.listByUser(Number(userId), Number(limit)));
  }

  private requireInternalToken(token: string | undefined): void {
    if (!this.internalToken || token !== this.internalToken) {
      throw new UnauthorizedException('内部接口令牌无效');
    }
  }
}

@Controller('api/grab/sessions')
@UseGuards(JwtAuthGuard)
export class GrabSessionController {
  constructor(private readonly visibleStockService: VisibleStockService) {}

  @Get(':sessionId/stock-visible')
  async stockVisible(
    @Param('sessionId') sessionId: string,
    @Query('ticketTypeIds') ticketTypeIds = '',
  ): Promise<ApiResult<SessionVisibleStockResponse>> {
    const parsedSessionId = Number(sessionId);
    if (!Number.isInteger(parsedSessionId) || parsedSessionId <= 0) {
      throw new BadRequestException('场次无效');
    }
    const ids = ticketTypeIds
      .split(',')
      .map((ticketTypeId) => Number(ticketTypeId))
      .filter((ticketTypeId) => Number.isInteger(ticketTypeId) && ticketTypeId > 0);
    if (ids.length === 0) {
      throw new BadRequestException('票档不能为空');
    }
    return success(await this.visibleStockService.getSessionVisibleStock(parsedSessionId, ids));
  }
}
