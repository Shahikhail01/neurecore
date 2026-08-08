import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { json, urlencoded } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import { AppModule } from './app.module';
import { initTracing } from './infrastructure/tracing/tracing';
import { MetricsService } from './modules/metrics/metrics.service';
import { SharedSocketIoAdapter } from './common/socket/shared-socket-io-adapter';

// Initialise tracing before the app bootstraps.
void initTracing();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
    bodyParser: false,
  });

  app.useWebSocketAdapter(new SharedSocketIoAdapter(app));

  const config = app.get(ConfigService);

  // Security
  app.use(helmet());

  // PERF-FIX: gzip/deflate compression for all JSON/HTML responses.
  // List endpoints (projects/agents/customers/chat-history) can return
  // 100KB-1MB payloads; compression cuts TTFB for first-paint of list
  // pages by 50-80% on slow links.
  app.use(
    compression({
      threshold: 1024, // skip very small payloads
      level: 6,
    }),
  );

  // PERF-FIX: per-request structured access log with elapsed time.
  // Uses pino-http (already a dep). Slow-request alarm via customLogLevel.
  const isProd =
    config.get<string>('NODE_ENV') === 'production' ||
    process.env.NODE_ENV === 'production';
  app.use(
    pinoHttp({
      level: isProd ? 'info' : 'debug',
      // Assign a correlation id if upstream didn't (X-Correlation-ID).
      genReqId: (req, res) => {
        const existing = req.headers['x-correlation-id'];
        const id =
          (Array.isArray(existing) ? existing[0] : existing) || randomUUID();
        res.setHeader('X-Correlation-ID', String(id));
        return id;
      },
      // Slow-request alarm — anything >1500ms gets a warn line.
      customLogLevel: (req, res, err) => {
        if (err || (res.statusCode ?? 0) >= 500) return 'error';
        const responseTime = (req as { responseTime?: number }).responseTime;
        if (typeof responseTime === 'number' && responseTime > 1500) {
          return 'warn';
        }
        return 'info';
      },
      // Trim noisy fields
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie'],
        censor: '[REDACTED]',
      },
      serializers: {
        req: (req) => ({ method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  // Phase 9: cookie-parser (parses Cookie header into req.cookies)
  // Required by CookieAuthService + JwtStrategy cookie-first extraction.
  app.use(cookieParser());

  // FIX D12.2 — mount JSON + urlencoded body parsers BEFORE any Nest guards or
  // interceptors run, guaranteeing `req.body` is populated when controllers
  // read `@Body()`. Both parsers populate `req.rawBody` via the `verify` hook
  // for downstream code (webhook signatures, etc.).
  app.use(
    json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(
    urlencoded({
      extended: true,
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );

  // Global prefix & versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // CORS — frontend origins only
  const tenantFrontendUrl = config.get<string>('TENANT_FRONTEND_URL');
  const adminFrontendUrl = config.get<string>('ADMIN_FRONTEND_URL');

  // Dev defaults in this repo: admin=3001, tenant=3002 (support localhost and 127.0.0.1)
  // Production domains for Contabo frontends
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

  // Cookie-only auth requires the Access-Control-Allow-Origin response
  // header to ECHO the calling Origin (it cannot be "*" when
  // credentials are involved). NestJS' built-in CORS handler does this
  // correctly when `origin: true` is passed — it mirrors whatever the
  // browser sent. We also validate the origin against an allow-list so
  // misbehaving clients cannot trick us into "Access-Control-Allow-Origin:
  // https://attacker.example".
  app.enableCors({
    origin: (origin, callback) => {
      // Same-origin / no-origin (curl, server-to-server) — allow.
      if (!origin) return callback(null, true);
      const allowed = new Set(origins);
      const originParts = origin.split(',').map(o => o.trim());
      if (originParts.some(o => allowed.has(o))) return callback(null, true);
      return callback(new Error(`Origin not allowed: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-ID',
      'X-CSRF-Token',
      'X-Tenant-ID',
      'Idempotency-Key',
    ],
  });

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

  // WS-2.1: Static asset serving for tenant logos (and future uploads).
  // Mounted at `/cdn` → `apps/cdn/uploads/`. Public read; uploads go through
  // the authenticated POST /uploads/logo endpoint which validates type + size.
  app.useStaticAssets(resolve(process.cwd(), 'apps', 'cdn', 'uploads'), {
    prefix: '/cdn/',
  });

  // ─── Phase 1, Task 1.7: OpenAPI generation ───────────────────────
  // Per `EAOS-api-contract.md` §11, we generate the OpenAPI 3.1 spec
  // at boot and persist it to `backend/openapi/openapi.json` so the
  // frontend codegen pipeline can consume a committed artifact.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('NeureCore API')
    .setDescription('Enterprise AI Operating System — REST + WebSocket + SSE')
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .addApiKey(
      { type: 'apiKey', name: 'X-Tenant-ID', in: 'header' },
      'X-Tenant-ID',
    )
    .addApiKey(
      { type: 'apiKey', name: 'Idempotency-Key', in: 'header' },
      'Idempotency-Key',
    )
    .addServer('http://localhost:3000/api/v1', 'Local dev')
    .addServer('https://brain.neurecore.com/api/v1', 'Production (Contabo)')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Persist OpenAPI artifact to backend/openapi/openapi.json (per spec §11.4).
  const logger = new Logger('Bootstrap');
  try {
    const outDir = join(process.cwd(), 'openapi');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, 'openapi.json'),
      JSON.stringify(document, null, 2),
    );
    logger.log(
      `[OpenAPI] Wrote backend/openapi/openapi.json (${Object.keys((document as { paths?: Record<string, unknown> }).paths ?? {}).length} paths)`,
    );
  } catch (err) {
    logger.warn(
      `[OpenAPI] Failed to write openapi.json (request flow NOT blocked): ${String(err)}`,
    );
  }

  // Serve Swagger UI at /api/docs (dev + prod per spec §11.4).
  SwaggerModule.setup('api/docs', app, document);

  // Add a lightweight root handler for `/api` so the base path returns useful info
  try {
    const adapter = app.getHttpAdapter().getInstance();
    if (adapter && typeof adapter.get === 'function') {
      adapter.get('/api', (_req: any, res: any) => {
        res.json({
          status: 'ok',
          api: 'NeureCore Backend',
          endpoints: [
            '/api/health',
            '/api/health/ready',
            '/api/health/live',
            '/api/docs',
            '/api/docs-json',
          ],
        });
      });

      adapter.get('/api/metrics', async (_req: any, res: any) => {
        try {
          const metricsService = app.get(MetricsService);
          const body = await metricsService.toExpositionFormat();
          res.setHeader('Content-Type', metricsService.contentType);
          res.status(200).send(body);
        } catch (err) {
          res.status(500).send('Metrics unavailable');
        }
      });
    }
  } catch (err) {
    // ignore if adapter not available
  }

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`🚀 NeureCore API running on: http://localhost:${port}/api`);
  logger.log(`📘 OpenAPI UI:  http://localhost:${port}/api/docs`);
}
bootstrap();
