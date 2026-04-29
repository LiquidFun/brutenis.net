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
}

const SESSION_KEY = "bnet-session-id";
const TOKEN_KEY = "bnet-session-token";

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

  const resp = await fetch("/api/sessions", { method: "POST" });
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

export async function logEventsBatch(
  session: SessionTokens,
  events: GameEvent[],
): Promise<void> {
  if (events.length === 0) return;
  await fetch(`/api/sessions/${session.sessionId}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: session.token, events }),
  });
}

export async function submitScore(
  session: SessionTokens,
  name: string,
  score: number,
  level: number,
  durationMs: number,
): Promise<{ accepted: boolean; rank: number | null }> {
  const resp = await fetch(`/api/sessions/${session.sessionId}/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: session.token,
      name,
      score,
      level,
      duration_ms: durationMs,
    }),
  });
  if (!resp.ok) throw new Error(`Submit failed: ${resp.status}`);
  return resp.json();
}

export async function fetchLeaderboard(
  limit = 50,
): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  const resp = await fetch(`/api/leaderboard?limit=${limit}`);
  if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
  return resp.json();
}
