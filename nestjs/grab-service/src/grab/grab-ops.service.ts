import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface GrabOpsSummary {
  failureReasons: Array<{ reason: string; count: number }>;
  waitlist: {
    totalCount: number;
    paidCount: number;
    conversionRate: number;
  };
}

@Injectable()
export class GrabOpsService {
  constructor(private readonly database: DatabaseService) {}

  async getSummary(): Promise<GrabOpsSummary> {
    const failureReasons = await this.loadFailureReasons();
    const waitlist = await this.loadWaitlistConversion();
    return { failureReasons, waitlist };
  }

  private async loadFailureReasons(): Promise<Array<{ reason: string; count: number }>> {
    const result = await this.database.query<{ reason: string | null; count: string | number }>(
      `select coalesce(nullif(trim(fail_reason), ''), progress_status, status, '未知原因') as reason,
              count(*) as count
         from grab_request
        where status in ('SOLD_OUT', 'LIMITED', 'FAILED', 'EXPIRED', 'PENDING_RECOVERY')
           or progress_status in ('SOLD_OUT', 'LIMITED', 'FAILED', 'EXPIRED', 'PENDING_RECOVERY')
        group by coalesce(nullif(trim(fail_reason), ''), progress_status, status, '未知原因')
        order by count(*) desc
        limit 8`,
    );
    return result.rows.map((row) => ({
      reason: row.reason || '未知原因',
      count: Number(row.count ?? 0),
    }));
  }

  private async loadWaitlistConversion(): Promise<GrabOpsSummary['waitlist']> {
    const result = await this.database.query<{ total_count: string | number; paid_count: string | number }>(
      `select count(*) as total_count,
              coalesce(sum(case when status = 'PAID' then 1 else 0 end), 0) as paid_count
         from waitlist_entry`,
    );
    const row = result.rows[0] ?? { total_count: 0, paid_count: 0 };
    const totalCount = Number(row.total_count ?? 0);
    const paidCount = Number(row.paid_count ?? 0);
    return {
      totalCount,
      paidCount,
      conversionRate: totalCount > 0 ? paidCount / totalCount : 0,
    };
  }
}
