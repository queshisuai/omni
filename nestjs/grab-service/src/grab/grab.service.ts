import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { GrabAdmissionService } from './grab-admission.service';
import { GrabQueueService } from './grab-queue.service';
import { GrabRepository, isUniqueViolation } from './grab.repository';
import { GRAB_STATUS } from './grab-status';
import type { GrabRequestRecord, GrabRequestResponse, GrabTicketPreference, SubmitGrabRequestDto } from './grab.types';
import { OrderClientService } from './order-client.service';

@Injectable()
export class GrabService {
  private readonly requestTtlSeconds = 900;

  constructor(
    private readonly repository: GrabRepository,
    private readonly admissionService: GrabAdmissionService,
    private readonly orderClient: OrderClientService,
    private readonly queueService: GrabQueueService,
  ) {}

  async submitRequest(userId: number, dto: SubmitGrabRequestDto): Promise<GrabRequestResponse> {
    this.validateSubmitRequest(dto);
    const requestedTicketTypes = this.normalizePreferences(dto);
    const firstPreference = requestedTicketTypes[0];

    const existing = await this.repository.findByUserAndIdempotency(userId, dto.idempotencyKey);
    if (existing) return this.toResponse(existing);

    const requestId = this.generateRequestId();
    const seatIds = [...(dto.seatIds ?? [])].sort((a, b) => a - b);
    const allocateRandom = Boolean(dto.allocateRandom);
    const active = await this.repository.findActiveByIntent({
      userId,
      sessionId: dto.sessionId,
      ticketTypeId: firstPreference.ticketTypeId,
      quantity: dto.quantity,
      seatIds,
      allocateRandom,
    });
    if (active) return this.toResponse(active);

    const queued = await this.queueService.enqueue({ requestId, sessionId: dto.sessionId, userId });

    let created: GrabRequestRecord;
    try {
      created = await this.repository.createQueued({
        requestId,
        idempotencyKey: dto.idempotencyKey,
        userId,
        sessionId: dto.sessionId,
        ticketTypeId: firstPreference.ticketTypeId,
        quantity: dto.quantity,
        seatIds,
        allocateRandom,
        expireTime: new Date(Date.now() + this.requestTtlSeconds * 1000),
        queueSeq: queued.queueSeq,
        requestedTicketTypes,
        allowAutoDowngrade: Boolean(dto.allowAutoDowngrade) && requestedTicketTypes.length > 1,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const record = await this.repository.findByUserAndIdempotency(userId, dto.idempotencyKey);
        if (record) return this.toResponse(record);
      }
      throw error;
    }

    return this.toResponse(created, queued.queueRank);
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
    if (record.orderId) return this.toResponse(record);
    if (record.status !== GRAB_STATUS.ACCEPTED && record.status !== GRAB_STATUS.ORDER_CREATING) return this.toResponse(record);
    await this.admissionService.release(record);
    return this.toResponse(await this.repository.updateStatus(requestId, GRAB_STATUS.EXPIRED, '抢票请求已取消'));
  }

  private validateSubmitRequest(dto: SubmitGrabRequestDto): void {
    if (!Number.isInteger(dto.sessionId) || dto.sessionId <= 0) throw new BadRequestException('场次不正确');
    if (!Number.isInteger(dto.quantity) || dto.quantity <= 0) throw new BadRequestException('数量不正确');
    if (!dto.idempotencyKey?.trim()) throw new BadRequestException('幂等键不能为空');
    if (dto.seatIds && dto.seatIds.length > 0 && dto.seatIds.length !== dto.quantity) throw new BadRequestException('座位数量不正确');
  }

  private normalizePreferences(dto: SubmitGrabRequestDto): GrabTicketPreference[] {
    const preferences = dto.ticketTypePreferences?.length
      ? dto.ticketTypePreferences
      : dto.ticketTypeId == null
        ? []
        : [{ ticketTypeId: dto.ticketTypeId }];

    if (preferences.length === 0) throw new BadRequestException('票档不能为空');

    const normalized = preferences.map((preference) => {
      if (!Number.isInteger(preference.ticketTypeId) || preference.ticketTypeId <= 0) {
        throw new BadRequestException('票档不能为空');
      }

      return {
        ticketTypeId: preference.ticketTypeId,
        name: preference.name ?? null,
        maxPrice: preference.maxPrice ?? null,
      };
    });

    if (dto.seatIds?.length && normalized.length > 1) {
      throw new BadRequestException('选座请求不支持自动降级');
    }

    if (!dto.allowAutoDowngrade) return [normalized[0]];

    return normalized;
  }

  private generateRequestId(): string {
    return `GRAB${randomBytes(12).toString('hex')}`;
  }

  private async toResponse(
    record: Pick<GrabRequestRecord, 'requestId' | 'status' | 'orderId' | 'failReason'> &
      Partial<Pick<GrabRequestRecord, 'sessionId' | 'progressStatus' | 'progressMessage' | 'queueSeq'>>,
    queueRank?: number | null,
  ): Promise<GrabRequestResponse> {
    const rank = queueRank ?? (
      record.queueSeq != null && record.sessionId != null
        ? await this.queueService.calculateQueueRank(record.sessionId, record.queueSeq)
        : null
    );

    return {
      requestId: record.requestId,
      status: record.progressStatus ?? record.status,
      orderId: record.orderId,
      failReason: record.failReason,
      queueSeq: record.queueSeq ?? null,
      queueRank: rank,
      estimatedWaitSeconds: null,
      message: record.progressMessage ?? null,
    };
  }
}
