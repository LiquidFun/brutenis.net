import type { Vec2 } from "./verlet-rope";
import type { YarnBall } from "./yarn-ball";

export function drawRope(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<Vec2>,
  color: string = "#ff6b6b",
) {
  if (points.length < 2) return;

  // Draw fuzzy yarn string using multiple offset passes
  const passes = [
    { offset: 0, alpha: 0.8, width: 3.5 },
    { offset: 1.2, alpha: 0.15, width: 5 },
    { offset: -1, alpha: 0.15, width: 5 },
  ];

  for (const pass of passes) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.globalAlpha = pass.alpha;
    ctx.lineWidth = pass.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Use quadratic bezier through midpoints for smoothness
    const p0 = points[0];
    ctx.moveTo(p0.x + pass.offset, p0.y + pass.offset);

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const midX = (p1.x + p2.x) / 2 + pass.offset;
      const midY = (p1.y + p2.y) / 2 + pass.offset;

      ctx.quadraticCurveTo(
        p1.x + pass.offset,
        p1.y + pass.offset,
        midX,
        midY,
      );
    }

    // Line to last point
    const last = points[points.length - 1];
    ctx.lineTo(last.x + pass.offset, last.y + pass.offset);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

export function drawYarnBall(
  ctx: CanvasRenderingContext2D,
  ball: YarnBall,
  points: ReadonlyArray<Vec2>,
) {
  if (points.length < 2) return;
  const last = points[points.length - 1];
  const prev = points[points.length - 2];

  ball.update({ x: last.x - prev.x, y: last.y - prev.y });
  ball.draw(ctx, last.x, last.y);
}
