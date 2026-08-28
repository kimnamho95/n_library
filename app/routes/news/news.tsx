import { useEffect, useState } from "react";
import type { Route } from "./+types/news";

export function meta({}: Route.MetaArgs) {
  return [{ title: "News - N_library" }];
}

const PROXY_URL = "https://n-library-news-proxy.kimnamho95.workers.dev";

type NewsItem = {
  title: string;
  link: string;
  source: string | null;
  published: string | null;
};

type NewsData = {
  source: string;
  updated_at: string;
  items: NewsItem[];
};

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; data: NewsData };

export default function News() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/news/latest.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: NewsData) => setState({ status: "ok", data }))
      .catch(() => setState({ status: "error" }))
      .finally(() => refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refresh() {
    setRefreshing(true);
    setRefreshError(false);

    fetch(PROXY_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: NewsData) => {
        setState({ status: "ok", data });
        setRefreshing(false);
      })
      .catch(() => {
        setRefreshError(true);
        setRefreshing(false);
      });
  }

  return (
    <div className="page">
      <h1>News</h1>

      <section className="data-section">
        {state.status === "loading" && (
          <p className="news-state-msg">Loading…</p>
        )}

        {state.status === "error" && (
          <p className="news-state-msg">Failed to load news.</p>
        )}

        {state.status === "ok" && (
          <>
            <div className="news-toolbar">
              <p className="news-updated">
                Updated {new Date(state.data.updated_at).toLocaleString()} ·{" "}
                {state.data.source}
              </p>
              <button
                type="button"
                className="news-refresh-btn"
                onClick={refresh}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing…" : "Refresh now"}
              </button>
            </div>

            {refreshError && (
              <p className="news-error">Failed to refresh. Showing last known news.</p>
            )}

            <ul className="news-list">
              {state.data.items.map((item) => (
                <li key={item.link} className="news-item">
                  <a
                    className="news-item-title"
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.title}
                  </a>
                  <div className="news-item-meta">
                    {item.source}
                    {item.published &&
                      ` · ${new Date(item.published).toLocaleString()}`}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
