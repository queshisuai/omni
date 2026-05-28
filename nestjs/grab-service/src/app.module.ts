import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { GrabModule } from './grab/grab.module';

@Module({
  imports: [AuthModule, DatabaseModule, GrabModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
