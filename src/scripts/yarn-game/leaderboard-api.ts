import type { GameEvent } from "./event-tracker";

export interface SessionTokens {
  sessionId: string;
  token: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  level: number;
  duration_s: number;
  date: string;
  weapon: string;
  platform: string;
  /**
   * Set by the server for the caller's own row. It works out who that is from
   * the `_bnet_uid` cookie, which rides along automatically because it is
   * scoped to /api — and which this code could not read even if it wanted to,
   * since the cookie is HttpOnly. That is deliberate: the board is public, so
   * it must never carry identifiers a visitor could collect.
   */
  is_you: boolean;
}

declare const __GAME_VERSION__: string;

const SESSION_KEY = "bnet-session-id";
const TOKEN_KEY = "bnet-session-token";

/** fetch() never times out on its own; a hung backend would block the UI forever. */
const REQUEST_TIMEOUT_MS = 8000;

async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function getCachedSession(): SessionTokens | null {
  const id = sessionStorage.getItem(SESSION_KEY);
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (id && token) return { sessionId: id, token };
  return null;
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function ensureSession(): Promise<SessionTokens> {
  const cached = getCachedSession();
  if (cached) return cached;

  const resp = await apiFetch("/api/sessions", { method: "POST" });
  if (!resp.ok) throw new Error(`Session creation failed: ${resp.status}`);

  const data = await resp.json();
  const session: SessionTokens = {
    sessionId: data.session_id,
    token: data.token,
  };
  sessionStorage.setItem(SESSION_KEY, session.sessionId);
  sessionStorage.setItem(TOKEN_KEY, session.token);
  return session;
}

/**
 * `session` may be null: if the backend was unreachable when the game started, no
 * session exists, so one is created here. That lets a score still be submitted once
 * the backend comes back, instead of failing forever.
 */
export async function submitScore(
  session: SessionTokens | null,
  name: string,
  score: number,
  level: number,
  durationMs: number,
  events: GameEvent[],
): Promise<{ accepted: boolean; rank: number | null }> {
  const platform = window.matchMedia("(hover: none)").matches ? "mobile" : "desktop";

  const post = (s: SessionTokens) =>
    apiFetch(`/api/sessions/${s.sessionId}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: s.token,
        name,
        score,
        level,
        duration_ms: durationMs,
        version: typeof __GAME_VERSION__ !== "undefined" ? __GAME_VERSION__ : "unknown",
        weapon: "yarn-ball",
        platform,
        events,
      }),
    });

  let resp = await post(session ?? (await ensureSession()));

  // The cached session can be gone or unusable server-side (e.g. the database was
  // reset). Start a fresh one and retry once so the score isn't lost.
  if (resp.status === 404 || resp.status === 403) {
    clearSession();
    resp = await post(await ensureSession());
  }

  if (!resp.ok) throw new Error(`Submit failed: ${resp.status}`);
  return resp.json();
}

export async function fetchLeaderboard(
  limit = 50,
): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  const resp = await apiFetch(`/api/leaderboard?limit=${limit}`);
  if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
  return resp.json();
}

/**
 * Remove every run belonging to this browser from the leaderboard.
 *
 * Takes no arguments because it needs none: the server identifies the caller
 * from the cookie. Removes all of the player's runs rather than one row, since
 * the board only ever shows a player's best — deleting just that would promote
 * the next one and read as a failed click.
 */
export async function deleteMyEntries(): Promise<number> {
  const resp = await apiFetch("/api/leaderboard/me", { method: "DELETE" });
  if (resp.status === 404) return 0; // nothing of ours on the board
  if (!resp.ok) throw new Error(`Delete failed: ${resp.status}`);
  return (await resp.json()).removed as number;
}
