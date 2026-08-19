import { useEffect, useState } from "react";

const API_URL = "https://n-library-guestbook.kimnamho95.workers.dev";
const TOKENS_KEY = "guestbook-tokens";
const COMMENT_TOKENS_KEY = "guestbook-comment-tokens";
const ADMIN_TOKEN_KEY = "guestbook-admin-token";

type Entry = {
  id: number;
  name: string;
  message: string | null;
  ip: string | null;
  created_at: string;
  is_secret: boolean;
};

// Only present in the POST response, right after an entry is created —
// the server never sends it back on GET.
type CreatedEntry = Entry & { edit_token: string };

type Comment = {
  id: number;
  entry_id: number;
  parent_id: number | null;
  name: string;
  message: string;
  ip: string | null;
  created_at: string;
};

type CreatedComment = Comment & { edit_token: string };

function loadTokenMap(key: string): Record<number, string> {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function saveToken(key: string, id: number, token: string) {
  const tokens = loadTokenMap(key);
  tokens[id] = token;
  localStorage.setItem(key, JSON.stringify(tokens));
}

function removeToken(key: string, id: number) {
  const tokens = loadTokenMap(key);
  delete tokens[id];
  localStorage.setItem(key, JSON.stringify(tokens));
}

function buildChildrenMap(comments: Comment[]): Record<number, Comment[]> {
  const map: Record<number, Comment[]> = {};
  for (const comment of comments) {
    if (comment.parent_id == null) continue;
    if (!map[comment.parent_id]) map[comment.parent_id] = [];
    map[comment.parent_id].push(comment);
  }
  return map;
}

function CommentForm({
  onSubmit,
  submitLabel,
  autoFocus,
}: {
  onSubmit: (name: string, message: string) => Promise<void>;
  submitLabel: string;
  autoFocus?: boolean;
}) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedMessage = message.trim();
    if (!trimmedName || !trimmedMessage) return;

    setSubmitting(true);
    await onSubmit(trimmedName, trimmedMessage);
    setSubmitting(false);
    setName("");
    setMessage("");
  }

  return (
    <form className="guestbook-comment-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        autoFocus={autoFocus}
      />
      <textarea
        placeholder="Write a reply…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={500}
        rows={2}
      />
      <button type="submit" className="guestbook-comment-submit-btn" disabled={submitting}>
        {submitting ? "Posting…" : submitLabel}
      </button>
    </form>
  );
}

function CommentNode({
  comment,
  childrenMap,
  depth,
  onReply,
  onDelete,
  canDelete,
  deletingId,
}: {
  comment: Comment;
  childrenMap: Record<number, Comment[]>;
  depth: number;
  onReply: (parentId: number, name: string, message: string) => Promise<void>;
  onDelete: (id: number) => void;
  canDelete: (comment: Comment) => boolean;
  deletingId: number | null;
}) {
  const [replying, setReplying] = useState(false);
  const children = childrenMap[comment.id] || [];

  return (
    <div className="guestbook-comment" style={{ marginLeft: depth * 20 }}>
      <div className="guestbook-comment-header">
        <span className="guestbook-comment-name">
          {comment.name}
          {comment.ip && <span className="guestbook-entry-ip"> ({comment.ip})</span>}
        </span>
        <span className="guestbook-comment-date">{comment.created_at}</span>
      </div>
      <p className="guestbook-comment-message">{comment.message}</p>
      <div className="guestbook-comment-actions">
        <button type="button" className="guestbook-comment-reply-btn" onClick={() => setReplying((v) => !v)}>
          Reply
        </button>
        {canDelete(comment) && (
          <button
            type="button"
            className="guestbook-delete-btn"
            disabled={deletingId === comment.id}
            onClick={() => onDelete(comment.id)}
          >
            Delete
          </button>
        )}
      </div>
      {replying && (
        <CommentForm
          submitLabel="Reply"
          autoFocus
          onSubmit={async (name, message) => {
            await onReply(comment.id, name, message);
            setReplying(false);
          }}
        />
      )}
      {children.map((child) => (
        <CommentNode
          key={child.id}
          comment={child}
          childrenMap={childrenMap}
          depth={depth + 1}
          onReply={onReply}
          onDelete={onDelete}
          canDelete={canDelete}
          deletingId={deletingId}
        />
      ))}
    </div>
  );
}

