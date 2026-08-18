import { useEffect, useState } from "react";

type Granularity = "daily" | "monthly";

type Point = { key: string; rate: number };

const WIDTH = 360;
const HEIGHT = 230;
const MARGIN = { top: 10, right: 10, bottom: 22, left: 46 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

function niceNum(range: number, round: boolean) {
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / Math.pow(10, exponent);
  let niceFraction: number;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }
  return niceFraction * Math.pow(10, exponent);
}

function niceTicks(min: number, max: number, tickCount: number) {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const range = niceNum(max - min, false);
  const spacing = niceNum(range / (tickCount - 1), true);
  const niceMin = Math.floor(min / spacing) * spacing;
  const niceMax = Math.ceil(max / spacing) * spacing;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + spacing * 0.5; v += spacing) {
    ticks.push(Math.round(v * 1e6) / 1e6);
  }
  return ticks;
}

function formatValue(v: number) {
  return v.toLocaleString("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatShort(key: string, granularity: Granularity) {
  const parts = key.split("-");
  if (granularity === "monthly") {
    return parts[0].slice(2) + "." + parts[1];
  }
  return parseInt(parts[1], 10) + "/" + parseInt(parts[2], 10);
}

function formatFull(key: string, granularity: Granularity) {
  const parts = key.split("-");
  if (granularity === "monthly") {
    return parts[0] + "-" + parts[1];
  }
  return parts[0] + "." + parts[1] + "." + parts[2];
}

export function RateChart({
  pair,
  label,
  granularity,
}: {
  pair: string;
  label: string;
  granularity: Granularity;
}) {
  const [points, setPoints] = useState<Point[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    setPoints(null);
    setError(null);
    const file = granularity === "monthly" ? "monthly.json" : "daily.json";
    fetch(`${import.meta.env.BASE_URL}data/rate_info/${pair}/${file}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        const raw: Array<{ date?: string; month?: string; rate: number }> =
          json.data || [];
        const parsed = raw
          .map((item) => ({
            key: granularity === "monthly" ? item.month! : item.date!,
            rate: item.rate,
          }))
          .sort((a, b) => (a.key < b.key ? -1 : 1));
        setPoints(parsed);
      })
      .catch(() => setError("데이터를 불러오는데 실패했습니다."));
  }, [pair, granularity]);

  const sub =
    granularity === "monthly"
      ? "월평균 · 출처: Frankfurter"
      : "최근 30일 · 출처: Frankfurter";
  const columnLabel = granularity === "monthly" ? "월" : "날짜";

  function handlePointerMove(e: React.PointerEvent<SVGRectElement>) {
    if (!points || points.length === 0) return;
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const scale = WIDTH / rect.width;
    const svgX = (e.clientX - rect.left) * scale;
    const ratio = Math.max(
      0,
      Math.min(1, (svgX - MARGIN.left) / PLOT_WIDTH)
    );
    setHoverIndex(Math.round(ratio * (points.length - 1)));
  }

  let chartBody: React.ReactNode = null;
  let hoverTooltip: React.ReactNode = null;

  if (points && points.length > 0) {
    const values = points.map((p) => p.rate);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const yTicks = niceTicks(minV, maxV, 4);
    const yMin = yTicks[0];
    const yMax = yTicks[yTicks.length - 1];

    const xAt = (i: number) =>
      MARGIN.left +
      (points.length === 1 ? PLOT_WIDTH / 2 : (i / (points.length - 1)) * PLOT_WIDTH);
    const yAt = (v: number) =>
      MARGIN.top + PLOT_HEIGHT - ((v - yMin) / (yMax - yMin)) * PLOT_HEIGHT;

    const d = points
      .map((p, i) => (i === 0 ? "M" : "L") + xAt(i).toFixed(2) + "," + yAt(p.rate).toFixed(2))
      .join(" ");

    const lastIdx = points.length - 1;
    const lastX = xAt(lastIdx);
    const lastY = yAt(points[lastIdx].rate);
    const labelAnchor = lastX > WIDTH - MARGIN.right - 60 ? "end" : "start";
    const labelX = labelAnchor === "end" ? lastX - 8 : lastX + 8;

    const labelEvery = Math.ceil(points.length / 4);

    const hovered = hoverIndex !== null ? points[hoverIndex] : null;
    const hoverX = hoverIndex !== null ? xAt(hoverIndex) : 0;
    const hoverY = hovered ? yAt(hovered.rate) : 0;

    chartBody = (
      <svg
        className="rate-chart-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line
              className="rate-chart-grid-line"
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={yAt(t)}
              y2={yAt(t)}
            />
            <text
              className="rate-chart-tick-text"
              x={MARGIN.left - 6}
              y={yAt(t) + 3}
              textAnchor="end"
            >
              {t.toLocaleString("ko-KR")}
            </text>
          </g>
        ))}

        <line
          className="rate-chart-axis-line"
          x1={MARGIN.left}
          x2={WIDTH - MARGIN.right}
          y1={MARGIN.top + PLOT_HEIGHT}
          y2={MARGIN.top + PLOT_HEIGHT}
        />

        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text
              key={p.key}
              className="rate-chart-tick-text"
              x={xAt(i)}
              y={MARGIN.top + PLOT_HEIGHT + 14}
              textAnchor="middle"
            >
              {formatShort(p.key, granularity)}
            </text>
          ) : null
        )}

        <path className="rate-chart-series-line" d={d} />

        <circle className="rate-chart-end-dot" cx={lastX} cy={lastY} r={3.5} />
        <text
          className="rate-chart-end-label"
          x={labelX}
          y={Math.max(lastY - 8, MARGIN.top + 8)}
          textAnchor={labelAnchor}
        >
          {formatValue(points[lastIdx].rate)}
        </text>

        {hovered && (
          <>
            <line
              className="rate-chart-crosshair"
              x1={hoverX}
              x2={hoverX}
              y1={MARGIN.top}
              y2={MARGIN.top + PLOT_HEIGHT}
              style={{ opacity: 1 }}
            />
            <circle
              className="rate-chart-hover-dot"
              cx={hoverX}
              cy={hoverY}
              r={3.5}
              style={{ opacity: 1 }}
            />
          </>
        )}

        <rect
          className="rate-chart-hit-overlay"
          x={MARGIN.left}
          y={MARGIN.top}
          width={PLOT_WIDTH}
          height={PLOT_HEIGHT}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        />
      </svg>
    );

    if (hovered) {
      hoverTooltip = (
        <div
          className="rate-chart-tooltip"
          style={{
            left: `${(hoverX / WIDTH) * 100}%`,
            top: `${(hoverY / HEIGHT) * 100}%`,
          }}
        >
          <div className="rate-chart-tooltip-date">
            {formatFull(hovered.key, granularity)}
          </div>
          <div className="rate-chart-tooltip-value">
            <span className="rate-chart-tooltip-key" />
            {formatValue(hovered.rate)}
          </div>
        </div>
      );
    }
  }

  return (
    <div className="rate-chart-card">
      <div className="rate-chart-header">
        <h3>{label} 환율</h3>
        <p className="rate-chart-muted">{sub}</p>
      </div>

      <div className="rate-chart-wrap">
        {error && <p className="rate-chart-state-msg">{error}</p>}
        {!error && !points && <p className="rate-chart-state-msg">불러오는 중…</p>}
        {!error && points && points.length === 0 && (
          <p className="rate-chart-state-msg">표시할 데이터가 없습니다.</p>
        )}
        {chartBody}
        {hoverTooltip}
      </div>

      {points && points.length > 0 && (
        <>
          <button
            type="button"
            className="rate-chart-toggle-btn"
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? "차트로 보기" : "표로 보기"}
          </button>

          {showTable && (
            <div className="rate-chart-table-wrap">
              <table className="rate-chart-table">
                <thead>
                  <tr>
                    <th>{columnLabel}</th>
                    <th>환율</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p) => (
                    <tr key={p.key}>
                      <td>{formatFull(p.key, granularity)}</td>
                      <td>{formatValue(p.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
