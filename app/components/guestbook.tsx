import { useEffect, useState } from "react";

const API_URL = "https://n-library-guestbook.kimnamho95.workers.dev";

type Entry = {
  id: number;
  name: string;
  message: string;
  ip: string | null;
  created_at: string;
};

export function Guestbook() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
      .then((entry: Entry) => {
        setEntries((prev) => (prev ? [entry, ...prev] : [entry]));
        setName("");
        setMessage("");
      })
      .catch(() => setFormError("Failed to post your message."))
      .finally(() => setSubmitting(false));
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

      <div className="guestbook-entries">
        {error && <p className="guestbook-state-msg">{error}</p>}
        {!error && !entries && <p className="guestbook-state-msg">Loading…</p>}
        {!error && entries && entries.length === 0 && (
          <p className="guestbook-state-msg">No messages yet. Be the first!</p>
        )}
        {entries?.map((entry) => (
          <div key={entry.id} className="guestbook-entry">
            <div className="guestbook-entry-header">
              <span className="guestbook-entry-name">
                {entry.name}
                {entry.ip && <span className="guestbook-entry-ip"> ({entry.ip})</span>}
              </span>
              <span className="guestbook-entry-date">{entry.created_at}</span>
            </div>
            <p className="guestbook-entry-message">{entry.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
