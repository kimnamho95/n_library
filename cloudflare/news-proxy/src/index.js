const ALLOWED_ORIGINS = new Set([
  "https://kimnamho95.github.io",
  "http://localhost:5173",
]);

const FEED_URL = "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko";
const MAX_ITEMS = 30;

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "null",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? decodeEntities(match[1].trim()) : null;
}

function parseItems(xml) {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  const items = [];

  for (const block of itemBlocks.slice(0, MAX_ITEMS)) {
    let title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const source = extractTag(block, "source");
    const pubDate = extractTag(block, "pubDate");

    if (!title || !link) continue;

    if (source && title.endsWith(` - ${source}`)) {
      title = title.slice(0, -(` - ${source}`.length)).trim();
    }

    items.push({
      title,
      link,
      source,
      published: pubDate ? new Date(pubDate).toISOString() : null,
    });
  }

  return items;
}

export default {
  async fetch(request) {
    const headers = corsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    let upstream;
    try {
      upstream = await fetch(FEED_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/rss+xml, application/xml",
        },
      });
    } catch {
      return json({ error: "upstream request failed" }, 502, headers);
    }

    if (!upstream.ok) {
      return json({ error: `upstream HTTP ${upstream.status}` }, 502, headers);
    }

    const xml = await upstream.text();

    return json(
      {
        source: "Google News (KR)",
        updated_at: new Date().toISOString(),
        items: parseItems(xml),
      },
      200,
      headers
    );
  },
};
