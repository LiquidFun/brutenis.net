import { MonsterManager } from "./monsters";

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let monsters: MonsterManager | null = null;
let lastTime = 0;
let animId = 0;
let initialized = false;

const YARN_BALL_RADIUS = 14;

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
  const scoreWrap = document.getElementById("game-score-wrap");
  const scoreEl = document.getElementById("game-score");
  if (!monsters) return;

  if (monsters.score > 0) {
    if (scoreWrap) scoreWrap.style.display = "";
    if (scoreEl) {
      const lvl = monsters.level > 1 ? ` (Lvl ${monsters.level})` : "";
      scoreEl.textContent = `${monsters.score}${lvl}`;
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

function checkYarnBallVsMonsters() {
  if (!monsters || monsters.gameOver) return;
  const getBallPos = (window as any).__yarnCursorGetBallPos;
  if (!getBallPos) return;
  const ballPos = getBallPos();
  if (!ballPos) return;

  const hits = monsters.checkYarnBallHit(ballPos.x, ballPos.y, YARN_BALL_RADIUS);
  if (hits > 0 && !monsters.engaged) {
    monsters.engaged = true;
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
    monsters.draw(ctx, time / 1000);
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

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  canvas = document.getElementById("yarn-game-canvas") as HTMLCanvasElement;
  if (!canvas) return;

  ctx = canvas.getContext("2d");
  if (!ctx) return;

  resize();
  monsters = new MonsterManager();

  window.addEventListener("resize", resize);

  lastTime = performance.now();
  animId = requestAnimationFrame(animate);
  initialized = true;
}

document.addEventListener("astro:page-load", () => {
  initOverlayButtons();
  if (!initialized) {
    init();
  } else if (monsters) {
    // Clear game over visuals when navigating away
    setGameOverVisuals(false);
    if (isListingPage()) {
      monsters.retarget();
    } else {
      monsters.cleanup();
    }
  }
});

init();
initOverlayButtons();
