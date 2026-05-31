import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { OrderClientService } from '../grab/order-client.service';
import { WaitlistController } from './waitlist.controller';
import { WaitlistAllocatorService } from './waitlist-allocator.service';
import { WaitlistNotificationService } from './waitlist-notification.service';
import { WaitlistRepository } from './waitlist.repository';
import { WaitlistService } from './waitlist.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [WaitlistController],
  providers: [
    WaitlistService,
    WaitlistRepository,
    WaitlistAllocatorService,
    WaitlistNotificationService,
    OrderClientService,
  ],
})
export class WaitlistModule {}
