import { VerletRope } from "./verlet-rope";
import { YarnBall } from "./yarn-ball";
import { drawRope, drawYarnBall } from "./renderer";
import { GyroBall } from "./gyro-ball";

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let mouseX = -100;
let mouseY = -100;
let lastTime = 0;
let animId = 0;
let initialized = false;
const isTouchDevice = window.matchMedia("(hover: none)").matches;
let attackersEnabled = !isTouchDevice;

// ── Multi-ball state (desktop) ──
interface RopeEntry {
  rope: VerletRope;
  ball: YarnBall;
  color: string;
}
let ropes: RopeEntry[] = [];

// ── Multi-ball state (mobile) ──
let gyroBalls: GyroBall[] = [];
let gyroActive = false;
let gyroLastTime = 0;
let gyroIdleTime = 0;
let gyroHasMoved = false;
let gyroHintShown = false;

// ── Radius bonus from upgrades ──
let ballRadiusBonus = 0;

// ── Extra ball configs ──
const EXTRA_ROPE_CONFIGS = [
  { numPoints: 15, segLen: 10, color: "#74b9ff" },
  { numPoints: 12, segLen: 14, color: "#a06cd5" },
  { numPoints: 18, segLen: 9, color: "#55efc4" },
];

const EXTRA_GYRO_CONFIGS = [
  { gravScale: 55, color: "#74b9ff" },
  { gravScale: 65, color: "#a06cd5" },
  { gravScale: 50, color: "#55efc4" },
];

// ── Expose primary ball position (backward compat) ──
export function getYarnBallPosition(): { x: number; y: number } | null {
  if (gyroActive && gyroBalls.length > 0) {
    return { x: gyroBalls[0].x, y: gyroBalls[0].y };
  }
  if (ropes.length > 0) {
    const pts = ropes[0].rope.points;
    const last = pts[pts.length - 1];
    return { x: last.x, y: last.y };
  }
  return null;
}
(window as any).__yarnCursorGetBallPos = getYarnBallPosition;

// ── Expose all ball positions (for multi-ball hit detection) ──
function getAllBallPositions(): Array<{ x: number; y: number; radius: number }> {
  if (gyroActive) {
    return gyroBalls.map((gb) => ({
      x: gb.x,
      y: gb.y,
      radius: gb.radius,
    }));
  }
  return ropes.map((entry) => {
    const pts = entry.rope.points;
    const last = pts[pts.length - 1];
    return { x: last.x, y: last.y, radius: entry.ball.radius };
  });
}
(window as any).__yarnCursorGetAllBallPositions = getAllBallPositions;

// ── Add extra ball (called by upgrade system) ──
function addBall() {
  if (gyroActive) {
    const idx = gyroBalls.length - 1; // 0-indexed into extra configs
    if (idx >= EXTRA_GYRO_CONFIGS.length) return;
    const cfg = EXTRA_GYRO_CONFIGS[idx];
    const gb = new GyroBall(
      window.innerWidth / 2 + (Math.random() - 0.5) * 100,
      window.innerHeight / 2 + (Math.random() - 0.5) * 100,
      cfg.gravScale,
      cfg.color,
    );
    gb.visual.radiusBonus = ballRadiusBonus;
    // Share orientation from primary
    gyroBalls.push(gb);
  } else {
    const idx = ropes.length - 1; // 0-indexed into extra configs
    if (idx >= EXTRA_ROPE_CONFIGS.length) return;
    const cfg = EXTRA_ROPE_CONFIGS[idx];
    const newRope = new VerletRope(mouseX, mouseY, cfg.numPoints, cfg.segLen);
    const newBall = new YarnBall(14, cfg.color);
    newBall.radiusBonus = ballRadiusBonus;
    ropes.push({ rope: newRope, ball: newBall, color: cfg.color });
  }
}
(window as any).__yarnCursorAddBall = addBall;

// ── Set radius bonus (called by upgrade system) ──
function setRadiusBonus(bonus: number) {
  ballRadiusBonus = bonus;
  for (const entry of ropes) {
    entry.ball.radiusBonus = bonus;
  }
  for (const gb of gyroBalls) {
    gb.visual.radiusBonus = bonus;
  }
}
(window as any).__yarnCursorSetRadiusBonus = setRadiusBonus;

