import { Body, Controller, Delete, Get, Headers, Param, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/authenticated-request';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WaitlistService } from './waitlist.service';
import { WaitlistAllocatorService } from './waitlist-allocator.service';
import { CreateWaitlistEntryDto, WaitlistEntryResponse } from './waitlist.types';

interface ApiResult<T> {
  code: number;
  message: string;
  data: T;
}

function success<T>(data: T): ApiResult<T> {
  return { code: 200, message: '成功', data };
}

@Controller('api/waitlist')
export class WaitlistController {
  private readonly internalToken = process.env.INTERNAL_API_TOKEN || '';

  constructor(
    private readonly waitlistService: WaitlistService,
    private readonly allocator: WaitlistAllocatorService,
  ) {}

  @Post('entries')
  @UseGuards(JwtAuthGuard)
  async create(@Req() request: AuthenticatedRequest, @Body() body: CreateWaitlistEntryDto): Promise<ApiResult<WaitlistEntryResponse>> {
    return success(await this.waitlistService.createEntry(request.user.userId, body));
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async mine(@Req() request: AuthenticatedRequest): Promise<ApiResult<WaitlistEntryResponse[]>> {
    return success(await this.waitlistService.listMine(request.user.userId));
  }

  @Get('internal/users/:userId/entries')
  async internalListByUser(
    @Headers('x-internal-token') token: string | undefined,
    @Param('userId') userId: string,
    @Query('limit') limit = '5',
  ): Promise<ApiResult<WaitlistEntryResponse[]>> {
    this.requireInternalToken(token);
    return success(await this.waitlistService.listByUser(Number(userId), Number(limit)));
  }

  @Delete('entries/:id')
  @UseGuards(JwtAuthGuard)
  async cancel(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<ApiResult<WaitlistEntryResponse>> {
    return success(await this.waitlistService.cancelEntry(request.user.userId, Number(id)));
  }

  @Post('internal/offers/expire-scan')
  async expireScan(@Headers('x-internal-token') token: string | undefined): Promise<ApiResult<unknown>> {
    this.requireInternalToken(token);
    return success(await this.allocator.scanExpiredOffers());
  }

  private requireInternalToken(token: string | undefined): void {
    if (!this.internalToken || token !== this.internalToken) {
      throw new UnauthorizedException('内部接口令牌无效');
    }
  }
}
