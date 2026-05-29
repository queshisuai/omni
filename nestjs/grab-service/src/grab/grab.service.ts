import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { GrabAdmissionService } from './grab-admission.service';
import { ACTIVE_ASYNC_PROGRESS_STATUSES, GrabRepository, isUniqueViolation } from './grab.repository';
import { GRAB_STATUS } from './grab-status';
import type { GrabRequestRecord, GrabRequestResponse, SubmitGrabRequestDto } from './grab.types';
import { OrderClientService } from './order-client.service';

const ACTIVE_ASYNC_PROGRESS_STATUS_SET = new Set<string>(ACTIVE_ASYNC_PROGRESS_STATUSES);
const RELEASEABLE_PROGRESS_STATUSES = new Set(['LOCKING', 'ORDER_CREATING']);
const TERMINAL_CANCEL_STATUSES = new Set<string>([
  GRAB_STATUS.ORDER_CREATED,
  GRAB_STATUS.SOLD_OUT,
  GRAB_STATUS.LIMITED,
  GRAB_STATUS.FAILED,
  GRAB_STATUS.EXPIRED,
]);

@Injectable()
export class GrabService {
  private readonly requestTtlSeconds = 900;

  constructor(
    private readonly repository: GrabRepository,
    private readonly admissionService: GrabAdmissionService,
    private readonly orderClient: OrderClientService,
  ) {}

