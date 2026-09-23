import type { MonsterKind } from "./monsters";

/**
 * Which bosses this browser has beaten, and what beating them is worth.
 *
 * This is the game's only permanent state. It lives in localStorage rather
 * than on the server on purpose: the backend deliberately knows nothing about
 * a visitor until they submit a score, and a trophy cabinet is not worth
 * teaching it to. The cost is that clearing site data clears the cabinet, and
 * a second device starts empty.
 *
 * The type-only import of MonsterKind is deliberate — it is erased at build
 * time, so this module has no runtime dependency on the game and the game can
 * import it back without a cycle.
 */

const STORAGE_KEY = "yarn-bosses-defeated";

export interface BossUnlock {
  /** Stable id the game checks with hasUnlock(). */
  id: string;
  name: string;
  description: string;
}

export interface BossEntry {
  /** Stable storage key — never renamed, or every cabinet empties. */
  id: string;
  /** Which sprite to draw for its portrait. */
  kind: MonsterKind;
  name: string;
  /** The level its fight takes over. */
  level: number;
  blurb: string;
  /** What beating it grants, for good. Absent means not decided yet. */
  unlock?: BossUnlock;
}

/** In fight order. Appending to this is how a new boss joins the cabinet. */
export const BOSSES: BossEntry[] = [
  {
    id: "boss",
    kind: "boss",
    name: "The Bulwark",
    level: 10,
    blurb:
      "A colossal plated moth. Its ring of shields has exactly one opening, and it rolls that opening somewhere else every time you land a hit.",
    unlock: {
      id: "combo",
      name: "Combos",
      description:
        "Five kills without pausing and the yarn catches fire. While it burns it smashes straight through shields — no need to find the gap.",
    },
  },
  {
    id: "queen",
    kind: "queen",
    name: "The Loom Queen",
    level: 15,
    blurb:
      "She refuses to be stood next to. Every hit strings a fresh silk line across the screen and sends her down it — be off the thread before she travels it.",
  },
];

function read(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    // Private mode, disabled storage, or something else wrote nonsense here.
    // A missing trophy cabinet must never take the game down with it.
    return [];
  }
}

export function defeatedBosses(): Set<string> {
  return new Set(read());
}

/** Remember that this browser has beaten `kind`. Silently does nothing twice. */
export function recordBossDefeat(kind: MonsterKind): void {
  const boss = BOSSES.find((b) => b.kind === kind);
  if (!boss) return;
  const have = read();
  if (have.includes(boss.id)) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...have, boss.id]));
  } catch {
    // Nothing to do — the run still counts for the leaderboard.
  }
}

/** True once the boss that grants `unlockId` has been beaten. */
export function hasUnlock(unlockId: string): boolean {
  const done = defeatedBosses();
  return BOSSES.some((b) => b.unlock?.id === unlockId && done.has(b.id));
}
