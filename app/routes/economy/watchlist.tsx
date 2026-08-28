import { useEffect, useMemo, useState } from "react";

const PROXY_URL = "https://n-library-stock-proxy.kimnamho95.workers.dev";

const MAX_TICKERS = 10;
const MAX_SUGGESTIONS = 8;
const STORAGE_KEY = "stock-watchlist";

type Quote = {
  status: "loading" | "ok" | "error";
  name?: string;
  price?: number;
  changePrice?: number;
  changeRatio?: number;
  marketStatus?: string;
};

type StockInfo = { ticker: string; name: string; market: string };

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
  const [stockList, setStockList] = useState<StockInfo[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

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

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/stocks/list.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { items: StockInfo[] }) => setStockList(data.items))
      .catch(() => setStockList([]));
  }, []);

  const matches = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    if (!query) return [];

    return stockList
      .filter(
        (s) =>
          s.name.toLowerCase().includes(query) || s.ticker.startsWith(query)
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [inputValue, stockList]);

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
      setFormError("Type a company name and pick it from the list.");
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
    setShowDropdown(false);
  }

  function selectMatch(stock: StockInfo) {
    addTicker(stock.ticker);
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
          if (matches.length === 1) {
            selectMatch(matches[0]);
          } else {
            addTicker(inputValue);
          }
        }}
      >
        <div className="watchlist-input-wrap">
          <input
            type="text"
            className="watchlist-input"
            placeholder="Search by company name, e.g. Samsung Electronics"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setFormError(null);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 100)}
          />

          {showDropdown && matches.length > 0 && (
            <ul className="watchlist-autocomplete">
              {matches.map((stock) => (
                <li key={stock.ticker}>
                  <button
                    type="button"
                    className="watchlist-autocomplete-item"
                    onClick={() => selectMatch(stock)}
                  >
                    <span>{stock.name}</span>
                    <span className="watchlist-autocomplete-meta">
                      {stock.ticker} · {stock.market}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="submit" className="watchlist-add-btn">
          Save
        </button>
      </form>

      {formError && <p className="watchlist-error">{formError}</p>}

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
