import type { Route } from "./+types/economy";
import { RateChart } from "../components/rate-chart";
import { LiveRates } from "../components/live-rates";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Economy - N_library" }];
}

const RATE_PAIRS = [
  { pair: "USD_KRW", label: "USD → KRW" },
  { pair: "PHP_KRW", label: "PHP → KRW" },
  { pair: "USD_PHP", label: "USD → PHP" },
];

const STOCKS = [
  { code: "005930", name: "Samsung Electronics", price: "71,000", change: "+1.2%" },
  { code: "035420", name: "NAVER", price: "215,000", change: "-0.5%" },
  { code: "035720", name: "Kakao", price: "48,300", change: "+0.8%" },
  { code: "000660", name: "SK Hynix", price: "185,500", change: "+2.1%" },
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
        <ul className="data-list">
          {STOCKS.map((stock) => (
            <li key={stock.code} className="data-row">
              <span className="data-row-label">
                {stock.name} ({stock.code})
              </span>
              <span className="data-row-value">
                {stock.price}
                <span
                  className={
                    stock.change.startsWith("+")
                      ? "data-row-change-up"
                      : "data-row-change-down"
                  }
                >
                  {" "}
                  {stock.change}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