export function Guestbook() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [isSecret, setIsSecret] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [ownedIds, setOwnedIds] = useState<Set<number>>(
    () => new Set(Object.keys(loadTokenMap(TOKENS_KEY)).map(Number))
  );
  const [ownedCommentIds, setOwnedCommentIds] = useState<Set<number>>(
    () => new Set(Object.keys(loadTokenMap(COMMENT_TOKENS_KEY)).map(Number))
  );
  const [adminToken, setAdminToken] = useState<string | null>(() =>
    localStorage.getItem(ADMIN_TOKEN_KEY)
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);
  const [unlockingId, setUnlockingId] = useState<number | null>(null);
  const [unlockedMessages, setUnlockedMessages] = useState<Record<number, string>>({});
  const [openComments, setOpenComments] = useState<Set<number>>(new Set());
  const [commentsByEntry, setCommentsByEntry] = useState<Record<number, Comment[]>>({});

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
    if (isSecret && !password) {
      setFormError("Please set a password for your secret message.");
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
      body: JSON.stringify({
        name: trimmedName,
        message: trimmedMessage,
        secret: isSecret,
        password: isSecret ? password : undefined,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((entry: CreatedEntry) => {
        saveToken(TOKENS_KEY, entry.id, entry.edit_token);
        setOwnedIds((prev) => new Set(prev).add(entry.id));
        setEntries((prev) => (prev ? [entry, ...prev] : [entry]));
        if (!entry.is_secret) {
          setUnlockedMessages((prev) => ({ ...prev, [entry.id]: entry.message! }));
        }
        setName("");
        setMessage("");
        setIsSecret(false);
        setPassword("");
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
    const input = window.prompt("Enter admin password.");
    if (!input) return;
    localStorage.setItem(ADMIN_TOKEN_KEY, input);
    setAdminToken(input);
  }

  function handleDelete(id: number) {
    if (!API_URL) return;
    if (!window.confirm("Delete this entry?")) return;

    const ownedToken = loadTokenMap(TOKENS_KEY)[id];
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
          window.alert("Incorrect admin password.");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        removeToken(TOKENS_KEY, id);
        setOwnedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setEntries((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
      })
      .catch(() => window.alert("Failed to delete."))
      .finally(() => setDeletingId(null));
  }

  function handleUnlock(id: number) {
    if (!API_URL) return;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    let body: { password?: string } = {};

    if (adminToken) {
      headers["Authorization"] = `Bearer ${adminToken}`;
    } else {
      const input = window.prompt("Enter the password for this secret message.");
      if (!input) return;
      body = { password: input };
    }

    setUnlockingId(id);
    fetch(`${API_URL}/${id}/unlock`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (res.status === 403) {
          window.alert("Incorrect password.");
          throw new Error("forbidden");
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { message: string }) => {
        setUnlockedMessages((prev) => ({ ...prev, [id]: data.message }));
      })
      .catch(() => {})
      .finally(() => setUnlockingId(null));
  }

  function toggleComments(entryId: number) {
    setOpenComments((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });

    if (!commentsByEntry[entryId] && API_URL) {
      fetch(`${API_URL}/${entryId}/comments`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data: Comment[]) => {
          setCommentsByEntry((prev) => ({ ...prev, [entryId]: data }));
        })
        .catch(() => {});
    }
  }

  async function handlePostComment(entryId: number, parentId: number | null, name: string, message: string) {
    if (!API_URL) return;

    const res = await fetch(`${API_URL}/${entryId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, message, parent_id: parentId }),
    });
    if (!res.ok) {
      window.alert("Failed to post your comment.");
      return;
    }
    const comment: CreatedComment = await res.json();
    saveToken(COMMENT_TOKENS_KEY, comment.id, comment.edit_token);
    setOwnedCommentIds((prev) => new Set(prev).add(comment.id));
    setCommentsByEntry((prev) => ({
      ...prev,
      [entryId]: [...(prev[entryId] || []), comment],
    }));
  }

  function handleDeleteComment(entryId: number, commentId: number) {
    if (!API_URL) return;
    if (!window.confirm("Delete this comment?")) return;

    const ownedToken = loadTokenMap(COMMENT_TOKENS_KEY)[commentId];
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (adminToken) headers["Authorization"] = `Bearer ${adminToken}`;

    setDeletingCommentId(commentId);
    fetch(`${API_URL}/comments/${commentId}`, {
      method: "DELETE",
      headers,
      body: JSON.stringify({ token: ownedToken || "" }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        removeToken(COMMENT_TOKENS_KEY, commentId);
        setOwnedCommentIds((prev) => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
        // A deleted comment takes its replies with it (server-side cascade),
        // so re-fetch this entry's thread instead of patching state by hand.
        return fetch(`${API_URL}/${entryId}/comments`).then((r) => r.json());
      })
      .then((data: Comment[]) => {
        setCommentsByEntry((prev) => ({ ...prev, [entryId]: data }));
      })
      .catch(() => window.alert("Failed to delete comment."))
      .finally(() => setDeletingCommentId(null));
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
        <label className="guestbook-secret-toggle">
          <input
            type="checkbox"
            checked={isSecret}
            onChange={(e) => setIsSecret(e.target.checked)}
          />
          Secret message
        </label>
        {isSecret && (
          <input
            type="password"
            className="guestbook-password-input"
            placeholder="Set a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={100}
          />
        )}
        <button type="submit" className="guestbook-submit-btn" disabled={submitting}>
          {submitting ? "Posting…" : "Post"}
        </button>
        {formError && <p className="guestbook-error">{formError}</p>}
      </form>

      <button type="button" className="guestbook-admin-toggle" onClick={handleAdminLogin}>
        {adminToken ? "Admin logout" : "Admin login"}
      </button>

      <div className="guestbook-entries">
        {error && <p className="guestbook-state-msg">{error}</p>}
        {!error && !entries && <p className="guestbook-state-msg">Loading…</p>}
        {!error && entries && entries.length === 0 && (
          <p className="guestbook-state-msg">No messages yet. Be the first!</p>
        )}
        {entries?.map((entry) => {
          const canDeleteEntry = adminToken !== null || ownedIds.has(entry.id);
          const unlockedMessage = unlockedMessages[entry.id];
          const isUnlocked = !entry.is_secret || unlockedMessage !== undefined;
          const commentsOpen = openComments.has(entry.id);
          const comments = commentsByEntry[entry.id] || [];
          const childrenMap = buildChildrenMap(comments);
          const topLevelComments = comments.filter((c) => c.parent_id == null);
          const canDeleteComment = (comment: Comment) =>
            adminToken !== null || ownedCommentIds.has(comment.id);

          return (
            <div key={entry.id} className="guestbook-entry">
              <div className="guestbook-entry-header">
                <span className="guestbook-entry-name">
                  {entry.name}
                  {entry.ip && <span className="guestbook-entry-ip"> ({entry.ip})</span>}
                </span>
                <span className="guestbook-entry-date">{entry.created_at}</span>
              </div>

              {isUnlocked ? (
                <p className="guestbook-entry-message">{unlockedMessage ?? entry.message}</p>
              ) : (
                <div className="guestbook-secret">
                  <p className="guestbook-secret-placeholder">🔒 Secret message</p>
                  <button
                    type="button"
                    className="guestbook-unlock-btn"
                    disabled={unlockingId === entry.id}
                    onClick={() => handleUnlock(entry.id)}
                  >
                    {unlockingId === entry.id ? "Unlocking…" : "Unlock"}
                  </button>
                </div>
              )}

              <div className="guestbook-entry-actions">
                <button
                  type="button"
                  className="guestbook-comments-toggle-btn"
                  onClick={() => toggleComments(entry.id)}
                >
                  {commentsOpen ? "Hide comments" : "Comments"}
                </button>
                {canDeleteEntry && (
                  <button
                    type="button"
                    className="guestbook-delete-btn"
                    disabled={deletingId === entry.id}
                    onClick={() => handleDelete(entry.id)}
                  >
                    Delete
                  </button>
                )}
              </div>

              {commentsOpen && (
                <div className="guestbook-comments">
                  {topLevelComments.map((comment) => (
                    <CommentNode
                      key={comment.id}
                      comment={comment}
                      childrenMap={childrenMap}
                      depth={0}
                      onReply={(parentId, replyName, replyMessage) =>
                        handlePostComment(entry.id, parentId, replyName, replyMessage)
                      }
                      onDelete={(commentId) => handleDeleteComment(entry.id, commentId)}
                      canDelete={canDeleteComment}
                      deletingId={deletingCommentId}
                    />
                  ))}
                  <CommentForm
                    submitLabel="Comment"
                    onSubmit={(commentName, commentMessage) =>
                      handlePostComment(entry.id, null, commentName, commentMessage)
                    }
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
