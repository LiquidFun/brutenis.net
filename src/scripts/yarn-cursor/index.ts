import { VerletRope } from "./verlet-rope";
import { YarnBall } from "./yarn-ball";
import { drawRope, drawYarnBall } from "./renderer";
import { GyroBall } from "./gyro-ball";
import { WebAnchorManager } from "./web-anchors";

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
  /** Seconds left stuck in place, and where — see freezeBallAt(). */
  frozen: number;
  frozenX: number;
  frozenY: number;
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

// ── Spider webs pinning the yarn (see web-anchors.ts) ──
const webAnchors = new WebAnchorManager(
  () => ropes.map(r => r.rope),
  () => gyroBalls,
  () => gyroActive,
);
(window as any).__yarnCursorAttachWeb = (id: string, x: number, y: number, maxDist: number) =>
  webAnchors.attach(id, x, y, maxDist);
(window as any).__yarnCursorWebInfo = (id: string) => webAnchors.info(id);
(window as any).__yarnCursorReleaseWeb = (id: string) => webAnchors.release(id);
(window as any).__yarnCursorReleaseAllWebs = () => webAnchors.releaseAll();

// ── Visibility: hide on deeper pages (no game) or when game disabled ──
function shouldShowCursor(): boolean {
  if (!attackersEnabled) return false;
  const path = location.pathname.replace(/\/$/, "") || "/";
  // /blog/tag/* is a listing page with cards, keep cursor
  if (/^\/blog\/tag\//.test(path)) return true;
  // Hide on any deeper page (2+ path segments = individual post/project/game/ctf)
  const segments = path.split("/").filter(Boolean);
  if (segments.length >= 2) return false;
  return true;
}

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
    ropes.push({ rope: newRope, ball: newBall, color: cfg.color, frozen: 0, frozenX: 0, frozenY: 0 });
  }
}
(window as any).__yarnCursorAddBall = addBall;

// ── Remove last extra ball (called by upgrade system on deactivation) ──
function removeBall() {
  if (gyroActive) {
    if (gyroBalls.length > 1) gyroBalls.pop();
  } else {
    if (ropes.length > 1) ropes.pop();
  }
}
(window as any).__yarnCursorRemoveBall = removeBall;

// ── Apply impulse to the nearest ball (called by game for shield bounce) ──
function applyImpulse(x: number, y: number, ix: number, iy: number) {
  if (gyroActive) {
    let best = gyroBalls[0];
    let bestDist = Infinity;
    for (const gb of gyroBalls) {
      const d = (gb.x - x) ** 2 + (gb.y - y) ** 2;
      if (d < bestDist) { bestDist = d; best = gb; }
    }
    if (best) { best.vx += ix; best.vy += iy; }
  } else {
    let bestEntry = ropes[0];
    let bestDist = Infinity;
    for (const entry of ropes) {
      const pts = entry.rope.points;
      const last = pts[pts.length - 1];
      const d = (last.x - x) ** 2 + (last.y - y) ** 2;
      if (d < bestDist) { bestDist = d; bestEntry = entry; }
    }
    if (bestEntry) {
      const pts = bestEntry.rope.points;
      // Push the last few points to overcome constraint solver
      const strength = 0.04;
      const count = Math.min(5, pts.length - 1);
      for (let i = 0; i < count; i++) {
        const p = pts[pts.length - 1 - i];
        if (p.locked) continue;
        const fade = 1 - i / count;
        // Move position and inject velocity
        p.x += ix * strength * fade;
        p.y += iy * strength * fade;
        p.prevX -= ix * strength * fade;
        p.prevY -= iy * strength * fade;
      }
    }
  }
}
(window as any).__yarnCursorApplyImpulse = applyImpulse;

// ── Hard freezes (the Loom Queen's silk lines) ──
// A web is a struggle you whip out of; a freeze is a flat timed punishment for
// standing somewhere the game told you not to. It grips the ball end itself
// rather than a mid-rope point, so the ball stops dead instead of swinging.

/** Freeze the ball nearest (x, y) — same nearest-ball rule as applyImpulse. */
function freezeBallAt(x: number, y: number, seconds: number): boolean {
  if (gyroActive) {
    let best: GyroBall | null = null;
    let bestDist = Infinity;
    for (const gb of gyroBalls) {
      const d = (gb.x - x) ** 2 + (gb.y - y) ** 2;
      if (d < bestDist) { bestDist = d; best = gb; }
    }
    if (!best) return false;
    best.freeze(seconds);
    return true;
  }

  let bestEntry: RopeEntry | null = null;
  let bestDist = Infinity;
  for (const entry of ropes) {
    const pts = entry.rope.points;
    const last = pts[pts.length - 1];
    const d = (last.x - x) ** 2 + (last.y - y) ** 2;
    if (d < bestDist) { bestDist = d; bestEntry = entry; }
  }
  if (!bestEntry) return false;

  const pts = bestEntry.rope.points;
  const last = pts[pts.length - 1];
  bestEntry.frozen = Math.max(bestEntry.frozen, seconds);
  bestEntry.frozenX = last.x;
  bestEntry.frozenY = last.y;
  last.locked = true;
  return true;
}
(window as any).__yarnCursorFreezeBallAt = freezeBallAt;

