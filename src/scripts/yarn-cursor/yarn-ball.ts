import type { Vec2 } from "./verlet-rope";

export class YarnBall {
  rotation: number = 0;
  private baseRadius: number;
  radiusBonus: number = 0;
  color: string;

  get radius(): number {
    return this.baseRadius + this.radiusBonus;
  }

  constructor(radius: number = 14, color: string = "#ff6b6b") {
    this.baseRadius = radius;
    this.color = color;
  }

  update(velocity: Vec2) {
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    this.rotation += speed * 0.02;
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.rotation);

    // Main ball
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();

    // Yarn texture lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";

    // Curved wrap lines
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI;
      const r = this.radius * 0.85;
      ctx.beginPath();
      ctx.arc(0, 0, r, angle - 0.6, angle + 0.6);
      ctx.stroke();
    }

    // Cross wraps
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI + Math.PI / 6;
      const r = this.radius * 0.7;
      ctx.beginPath();
      ctx.arc(0, 0, r, angle - 0.8, angle + 0.8);
      ctx.stroke();
    }

    ctx.restore();
  }
}
