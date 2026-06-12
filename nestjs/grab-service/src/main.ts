import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { requireEnv } from './runtime-env';

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = Number(process.env.GRAB_SERVICE_PORT || 3001);
  const host = requireEnv('GRAB_SERVICE_HOST', '抢票服务监听地址未配置');
  await app.init();
  await new Promise<void>((resolve) => app.getHttpServer().listen(port, host, 2048, resolve));
  console.log(`抢票服务运行在 http://${host}:${port}`);
}

if (require.main === module) {
  bootstrap();
}
