import { VerletRope } from "./verlet-rope";
import { YarnBall } from "./yarn-ball";
import { drawRope, drawYarnBall } from "./renderer";

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

// Expose yarn ball position (always available — yarn ball is always on)
export function getYarnBallPosition(): { x: number; y: number } | null {
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
}

function toggle() {
  setAttackersEnabled(!attackersEnabled);
}

function syncButton() {
  const btn = document.getElementById("yarn-toggle");
  if (btn) {
    btn.textContent = attackersEnabled ? "Attackers: ON" : "Attackers: OFF";
    btn.classList.toggle("yarn-toggle-off", !attackersEnabled);
  }
}

function attachButton() {
  const btn = document.getElementById("yarn-toggle");
  if (!btn) return;
  const newBtn = btn.cloneNode(true) as HTMLElement;
  btn.replaceWith(newBtn);
  newBtn.addEventListener("click", toggle);
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
  if (!isTouchDevice) return;
  const hud = document.getElementById("game-hud");
  if (hud) hud.style.display = "none";
}

document.addEventListener("astro:page-load", () => { init(); hideHudOnMobile(); });
init();
hideHudOnMobile();
