import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { GrabModule } from './grab/grab.module';
import { WaitlistModule } from './waitlist/waitlist.module';

@Module({
  imports: [AuthModule, DatabaseModule, GrabModule, WaitlistModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
