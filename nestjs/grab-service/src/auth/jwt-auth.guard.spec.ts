import { UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard } from './jwt-auth.guard';

function contextWithAuthorization(authorization?: string) {
  const request: any = { headers: {} };
  if (authorization) request.headers.authorization = authorization;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    request,
  };
}

describe('JwtAuthGuard', () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = '12345678901234567890123456789012';
  });

  afterAll(() => {
    if (originalJwtSecret == null) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it('extracts userId from a valid bearer token', () => {
    const token = jwt.sign({ userId: 2004, phone: '13900000001', role: 'user' }, process.env.JWT_SECRET!, { subject: '2004' });
    const context = contextWithAuthorization(`Bearer ${token}`);
    const guard = new JwtAuthGuard();

    expect(guard.canActivate(context as any)).toBe(true);
    expect(context.request.user).toEqual({ userId: 2004, phone: '13900000001', role: 'user' });
  });

  it('rejects requests without bearer token', () => {
    const context = contextWithAuthorization();
    const guard = new JwtAuthGuard();

    expect(() => guard.canActivate(context as any)).toThrow(UnauthorizedException);
  });

  it('rejects requests when JWT_SECRET is not set', () => {
    delete process.env.JWT_SECRET;
    const token = jwt.sign(
      { userId: 2002, phone: '13800000000', role: 'platform_super_admin' },
      'omni-jwt-secretomni-jwt-secretomni-jwt-secret',
      { subject: '2002' },
    );
    const context = contextWithAuthorization(`Bearer ${token}`);
    const guard = new JwtAuthGuard();

    expect(() => guard.canActivate(context as any)).toThrow(UnauthorizedException);
    expect(context.request.user).toBeUndefined();
  });
});