// ── Expose attackers enabled state ──
export function areAttackersEnabled(): boolean {
  return attackersEnabled;
}
(window as any).__attackersEnabled = areAttackersEnabled;

function resize() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// ── Desktop animate ──
function animate(time: number) {
  if (!ctx || !canvas || ropes.length === 0) return;

  const dt = Math.min((time - lastTime) / 1000, 0.033);
  lastTime = time;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw extra balls first (behind primary)
  for (let i = ropes.length - 1; i >= 0; i--) {
    const entry = ropes[i];
    entry.rope.update(mouseX, mouseY, dt);
    const points = entry.rope.getPoints();
    drawRope(ctx, points, entry.color);
    drawYarnBall(ctx, entry.ball, points);
  }

  animId = requestAnimationFrame(animate);
}

function onMouseMove(e: MouseEvent) {
  mouseX = e.clientX;
  mouseY = e.clientY;
}

function onTouchMove(e: TouchEvent) {
  if (e.touches.length > 0) {
    mouseX = e.touches[0].clientX;
    mouseY = e.touches[0].clientY;
  }
}

function setAttackersEnabled(value: boolean) {
  attackersEnabled = value;
  localStorage.setItem("attackers-enabled", String(attackersEnabled));
  syncButton();
  const toast = (window as any).__gameShowToast;
  if (toast) toast(value ? "Game Enabled" : "Game Disabled");

  if (value && gyroBalls.length > 0 && canvas) {
    for (const gb of gyroBalls) {
      gb.respawn(canvas.width, canvas.height);
    }
    gyroIdleTime = 0;
    gyroHasMoved = false;
    gyroHintShown = false;
  }
  if (!value) {
    const dismissHint = (window as any).__gameDismissHint;
    if (dismissHint) dismissHint();
  }
}

function toggle() {
  setAttackersEnabled(!attackersEnabled);
}

function syncButton() {
  const hud = document.getElementById("game-hud");
  if (!hud) return;
  hud.classList.toggle("game-hud-collapsed", !attackersEnabled);

  const label = document.getElementById("hud-disable-label");
  const separator = document.getElementById("hud-separator");
  const scoreWrap = document.getElementById("game-score-wrap");
  if (attackersEnabled) {
    if (label) label.style.display = "";
    if (separator) separator.style.display = "none";
    if (scoreWrap) scoreWrap.style.display = "none";
  }
}

let hudListenerAttached = false;
function attachButton() {
  const hud = document.getElementById("game-hud");
  if (hud && !hudListenerAttached) {
    hud.addEventListener("click", () => {
      setAttackersEnabled(!attackersEnabled);
    });
    hudListenerAttached = true;
  }

  syncButton();
}

