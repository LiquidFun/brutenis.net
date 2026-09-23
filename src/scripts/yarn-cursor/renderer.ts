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

/**
 * The yarn alight — what a combo looks like (see monsters.ts).
 *
 * Drawn under the ball so the wound yarn still reads as yarn, in the same
 * chunky pixels as everything else the game draws. Deterministic flicker from
 * `time`: a fire made of Math.random() boils rather than burns.
 */
export function drawFlames(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  time: number,
) {
  const prevAlpha = ctx.globalAlpha;

  // Heat haze, so the ball reads as glowing rather than merely decorated
  const glow = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius * 2.6);
  glow.addColorStop(0, "rgba(255, 215, 0, 0.55)");
  glow.addColorStop(0.5, "rgba(243, 156, 18, 0.25)");
  glow.addColorStop(1, "rgba(243, 156, 18, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 2.6, 0, Math.PI * 2);
  ctx.fill();

  // Tongues: each one climbs, narrows and dies on its own schedule
  const tongues = 9;
  for (let i = 0; i < tongues; i++) {
    const phase = (time * 1.9 + i / tongues) % 1;
    const spread = Math.sin(i * 2.4) * radius * 0.9;
    const wobble = Math.sin(time * 9 + i * 1.7) * radius * 0.25;
    const fx = x + spread * (1 - phase * 0.4) + wobble;
    const fy = y - phase * radius * 2.4;
    const size = Math.max(1.5, radius * (0.5 - phase * 0.35));
    ctx.globalAlpha = (1 - phase) * 0.85;
    ctx.fillStyle = phase < 0.3 ? "#ffffff" : phase < 0.6 ? "#ffd32a" : "#e67e22";
    ctx.fillRect(Math.round(fx - size / 2), Math.round(fy - size / 2), size, size);
  }

  ctx.globalAlpha = prevAlpha;
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
