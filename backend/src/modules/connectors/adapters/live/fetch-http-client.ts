/**
 * FetchHttpClient — production IHTTPClient.
 *
 * Phase 27 (P27) — Live connectors.
 *
 * Thin wrapper around the Node 20+ global `fetch` so the IHTTPClient
 * port can be substituted in tests.
 *
 * SRP — only does transport; no retry, no auth, no JSON parsing.
 * OCP — adding a retry/circuit-breaker wrapper is a new class that
 *        implements IHTTPClient and delegates here.
 */
import type { IHTTPClient, HTTPRequest, HTTPResponse } from './http-client';

export class FetchHttpClient implements IHTTPClient {
  async request(req: HTTPRequest): Promise<HTTPResponse> {
    const res = await fetch(req.url, {
      method: req.method,
      headers: req.headers as Record<string, string> | undefined,
      body: req.body,
    });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k] = v;
    });
    const body = await res.text();
    return {
      status: res.status,
      headers,
      body,
    };
  }
}
