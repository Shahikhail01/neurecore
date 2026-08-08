/**
 * IHTTPClient — narrow port for outbound HTTP.
 *
 * Phase 27 (P27) — Live connectors replace PRODUCTION-BLOCKED stubs.
 *
 * The adapters never call `fetch` directly. They depend on this
 * interface so:
 *   - production uses the real `FetchHttpClient` (Node 20+ global fetch),
 *   - tests use an in-memory `InMemoryHttpClient` that asserts
 *     request shape and returns canned responses without I/O.
 *
 * SRP — owns only the HTTP request shape.
 * ISP — one method, no extra knobs.
 * DIP — adapters depend on this abstraction, not on `fetch`.
 */
export interface HTTPRequest {
  readonly url: string;
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
}

export interface HTTPResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export interface IHTTPClient {
  request(req: HTTPRequest): Promise<HTTPResponse>;
}
