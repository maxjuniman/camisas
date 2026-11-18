import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { ensureSeed } from './bootstrap/ensure-seed';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    throw new Error('Defina JWT_SECRET com pelo menos 16 caracteres.');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.enableCors({
    origin: (process.env.WEB_ORIGIN || 'http://localhost:5173').split(','),
    credentials: true,
  });
  app.useStaticAssets(process.env.STORAGE_DIR || join(process.cwd(), 'storage'), {
    prefix: '/media',
    index: false,
    dotfiles: 'deny',
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const prisma = app.get(PrismaService);
  await ensureSeed(prisma);
  await app.listen(Number(process.env.PORT || 3000), '0.0.0.0');
}

void bootstrap();
