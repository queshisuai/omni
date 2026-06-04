import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = Number(process.env.GRAB_SERVICE_PORT || 3001);
  const host = process.env.GRAB_SERVICE_HOST || '127.0.0.1';
  await app.listen(port, host);
  console.log(`Grab service running on http://${host}:${port}`);
}

if (require.main === module) {
  bootstrap();
}
