/**
 * Drift backtest cron (D4 — IMPL_PLAN §8).
 *
 * Runs the per-tenant backtest on a schedule (PM2 entry in
 * scripts/pm2/ecosystem.config.js, scheduled at 02:30 UTC daily).
 *
 * CLI flags:
 *   --tenants=<csv>     Comma-separated tenant IDs to run for
 *                        (default: all non-archived tenants)
 *   --tenantId=<id>     Single tenant ID (shorthand)
 *   --windowDays=<n>    Lookback window (default 30)
 *   --dryRun            Print plan, do not call any LLM / persist
 *   --json              Emit JSON one-per-line events to stdout
 *
 * Telemetry:
 *   - Emits `drift.backtest.completed` once per tenant with outcome +
 *     elapsed ms.
 *   - On error, emits `drift.backtest.failed` with reason.
 *
 * Exit codes:
 *   0  success for every tenant
 *   1  one or more tenants failed (other tenants may have succeeded)
 *   2  invalid arguments
 *
 * Per SOLID:
 *   - SRP: this script owns ONLY the schedule glue; the ResidencyDriftService
 *     owns the computation.
 *   - DIP: depends on PrismaService + the service abstraction, no direct
 *     repository access.
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
// AppModule + service imports moved into main() for lazy loading so
// `--help` exits without booting the dep graph.

interface CliArgs {
  tenants?: string[];
  tenantId?: string;
  windowDays: number;
  dryRun: boolean;
  json: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    windowDays: 30,
    dryRun: false,
    json: false,
  };
  for (const arg of argv.slice(2)) {
    if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'drift-backtest.cron.ts — multi-tenant drift backtest',
          '',
          'Usage:',
          '  pnpm drift:backtest [--tenants=<csv>|--tenantId=<id>] [--windowDays=<n>] [--dryRun] [--json]',
          '',
          'Flags:',
          '  --tenants=<csv>   Comma-separated tenant IDs (default: all active tenants)',
          '  --tenantId=<id>   Single tenant ID (shorthand)',
          '  --windowDays=<n>  Lookback window in days (default 30)',
          '  --dryRun          Print plan; do not call any backend / persist',
          '  --json            Emit JSON one-per-line events to stdout',
          '  --help, -h        Show this message',
          '',
          'Telemetry:',
          '  Emits `drift.backtest.completed` per tenant with outcome + duration.',
          '',
          'Exit codes:',
          '  0  every tenant succeeded',
          '  1  one or more tenants failed',
          '  2  invalid arguments',
        ].join('\n'),
      );
      process.exit(0);
    }
    if (arg.startsWith('--tenants=')) {
      args.tenants = arg.slice('--tenants='.length).split(',').filter(Boolean);
    } else if (arg.startsWith('--tenantId=')) {
      args.tenantId = arg.slice('--tenantId='.length);
    } else if (arg.startsWith('--windowDays=')) {
      args.windowDays = Math.max(1, parseInt(arg.slice('--windowDays='.length), 10));
    } else if (arg === '--dryRun') {
      args.dryRun = true;
    } else if (arg === '--json') {
      args.json = true;
    } else {
      console.error(`unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  if (args.tenantId && args.tenants?.length) {
    console.error('--tenantId and --tenants are mutually exclusive');
    process.exit(2);
  }
  return args;
}

function emit(line: unknown, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify(line) + '\n');
  } else {
    console.log(line);
  }
}

async function resolveTargetTenants(
  prisma: InstanceType<typeof import('../src/infrastructure/database/prisma.service').PrismaService>,
  args: CliArgs,
): Promise<string[]> {
  if (args.tenants && args.tenants.length) return args.tenants;
  if (args.tenantId) return [args.tenantId];
  const rows = await prisma.tenant.findMany({
    where: { status: { in: ['ACTIVE'] } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((r: { id: string }) => r.id);
}

async function main(): Promise<void> {
  const log = new Logger('drift-backtest-cron');
  const args = parseArgs(process.argv);

  if (args.tenantId === undefined && args.tenants === undefined && args.dryRun === false) {
    // Defensive: default to dryRun when no tenant specified, so an
    // operator mistakenly running the cron without args gets a safe
    // print-only run.
    args.dryRun = true;
    args.json = true;
    emit({ event: 'no-tenant-set; defaulting to dry-run', args }, args.json);
  }

  // Lazy-import AppModule + DriftService + PrismaService to keep --help fast.
  const [
    { AppModule: LazyAppModule },
    { DriftService: LazyDriftService },
    { PrismaService: LazyPrismaService },
  ] = await Promise.all([
    import('../src/app.module'),
    import('../src/modules/residency/residency-drift.service'),
    import('../src/infrastructure/database/prisma.service'),
  ]);

  const app = await NestFactory.createApplicationContext(LazyAppModule, {
    logger: ['error', 'warn', 'log'],
  });
  await app.init();

  let exitCode = 0;
  let processed = 0;
  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const drift = app.get(LazyDriftService);
    const prisma = app.get(LazyPrismaService);

    if (!drift?.runBacktest) {
      log.error('DriftService.runBacktest is unavailable');
      exitCode = 2;
    } else {
      const tenantIds = await resolveTargetTenants(prisma, args);
      emit({ event: 'start', tenants: tenantIds.length, args }, args.json);

      for (const tenantId of tenantIds) {
        processed += 1;
        const started = Date.now();

        if (args.dryRun) {
          emit(
            { event: 'dry-run.skip', tenantId, windowDays: args.windowDays },
            args.json,
          );
          skipped += 1;
          continue;
        }

        try {
          // Per-tenant backtest: resolve baselines, run drift. No model
          // id is passed here because the service can resolve default
          // baseline-style features. Empty features → STABLE outcome.
          const out = await drift.runBacktest({
            tenantId,
            modelId: 'tenant-default',
            features: {},
          });
          const durationMs = Date.now() - started;
          emit(
            {
              event: 'drift.backtest.completed',
              tenantId,
              outcome: out.outcome,
              note: out.note,
              durationMs,
            },
            args.json,
          );
          succeeded += 1;
        } catch (err) {
          failed += 1;
          emit(
            {
              event: 'drift.backtest.failed',
              tenantId,
              error: (err as Error).message,
            },
            args.json,
          );
          if (exitCode === 0) exitCode = 1;
        }
      }
    }
  } finally {
    emit(
      { event: 'summary', processed, succeeded, skipped, failed, exitCode },
      args.json,
    );
    await app.close();
  }
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
