import { MonsterManager } from "./monsters";
import { UpgradeManager } from "./upgrades";

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let monsters: MonsterManager | null = null;
let upgrades: UpgradeManager | null = null;
let lastTime = 0;
let animId = 0;
let initialized = false;

const YARN_BALL_RADIUS = 14;

// Toast overlay
let toastText = "";
let toastTimer = 0;
const TOAST_DURATION = 2.0;

function showToast(msg: string) {
  toastText = msg;
  toastTimer = TOAST_DURATION;
}
(window as any).__gameShowToast = showToast;

// Persistent hint (stays until dismissed)
let hintText = "";
let hintElapsed = 0;
let hintDismissing = false;
let hintDismissTimer = 0;

function showHint(msg: string) {
  hintText = msg;
  hintElapsed = 0;
  hintDismissing = false;
  hintDismissTimer = 0;
}
function dismissHint() {
  if (hintText && !hintDismissing) {
    hintDismissing = true;
    hintDismissTimer = 0;
  }
}
(window as any).__gameShowHint = showHint;
(window as any).__gameDismissHint = dismissHint;

function drawHint(ctx: CanvasRenderingContext2D, dt: number) {
  if (!hintText) return;
  hintElapsed += dt;

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2 + 60;

  let alpha = 1, yOff = 0, scale = 1;

  if (hintDismissing) {
    hintDismissTimer += dt;
    const t = Math.min(1, hintDismissTimer / 0.4);
    alpha = 1 - t;
    yOff = -t * 20;
    scale = 1 + t * 0.05;
    if (t >= 1) { hintText = ""; return; }
  } else if (hintElapsed < 0.4) {
    const t = hintElapsed / 0.4;
    alpha = t;
    scale = 0.9 + t * 0.1;
  } else {
    // Gentle float
    const t = hintElapsed - 0.4;
    yOff = Math.sin(t * 1.5) * 4;
    alpha = 0.7 + Math.sin(t * 1.5) * 0.1;
  }

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.translate(cx, cy + yOff);
  ctx.scale(scale, scale);

  ctx.font = "bold 28px Caveat, cursive";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillText(hintText, 2, 2);
  ctx.fillStyle = "#ff6b6b";
  ctx.fillText(hintText, 0, 0);

  ctx.restore();
}

function drawToast(ctx: CanvasRenderingContext2D, dt: number) {
  if (toastTimer <= 0) return;
  toastTimer -= dt;

  const elapsed = TOAST_DURATION - toastTimer;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;

  let scale = 1, alpha = 1, yOff = 0;

  if (elapsed < 0.3) {
    const t = elapsed / 0.3;
    scale = 1 + (1 - t) * 1.5 * Math.exp(-t * 3);
    alpha = Math.min(1, elapsed / 0.1);
  } else if (elapsed < 1.5) {
    const t = elapsed - 0.3;
    scale = 1 + Math.sin(t * 4) * 0.015;
    yOff = Math.sin(t * 2.5) * 3;
  } else {
    const t = (elapsed - 1.5) / 0.5;
    alpha = 1 - t;
    yOff = -t * 25;
    scale = 1 + t * 0.08;
  }

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.translate(cx, cy + yOff);
  ctx.scale(scale, scale);

  ctx.font = "bold 52px Caveat, cursive";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillText(toastText, 3, 3);
  ctx.fillStyle = "#ff6b6b";
  ctx.fillText(toastText, 0, 0);

  ctx.restore();
}

function areAttackersEnabled(): boolean {
  const check = (window as any).__attackersEnabled;
  return check ? check() : true;
}

function isListingPage(): boolean {
  return document.querySelectorAll(".post-card, .project-card, .ctf-card").length > 0;
}

function resize() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function updateHUD() {
  const disableLabel = document.getElementById("hud-disable-label");
  const separator = document.getElementById("hud-separator");
  const scoreWrap = document.getElementById("game-score-wrap");
  const scoreEl = document.getElementById("game-score");
  if (!monsters) return;

  const s = monsters.score;
  if (s === 0) {
    if (disableLabel) disableLabel.style.display = "";
    if (separator) separator.style.display = "none";
    if (scoreWrap) scoreWrap.style.display = "none";
  } else if (s < 5) {
    if (disableLabel) disableLabel.style.display = "";
    if (separator) separator.style.display = "";
    if (scoreWrap) scoreWrap.style.display = "";
    if (scoreEl) scoreEl.textContent = String(s);
  } else {
    if (disableLabel) disableLabel.style.display = "none";
    if (separator) separator.style.display = "none";
    if (scoreWrap) scoreWrap.style.display = "";
    if (scoreEl) {
      const lvl = monsters.level > 1 ? ` (Lvl ${monsters.level})` : "";
      scoreEl.textContent = `${s}${lvl}`;
    }
  }
}

function setGameOverVisuals(on: boolean) {
  const gameCanvas = document.getElementById("yarn-game-canvas");
  const cursorCanvas = document.getElementById("yarn-cursor-canvas");
  const overlay = document.getElementById("game-over-overlay");

  if (on) {
    gameCanvas?.classList.add("canvas-greyed");
    cursorCanvas?.classList.add("canvas-greyed");
    if (overlay) overlay.style.display = "flex";
    const overScore = document.getElementById("game-over-score");
    if (overScore && monsters) overScore.textContent = String(monsters.score);
    const overLevel = document.getElementById("game-over-level");
    if (overLevel && monsters) overLevel.textContent = String(monsters.level);
  } else {
    gameCanvas?.classList.remove("canvas-greyed");
    cursorCanvas?.classList.remove("canvas-greyed");
    if (overlay) overlay.style.display = "none";
  }
}

