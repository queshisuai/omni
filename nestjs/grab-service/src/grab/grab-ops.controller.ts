import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/authenticated-request';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GrabOpsService, GrabOpsSummary } from './grab-ops.service';

interface ApiResult<T> {
  code: number;
  message: string;
  data: T;
}

function success<T>(data: T): ApiResult<T> {
  return { code: 200, message: '成功', data };
}

@Controller('api/grab/admin')
@UseGuards(JwtAuthGuard)
export class GrabOpsController {
  constructor(private readonly grabOpsService: GrabOpsService) {}

  @Get('ops-summary')
  async summary(@Req() request: AuthenticatedRequest): Promise<ApiResult<GrabOpsSummary>> {
    if (request.user.role !== 'admin') {
      throw new ForbiddenException('仅平台管理员可查看运营驾驶舱');
    }
    return success(await this.grabOpsService.getSummary());
  }
}
