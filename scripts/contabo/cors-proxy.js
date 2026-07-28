/**
 * Minimal CORS proxy: OLS -> port 3004 -> NestJS on port 3003
 * Emits credentialed CORS responses (cookie-only auth) and strips any
 * conflicting CORS headers from the upstream NestJS response.
 *
 * Updated Batch 1: now also forwards X-CSRF-Token (used by cookie-auth
 * double-submit) and matches the new domain allowlist.
 *
 * SIM-04 G-10 — Socket.IO transport shim:
 *
 *   The browser client sends a GET /socket.io/ probe to detect whether
 *   Socket.IO is reachable. Engine.IO v4 expects the server to reply
 *   with a polling handshake (HTTP 200 + open packet) so the client
 *   knows which transport to upgrade to. Without this handshake, the
 *   browser logs `400 Transport unknown` on every page load and never
 *   upgrades to WebSocket.
 *
 *   Strategy:
 *     1. /socket.io/?EIO=4&transport=polling   -> forward verbatim to
 *        NestJS (which has Socket.IO attached via @nestjs/platform-socket.io).
 *     2. /socket.io/  (no EIO)                -> reply with an empty 200 so
 *        the browser moves on; subsequent polling requests (case 1) succeed.
 *     3. /socket.io/?EIO=4&transport=websocket -> reply 400 with a clear
 *        "use polling" message; the browser logs one clear error instead
 *        of hanging. (WebSocket bridging would require the `ws` package
 *        to be installed at /opt/neurecore/node_modules; out of scope here.)
 *
 *   Polling continues to work indefinitely for timeline-event delivery.
 */

const http = require("http");

const UPSTREAM_HOST = "127.0.0.1";
const UPSTREAM_PORT = 3003;
const LISTEN_PORT = 3004;

const ALLOWED_ORIGINS = new Set([
  // Dev origins (local Next.js dev servers)
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3005",
  "http://localhost:3011",
  "http://localhost:3020",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
  "http://127.0.0.1:3005",
  "http://127.0.0.1:3011",
  "http://127.0.0.1:3020",
  // Production origins
  "https://hq.neurecore.com",
  "https://cc.neurecore.com",
  "https://brain.neurecore.com",
  "https://eaos.neurecore.com",
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Correlation-ID, X-CSRF-Token, X-Tenant-ID, Idempotency-Key",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

const VALID_TRANSPORTS = new Set(["polling", "websocket"]);

function parseQuery(url) {
  const q = {};
  const idx = url.indexOf("?");
  if (idx === -1) return q;
  const pairs = url.slice(idx + 1).split("&");
  for (const pair of pairs) {
    const [k, v = ""] = pair.split("=");
    q[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
  }
  return q;
}

function isSocketIoPath(req) {
  return req.url && req.url.split("?")[0] === "/socket.io/";
}

function isValidEioVersion(v) {
  // Engine.IO v4 clients send `EIO=4`. Older versions (v3) are not used
  // by the current FE clients per the project dependencies, so we refuse
  // anything else with a 400.
  return v === "4";
}

function setCorsHeaders(origin, res) {
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.setHeader(k, v);
  }
}

function proxyRequest(req, res, { origin }) {
  const opts = {
    hostname: UPSTREAM_HOST,
    port: UPSTREAM_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const proxy = http.request(opts, (upstreamRes) => {
    // Skip upstream CORS headers — we own CORS now
    const skipCors = /^access-control-/i;
    for (const [k, v] of Object.entries(upstreamRes.headers)) {
      if (!skipCors.test(k)) res.setHeader(k, v);
    }
    setCorsHeaders(origin, res);
    res.writeHead(upstreamRes.statusCode);
    upstreamRes.pipe(res, { end: true });
  });

  proxy.on("error", (err) => {
    console.error("Proxy error:", err.message);
    if (!res.headersSent) {
      res.writeHead(502);
      res.end("Bad Gateway");
    }
  });

  req.on("error", (err) => {
    console.error("Req error:", err.message);
    proxy.destroy();
  });

  req.pipe(proxy, { end: true });
}

function handleSocketIoProbe(req, res, origin) {
  const q = parseQuery(req.url);
  // Case 1: real Socket.IO polling request — forward to NestJS verbatim.
  if (
    q.EIO &&
    isValidEioVersion(q.EIO) &&
    q.transport &&
    VALID_TRANSPORTS.has(q.transport)
  ) {
    if (q.transport === "websocket") {
      // WebSocket bridge not installed; reply with a clean 400 so the
      // browser logs a single clear error instead of hanging.
      setCorsHeaders(origin, res);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          code: 3,
          message:
            "WebSocket transport not supported by this proxy; use polling (?EIO=4&transport=polling)",
        }),
      );
      return;
    }
    proxyRequest(req, res, { origin });
    return;
  }
  // EIO=4 but no transport, or EIO is some other version.
  if (q.EIO && !isValidEioVersion(q.EIO)) {
    setCorsHeaders(origin, res);
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ code: 3, message: "Bad request" }));
    return;
  }
  // Case 2: probe with no EIO at all — reply with empty 200 so the
  // browser moves on. The next request will carry EIO=4&transport=polling
  // (case 1) and succeed.
  setCorsHeaders(origin, res);
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=UTF-8",
    "Content-Length": "0",
  });
  res.end("");
}

const server = http.createServer((req, res) => {
  const origin = req.headers["origin"] || "";

  // Short-circuit OPTIONS preflight — no need to hit NestJS
  if (req.method === "OPTIONS") {
    setCorsHeaders(origin, res);
    res.writeHead(204);
    res.end();
    return;
  }

  // SIM-04 G-10 — Socket.IO transport shim
  if (isSocketIoPath(req)) {
    handleSocketIoProbe(req, res, origin);
    return;
  }

  // All non-Socket.IO traffic: forward to NestJS.
  proxyRequest(req, res, { origin });
});

server.listen(LISTEN_PORT, () => {
  console.log(
    `CORS proxy listening on :${LISTEN_PORT} -> ${UPSTREAM_HOST}:${UPSTREAM_PORT} ` +
      `(SIM-04 G-10: socket.io / polling handshake shim active)`,
  );
});