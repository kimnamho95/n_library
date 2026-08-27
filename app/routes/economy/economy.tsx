import type { Route } from "./+types/economy";
import { RateChart } from "./rate-chart";
import { LiveRates } from "./live-rates";
import { Watchlist } from "./watchlist";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Economy - N_library" }];
}

const RATE_PAIRS = [
  { pair: "USD_KRW", label: "USD → KRW" },
  { pair: "PHP_KRW", label: "PHP → KRW" },
  { pair: "USD_PHP", label: "USD → PHP" },
];

export default function Economy() {
  return (
    <div className="page">
      <h1>Economy</h1>

      <section className="data-section">
        <h2>Exchange Rates</h2>

        <h3 className="rate-chart-row-label">Today's Rates</h3>
        <LiveRates />

        <h3 className="rate-chart-row-label">Daily (Last 30 Days)</h3>
        <div className="rate-charts-grid">
          {RATE_PAIRS.map((p) => (
            <RateChart key={p.pair} pair={p.pair} label={p.label} granularity="daily" />
          ))}
        </div>

        <h3 className="rate-chart-row-label">Monthly Average (All Time)</h3>
        <div className="rate-charts-grid">
          {RATE_PAIRS.map((p) => (
            <RateChart key={p.pair} pair={p.pair} label={p.label} granularity="monthly" />
          ))}
        </div>
      </section>

      <section className="data-section">
        <h2>Stocks</h2>
        <Watchlist />
      </section>
    </div>
  );
}