function getAllBalls(): Array<{ x: number; y: number; radius: number }> {
  // getAllBallPositions already returns radius with bonus applied (YarnBall.radius getter)
  const getAllPositions = (window as any).__yarnCursorGetAllBallPositions;
  if (getAllPositions) {
    const balls = getAllPositions();
    if (balls.length > 0) return balls;
  }
  // Fallback to single ball (old API without bonus awareness)
  const bonus = upgrades ? upgrades.getBallRadiusBonus() : 0;
  const getBallPos = (window as any).__yarnCursorGetBallPos;
  if (!getBallPos) return [];
  const pos = getBallPos();
  if (!pos) return [];
  return [{ x: pos.x, y: pos.y, radius: YARN_BALL_RADIUS + bonus }];
}

function checkYarnBallVsMonsters() {
  if (!monsters || monsters.gameOver) return;
  const balls = getAllBalls();
  if (balls.length === 0) return;

  let totalHits = 0;
  for (const ball of balls) {
    totalHits += monsters.checkYarnBallHit(ball.x, ball.y, ball.radius);
    monsters.checkProjectileHit(ball.x, ball.y, ball.radius);
  }
  if (totalHits > 0 && !monsters.engaged) {
    monsters.engaged = true;
  }

  // Check upgrade pickup collision
  if (upgrades && monsters) {
    upgrades.checkCollision(balls, monsters.level);
  }
}

function animate(time: number) {
  if (!ctx || !canvas || !monsters) {
    animId = requestAnimationFrame(animate);
    return;
  }

  const dt = Math.min((time - lastTime) / 1000, 0.033);
  lastTime = time;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const active = areAttackersEnabled() && isListingPage();

  if (active) {
    monsters.paused = false;
    monsters.update(dt);
    checkYarnBallVsMonsters();

    // Upgrade system
    if (upgrades) {
      upgrades.checkLevelUp(monsters.level);
      const balls = getAllBalls();
      upgrades.applyMagnetForce(monsters.monsters, balls, dt);
      upgrades.healCards(dt);
      upgrades.update(dt);
    }

    monsters.draw(ctx, time / 1000);
    if (upgrades) upgrades.draw(ctx, time / 1000);
    updateHUD();

    // Check game over state transition
    if (monsters.gameOver) {
      setGameOverVisuals(true);
    }
  } else {
    if (monsters.monsters.length > 0) {
      monsters.cleanup();
    }
    monsters.paused = true;
    monsters.update(dt);
    monsters.draw(ctx, time / 1000);
  }

  drawToast(ctx, dt);
  drawHint(ctx, dt);

  animId = requestAnimationFrame(animate);
}

function initOverlayButtons() {
  const tryBtn = document.getElementById("try-again-btn");
  if (tryBtn) {
    const b = tryBtn.cloneNode(true) as HTMLElement;
    tryBtn.replaceWith(b);
    b.addEventListener("click", () => location.reload());
  }

  const disableBtn = document.getElementById("disable-attackers-btn");
  if (disableBtn) {
    const b = disableBtn.cloneNode(true) as HTMLElement;
    disableBtn.replaceWith(b);
    b.addEventListener("click", () => {
      localStorage.setItem("attackers-enabled", "false");
      location.reload();
    });
  }
}

function init() {
  if (initialized) return;

  const isTouchDevice = window.matchMedia("(hover: none)").matches;
  if (!isTouchDevice && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  canvas = document.getElementById("yarn-game-canvas") as HTMLCanvasElement;
  if (!canvas) return;

  ctx = canvas.getContext("2d");
  if (!ctx) return;

  resize();
  monsters = new MonsterManager();
  upgrades = new UpgradeManager();

  // Wire up upgrade ↔ monster interactions
  upgrades.setDamageMapAccess({
    getDamage: (key) => monsters!.getDamage(key),
    setDamage: (key, value) => monsters!.setDamage(key, value),
    cardKey: (el) => monsters!.cardKey(el),
    getAliveCards: () => monsters!.getAliveCards(),
    refreshCardVisual: (el, dmg, maxHP) => monsters!.refreshCardVisual(el, dmg, maxHP),
  });
  (window as any).__upgradeAbsorbDamage = (dmg: number) => upgrades!.absorbDamage(dmg);
  (window as any).__upgradeDamageMultiplier = () => upgrades!.getDamageMultiplier();

  window.addEventListener("resize", resize);

  lastTime = performance.now();
  animId = requestAnimationFrame(animate);
  initialized = true;
}

// ── Cheat panel (dev only) ──

function initCheatPanel() {
  if (location.hostname !== "10.0.0.2") return;
  if (document.getElementById("cheat-panel")) return;

  const panel = document.createElement("div");
  panel.id = "cheat-panel";
  Object.assign(panel.style, {
    position: "fixed",
    bottom: "12px",
    left: "12px",
    zIndex: "99999",
    background: "rgba(0,0,0,0.75)",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: "8px",
    fontFamily: "monospace",
    fontSize: "13px",
    display: "flex",
    gap: "8px",
    alignItems: "center",
  });

  const btn = document.createElement("button");
  btn.textContent = "Next Level";
  Object.assign(btn.style, {
    background: "#ff6b6b",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    padding: "4px 10px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "13px",
  });
  btn.addEventListener("click", () => {
    if (monsters) monsters.skipToNextLevel();
  });

  panel.appendChild(btn);
  document.body.appendChild(panel);
}

document.addEventListener("astro:page-load", () => {
  initOverlayButtons();
  initCheatPanel();
  if (!initialized) {
    init();
  } else if (monsters) {
    // Clear game over visuals when navigating away
    setGameOverVisuals(false);
    if (isListingPage()) {
      monsters.retarget();
    } else {
      monsters.cleanup();
      if (upgrades) upgrades.cleanup();
    }
  }
});

init();
initOverlayButtons();
initCheatPanel();