/** Thaw everything — the game calls this whenever it stops running. */
function clearFreezes() {
  for (const entry of ropes) {
    if (entry.frozen <= 0) continue;
    entry.frozen = 0;
    const pts = entry.rope.points;
    pts[pts.length - 1].locked = false;
  }
  for (const gb of gyroBalls) gb.freezeLeft = 0;
}
(window as any).__yarnCursorClearFreezes = clearFreezes;

/** Re-pin frozen ball ends after the solver has run; unlock when time is up. */
function tickFreezes(dt: number) {
  for (const entry of ropes) {
    if (entry.frozen <= 0) continue;
    entry.frozen -= dt;
    const pts = entry.rope.points;
    const last = pts[pts.length - 1];
    if (entry.frozen <= 0) {
      entry.frozen = 0;
      last.locked = false;
      continue;
    }
    last.x = entry.frozenX;
    last.y = entry.frozenY;
    last.prevX = entry.frozenX;
    last.prevY = entry.frozenY;
  }
}

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

  if (shouldShowCursor()) {
    for (const entry of ropes) entry.rope.update(mouseX, mouseY, dt);
    // Re-pin webbed and frozen points after the solver has run, before anything
    // is drawn
    tickFreezes(dt);
    webAnchors.update(dt);
    // Draw extra balls first (behind primary)
    for (let i = ropes.length - 1; i >= 0; i--) {
      const entry = ropes[i];
      const points = entry.rope.getPoints();
      drawRope(ctx, points, entry.color);
      drawYarnBall(ctx, entry.ball, points);
    }
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
  // Toggling must never strand the cursor mid-freeze
  clearFreezes();
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
  // Narrow desktop windows hide the "Disable Game" wording to keep the nav on
  // one row, so the tooltip carries it instead of being empty while playing.
  hud.title = attackersEnabled ? "Disable Game" : "Start Game";

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
  ropes = [{ rope: primaryRope, ball: primaryBall, color: "#ff6b6b", frozen: 0, frozenX: 0, frozenY: 0 }];

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
  if (shouldShowCursor()) {
    // Update and draw all gyro balls (extras behind primary)
    webAnchors.update(dt);
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
  let baseBeta: number | null = null;
  let baseGamma: number | null = null;
  window.addEventListener("deviceorientation", (e: DeviceOrientationEvent) => {
    const now = performance.now();
    const dt = (now - lastOrientTime) / 1000;
    lastOrientTime = now;

    let beta = e.beta ?? 0;
    let gamma = e.gamma ?? 0;

    // Use the first reading as the neutral "zero" position so the phone's
    // orientation at load time becomes the resting point.
    if (baseBeta === null) {
      baseBeta = beta;
      baseGamma = gamma;
    }
    beta -= baseBeta;
    gamma -= baseGamma!;

    // Compensate for screen rotation: deviceorientation values are in the
    // device's physical frame, so rotate them into screen coordinates.
    const angle = screen.orientation?.angle ?? 0;
    if (angle === 90) {
      const b = beta;
      beta = -gamma;
      gamma = b;
    } else if (angle === 180) {
      beta = -beta;
      gamma = -gamma;
    } else if (angle === 270) {
      const b = beta;
      beta = gamma;
      gamma = -b;
    }

    // Feed orientation to ALL gyro balls
    for (const gb of gyroBalls) {
      gb.setOrientation(beta, gamma, dt);
    }
  });

  const saved = localStorage.getItem("attackers-enabled");
  attackersEnabled = saved !== "false";
  showHudForGyro();

  gyroLastTime = performance.now();
  requestAnimationFrame(animateGyro);
  gyroActive = true;
}

// ── Mobile bring-up ──

/** How long to wait before reporting that no sensor readings are arriving. */
const GYRO_PROBE_TIMEOUT = 3000;

/** Whatever the overlay's primary button should do now; null while it is a notice. */
let gyroGrantAction: (() => void) | null = null;
let gyroOverlayBound = false;
let gyroWatching = false;
/**
 * Mobile bring-up runs once per real page load rather than once per view
 * transition. It used to run on every `astro:page-load`, which re-raised the
 * permission dialog on each tap of the nav — and a "No thanks" only lasted until
 * the visitor opened another page. One ask per visit, and declining sticks for
 * as long as the visit does; a reload is the way back for anyone who wants it.
 */
let mobileInitDone = false;

/**
 * The overlay is `transition:persist`ed — the same buttons outlive every
 * client-side navigation — so its listeners are bound exactly once and dispatch
 * through `gyroGrantAction`. Re-binding per navigation would stack a fresh
 * handler on each one, and iOS would then fire as many permission requests.
 */
function bindGyroOverlay() {
  if (gyroOverlayBound) return;
  const grant = document.getElementById("gyro-grant-btn");
  const skip = document.getElementById("gyro-skip-btn");
  if (!grant || !skip) return;
  grant.addEventListener("click", () => {
    hideGyroOverlay();
    // Invoked straight from the click: iOS only honours requestPermission()
    // while the gesture that led to it is still being processed.
    gyroGrantAction?.();
  });
  skip.addEventListener("click", hideGyroOverlay);
  gyroOverlayBound = true;
}

function setGyroOverlay(title: string, body: string) {
  bindGyroOverlay();
  const el = document.getElementById("gyro-permission-title");
  const msg = document.getElementById("gyro-permission-body");
  const overlay = document.getElementById("gyro-permission-overlay");
  if (el) el.textContent = title;
  if (msg) msg.textContent = body;
  if (overlay) overlay.style.display = "flex";
}

function hideGyroOverlay() {
  const overlay = document.getElementById("gyro-permission-overlay");
  if (overlay) overlay.style.display = "none";
}

/** Offer to turn tilt controls on. `action` runs inside the button's click. */
function showGyroPrompt(action: () => void) {
  gyroGrantAction = action;
  const grant = document.getElementById("gyro-grant-btn");
  const skip = document.getElementById("gyro-skip-btn");
  if (grant) { grant.style.display = ""; grant.textContent = "Enable Gyroscope"; }
  if (skip) skip.textContent = "No thanks";
  setGyroOverlay(
    "Tilt to play!",
    "Tilt your phone to bounce the yarn ball and defend your blog posts from monsters.",
  );
}

/** Say why tilting is not going to work. Dismiss-only — there is nothing to grant. */
function showGyroNotice(title: string, body: string) {
  gyroGrantAction = null;
  const grant = document.getElementById("gyro-grant-btn");
  const skip = document.getElementById("gyro-skip-btn");
  if (grant) grant.style.display = "none";
  if (skip) skip.textContent = "OK";
  setGyroOverlay(title, body);
}

/**
 * Watch for the first real `deviceorientation` reading and start the game on it.
 *
 * Deliberately never gives up. The old version resolved false after 1.5s and
 * that was the end of tilt controls for the visit, which threw away every case
 * where the sensor is simply late: a cold-started sensor stack, a backgrounded
 * tab that only gets readings once it is foregrounded, or a permission the
 * visitor grants in browser settings and then comes back to. Nothing about
 * staying subscribed costs anything — no events is exactly no work.
 *
 * `onSilence` fires once if nothing has arrived by the time it is due, purely so
 * the failure can be reported; a reading after that still starts the game.
 */
function watchForGyro(onSilence?: () => void) {
  if (gyroWatching) return;
  gyroWatching = true;
  let started = false;
  const handler = (e: DeviceOrientationEvent) => {
    // Chromium delivers an all-null event on hardware with no sensor, so a
    // reading is only real if it carries an angle.
    if (e.beta == null && e.gamma == null) return;
    if (started) return;
    started = true;
    window.removeEventListener("deviceorientation", handler);
    startGyro();
  };
  window.addEventListener("deviceorientation", handler);
  if (onSilence) setTimeout(() => { if (!started) onSilence(); }, GYRO_PROBE_TIMEOUT);
}

/**
 * Bring up tilt controls, and say so when they cannot come up.
 *
 * Every failure here looks the same from the player's side — a ball that never
 * moves — so each one names itself instead. The secure-context case is the one
 * that catches people out: motion sensors are gated on https in every mobile
 * browser, so a phone pointed at a plain-http origin (the LAN dev server, most
 * often) gets no events at all, and iOS does not even expose the permission
 * prompt to ask with. That is indistinguishable from "this phone has no
 * gyroscope" unless something says which it is.
 */
function initMobile() {
  if (gyroActive || mobileInitDone) return;
  mobileInitDone = true;

  if (!window.isSecureContext) {
    showGyroNotice(
      "Tilt needs https",
      "Phone browsers only hand out motion sensors on a secure origin, so this page cannot read the tilt. Open it over https and the game works.",
    );
    return;
  }

  const DevOrient = DeviceOrientationEvent as any;
  // iOS gates orientation behind a prompt that only a user gesture may raise.
  if (typeof DevOrient?.requestPermission === "function") {
    showGyroPrompt(async () => {
      const result = await DevOrient.requestPermission().catch(() => "denied");
      if (result !== "granted") {
        showGyroNotice(
          "Motion access is off",
          "Safari declined the sensor. Look for \"Motion & Orientation Access\" in iOS Settings under Safari, turn it on, then reload.",
        );
        return;
      }
      watchForGyro(() => showGyroNotice(
        "No tilt readings",
        "Motion access was granted but this phone is not reporting any orientation. Nothing more the page can do, sorry!",
      ));
    });
    return;
  }

  // Everywhere else the sensor is simply there or not. Failing silently is the
  // right call: a visitor who never opens the game should not be told about a
  // sensor they did not ask to use.
  watchForGyro(() => console.info(
    "[yarn-cursor] No deviceorientation readings in %dms — tilt controls stay off. " +
    "On Android this is usually the browser's Motion sensors site permission, or an OS-level " +
    "sensor block (GrapheneOS ships one per app).",
    GYRO_PROBE_TIMEOUT,
  ));
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
