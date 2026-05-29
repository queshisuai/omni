import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GrabAdmissionService } from './grab-admission.service';
import { GrabRepository } from './grab.repository';
import { GRAB_STATUS } from './grab-status';

const RELEASEABLE_PROGRESS_STATUSES = new Set(['LOCKING', 'ORDER_CREATING']);

@Injectable()
export class GrabCompensationService implements OnModuleInit {
  private readonly logger = new Logger(GrabCompensationService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly repository: GrabRepository,
    private readonly admissionService: GrabAdmissionService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.sweepExpiredRequests().catch((error) => this.logger.error(error));
    }, 60_000);
  }

  async sweepExpiredRequests(): Promise<void> {
    const expiredRequests = await this.repository.findExpiredInFlight(new Date(), 100);
    for (const request of expiredRequests) {
      const progressStatus = (request as GrabRequestRecordWithProgress).progressStatus;
      if (!request.orderId && RELEASEABLE_PROGRESS_STATUSES.has(progressStatus)) {
        await this.admissionService.release(request);
      }
      await this.repository.updateStatus(request.requestId, GRAB_STATUS.EXPIRED, '抢票请求已超时');
    }
  }
}

interface GrabRequestRecordWithProgress {
  progressStatus?: string | null;
}
