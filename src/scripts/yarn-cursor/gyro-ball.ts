import { YarnBall } from "./yarn-ball";

const RESTITUTION = 0.65;
const DAMPING = 0.97;
const DEFAULT_GRAVITY_SCALE = 60.0;
const FLICK_SCALE = 62.0; // impulse from angular velocity (deg/s → px/s)
const MAX_SPEED = 9000;
export const GYRO_BALL_RADIUS = 14;

const TRAIL_LENGTH = 20;

interface TrailPoint {
  x: number;
  y: number;
}

export class GyroBall {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  private gravX = 0;
  private gravY = 0;
  private flickX = 0;
  private flickY = 0;
  private prevBeta = 0;
  private prevGamma = 0;
  private hasOrientation = false;
  visual: YarnBall;
  private trail: TrailPoint[] = [];
  private gravityScale: number;

  get radius(): number {
    return this.visual.radius;
  }

  constructor(
    x: number,
    y: number,
    gravityScale: number = DEFAULT_GRAVITY_SCALE,
    color: string = "#ff6b6b",
  ) {
    this.x = x;
    this.y = y;
    this.gravityScale = gravityScale;
    this.visual = new YarnBall(GYRO_BALL_RADIUS, color);
  }

  respawn(w: number, h: number) {
    this.x = w / 2;
    this.y = h / 2;
    const angle = Math.random() * Math.PI * 2;
    const speed = 200 + Math.random() * 150;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.trail = [];
  }

  setOrientation(beta: number, gamma: number, dt: number) {
    const b = Math.max(-90, Math.min(90, beta));

    // Static gravity from tilt angle
    this.gravX = gamma * this.gravityScale;
    this.gravY = b * this.gravityScale;

    // Angular velocity impulse (deg/s → force)
    if (this.hasOrientation && dt > 0) {
      const dGamma = gamma - this.prevGamma;
      const dBeta = b - this.prevBeta;
      this.flickX = (dGamma / dt) * FLICK_SCALE;
      this.flickY = (dBeta / dt) * FLICK_SCALE;
    }

    this.prevBeta = b;
    this.prevGamma = gamma;
    this.hasOrientation = true;
  }

  update(dt: number, w: number, h: number) {
    // Apply gravity + flick impulse
    this.vx = (this.vx + (this.gravX + this.flickX) * dt) * DAMPING;
    this.vy = (this.vy + (this.gravY + this.flickY) * dt) * DAMPING;

    // Decay flick so it's a one-shot impulse, not sustained
    this.flickX *= 0.85;
    this.flickY *= 0.85;

    // Cap max speed
    const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (spd > MAX_SPEED) {
      this.vx = (this.vx / spd) * MAX_SPEED;
      this.vy = (this.vy / spd) * MAX_SPEED;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const r = this.radius;
    if (this.x < r) {
      this.x = r;
      this.vx = Math.abs(this.vx) * RESTITUTION;
    } else if (this.x > w - r) {
      this.x = w - r;
      this.vx = -Math.abs(this.vx) * RESTITUTION;
    }
    if (this.y < r) {
      this.y = r;
      this.vy = Math.abs(this.vy) * RESTITUTION;
    } else if (this.y > h - r) {
      this.y = h - r;
      this.vy = -Math.abs(this.vy) * RESTITUTION;
    }

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > TRAIL_LENGTH) {
      this.trail.shift();
    }

    this.visual.update({ x: this.vx * dt, y: this.vy * dt });
  }

  draw(ctx: CanvasRenderingContext2D) {
    // Draw trail
    const len = this.trail.length;
    if (len >= 2) {
      for (let i = 1; i < len; i++) {
        const t = i / len;
        const prev = this.trail[i - 1];
        const curr = this.trail[i];
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.strokeStyle = `rgba(255, 107, 107, ${t * 0.5})`;
        ctx.lineWidth = t * this.radius * 1.5;
        ctx.lineCap = "round";
        ctx.stroke();
      }
    }

    this.visual.draw(ctx, this.x, this.y);
  }
}
