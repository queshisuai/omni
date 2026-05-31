import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { WaitlistRepository } from './waitlist.repository';
import { CreateWaitlistEntryDto, WaitlistEntryRecord, WaitlistEntryResponse } from './waitlist.types';

@Injectable()
export class WaitlistService {
  constructor(private readonly repository: WaitlistRepository) {}

  async createEntry(userId: number, dto: CreateWaitlistEntryDto): Promise<WaitlistEntryResponse> {
    this.validateCreateDto(dto);
    try {
      const result = await this.repository.createEntry({
        userId,
        sessionId: dto.sessionId,
        ticketTypeId: dto.ticketTypeId,
        quantity: dto.quantity,
        attendeeIds: [...(dto.attendeeIds ?? [])].sort((a, b) => a - b),
      });
      return this.toResponse(result.entry, result.rank);
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new ConflictException('已加入该场次票档候补');
      }
      throw error;
    }
  }

  async listMine(userId: number): Promise<WaitlistEntryResponse[]> {
    const entries = await this.repository.listByUser(userId);
    return entries.map((entry) => this.toResponse(entry, entry.rank ?? null));
  }

  async cancelEntry(userId: number, entryId: number): Promise<WaitlistEntryResponse> {
    const entry = await this.repository.cancelWaitingEntry(entryId, userId);
    if (!entry) throw new NotFoundException('未找到可取消的候补记录');
    return this.toResponse(entry, null);
  }

  private validateCreateDto(dto: CreateWaitlistEntryDto): void {
    if (!dto || !Number.isInteger(dto.sessionId) || dto.sessionId <= 0) throw new BadRequestException('场次不能为空');
    if (!Number.isInteger(dto.ticketTypeId) || dto.ticketTypeId <= 0) throw new BadRequestException('票档不能为空');
    if (!Number.isInteger(dto.quantity) || dto.quantity <= 0 || dto.quantity > 6) throw new BadRequestException('候补数量必须为 1-6 张');
    if (dto.attendeeIds && dto.attendeeIds.length > 0) {
      if (dto.attendeeIds.length !== dto.quantity) throw new BadRequestException('实名观演人数必须与候补数量一致');
      const unique = new Set(dto.attendeeIds);
      if (unique.size !== dto.attendeeIds.length || dto.attendeeIds.some((id) => !Number.isInteger(id) || id <= 0)) {
        throw new BadRequestException('实名观演人信息无效');
      }
    }
  }

  private toResponse(entry: WaitlistEntryRecord, rank: number | null): WaitlistEntryResponse {
    return {
      id: entry.id,
      sessionId: entry.sessionId,
      ticketTypeId: entry.ticketTypeId,
      quantity: entry.quantity,
      status: entry.status,
      rank,
      offerOrderId: entry.offerOrderId,
      offerExpireTime: entry.offerExpireTime ? entry.offerExpireTime.toISOString() : null,
      failReason: entry.failReason,
    };
  }
}
