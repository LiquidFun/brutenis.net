// Background yarn strings — taut strings that vibrate globally when the yarn ball passes

const COLORS = [
  "#ff6b6b", "#4ecdc4", "#ffe66d", "#a06cd5",
  "#ff8fab", "#74b9ff", "#55efc4", "#fdcb6e",
];

const STRING_COUNT = 15;
const HIT_RADIUS = 80;
const SPRING = 200;
const DAMP = 6;
const PUSH_MULT = 8;
const PUSH_CAP = 80;
const BASE_ALPHA = 1.00;
const DRAW_SEGS = 30;
const CHECK_SEGS = 20;

class Strand {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  nx: number;
  ny: number;
  disp = 0;
  vel = 0;
  color: string;
  alpha: number;

  constructor(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
  ) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.color = color;
    this.alpha = BASE_ALPHA + (Math.random() - 0.5) * 0.03;
    const dx = x2 - x1,
      dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    this.nx = -dy / len;
    this.ny = dx / len;
  }

  update(dt: number) {
    // Damped harmonic oscillator — whole string vibrates in fundamental mode
    this.vel += (-SPRING * this.disp - DAMP * this.vel) * dt;
    this.disp += this.vel * dt;
  }

  pushFromBall(bx: number, by: number, speed: number) {
    const dx = this.x2 - this.x1,
      dy = this.y2 - this.y1;
    let minDist = Infinity,
      bestT = 0,
      bestDot = 0;

    // Find closest point on the displaced string to the ball
    for (let i = 0; i <= CHECK_SEGS; i++) {
      const t = i / CHECK_SEGS;
      const w = Math.sin(Math.PI * t);
      const px = this.x1 + dx * t + this.nx * this.disp * w;
      const py = this.y1 + dy * t + this.ny * this.disp * w;
      const ex = bx - px,
        ey = by - py;
      const d2 = ex * ex + ey * ey;
      if (d2 < minDist) {
        minDist = d2;
        bestT = t;
        bestDot = ex * this.nx + ey * this.ny;
      }
    }

    const dist = Math.sqrt(minDist);
    if (dist < HIT_RADIUS && dist > 0) {
      const w = Math.sin(Math.PI * bestT);
      const push =
        Math.min(speed * PUSH_MULT, PUSH_CAP) * (1 - dist / HIT_RADIUS) * w;
      // Push string away from ball
      this.vel -= Math.sign(bestDot) * push;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const dx = this.x2 - this.x1,
      dy = this.y2 - this.y1;

    const trace = () => {
      ctx.moveTo(this.x1, this.y1);
      for (let i = 1; i <= DRAW_SEGS; i++) {
        const t = i / DRAW_SEGS;
        const w = Math.sin(Math.PI * t);
        ctx.lineTo(
          this.x1 + dx * t + this.nx * this.disp * w,
          this.y1 + dy * t + this.ny * this.disp * w,
        );
      }
    };

    ctx.strokeStyle = this.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Soft glow
    ctx.beginPath();
    ctx.globalAlpha = this.alpha * 0.35;
    ctx.lineWidth = 6;
    trace();
    ctx.stroke();

    // Core line
    ctx.beginPath();
    ctx.globalAlpha = this.alpha;
    ctx.lineWidth = 2.5;
    trace();
    ctx.stroke();

    ctx.globalAlpha = 1;
  }
}

// --- Module state ---

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let strands: Strand[] = [];
let prevBX = NaN,
  prevBY = NaN;
let lastTime = 0;
let initialized = false;
let remPx = 19.2; // cached rem size (120% of 16px)
const BACKDROP_REM = 72;
const FADE_PX = 60;
const CREAM = "#fef9ef";

function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const bw = BACKDROP_REM * remPx;
  if (bw >= w) return; // viewport narrower than backdrop — nothing to mask

  const left = (w - bw) / 2;
  const right = left + bw;

  // Left fade
  const gL = ctx.createLinearGradient(left - FADE_PX, 0, left, 0);
  gL.addColorStop(0, "rgba(254,249,239,0)");
  gL.addColorStop(1, CREAM);
  ctx.fillStyle = gL;
  ctx.fillRect(left - FADE_PX, 0, FADE_PX, h);

  // Solid center
  ctx.fillStyle = CREAM;
  ctx.fillRect(left, 0, bw, h);

  // Right fade
  const gR = ctx.createLinearGradient(right, 0, right + FADE_PX, 0);
  gR.addColorStop(0, CREAM);
  gR.addColorStop(1, "rgba(254,249,239,0)");
  ctx.fillStyle = gR;
  ctx.fillRect(right, 0, FADE_PX, h);
}

function generate() {
  if (!canvas) return;
  const w = canvas.width,
    h = canvas.height;
  strands = [];
  const M = 30;

  // String art: fans of strings between two edge segments create curved envelopes
  const fans = [
    {
      // Top-left corner: top edge → left edge
      a1x: 0, a1y: -M, a2x: w * 0.5, a2y: -M,
      b1x: -M, b1y: h * 0.6, b2x: -M, b2y: 0,
      colorOff: 0,
    },
    {
      // Bottom-right corner: bottom edge → right edge
      a1x: w, a1y: h + M, a2x: w * 0.5, a2y: h + M,
      b1x: w + M, b1y: h * 0.4, b2x: w + M, b2y: h,
      colorOff: 4,
    },
  ];

  const perFan = Math.ceil(STRING_COUNT / fans.length);

  for (const fan of fans) {
    const n = Math.min(perFan, STRING_COUNT - strands.length);
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0.5;
      const x1 = fan.a1x + (fan.a2x - fan.a1x) * t;
      const y1 = fan.a1y + (fan.a2y - fan.a1y) * t;
      const x2 = fan.b1x + (fan.b2x - fan.b1x) * t;
      const y2 = fan.b1y + (fan.b2y - fan.b1y) * t;
      strands.push(
        new Strand(x1, y1, x2, y2, COLORS[(i + fan.colorOff) % COLORS.length]),
      );
    }
  }

  prevBX = NaN;
  prevBY = NaN;
}

function resize() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
  generate();
}

function animate(time: number) {
  if (!ctx || !canvas) return;

  const dt = Math.min((time - lastTime) / 1000, 0.033);
  lastTime = time;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Ball interaction
  const fn = (window as any).__yarnCursorGetBallPos;
  if (fn) {
    const pos = fn();
    if (pos && !isNaN(prevBX)) {
      const dx = pos.x - prevBX,
        dy = pos.y - prevBY;
      const sp = Math.sqrt(dx * dx + dy * dy);
      if (sp > 1) {
        for (const s of strands) s.pushFromBall(pos.x, pos.y, sp);
      }
    }
    if (pos) {
      prevBX = pos.x;
      prevBY = pos.y;
    }
  }

  for (const s of strands) {
    s.update(dt);
    s.draw(ctx);
  }

  drawBackdrop(ctx, canvas.width, canvas.height);

  requestAnimationFrame(animate);
}

function init() {
  if (initialized) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  canvas = document.getElementById("yarn-bg-canvas") as HTMLCanvasElement;
  if (!canvas) return;
  ctx = canvas.getContext("2d");
  if (!ctx) return;

  resize();
  window.addEventListener("resize", resize);

  lastTime = performance.now();
  requestAnimationFrame(animate);
  initialized = true;
}

document.addEventListener("astro:page-load", () => {
  if (!initialized) init();
});
init();
