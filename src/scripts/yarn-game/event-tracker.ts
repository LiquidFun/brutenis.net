import { ensureSession, clearSession, type SessionTokens } from "./leaderboard-api";

export interface GameEvent {
  seq: number;
  event_type: string;
  timestamp_ms: number;
  payload?: Record<string, unknown>;
}

/** Collects the game's event log in memory; it is sent once with the final score. */
export class EventTracker {
  private events: GameEvent[] = [];
  private nextSeq = 1;
  private startTime = 0;
  private session: SessionTokens | null = null;
  private started = false;

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.startTime = performance.now();
    this.nextSeq = 1;
    this.events = [];
    try {
      this.session = await ensureSession();
    } catch {
      // API unavailable — tracking disabled for this session
      this.session = null;
    }
  }

  record(event: Omit<GameEvent, "seq" | "timestamp_ms">): void {
    if (!this.started) return;
    const entry: GameEvent = {
      ...event,
      seq: this.nextSeq++,
      timestamp_ms: Math.round(performance.now() - this.startTime),
    };
    this.events.push(entry);
  }

  getAll(): GameEvent[] {
    return this.events;
  }

  getSession(): SessionTokens | null {
    return this.session;
  }

  isStarted(): boolean {
    return this.started;
  }

  reset(): void {
    this.events = [];
    this.nextSeq = 1;
    this.startTime = 0;
    this.session = null;
    this.started = false;
    clearSession();
  }
}
