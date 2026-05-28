import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = Number(process.env.GRAB_SERVICE_PORT || 3001);
  await app.init();
  await new Promise<void>((resolve) => app.getHttpServer().listen(port, 2048, resolve));
  console.log(`Grab service running on http://localhost:${port}`);
}

if (require.main === module) {
  bootstrap();
}
