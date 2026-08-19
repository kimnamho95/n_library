import { useEffect, useState } from "react";

const API_URL = "https://n-library-guestbook.kimnamho95.workers.dev";
const TOKENS_KEY = "guestbook-tokens";
const ADMIN_TOKEN_KEY = "guestbook-admin-token";

type Entry = {
  id: number;
  name: string;
  message: string;
  ip: string | null;
  created_at: string;
};

// Only present in the POST response, right after an entry is created —
// the server never sends it back on GET.
type CreatedEntry = Entry & { edit_token: string };

function loadOwnedTokens(): Record<number, string> {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveOwnedToken(id: number, token: string) {
  const tokens = loadOwnedTokens();
  tokens[id] = token;
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

function removeOwnedToken(id: number) {
  const tokens = loadOwnedTokens();
  delete tokens[id];
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function Guestbook() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [ownedIds, setOwnedIds] = useState<Set<number>>(
    () => new Set(Object.keys(loadOwnedTokens()).map(Number))
  );
  const [adminToken, setAdminToken] = useState<string | null>(() =>
    localStorage.getItem(ADMIN_TOKEN_KEY)
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function loadEntries() {
    if (!API_URL) {
      setError("Guestbook API is not configured yet.");
      return;
    }
    setError(null);
    fetch(API_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: Entry[]) => setEntries(data))
      .catch(() => setError("Failed to load guestbook entries."));
  }

  useEffect(() => {
    loadEntries();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName || !trimmedMessage) {
      setFormError("Please fill in both name and message.");
      return;
    }
    if (!API_URL) {
      setFormError("Guestbook API is not configured yet.");
      return;
    }

    setFormError(null);
    setSubmitting(true);

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmedName, message: trimmedMessage }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((entry: CreatedEntry) => {
        saveOwnedToken(entry.id, entry.edit_token);
        setOwnedIds((prev) => new Set(prev).add(entry.id));
        setEntries((prev) => (prev ? [entry, ...prev] : [entry]));
        setName("");
        setMessage("");
      })
      .catch(() => setFormError("Failed to post your message."))
      .finally(() => setSubmitting(false));
  }

  function handleAdminLogin() {
    if (adminToken) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      setAdminToken(null);
      return;
    }
    const input = window.prompt("관리자 비밀번호를 입력하세요.");
    if (!input) return;
    localStorage.setItem(ADMIN_TOKEN_KEY, input);
    setAdminToken(input);
  }

  function handleDelete(id: number) {
    if (!API_URL) return;
    if (!window.confirm("이 글을 삭제할까요?")) return;

    const ownedToken = loadOwnedTokens()[id];
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (adminToken) headers["Authorization"] = `Bearer ${adminToken}`;

    setDeletingId(id);
    fetch(`${API_URL}/${id}`, {
      method: "DELETE",
      headers,
      body: JSON.stringify({ token: ownedToken || "" }),
    })
      .then((res) => {
        if (res.status === 403 && adminToken) {
          localStorage.removeItem(ADMIN_TOKEN_KEY);
          setAdminToken(null);
          window.alert("관리자 비밀번호가 올바르지 않습니다.");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        removeOwnedToken(id);
        setOwnedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setEntries((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
      })
      .catch(() => window.alert("삭제에 실패했습니다."))
      .finally(() => setDeletingId(null));
  }

  return (
    <div className="guestbook">
      <form className="guestbook-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="guestbook-name-input"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
        />
        <textarea
          className="guestbook-message-input"
          placeholder="Leave a message…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          rows={3}
        />
        <button type="submit" className="guestbook-submit-btn" disabled={submitting}>
          {submitting ? "Posting…" : "Post"}
        </button>
        {formError && <p className="guestbook-error">{formError}</p>}
      </form>

      <button type="button" className="guestbook-admin-toggle" onClick={handleAdminLogin}>
        {adminToken ? "관리자 로그아웃" : "관리자 로그인"}
      </button>

      <div className="guestbook-entries">
        {error && <p className="guestbook-state-msg">{error}</p>}
        {!error && !entries && <p className="guestbook-state-msg">Loading…</p>}
        {!error && entries && entries.length === 0 && (
          <p className="guestbook-state-msg">No messages yet. Be the first!</p>
        )}
        {entries?.map((entry) => {
          const canDelete = adminToken !== null || ownedIds.has(entry.id);
          return (
            <div key={entry.id} className="guestbook-entry">
              <div className="guestbook-entry-header">
                <span className="guestbook-entry-name">
                  {entry.name}
                  {entry.ip && <span className="guestbook-entry-ip"> ({entry.ip})</span>}
                </span>
                <span className="guestbook-entry-date">{entry.created_at}</span>
              </div>
              <p className="guestbook-entry-message">{entry.message}</p>
              {canDelete && (
                <button
                  type="button"
                  className="guestbook-delete-btn"
                  disabled={deletingId === entry.id}
                  onClick={() => handleDelete(entry.id)}
                >
                  삭제
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
