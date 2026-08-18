import { useEffect, useState } from "react";
import { Link } from "react-router";

const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/blog", label: "Blog" },
  { to: "/economy", label: "Economy" },
  { to: "/news", label: "News" },
  { to: "/technology", label: "Technology" },
];

const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 480;
const DEFAULT_SIDEBAR_WIDTH = 240;
const SIDEBAR_WIDTH_STORAGE_KEY = "sidebar-width";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);

  useEffect(() => {
    const stored = Number(
      window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
    );
    if (stored >= MIN_SIDEBAR_WIDTH && stored <= MAX_SIDEBAR_WIDTH) {
      setSidebarWidth(stored);
    }
  }, []);

  function startResizing(e: React.MouseEvent) {
    e.preventDefault();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    let latestWidth = sidebarWidth;

    function handleMouseMove(ev: MouseEvent) {
      latestWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, ev.clientX)
      );
      setSidebarWidth(latestWidth);
    }

    function handleMouseUp() {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.localStorage.setItem(
        SIDEBAR_WIDTH_STORAGE_KEY,
        String(latestWidth)
      );
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  return (
    <div className="app-shell">
      <button
        type="button"
        className="hamburger-btn"
        aria-label="메뉴 열기"
        aria-expanded={isSidebarOpen}
        onClick={() => setSidebarOpen(true)}
      >
        <span />
        <span />
        <span />
      </button>

      {isSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`sidebar ${isSidebarOpen ? "sidebar-open" : ""}`}
        style={{ width: sidebarWidth }}
      >
        <div className="sidebar-header">
          <span className="sidebar-title">N_library</span>
          <button
            type="button"
            className="sidebar-close-btn"
            aria-label="메뉴 닫기"
            onClick={() => setSidebarOpen(false)}
          >
            ✕
          </button>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="sidebar-link"
              onClick={() => setSidebarOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div
          className="sidebar-resizer"
          onMouseDown={startResizing}
          role="separator"
          aria-orientation="vertical"
          aria-label="사이드바 크기 조절"
        />
      </aside>

      <main className="app-content">{children}</main>
    </div>
  );
}
