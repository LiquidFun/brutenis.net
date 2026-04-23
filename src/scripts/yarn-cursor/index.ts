import { VerletRope } from "./verlet-rope";
import { YarnBall } from "./yarn-ball";
import { drawRope, drawYarnBall } from "./renderer";
import { GyroBall } from "./gyro-ball";

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let rope: VerletRope | null = null;
let ball: YarnBall | null = null;
let mouseX = -100;
let mouseY = -100;
let lastTime = 0;
let animId = 0;
let initialized = false;
const isTouchDevice = window.matchMedia("(hover: none)").matches;
let attackersEnabled = !isTouchDevice;

// Gyro / mobile state
let gyroBall: GyroBall | null = null;
let gyroActive = false;
let gyroLastTime = 0;
let gyroIdleTime = 0;
let gyroHasMoved = false;
let gyroHintShown = false;

// Expose yarn ball position (always available — yarn ball is always on)
export function getYarnBallPosition(): { x: number; y: number } | null {
  if (gyroActive && gyroBall) return { x: gyroBall.x, y: gyroBall.y };
  if (!rope) return null;
  const pts = rope.points;
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y };
}
(window as any).__yarnCursorGetBallPos = getYarnBallPosition;

// Expose attackers enabled state for the game module
export function areAttackersEnabled(): boolean {
  return attackersEnabled;
}
(window as any).__attackersEnabled = areAttackersEnabled;

function resize() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function animate(time: number) {
  if (!ctx || !canvas || !rope || !ball) return;

  const dt = Math.min((time - lastTime) / 1000, 0.033);
  lastTime = time;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  rope.update(mouseX, mouseY, dt);
  const points = rope.getPoints();
  drawRope(ctx, points);
  drawYarnBall(ctx, ball, points);

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

  if (value && gyroBall && canvas) {
    gyroBall.respawn(canvas.width, canvas.height);
    gyroIdleTime = 0;
    gyroHasMoved = false;
    gyroHintShown = false;
  }
  if (!value) {
    // Dismiss hint if showing
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
  hud.title = attackersEnabled ? "" : "Start Game";

  // Reset HUD contents when toggling
  const label = document.getElementById("hud-disable-label");
  const separator = document.getElementById("hud-separator");
  const scoreWrap = document.getElementById("game-score-wrap");
  if (attackersEnabled) {
    // Reset to initial "Disable Game" state; updateHUD() will take over
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
  rope = new VerletRope(mouseX, mouseY);
  ball = new YarnBall();

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

function animateGyro(time: number) {
  if (!ctx || !canvas || !gyroBall) return;
  const dt = Math.min((time - gyroLastTime) / 1000, 0.033);
  gyroLastTime = time;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (attackersEnabled) {
    gyroBall.update(dt, canvas.width, canvas.height);
    gyroBall.draw(ctx);

    // Idle hint: show after 3s of no movement
    const speed = Math.sqrt(gyroBall.vx * gyroBall.vx + gyroBall.vy * gyroBall.vy);
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

  gyroBall = new GyroBall(window.innerWidth / 2, window.innerHeight / 2);
  let lastOrientTime = performance.now();
  window.addEventListener("deviceorientation", (e: DeviceOrientationEvent) => {
    const now = performance.now();
    const dt = (now - lastOrientTime) / 1000;
    lastOrientTime = now;
    gyroBall?.setOrientation(e.beta ?? 0, e.gamma ?? 0, dt);
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
    // iOS 13+: show permission overlay, then probe after grant
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

  // Android / others: probe for real gyro data first
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