  async submitRequest(userId: number, dto: SubmitGrabRequestDto): Promise<GrabRequestResponse> {
    this.validateSubmitRequest(dto);
    const existing = await this.repository.findByUserAndIdempotency(userId, dto.idempotencyKey);
    if (existing) return this.toResponse(existing);

    const requestId = this.generateRequestId();
    const seatIds = [...(dto.seatIds ?? [])].sort((a, b) => a - b);
    const allocateRandom = Boolean(dto.allocateRandom);
    const active = await this.repository.findActiveByIntent({
      userId,
      sessionId: dto.sessionId,
      ticketTypeId: dto.ticketTypeId,
      quantity: dto.quantity,
      seatIds,
      allocateRandom,
    });
    if (active) return this.toResponse(active);

    let created: GrabRequestRecord;
    try {
      created = await this.repository.createPending({
        requestId,
        idempotencyKey: dto.idempotencyKey,
        userId,
        sessionId: dto.sessionId,
        ticketTypeId: dto.ticketTypeId,
        quantity: dto.quantity,
        seatIds,
        allocateRandom,
        expireTime: new Date(Date.now() + this.requestTtlSeconds * 1000),
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const record = await this.repository.findByUserAndIdempotency(userId, dto.idempotencyKey);
        if (record) return this.toResponse(record);
      }
      throw error;
    }

    const admission = await this.admissionService.admit({
      requestId: created.requestId,
      userId,
      sessionId: dto.sessionId,
      ticketTypeId: dto.ticketTypeId,
      quantity: dto.quantity,
      seatIds,
      idempotencyKey: dto.idempotencyKey,
      ttlSeconds: this.requestTtlSeconds,
    });

    if (admission.outcome === 'IDEMPOTENT' && admission.existingRequestId) {
      const record = await this.repository.findByRequestId(admission.existingRequestId);
      return record ? this.toResponse(record) : this.toResponse(created);
    }
    if (admission.outcome === 'SOLD_OUT') {
      return this.toResponse(await this.repository.updateStatus(created.requestId, GRAB_STATUS.SOLD_OUT, '库存不足'));
    }
    if (admission.outcome === 'LIMITED') {
      return this.toResponse(await this.repository.updateStatus(created.requestId, GRAB_STATUS.LIMITED, '请勿重复抢票'));
    }
    if (admission.outcome === 'STOCK_UNINITIALIZED') {
      return this.toResponse(await this.repository.updateStatus(created.requestId, GRAB_STATUS.FAILED, '抢票库存未初始化'));
    }

    await this.repository.updateStatus(created.requestId, GRAB_STATUS.ACCEPTED);
    await this.repository.updateStatus(created.requestId, GRAB_STATUS.ORDER_CREATING);

    try {
      const order = await this.orderClient.createOrder({
        userId,
        sessionId: dto.sessionId,
        ticketTypeId: dto.ticketTypeId,
        quantity: dto.quantity,
        seatIds,
        allocateRandom,
      });
      return this.toResponse(await this.repository.markOrderCreated(created.requestId, order.id));
    } catch (error) {
      await this.admissionService.release({
        userId,
        sessionId: dto.sessionId,
        ticketTypeId: dto.ticketTypeId,
        quantity: dto.quantity,
        seatIds,
        idempotencyKey: dto.idempotencyKey,
        restoreStock: true,
      });
      const message = error instanceof Error ? error.message : '订单创建失败';
      const status = message.includes('库存') ? GRAB_STATUS.SOLD_OUT : message.includes('限购') ? GRAB_STATUS.LIMITED : GRAB_STATUS.FAILED;
      return this.toResponse(await this.repository.updateStatus(created.requestId, status, message));
    }
  }

  async getRequest(userId: number, requestId: string): Promise<GrabRequestResponse> {
    const record = await this.repository.findByRequestId(requestId);
    if (!record) throw new NotFoundException('抢票请求不存在');
    if (record.userId !== userId) throw new ForbiddenException('不能查看他人的抢票请求');
    return this.toResponse(record);
  }

  async cancelRequest(userId: number, requestId: string): Promise<GrabRequestResponse> {
    const record = await this.repository.findByRequestId(requestId);
    if (!record) throw new NotFoundException('抢票请求不存在');
    if (record.userId !== userId) throw new ForbiddenException('不能取消他人的抢票请求');
    if (TERMINAL_CANCEL_STATUSES.has(record.status)) return this.toResponse(record);
    if (record.orderId) return this.toResponse(record);
    const progressStatus = (record as GrabRequestRecordWithProgress).progressStatus;
    const hasAsyncProgress = Boolean(progressStatus);
    const hasCancelableProgress = progressStatus ? ACTIVE_ASYNC_PROGRESS_STATUS_SET.has(progressStatus) : false;
    const hasLegacyCancelableStatus = !hasAsyncProgress && (record.status === GRAB_STATUS.ACCEPTED || record.status === GRAB_STATUS.ORDER_CREATING);
    if (!hasCancelableProgress && !hasLegacyCancelableStatus) return this.toResponse(record);
    if ((progressStatus && RELEASEABLE_PROGRESS_STATUSES.has(progressStatus)) || hasLegacyCancelableStatus) {
      await this.admissionService.release(record);
    }
    return this.toResponse(await this.repository.updateStatus(requestId, GRAB_STATUS.EXPIRED, 'grab request cancelled'));
  }

  private validateSubmitRequest(dto: SubmitGrabRequestDto): void {
    if (!Number.isInteger(dto.sessionId) || dto.sessionId <= 0) throw new BadRequestException('场次不正确');
    if (!Number.isInteger(dto.ticketTypeId) || dto.ticketTypeId <= 0) throw new BadRequestException('票档不正确');
    if (!Number.isInteger(dto.quantity) || dto.quantity <= 0) throw new BadRequestException('数量不正确');
    if (!dto.idempotencyKey?.trim()) throw new BadRequestException('幂等键不能为空');
    if (dto.seatIds && dto.seatIds.length > 0 && dto.seatIds.length !== dto.quantity) throw new BadRequestException('座位数量不正确');
  }

  private generateRequestId(): string {
    return `GRAB${randomBytes(12).toString('hex')}`;
  }

  private toResponse(record: Pick<GrabRequestRecord, 'requestId' | 'status' | 'orderId' | 'failReason'>): GrabRequestResponse {
    return {
      requestId: record.requestId,
      status: record.status,
      orderId: record.orderId,
      failReason: record.failReason,
    };
  }
}

interface GrabRequestRecordWithProgress {
  progressStatus?: string | null;
}
