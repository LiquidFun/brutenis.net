import type { VerletRope } from "./verlet-rope";
import type { GyroBall } from "./gyro-ball";

// A "web" pins part of the player's yarn in place. On desktop it locks a
// mid-rope point so the ball swings on a pivot; on mobile (no rope) it leashes
// the gyro ball to a fixed point. Either way, yanking hard builds strain until
// the strand snaps.

// Tuned so ordinary agitated mouse movement (~600px/s) tears free in about two
// seconds and a deliberate whip does it in well under one. The mechanic should
// read as "move, and you're out", not as a precision test.
const STRAIN_FREE_SPEED = 220; // px/s of movement that costs the web nothing
const STRAIN_GAIN = 0.0018; // strain per (px/s over free) per second
const STRAIN_DECAY = 0.22; // strain shed per second when moving gently

const TETHER_LENGTH = 140; // mobile: leash radius before the web pulls back
const TETHER_PULL = 12; // mobile: spring strength outside the leash

// Desktop: keep the bite well clear of the ball, otherwise the ball is already
// touching whatever spun the web and squashes it on contact.
const BALL_CLEARANCE = 80;

export interface WebInfo {
  /** Anchor point — fixed in screen space, where the spider sits. */
  ax: number;
  ay: number;
  /** Attached point — the bit of yarn held by the web. */
  bx: number;
  by: number;
  /** 0 → slack, 1 → snapped. */
  strain: number;
}

interface Anchor {
  id: string;
  x: number;
  y: number;
  rope: VerletRope | null;
  pointIdx: number;
  gyro: GyroBall | null;
  strain: number;
}

export class WebAnchorManager {
  private anchors: Anchor[] = [];

  constructor(
    private getRopes: () => VerletRope[],
    private getGyroBalls: () => GyroBall[],
    private isGyro: () => boolean,
  ) {}

  /**
   * Attach a web at (x, y) to the nearest piece of yarn within maxDist.
   * Returns the attach point, or null if there was no yarn in range.
   */
  attach(id: string, x: number, y: number, maxDist: number): { x: number; y: number } | null {
    this.release(id);

    if (this.isGyro()) {
      let best: GyroBall | null = null;
      let bestDist = maxDist * maxDist;
      for (const gb of this.getGyroBalls()) {
        const d = (gb.x - x) ** 2 + (gb.y - y) ** 2;
        if (d < bestDist) { bestDist = d; best = gb; }
      }
      if (!best) return null;
      this.anchors.push({ id, x, y, rope: null, pointIdx: -1, gyro: best, strain: 0 });
      return { x, y };
    }

    let bestRope: VerletRope | null = null;
    let bestIdx = -1;
    let bestDist = maxDist * maxDist;
    for (const rope of this.getRopes()) {
      const ball = rope.points[rope.points.length - 1];
      // Skip the cursor end so the web always bites mid-rope
      for (let i = 2; i < rope.points.length - 2; i++) {
        const p = rope.points[i];
        if (p.locked) continue;
        if ((p.x - ball.x) ** 2 + (p.y - ball.y) ** 2 < BALL_CLEARANCE ** 2) continue;
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bestDist) { bestDist = d; bestRope = rope; bestIdx = i; }
      }
    }
    if (!bestRope) return null;

    const p = bestRope.points[bestIdx];
    p.locked = true;
    this.anchors.push({ id, x: p.x, y: p.y, rope: bestRope, pointIdx: bestIdx, gyro: null, strain: 0 });
    return { x: p.x, y: p.y };
  }

  info(id: string): WebInfo | null {
    const a = this.anchors.find(an => an.id === id);
    if (!a) return null;
    const bx = a.gyro ? a.gyro.x : a.x;
    const by = a.gyro ? a.gyro.y : a.y;
    return { ax: a.x, ay: a.y, bx, by, strain: a.strain };
  }

  release(id: string) {
    const idx = this.anchors.findIndex(a => a.id === id);
    if (idx === -1) return;
    this.unpin(this.anchors[idx]);
    this.anchors.splice(idx, 1);
  }

  releaseAll() {
    for (const a of this.anchors) this.unpin(a);
    this.anchors.length = 0;
  }

  private unpin(a: Anchor) {
    if (!a.rope) return;
    const p = a.rope.points[a.pointIdx];
    if (p) p.locked = false;
  }

  /** Run after the ropes/balls have been integrated for this frame. */
  update(dt: number) {
    if (this.anchors.length === 0 || dt <= 0) return;
    const ropes = this.getRopes();

    for (let i = this.anchors.length - 1; i >= 0; i--) {
      const a = this.anchors[i];
      let speed: number;

      if (a.gyro) {
        speed = this.tether(a, dt);
      } else {
        // The rope may have been removed by an expiring extra-ball upgrade
        if (!a.rope || !ropes.includes(a.rope)) {
          this.anchors.splice(i, 1);
          continue;
        }
        speed = this.pin(a, dt);
      }

      a.strain += Math.max(0, speed - STRAIN_FREE_SPEED) * STRAIN_GAIN * dt;
      a.strain = Math.max(0, Math.min(1, a.strain - STRAIN_DECAY * dt));
    }
  }

  /** Hold the locked rope point still; report how fast its neighbours whip. */
  private pin(a: Anchor, dt: number): number {
    const pts = a.rope!.points;
    const p = pts[a.pointIdx];
    p.x = a.x;
    p.y = a.y;
    p.prevX = a.x;
    p.prevY = a.y;

    let fastest = 0;
    for (const n of [pts[a.pointIdx - 1], pts[a.pointIdx + 1]]) {
      if (!n) continue;
      const s = Math.hypot(n.x - n.prevX, n.y - n.prevY) / dt;
      if (s > fastest) fastest = s;
    }
    return fastest;
  }

  /** Reel the gyro ball back toward the anchor; report its speed. */
  private tether(a: Anchor, dt: number): number {
    const gb = a.gyro!;
    const dx = a.x - gb.x;
    const dy = a.y - gb.y;
    const dist = Math.hypot(dx, dy);
    const over = dist - TETHER_LENGTH;
    if (over > 0 && dist > 0) {
      gb.vx += (dx / dist) * over * TETHER_PULL * dt;
      gb.vy += (dy / dist) * over * TETHER_PULL * dt;
    }
    return Math.hypot(gb.vx, gb.vy);
  }
}
