import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = Number(process.env.GRAB_SERVICE_PORT || 3001);
  await app.listen(port);
  console.log(`Grab service running on http://localhost:${port}`);
}
bootstrap();
