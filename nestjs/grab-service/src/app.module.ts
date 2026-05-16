import { Module } from '@nestjs/common';
import { GrabModule } from './grab/grab.module';

@Module({
  imports: [GrabModule],
  controllers: [],
  providers: [],
})
export class AppModule {}