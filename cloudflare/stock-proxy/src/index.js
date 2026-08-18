const ALLOWED_ORIGINS = new Set([
  "https://kimnamho95.github.io",
  "http://localhost:5173",
]);

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

export default {
  async fetch(request) {
    const headers = corsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    const url = new URL(request.url);
    const ticker = url.searchParams.get("ticker") || "";

    if (!/^\d{6}$/.test(ticker)) {
      return json({ error: "ticker must be a 6-digit code" }, 400, headers);
    }

    const naverUrl = `https://polling.finance.naver.com/api/realtime/domestic/stock/${ticker}`;

    let naverRes;
    try {
      naverRes = await fetch(naverUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json, text/plain, */*",
        },
      });
    } catch {
      return json({ error: "upstream request failed" }, 502, headers);
    }

    if (!naverRes.ok) {
      return json({ error: `upstream HTTP ${naverRes.status}` }, 502, headers);
    }

    const data = await naverRes.json();
    const item = data.datas && data.datas[0];

    if (!item) {
      return json({ error: "no data for ticker" }, 404, headers);
    }

    return json(
      {
        ticker: item.itemCode,
        name: item.stockName,
        price: Number(item.closePriceRaw),
        changePrice: Number(item.compareToPreviousClosePriceRaw),
        changeRatio: Number(item.fluctuationsRatioRaw),
        marketStatus: item.marketStatus,
        tradedAt: item.localTradedAt,
      },
      200,
      headers
    );
  },
};