function init() {
  if (window.matchMedia("(hover: none)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const saved = localStorage.getItem("attackers-enabled");
  if (saved === "false") attackersEnabled = false;
  attachButton();

  if (initialized) return;

  canvas = document.getElementById("yarn-cursor-canvas") as HTMLCanvasElement;
  if (!canvas) return;

  ctx = canvas.getContext("2d");
  if (!ctx) return;

  resize();
  // Primary rope + ball
  const primaryRope = new VerletRope(mouseX, mouseY);
  const primaryBall = new YarnBall();
  ropes = [{ rope: primaryRope, ball: primaryBall, color: "#ff6b6b" }];

  window.addEventListener("resize", resize);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("touchmove", onTouchMove, { passive: true });

  lastTime = performance.now();
  animId = requestAnimationFrame(animate);
  initialized = true;
}

function hideHudOnMobile() {
  if (!isTouchDevice || gyroActive) return;
  const hud = document.getElementById("game-hud");
  if (hud) hud.style.display = "none";
}

function showHudForGyro() {
  const hud = document.getElementById("game-hud");
  if (hud) hud.style.display = "flex";
  attachButton();
  syncButton();
}

// ── Mobile animate ──
function animateGyro(time: number) {
  if (!ctx || !canvas || gyroBalls.length === 0) return;
  const dt = Math.min((time - gyroLastTime) / 1000, 0.033);
  gyroLastTime = time;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (attackersEnabled) {
    // Update and draw all gyro balls (extras behind primary)
    for (let i = gyroBalls.length - 1; i >= 0; i--) {
      gyroBalls[i].update(dt, canvas.width, canvas.height);
      gyroBalls[i].draw(ctx);
    }

    // Idle hint: check primary ball only
    const primary = gyroBalls[0];
    const speed = Math.sqrt(primary.vx * primary.vx + primary.vy * primary.vy);
    if (speed > 50) {
      gyroHasMoved = true;
      gyroIdleTime = 0;
      if (gyroHintShown) {
        gyroHintShown = false;
        const dismiss = (window as any).__gameDismissHint;
        if (dismiss) dismiss();
      }
    } else if (!gyroHasMoved) {
      gyroIdleTime += dt;
      if (gyroIdleTime > 3 && !gyroHintShown) {
        gyroHintShown = true;
        const showHint = (window as any).__gameShowHint;
        if (showHint) showHint("Tilt your phone to roll the ball!");
      }
    }
  }
  requestAnimationFrame(animateGyro);
}

function startGyro() {
  if (gyroActive) return;
  canvas = document.getElementById("yarn-cursor-canvas") as HTMLCanvasElement;
  if (!canvas) return;
  ctx = canvas.getContext("2d");
  if (!ctx) return;

  resize();
  window.addEventListener("resize", resize);

  // Primary gyro ball
  const primaryGyro = new GyroBall(window.innerWidth / 2, window.innerHeight / 2);
  gyroBalls = [primaryGyro];

  let lastOrientTime = performance.now();
  window.addEventListener("deviceorientation", (e: DeviceOrientationEvent) => {
    const now = performance.now();
    const dt = (now - lastOrientTime) / 1000;
    lastOrientTime = now;
    // Feed orientation to ALL gyro balls
    for (const gb of gyroBalls) {
      gb.setOrientation(e.beta ?? 0, e.gamma ?? 0, dt);
    }
  });

  const saved = localStorage.getItem("attackers-enabled");
  attackersEnabled = saved !== "false";
  showHudForGyro();

  gyroLastTime = performance.now();
  requestAnimationFrame(animateGyro);
  gyroActive = true;
}

/** Wait for a real deviceorientation event before starting; timeout → no gyro. */
function probeGyro(): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    const handler = (e: DeviceOrientationEvent) => {
      if (e.beta == null && e.gamma == null) return;
      if (resolved) return;
      resolved = true;
      window.removeEventListener("deviceorientation", handler);
      resolve(true);
    };
    window.addEventListener("deviceorientation", handler);
    setTimeout(() => {
      if (resolved) return;
      resolved = true;
      window.removeEventListener("deviceorientation", handler);
      resolve(false);
    }, 1500);
  });
}

async function initMobile() {
  if (gyroActive) return;

  const DevOrient = DeviceOrientationEvent as any;
  const needsPermission = typeof DevOrient?.requestPermission === "function";

  if (needsPermission) {
    const overlay = document.getElementById("gyro-permission-overlay");
    if (overlay) overlay.style.display = "flex";

    document.getElementById("gyro-grant-btn")?.addEventListener(
      "click",
      async () => {
        if (overlay) overlay.style.display = "none";
        const result = await DevOrient.requestPermission().catch(() => "denied");
        if (result === "granted") {
          const hasGyro = await probeGyro();
          if (hasGyro) startGyro();
        }
      },
      { once: true },
    );

    document.getElementById("gyro-skip-btn")?.addEventListener(
      "click",
      () => {
        if (overlay) overlay.style.display = "none";
      },
      { once: true },
    );
    return;
  }

  const hasGyro = await probeGyro();
  if (hasGyro) startGyro();
}

function bootstrap() {
  if (isTouchDevice) {
    hideHudOnMobile();
    initMobile();
  } else {
    init();
  }
}

document.addEventListener("astro:page-load", bootstrap);
bootstrap();
