const ALLOWED_ORIGINS = new Set([
  "https://kimnamho95.github.io",
  "http://localhost:5173",
]);

const NAME_MAX_LEN = 40;
const MESSAGE_MAX_LEN = 500;
const LIST_LIMIT = 100;

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "3600",
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

// Keeps the first 2 and last 2 characters, masks everything else
// except separators ("." for IPv4, ":" for IPv6).
function maskIp(ip) {
  if (!ip) return null;
  const len = ip.length;
  return ip
    .split("")
    .map((ch, i) => {
      if (i < 2 || i >= len - 2) return ch;
      if (ch === "." || ch === ":") return ch;
      return "*";
    })
    .join("");
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (request.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT id, name, message, ip, created_at FROM entries ORDER BY id DESC LIMIT ?"
      )
        .bind(LIST_LIMIT)
        .all();
      const masked = results.map((row) => ({ ...row, ip: maskIp(row.ip) }));
      return json(masked, 200, headers);
    }

    if (request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid JSON body" }, 400, headers);
      }

      const name = String(body.name || "").trim().slice(0, NAME_MAX_LEN);
      const message = String(body.message || "").trim().slice(0, MESSAGE_MAX_LEN);
      const ip = request.headers.get("CF-Connecting-IP") || null;

      if (!name || !message) {
        return json({ error: "name and message are required" }, 400, headers);
      }

      const result = await env.DB.prepare(
        "INSERT INTO entries (name, message, ip) VALUES (?, ?, ?) RETURNING id, name, message, ip, created_at"
      )
        .bind(name, message, ip)
        .first();

      return json({ ...result, ip: maskIp(result.ip) }, 201, headers);
    }

    return json({ error: "method not allowed" }, 405, headers);
  },
};
