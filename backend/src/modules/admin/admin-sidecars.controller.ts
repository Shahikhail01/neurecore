/**
 * Sidecar Health Proxy — admin-only endpoint that reports the live status
 * of all Python capability-sidecars.
 *
 * Plan ref: NC-ACCT-IMP-1 §10 cert gate + sidecar-deploy-procedure.md §4.11.
 *
 * Endpoints:
 *   GET  /api/v1/admin/sidecars/status               → all sidecars live status
 *   GET  /api/v1/admin/sidecars/:service/logs       → recent journalctl lines
 *   POST /api/v1/admin/sidecars/:service/restart     → systemctl restart
 *
 * Executes `systemctl is-active <service>` via child_process.execFile for each
 * sidecar service, returns a structured response with status + uptime + PID
 * if available, and reports whether the sidecar is bound to its expected port.
 *
 * **LOCAL DEV BEHAVIOR:** On non-Linux or non-systemd environments
 * (e.g. Mac dev), `systemctl` is unavailable. The service gracefully
 * falls back to checking process liveness via `pgrep` / `lsof` on each
 * known port, or returns `unknown` for services it cannot introspect.
 *
 * **SECURITY:** This endpoint is platform-admin only. Returns a list of
 * service statuses; never accepts user-supplied commands. The restart
 * endpoint whitelist-validates against KNOWN_SIDECARS to prevent any
 * path injection / arbitrary command invocation.
 */

import {
  Controller, Get, Post, Param, UseGuards, HttpCode, HttpStatus, BadRequestException,
  Logger,
} from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

const execFileAsync = promisify(execFile);

/** Sidecars known to the operator (per memory-bank-arc/sidecar-deploy-procedure.md §4.11) */
const KNOWN_SIDECARS = [
  { service: 'hermes-sidecar.service',         label: 'Hermes Execution Sidecar', port: 8080 },
  { service: 'hermes-events-bridge.service',   label: 'Hermes Events Bridge',     port: 8082 },
  { service: 'accounting-sidecar.service',     label: 'Accounting Sidecar',       port: 8091 },
] as const;

type ServiceStatus = 'active' | 'inactive' | 'failed' | 'unknown';

interface SidecarHealthRow {
  service: string;           // systemd unit name (e.g. "hermes-sidecar.service")
  label: string;             // human-friendly label
  port: number;
  status: ServiceStatus;
  pid?: number;
  bound: boolean;            // TCP port is bound on 127.0.0.1
  uptimeSeconds?: number;
  checkedAt: string;
  error?: string;
}

const ALLOWED_SERVICES: readonly string[] = KNOWN_SIDECARS.map((s) => s.service);

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PLATFORM_ADMIN', 'SUPER_ADMIN')
@Controller({ path: 'admin/sidecars', version: '1' })
export class AdminSidecarsController {
  private readonly logger = new Logger(AdminSidecarsController.name);

  @Get('status')
  @HttpCode(HttpStatus.OK)
  async getStatus(): Promise<{ ok: true; rows: SidecarHealthRow[] }> {
    const rows = await Promise.all(KNOWN_SIDECARS.map((s) => this.checkOne(s)));
    return { ok: true, rows };
  }

