export interface Vec2 {
  x: number;
  y: number;
}

interface RopePoint {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  locked: boolean;
}

export class VerletRope {
  points: RopePoint[];
  segmentLength: number;
  gravity: number;
  damping: number;
  iterations: number;

  constructor(
    startX: number,
    startY: number,
    numPoints: number = 20,
    segmentLength: number = 12,
  ) {
    this.segmentLength = segmentLength;
    this.gravity = 300;
    this.damping = 0.98;
    this.iterations = 4;

    this.points = [];
    for (let i = 0; i < numPoints; i++) {
      this.points.push({
        x: startX,
        y: startY + i * segmentLength,
        prevX: startX,
        prevY: startY + i * segmentLength,
        locked: i === 0,
      });
    }
  }

  update(mouseX: number, mouseY: number, dt: number) {
    // Lock first point to mouse
    this.points[0].x = mouseX;
    this.points[0].y = mouseY;

    // Verlet integration for free points
    for (let i = 1; i < this.points.length; i++) {
      const p = this.points[i];
      const vx = (p.x - p.prevX) * this.damping;
      const vy = (p.y - p.prevY) * this.damping;

      p.prevX = p.x;
      p.prevY = p.y;
      p.x += vx;
      p.y += vy + this.gravity * dt * dt;
    }

    // Satisfy distance constraints
    for (let iter = 0; iter < this.iterations; iter++) {
      for (let i = 0; i < this.points.length - 1; i++) {
        const a = this.points[i];
        const b = this.points[i + 1];

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) continue;

        const diff = (this.segmentLength - dist) / dist / 2;

        if (!a.locked) {
          a.x -= dx * diff;
          a.y -= dy * diff;
        }
        if (!b.locked) {
          b.x += dx * diff;
          b.y += dy * diff;
        }
      }
    }
  }

  getPoints(): ReadonlyArray<Vec2> {
    return this.points;
  }
}
