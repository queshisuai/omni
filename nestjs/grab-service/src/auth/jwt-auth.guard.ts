import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import type { AuthenticatedRequest } from './authenticated-request';

interface JwtPayload {
  userId?: number | string;
  phone?: string;
  role?: string;
  sub?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('未登录');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('JWT 未配置');
    }

    try {
      const token = authorization.slice('Bearer '.length);
      const payload = jwt.verify(token, secret) as JwtPayload;
      const userId = Number(payload.userId ?? payload.sub);
      if (!Number.isInteger(userId) || userId <= 0) {
        throw new UnauthorizedException('登录状态无效');
      }
      request.user = { userId, phone: payload.phone, role: payload.role };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('登录状态无效');
    }
  }
}