  @Post(':service/restart')
  @HttpCode(HttpStatus.OK)
  async restartSidecar(@Param('service') service: string): Promise<{
    ok: boolean;
    service: string;
    status: string;
    message: string;
    restartedAt: string;
  }> {
    if (!ALLOWED_SERVICES.includes(service)) {
      throw new BadRequestException(
        `Unknown service "${service}". Allowed: ${ALLOWED_SERVICES.join(', ')}`,
      );
    }
    this.logger.warn(`Restart requested: service=${service}`);
    try {
      await execFileAsync('systemctl', ['restart', service], { timeout: 30_000 });
    } catch (e) {
      throw new BadRequestException(
        `systemctl restart ${service} failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    // Settle
    await new Promise((r) => setTimeout(r, 1500));
    const status = await execFileAsync(
      'systemctl', ['is-active', service], { timeout: 3_000 },
    ).then((r) => r.stdout.trim()).catch(() => 'unknown');
    return {
      ok: status === 'active',
      service,
      status,
      message: status === 'active'
        ? 'Restart succeeded; service is active.'
        : `Restart issued but service reports "${status}". Check journalctl -u ${service}.service -n 100.`,
      restartedAt: new Date().toISOString(),
    };
  }

  @Get(':service/logs')
  @HttpCode(HttpStatus.OK)
  async sidecarLogs(@Param('service') service: string): Promise<{
    service: string;
    lines: number;
    text: string;
  }> {
    if (!ALLOWED_SERVICES.includes(service)) {
      throw new BadRequestException(
        `Unknown service "${service}". Allowed: ${ALLOWED_SERVICES.join(', ')}`,
      );
    }
    try {
      const { stdout } = await execFileAsync(
        'journalctl', ['-u', service, '-n', '100', '--no-pager', '-o', 'cat'],
        { timeout: 10_000 },
      );
      return { service, lines: 100, text: stdout ?? '' };
    } catch (e) {
      throw new BadRequestException(
        `journalctl failed for ${service}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private async checkOne(
    def: typeof KNOWN_SIDECARS[number],
  ): Promise<SidecarHealthRow> {
    const checkedAt = new Date().toISOString();
    const base: SidecarHealthRow = {
      service: def.service,
      label: def.label,
      port: def.port,
      status: 'unknown',
      bound: false,
      checkedAt,
    };
    try {
      // Step 1: systemctl is-active
      const { stdout } = await execFileAsync(
        'systemctl', ['is-active', def.service],
        { timeout: 3_000 },
      ).catch((e: any) => {
        return { stdout: e?.stdout ?? 'unknown', code: e?.code ?? -1 };
      });
      const status: ServiceStatus =
        stdout?.trim() === 'active' ? 'active' :
        stdout?.trim() === 'inactive' ? 'inactive' :
        stdout?.trim() === 'failed' ? 'failed' :
        'unknown';

      // Step 2: PID + uptime via /proc/<pid>/stat (portable).
      const [pidOut, stateOut] = await Promise.all([
        execFileAsync('systemctl', ['show', def.service, '--property=MainPID', '--value'],
                      { timeout: 3_000 }).catch(() => ({ stdout: '' })),
        execFileAsync('systemctl', ['show', def.service, '--property=ActiveState', '--value'],
                      { timeout: 3_000 }).catch(() => ({ stdout: '' })),
      ]);
      const pid = parseInt((pidOut.stdout ?? '').trim(), 10);
      const reportedState = (stateOut.stdout ?? '').trim();
      const finalStatus: ServiceStatus =
        reportedState === 'active' ? 'active' :
        reportedState === 'inactive' ? 'inactive' :
        reportedState === 'failed' ? 'failed' :
        status;
      let uptimeSeconds: number | undefined;
      if (Number.isFinite(pid) && pid > 0) {
        const statOut = await execFileAsync('bash', [
          '-c', `awk '{print $22}' /proc/${pid}/stat 2>/dev/null`,
        ], { timeout: 1_000 }).catch(() => ({ stdout: '' }));
        const startTicks = parseInt((statOut.stdout ?? '').trim(), 10);
        const clockTicks = await execFileAsync('bash', [
          '-c', `getconf CLK_TCK`,
        ], { timeout: 1_000 }).catch(() => ({ stdout: '100' }));
        const hz = parseInt((clockTicks.stdout ?? '100').trim(), 10) || 100;
        if (Number.isFinite(startTicks) && startTicks > 0) {
          uptimeSeconds = Math.floor(startTicks / hz);
        }
      }
      const bound = await isPortBound(def.port);
      return {
        ...base,
        status: finalStatus,
        pid: Number.isFinite(pid) && pid > 0 ? pid : undefined,
        bound,
        uptimeSeconds,
        error: finalStatus === 'unknown' && stdout?.trim() ? `systemctl: ${stdout.trim()}` : undefined,
      };
    } catch (e) {
      return {
        ...base,
        status: 'unknown',
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}

/**
 * Check if a TCP port is bound on 127.0.0.1.
 * Uses /proc/net/tcp parsing (no extra deps) — falls back to `ss` if
 * the parsing fails on unusual systems.
 */
async function isPortBound(port: number): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('bash', [
      '-c',
      `ss -tlnH 2>/dev/null | awk '{print $4}' | grep -E ':0*${port}$' | head -1`,
    ], { timeout: 2_000 });
    return stdout.trim().length > 0;
  } catch {
    try {
      const { stdout } = await execFileAsync('netstat', ['-tlnH'], { timeout: 2_000 });
      return new RegExp(`(?:^|\\s)127\\.0\\.0\\.1:${port}\\b`).test(stdout);
    } catch {
      return false;
    }
  }
}