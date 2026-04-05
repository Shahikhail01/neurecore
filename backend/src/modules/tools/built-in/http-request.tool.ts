import { Injectable } from '@nestjs/common';
import { URL } from 'url';
import type {
  ITool,
  ToolInput,
  ToolOutput,
} from '../interfaces/tool.interface';

/**
 * SSRF guard — rejects requests targeting private/loopback addresses.
 */
function assertSsrfSafe(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Disallowed URL scheme: ${parsed.protocol}`);
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === '0.0.0.0') {
    throw new Error('Requests to localhost are not allowed');
  }
  if (host.startsWith('[')) {
    const ipv6 = host.slice(1, -1).toLowerCase();
    if (
      ipv6 === '::1' ||
      ipv6.startsWith('fc') ||
      ipv6.startsWith('fd') ||
      ipv6.startsWith('fe80')
    ) {
      throw new Error('Requests to private IPv6 addresses are not allowed');
    }
  }
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (
      a === 127 ||
      a === 10 ||
      a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    ) {
      throw new Error('Requests to private IP addresses are not allowed');
    }
  }
}

/**
 * HttpRequestTool — executes an outbound HTTP GET/POST call.
 * Implements ITool so it can be registered alongside any other tool.
 */
@Injectable()
export class HttpRequestTool implements ITool {
  readonly name = 'http_request';
  readonly description = 'Sends an HTTP request to a given URL';
  readonly category = 'API';

  validate(input: ToolInput): boolean {
    return typeof input['url'] === 'string' && input['url'].length > 0;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    if (!this.validate(input)) {
      return { success: false, error: 'Missing required field: url' };
    }

    const url = input['url'] as string;
    const method = (input['method'] as string | undefined) ?? 'GET';
    const body = input['body'] as string | undefined;

    try {
      assertSsrfSafe(url);
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data: unknown = await response.json().catch(() => response.text());
      return { success: response.ok, data };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  }
}
