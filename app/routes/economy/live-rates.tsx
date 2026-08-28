import { useEffect, useState } from "react";

const PAIRS = [
  { pair: "USD_KRW", base: "USD", quote: "KRW", label: "USD → KRW" },
  { pair: "PHP_KRW", base: "PHP", quote: "KRW", label: "PHP → KRW" },
  { pair: "USD_PHP", base: "USD", quote: "PHP", label: "USD → PHP" },
];

type LiveRate = {
  pair: string;
  label: string;
  status: "loading" | "ok" | "error";
  date?: string;
  rate?: number;
};

export function LiveRates() {
  const [rates, setRates] = useState<LiveRate[]>(
    PAIRS.map((p) => ({ pair: p.pair, label: p.label, status: "loading" }))
  );

  useEffect(() => {
    PAIRS.forEach((p) => {
      fetch(
        `https://api.frankfurter.dev/v2/rates?base=${p.base}&quotes=${p.quote}`,
        { cache: "no-store" }
      )
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((json: Array<{ date: string; rate: number }>) => {
          const latest = json[0];
          setRates((prev) =>
            prev.map((r) =>
              r.pair === p.pair
                ? { ...r, status: "ok", date: latest.date, rate: latest.rate }
                : r
            )
          );
        })
        .catch(() => {
          setRates((prev) =>
            prev.map((r) => (r.pair === p.pair ? { ...r, status: "error" } : r))
          );
        });
    });
  }, []);

  return (
    <div className="live-rate-grid">
      {rates.map((r) => (
        <div key={r.pair} className="live-rate-card">
          <div className="live-rate-label">{r.label}</div>
          {r.status === "loading" && (
            <div className="live-rate-state">Loading…</div>
          )}
          {r.status === "error" && (
            <div className="live-rate-state">Failed to load</div>
          )}
          {r.status === "ok" && (
            <>
              <div className="live-rate-value">
                {r.rate!.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className="live-rate-date">As of {r.date}</div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
