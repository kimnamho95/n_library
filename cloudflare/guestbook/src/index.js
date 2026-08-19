const ALLOWED_ORIGINS = new Set([
  "https://kimnamho95.github.io",
  "http://localhost:5173",
]);

const NAME_MAX_LEN = 40;
const MESSAGE_MAX_LEN = 500;
const PASSWORD_MAX_LEN = 100;
const LIST_LIMIT = 100;

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "null",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "3600",
  };
}

// Constant-time string compare, so token checks don't leak length/prefix
// info through response timing.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
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

async function hashPassword(password, salt) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${password}`)
  );
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isAdminRequest(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  return !!env.ADMIN_TOKEN && safeEqual(authHeader, `Bearer ${env.ADMIN_TOKEN}`);
}

async function handleListEntries(request, env, headers) {
  const { results } = await env.DB.prepare(
    "SELECT id, name, message, ip, created_at, is_secret FROM entries ORDER BY id DESC LIMIT ?"
  )
    .bind(LIST_LIMIT)
    .all();
  const masked = results.map((row) => ({
    ...row,
    is_secret: !!row.is_secret,
    ip: maskIp(row.ip),
    message: row.is_secret ? null : row.message,
  }));
  return json(masked, 200, headers);
}

async function handleCreateEntry(request, env, headers) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400, headers);
  }

  const name = String(body.name || "").trim().slice(0, NAME_MAX_LEN);
  const message = String(body.message || "").trim().slice(0, MESSAGE_MAX_LEN);
  const isSecret = !!body.secret;
  const password = String(body.password || "").slice(0, PASSWORD_MAX_LEN);
  const ip = request.headers.get("CF-Connecting-IP") || null;
  const editToken = crypto.randomUUID();

  if (!name || !message) {
    return json({ error: "name and message are required" }, 400, headers);
  }
  if (isSecret && !password) {
    return json({ error: "password is required for secret entries" }, 400, headers);
  }

  let secretSalt = null;
  let secretHash = null;
  if (isSecret) {
    secretSalt = crypto.randomUUID();
    secretHash = await hashPassword(password, secretSalt);
  }

  const result = await env.DB.prepare(
    "INSERT INTO entries (name, message, ip, edit_token, is_secret, secret_salt, secret_hash) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, name, message, ip, created_at, is_secret"
  )
    .bind(name, message, ip, editToken, isSecret ? 1 : 0, secretSalt, secretHash)
    .first();

  // edit_token is only ever handed back here, at creation time, so the
  // poster's client can hold onto it to delete this entry later.
  return json(
    { ...result, is_secret: !!result.is_secret, ip: maskIp(result.ip), edit_token: editToken },
    201,
    headers
  );
}

async function handleDeleteEntry(request, env, headers, id) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    // no body is fine for admin-authenticated deletes
  }

  const isAdmin = isAdminRequest(request, env);

  if (!isAdmin) {
    const row = await env.DB.prepare("SELECT edit_token FROM entries WHERE id = ?")
      .bind(id)
      .first();
    if (!row) {
      return json({ error: "not found" }, 404, headers);
    }
    const providedToken = String(body.token || "");
    const isOwner = !!row.edit_token && safeEqual(providedToken, row.edit_token);
    if (!isOwner) {
      return json({ error: "forbidden" }, 403, headers);
    }
  }

  await env.DB.prepare("DELETE FROM comments WHERE entry_id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM entries WHERE id = ?").bind(id).run();
  return new Response(null, { status: 204, headers });
}

async function handleUnlockEntry(request, env, headers, id) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    // no body is fine for admin-authenticated unlocks
  }

  const row = await env.DB.prepare(
    "SELECT message, is_secret, secret_salt, secret_hash FROM entries WHERE id = ?"
  )
    .bind(id)
    .first();
  if (!row) {
    return json({ error: "not found" }, 404, headers);
  }
  if (!row.is_secret) {
    return json({ message: row.message }, 200, headers);
  }

  if (!isAdminRequest(request, env)) {
    const password = String(body.password || "").slice(0, PASSWORD_MAX_LEN);
    const candidateHash = row.secret_salt ? await hashPassword(password, row.secret_salt) : "";
    const isMatch = !!row.secret_hash && safeEqual(candidateHash, row.secret_hash);
    if (!isMatch) {
      return json({ error: "incorrect password" }, 403, headers);
    }
  }

  return json({ message: row.message }, 200, headers);
}

async function handleListComments(request, env, headers, entryId) {
  const { results } = await env.DB.prepare(
    "SELECT id, entry_id, parent_id, name, message, ip, created_at FROM comments WHERE entry_id = ? ORDER BY id ASC"
  )
    .bind(entryId)
    .all();
  const masked = results.map((row) => ({ ...row, ip: maskIp(row.ip) }));
  return json(masked, 200, headers);
}

async function handleCreateComment(request, env, headers, entryId) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400, headers);
  }

  const entry = await env.DB.prepare("SELECT id FROM entries WHERE id = ?").bind(entryId).first();
  if (!entry) {
    return json({ error: "entry not found" }, 404, headers);
  }

  const name = String(body.name || "").trim().slice(0, NAME_MAX_LEN);
  const message = String(body.message || "").trim().slice(0, MESSAGE_MAX_LEN);
  if (!name || !message) {
    return json({ error: "name and message are required" }, 400, headers);
  }

  let parentId = null;
  if (body.parent_id !== undefined && body.parent_id !== null) {
    parentId = Number(body.parent_id);
    const parent = await env.DB.prepare(
      "SELECT id FROM comments WHERE id = ? AND entry_id = ?"
    )
      .bind(parentId, entryId)
      .first();
    if (!parent) {
      return json({ error: "parent comment not found" }, 404, headers);
    }
  }

  const ip = request.headers.get("CF-Connecting-IP") || null;
  const editToken = crypto.randomUUID();

  const result = await env.DB.prepare(
    "INSERT INTO comments (entry_id, parent_id, name, message, ip, edit_token) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, entry_id, parent_id, name, message, ip, created_at"
  )
    .bind(entryId, parentId, name, message, ip, editToken)
    .first();

  return json({ ...result, ip: maskIp(result.ip), edit_token: editToken }, 201, headers);
}

async function handleDeleteComment(request, env, headers, id) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    // no body is fine for admin-authenticated deletes
  }

  const isAdmin = isAdminRequest(request, env);

  if (!isAdmin) {
    const row = await env.DB.prepare("SELECT edit_token FROM comments WHERE id = ?")
      .bind(id)
      .first();
    if (!row) {
      return json({ error: "not found" }, 404, headers);
    }
    const providedToken = String(body.token || "");
    const isOwner = !!row.edit_token && safeEqual(providedToken, row.edit_token);
    if (!isOwner) {
      return json({ error: "forbidden" }, 403, headers);
    }
  }

  // Replies form a tree via parent_id; deleting a comment must also drop
  // its descendants so replies never dangle under a removed parent.
  await env.DB.prepare(
    `WITH RECURSIVE descendants(id) AS (
       SELECT id FROM comments WHERE id = ?
       UNION ALL
       SELECT c.id FROM comments c JOIN descendants d ON c.parent_id = d.id
     )
     DELETE FROM comments WHERE id IN (SELECT id FROM descendants)`
  )
    .bind(id)
    .run();

  return new Response(null, { status: 204, headers });
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    const pathname = new URL(request.url).pathname;
    let match;

    if (pathname === "/") {
      if (request.method === "GET") return handleListEntries(request, env, headers);
      if (request.method === "POST") return handleCreateEntry(request, env, headers);
    } else if ((match = pathname.match(/^\/(\d+)$/))) {
      if (request.method === "DELETE") return handleDeleteEntry(request, env, headers, Number(match[1]));
    } else if ((match = pathname.match(/^\/(\d+)\/unlock$/))) {
      if (request.method === "POST") return handleUnlockEntry(request, env, headers, Number(match[1]));
    } else if ((match = pathname.match(/^\/(\d+)\/comments$/))) {
      if (request.method === "GET") return handleListComments(request, env, headers, Number(match[1]));
      if (request.method === "POST") return handleCreateComment(request, env, headers, Number(match[1]));
    } else if ((match = pathname.match(/^\/comments\/(\d+)$/))) {
      if (request.method === "DELETE") return handleDeleteComment(request, env, headers, Number(match[1]));
    }

    return json({ error: "not found" }, 404, headers);
  },
};
