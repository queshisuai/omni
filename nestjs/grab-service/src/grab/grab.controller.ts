import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/authenticated-request';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GrabService } from './grab.service';
import type { GrabProgressResponse, GrabRequestResponse, SubmitGrabRequestDto } from './grab.types';

interface ApiResult<T> {
  code: number;
  message: string;
  data: T;
}

function success<T>(data: T): ApiResult<T> {
  return { code: 200, message: 'success', data };
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
