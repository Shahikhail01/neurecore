import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { initTracing } from './infrastructure/tracing/tracing';

// Initialise tracing before the app bootstraps.
void initTracing();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
    rawBody: true, // required for OpenClaw inbound webhook HMAC validation
  });

  const config = app.get(ConfigService);

  // Security
  app.use(helmet());

  // Global prefix & versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });

  // CORS — frontend origins only
  const tenantFrontendUrl = config.get<string>('TENANT_FRONTEND_URL');
  const adminFrontendUrl = config.get<string>('ADMIN_FRONTEND_URL');

  // Dev defaults in this repo: admin=3001, tenant=3002 (support localhost and 127.0.0.1)
  // Production domains for Vercel frontends
  const defaultOrigins = [
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'https://hq.neurecore.com',
    'https://cc.neurecore.com',
  ];
  const origins = [
    tenantFrontendUrl,
    adminFrontendUrl,
    ...defaultOrigins,
  ].filter((v): v is string => Boolean(v));

  const isProd =
    config.get<string>('NODE_ENV') === 'production' ||
    process.env.NODE_ENV === 'production';
  if (isProd) {
    app.enableCors({
      origin: Array.from(new Set(origins)),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
    });
  } else {
    // In local dev allow all origins to avoid CORS friction
    app.enableCors({ origin: true, credentials: true });
  }

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Be permissive in local/dev workflows: strip unknown props but don't fail
      // (prevents 400 responses when frontends send extra fields).
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Add a lightweight root handler for `/api` so the base path returns useful info
  try {
    const adapter = app.getHttpAdapter().getInstance();
    if (adapter && typeof adapter.get === 'function') {
      adapter.get('/api', (_req: any, res: any) => {
        res.json({
          status: 'ok',
          api: 'NeureCore Backend',
          endpoints: ['/api/health', '/api/health/ready', '/api/health/live'],
        });
      });
    }
  } catch (err) {
    // ignore if adapter not available
  }

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`🚀 NeureCore API running on: http://localhost:${port}/api`);
}
bootstrap();
