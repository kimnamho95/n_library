import { useEffect, useState } from "react";

// TODO: replace with the deployed Cloudflare Worker URL
// (cloudflare/stock-proxy), e.g. https://n-library-stock-proxy.<subdomain>.workers.dev
const PROXY_URL = "";

const MAX_TICKERS = 10;
const STORAGE_KEY = "stock-watchlist";

const SUGGESTIONS = [
  { ticker: "005930", name: "Samsung Electronics" },
  { ticker: "000660", name: "SK Hynix" },
  { ticker: "035420", name: "NAVER" },
  { ticker: "035720", name: "Kakao" },
  { ticker: "005380", name: "Hyundai Motor" },
  { ticker: "000270", name: "Kia" },
];

type Quote = {
  status: "loading" | "ok" | "error";
  name?: string;
  price?: number;
  changePrice?: number;
  changeRatio?: number;
  marketStatus?: string;
};

function loadTickers(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function Watchlist() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [inputValue, setInputValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setTickers(loadTickers());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
  }, [tickers]);

  useEffect(() => {
    tickers.forEach((ticker) => {
      if (quotes[ticker]) return;
      fetchQuote(ticker);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers]);

  function fetchQuote(ticker: string) {
    setQuotes((prev) => ({ ...prev, [ticker]: { status: "loading" } }));

    if (!PROXY_URL) {
      setQuotes((prev) => ({ ...prev, [ticker]: { status: "error" } }));
      return;
    }

    fetch(`${PROXY_URL}?ticker=${ticker}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setQuotes((prev) => ({
          ...prev,
          [ticker]: {
            status: "ok",
            name: data.name,
            price: data.price,
            changePrice: data.changePrice,
            changeRatio: data.changeRatio,
            marketStatus: data.marketStatus,
          },
        }));
      })
      .catch(() => {
        setQuotes((prev) => ({ ...prev, [ticker]: { status: "error" } }));
      });
  }

  function addTicker(rawTicker: string) {
    const ticker = rawTicker.trim();

    if (!/^\d{6}$/.test(ticker)) {
      setFormError("Enter a 6-digit ticker code (e.g. 005930).");
      return;
    }
    if (tickers.includes(ticker)) {
      setFormError("This ticker is already saved.");
      return;
    }
    if (tickers.length >= MAX_TICKERS) {
      setFormError(`You can save up to ${MAX_TICKERS} tickers.`);
      return;
    }

    setFormError(null);
    setTickers((prev) => [...prev, ticker]);
    setInputValue("");
  }

  function removeTicker(ticker: string) {
    setTickers((prev) => prev.filter((t) => t !== ticker));
    setQuotes((prev) => {
      const next = { ...prev };
      delete next[ticker];
      return next;
    });
  }

  return (
    <div className="watchlist">
      <form
        className="watchlist-form"
        onSubmit={(e) => {
          e.preventDefault();
          addTicker(inputValue);
        }}
      >
        <input
          type="text"
          className="watchlist-input"
          placeholder="Ticker code, e.g. 005930"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          maxLength={6}
        />
        <button type="submit" className="watchlist-add-btn">
          Save
        </button>
      </form>

      {formError && <p className="watchlist-error">{formError}</p>}

      <div className="watchlist-suggestions">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.ticker}
            type="button"
            className="watchlist-suggestion-chip"
            onClick={() => addTicker(s.ticker)}
          >
            {s.name} ({s.ticker})
          </button>
        ))}
      </div>

      {tickers.length === 0 ? (
        <p className="watchlist-empty">No saved tickers yet.</p>
      ) : (
        <ul className="data-list">
          {tickers.map((ticker) => {
            const q = quotes[ticker];
            return (
              <li key={ticker} className="data-row watchlist-row">
                <span className="data-row-label">
                  {q?.status === "ok" ? q.name : ticker} ({ticker})
                </span>
                <span className="data-row-value">
                  {(!q || q.status === "loading") && "Loading…"}
                  {q?.status === "error" &&
                    (PROXY_URL ? "Failed to load" : "Proxy not configured")}
                  {q?.status === "ok" && (
                    <>
                      {q.price!.toLocaleString("en-US")}
                      <span
                        className={
                          (q.changePrice ?? 0) >= 0
                            ? "data-row-change-up"
                            : "data-row-change-down"
                        }
                      >
                        {" "}
                        {(q.changePrice ?? 0) >= 0 ? "+" : ""}
                        {q.changeRatio}%
                      </span>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  className="watchlist-remove-btn"
                  aria-label={`Remove ${ticker}`}
                  onClick={() => removeTicker(ticker)}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
