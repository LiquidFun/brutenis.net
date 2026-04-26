const YARN_COLORS = [
  "#ff6b6b", "#4ecdc4", "#a06cd5", "#ff8fab",
  "#74b9ff", "#55efc4", "#fdcb6e", "#e17055",
];

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let initialized = false;
let currentColor = YARN_COLORS[0];

const TEXT = "brutenis.net";
const FONT_SIZE = 36;

// For each letter, store multiple random stroke offsets
// Each "pass" draws the letter slightly offset, creating a sketchy hand-drawn look
interface LetterWobble {
  passes: { dx: number; dy: number; thickness: number; alpha: number }[];
  baseX: number;
}

let letterWobbles: LetterWobble[] = [];

function generateWobble() {
  if (!ctx) return;
  ctx.font = `bold ${FONT_SIZE}px Caveat, cursive`;

  letterWobbles = [];
  let x = 0;

  for (let i = 0; i < TEXT.length; i++) {
    const charW = ctx.measureText(TEXT[i]).width;
    const passes = [];

    // 3 overlapping stroke passes per letter, each slightly offset
    for (let p = 0; p < 3; p++) {
      passes.push({
        dx: (Math.random() - 0.5) * 2.0,
        dy: (Math.random() - 0.5) * 2.0,
        thickness: 0.8 + Math.random() * 0.8,
        alpha: p === 0 ? 1 : 0.3 + Math.random() * 0.3,
      });
    }

    letterWobbles.push({ passes, baseX: x });
    x += charW;
  }

  currentColor = YARN_COLORS[Math.floor(Math.random() * YARN_COLORS.length)];
}

function drawLogo() {
  if (!ctx || !canvas) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const totalWidth = letterWobbles.length > 0
    ? letterWobbles[letterWobbles.length - 1].baseX + ctx.measureText(TEXT[TEXT.length - 1]).width
    : 0;
  const isMobile = window.matchMedia("(max-width: 639px)").matches;
  const startX = isMobile ? (canvas.width - totalWidth) / 2 : 4;
  const y = canvas.height / 2;

  ctx.font = `bold ${FONT_SIZE}px Caveat, cursive`;
  ctx.textBaseline = "middle";

  for (let i = 0; i < TEXT.length; i++) {
    const lw = letterWobbles[i];
    if (!lw) continue;

    // Draw multiple passes (sketchy hand-drawn effect)
    for (const pass of lw.passes) {
      ctx.save();
      ctx.globalAlpha = pass.alpha;
      ctx.lineWidth = pass.thickness;
      ctx.strokeStyle = currentColor;
      ctx.fillStyle = currentColor;

      const px = startX + lw.baseX + pass.dx;
      const py = y + pass.dy;

      if (pass === lw.passes[0]) {
        // Primary pass: filled
        ctx.fillText(TEXT[i], px, py);
      } else {
        // Secondary passes: stroke only for sketch effect
        ctx.strokeText(TEXT[i], px, py);
      }

      ctx.restore();
    }
  }
}

let timerId: ReturnType<typeof setTimeout> | null = null;

function scheduleRedraw() {
  timerId = setTimeout(() => {
    if (!ctx || !canvas) return;
    generateWobble();
    drawLogo();
    scheduleRedraw();
  }, 1000);
}

function init() {
  if (initialized) return;

  const logoEl = document.getElementById("animated-logo");
  if (!logoEl) return;

  canvas = document.createElement("canvas");
  canvas.width = 264;
  canvas.height = 53;
  canvas.style.cursor = "pointer";
  canvas.style.display = "block";

  ctx = canvas.getContext("2d");
  if (!ctx) return;

  logoEl.textContent = "";
  logoEl.appendChild(canvas);

  generateWobble();
  drawLogo();

  scheduleRedraw();
  initialized = true;
}

document.addEventListener("astro:page-load", () => {
  const logoEl = document.getElementById("animated-logo");
  if (logoEl && !logoEl.querySelector("canvas")) {
    initialized = false;
    init();
  }
});

init();
