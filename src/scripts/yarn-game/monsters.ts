const MONSTER_COLORS = [
  { body: "#6c3483", eye: "#e74c3c", wing: "#8e44ad" },
  { body: "#1a5276", eye: "#f39c12", wing: "#2980b9" },
  { body: "#7b241c", eye: "#f1c40f", wing: "#c0392b" },
  { body: "#0e6655", eye: "#e74c3c", wing: "#148f77" },
  { body: "#4a235a", eye: "#2ecc71", wing: "#7d3c98" },
];

const SHOOTER_COLORS = [
  { body: "#922b21", eye: "#f1c40f", ring: "#e74c3c" },
  { body: "#4a235a", eye: "#00cec9", ring: "#9b59b6" },
  { body: "#0b5345", eye: "#ff6348", ring: "#2ed573" },
];

const SHOOTER_FIRST_LEVEL = 5;
const SHOOTER_ORBIT_SPEED = 0.4;
const SHOOTER_ORBIT_PADDING = 130;
const SHOOTER_COOLDOWN = 2.5;
const SHOOTER_CHARGE_TIME = 0.8;
const PROJECTILE_SPEED = 250;
const PROJECTILE_DAMAGE = 0.25;

const SHIELDED_FIRST_LEVEL = 7;
const SHIELDED_SCORE = 5;
const SHIELDED_SHIELD_COLOR = "#7f8c8d";
const SHIELDED_SHIELD_GLOW = "#ecf0f1";

const MAX_CARD_HP = 5;
const DAMAGE_PER_SECOND = 0.5;

// ── Crack system: each monster grows its own crack tree on its target card ──

interface CrackNode {
  x: number; y: number; // card-local 0..1 coords
  angle: number;        // this node's growth direction
  depth: number;        // 0 = root, increases with each generation
  children: CrackNode[];
}

interface CrackTree {
  root: CrackNode;
  monsterKey: string;
}

const cardCracks = new Map<string, CrackTree[]>();
const crackLastUpdate = new Map<string, number>();
const CRACK_UPDATE_INTERVAL = 1.0; // seconds between crack growth/render updates

/** Extend tip nodes of a crack tree — grows multiple nodes per call */
function extendCrackTree(tree: CrackTree, growCount: number = 10) {
  for (let g = 0; g < growCount; g++) {
    const tips: CrackNode[] = [];
    function walk(n: CrackNode) {
      if (n.children.length === 0) tips.push(n);
      else for (const c of n.children) walk(c);
    }
    walk(tree.root);

    if (tips.length === 0) return;

    const tip = tips[Math.floor(Math.random() * tips.length)];

    const jitter = (Math.random() - 0.5) * (0.5 + tip.depth * 0.1);
    const newAngle = tip.angle + jitter;
    const len = Math.max(0.02, 0.05 - tip.depth * 0.003) + Math.random() * 0.03;
    const child: CrackNode = {
      x: tip.x + Math.cos(newAngle) * len,
      y: tip.y + Math.sin(newAngle) * len,
      angle: newAngle,
      depth: tip.depth + 1,
      children: [],
    };
    tip.children.push(child);

    // Branch with a wide fork
    if (tips.length < 6 && tip.depth > 2 && Math.random() < 0.12) {
      const sign = Math.random() > 0.5 ? 1 : -1;
      const branchAngle = tip.angle + sign * (0.6 + Math.random() * 0.8);
      const blen = len * (0.6 + Math.random() * 0.3);
      tip.children.push({
        x: tip.x + Math.cos(branchAngle) * blen,
        y: tip.y + Math.sin(branchAngle) * blen,
        angle: branchAngle,
        depth: tip.depth + 1,
        children: [],
      });
    }
  }
}

function getOrCreateCrackTree(cardKeyStr: string, monsterKey: string, startX: number, startY: number, angle: number): CrackTree {
  if (!cardCracks.has(cardKeyStr)) cardCracks.set(cardKeyStr, []);
  const trees = cardCracks.get(cardKeyStr)!;
  let tree = trees.find(t => t.monsterKey === monsterKey);
  if (!tree) {
    tree = {
      root: { x: startX, y: startY, angle, depth: 0, children: [] },
      monsterKey,
    };
    trees.push(tree);
  }
  return tree;
}

/** Render cracks with tapering: thicker at base, thinner at tips */
function renderCracks(trees: CrackTree[], w: number, h: number, baseStrokeW: number, alpha: number): string {
  // Group segments by depth for different stroke widths
  const depthPaths = new Map<number, string>();
  let maxDepth = 0;

  function walk(parent: CrackNode) {
    for (const c of parent.children) {
      const d = parent.depth;
      if (d > maxDepth) maxDepth = d;
      const existing = depthPaths.get(d) || "";
      depthPaths.set(d, existing +
        `M${(parent.x * w).toFixed(1)} ${(parent.y * h).toFixed(1)}L${(c.x * w).toFixed(1)} ${(c.y * h).toFixed(1)}`);
      walk(c);
    }
  }
  for (const tree of trees) walk(tree.root);

  if (depthPaths.size === 0) return "";

  let paths = "";
  for (const [depth, d] of depthPaths) {
    // Stroke tapers: baseStrokeW at depth 0, thins out with depth
    const sw = Math.max(0.6, baseStrokeW * (1 - depth / (maxDepth + 10)));
    const a = Math.max(0.15, alpha * (1 - depth * 0.04));
    paths += `<path d="${d}" stroke="rgba(70,30,30,${a.toFixed(2)})" stroke-width="${sw.toFixed(1)}" fill="none" stroke-linejoin="bevel"/>`;
  }

  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
}

function applyCrackOverlay(el: Element, pct: number) {
  const html = el as HTMLElement;
  const key = cardKey(el);
  if (!html.classList.contains("card-cracked")) html.classList.add("card-cracked");
  let overlay = html.querySelector(".card-crack-overlay") as HTMLElement | null;
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "card-crack-overlay";
    html.appendChild(overlay);
  }
  const trees = cardCracks.get(key) || [];
  const rect = getCachedRect(html);
  const strokeW = 1.8 + pct * 2.2;
  const alpha = 0.35 + pct * 0.45;
  overlay.innerHTML = renderCracks(trees, rect.width, rect.height, strokeW, alpha);
}

// ── HP indicator + destroyed label helpers ──

function updateHpIndicator(el: Element, dmg: number, level: number) {
  const html = el as HTMLElement;
  let indicator = html.querySelector(".card-hp-indicator") as HTMLElement | null;

  if (level < 5 || dmg <= 0) {
    if (indicator) indicator.remove();
    return;
  }

  const hpPct = Math.max(0, Math.round((1 - dmg / MAX_CARD_HP) * 100));

  if (!indicator) {
    indicator = document.createElement("div");
    indicator.className = "card-hp-indicator";
    html.appendChild(indicator);
  }

  indicator.textContent = `${hpPct}%`;
  indicator.classList.remove("hp-high", "hp-mid", "hp-low");
  if (hpPct > 60) indicator.classList.add("hp-high");
  else if (hpPct > 30) indicator.classList.add("hp-mid");
  else indicator.classList.add("hp-low");
}

function addDestroyedLabel(el: Element) {
  const html = el as HTMLElement;
  if (html.querySelector(".card-destroyed-label")) return;
  // Remove HP indicator when destroyed
  const indicator = html.querySelector(".card-hp-indicator");
  if (indicator) indicator.remove();
  const label = document.createElement("div");
  label.className = "card-destroyed-label";
  label.textContent = "DESTROYED";
  html.appendChild(label);
}

// ── Types ──

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
}

interface Projectile {
  x: number; y: number;
  targetEl: Element;
  shooterId: string;
  life: number;
  color: string;
}

interface Monster {
  x: number; y: number; vx: number; vy: number;
  targetT: number; targetX: number; targetY: number;
  size: number; hitRadius: number;
  colorIdx: number; wingPhase: number;
  alive: boolean; spawnAnim: number;
  eatingTimer: number; targetEl: Element | null;
  hp: number; isBig: boolean; isHuge: boolean; flashTimer: number;
  id: string;
  isShooter: boolean;
  orbitAngle: number;
  shootCooldown: number;
  isShielded: boolean;
  shieldSegments: number;
  shieldFlash: number[];
}

let monsterIdCounter = 0;

// ── Persistence ──

const damageMap = new Map<string, number>();
const destroyedPerPath = new Map<string, Set<string>>();

function cardKey(el: Element): string {
  const a = el.querySelector("a[href]");
  return a?.getAttribute("href") || el.textContent?.slice(0, 60) || "";
}

function getDestroyedSet(): Set<string> {
  const path = location.pathname;
  if (!destroyedPerPath.has(path)) destroyedPerPath.set(path, new Set());
  return destroyedPerPath.get(path)!;
}

function pointOnPerimeter(rect: DOMRect, t: number): { x: number; y: number } {
  const perim = 2 * (rect.width + rect.height);
  let d = t * perim;
  if (d < rect.width) return { x: rect.left + d, y: rect.top };
  d -= rect.width;
  if (d < rect.height) return { x: rect.right, y: rect.top + d };
  d -= rect.height;
  if (d < rect.width) return { x: rect.right - d, y: rect.bottom };
  d -= rect.width;
  return { x: rect.left, y: rect.top + rect.height - d };
}

// ── Scroll tracking ──
let prevScrollY = 0;

// ── Cached card elements (refreshed on navigation) ──
let cachedCardElements: Element[] = [];

// ── Frame-scoped rect cache ──
let rectCacheFrame = -1;
const rectCache = new Map<Element, DOMRect>();

export function getCachedRect(el: Element): DOMRect {
  let cached = rectCache.get(el);
  if (cached) return cached;
  cached = (el as HTMLElement).getBoundingClientRect();
  rectCache.set(el, cached);
  return cached;
}

function newRectCacheFrame() {
  rectCacheFrame++;
  rectCache.clear();
}

// ── In-place array compaction (avoids .filter() allocation) ──
function compact<T>(arr: T[], keep: (item: T) => boolean): void {
  let w = 0;
  for (let i = 0; i < arr.length; i++) {
    if (keep(arr[i])) { if (i !== w) arr[w] = arr[i]; w++; }
  }
  arr.length = w;
}

// ── Manager ──

export class MonsterManager {
  monsters: Monster[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  eatParticles: Particle[] = [];
  score: number = 0;
  maxMonsters: number = 3;
  spawnTimer: number = 99;
  spawnInterval: number = 1.2;
  engaged: boolean = false;
  engageTimer: number = 0;
  level: number = 1;
  prevLevel: number = 1;
  levelUpTimer: number = 0;
  gameOver: boolean = false;
  paused: boolean = false;
  private mobile: boolean;
  private levelThresholds = [
    5, 15, 30, 50, 80, 120, 170, 230, 300,  // levels 2–10
    380, 470, 570, 680, 800, 930, 1070, 1220, 1380, 1550, // levels 11–20
    1740, 1950, 2180, 2430, 2700, 3000, 3330, 3690, 4080, 4500, // levels 21–30
    4960, 5460, 6000, 6600, 7260, 7980, 8770, 9630, 10570, 11600, // levels 31–40
    12730, 13970, 15330, 16820, 18450, 20240, 22200, 24350, 26700, // levels 41–49
  ];

  constructor() {
    this.mobile = window.matchMedia("(hover: none)").matches;
  }

  refreshCardCache() {
    cachedCardElements = [...document.querySelectorAll(".post-card, .project-card, .ctf-card")];
  }

  getAliveCards(): Element[] {
    const destroyed = getDestroyedSet();
    return cachedCardElements.filter(el => !destroyed.has(cardKey(el)));
  }

  cardKey(el: Element): string {
    return cardKey(el);
  }

  getDamage(key: string): number {
    return damageMap.get(key) || 0;
  }

  setDamage(key: string, value: number) {
    if (value <= 0) {
      damageMap.delete(key);
    } else {
      damageMap.set(key, value);
    }
  }

  refreshCardVisual(el: Element, dmg: number, maxHP: number) {
    const html = el as HTMLElement;
    const key = cardKey(el);
    updateHpIndicator(el, dmg, this.level);
    if (dmg <= 0) {
      html.style.filter = "";
      html.classList.remove("card-cracked");
      const overlay = html.querySelector(".card-crack-overlay");
      if (overlay) overlay.remove();
      cardCracks.delete(key);
    } else {
      const pct = dmg / maxHP;
      const gs = pct * 0.85;
      const br = 1 - pct * 0.3;
      html.style.filter = `grayscale(${gs.toFixed(2)}) brightness(${br.toFixed(2)})`;
      if (pct > 0.05 && cardCracks.has(key)) applyCrackOverlay(el, pct);
    }
  }

  private findTarget(): { x: number; y: number; t: number; el: Element } | null {
    const cards = this.getAliveCards();
    if (cards.length === 0) return null;
    const card = cards[Math.floor(Math.random() * cards.length)];
    const rect = getCachedRect(card);
    const t = Math.random();
    const pt = pointOnPerimeter(rect, t);
    return { x: pt.x, y: pt.y, t, el: card };
  }

  private spawnOffScreen(): { x: number; y: number } {
    const side = Math.floor(Math.random() * 4);
    const m = 20;
    switch (side) {
      case 0: return { x: Math.random() * window.innerWidth, y: -m };
      case 1: return { x: window.innerWidth + m, y: Math.random() * window.innerHeight };
      case 2: return { x: Math.random() * window.innerWidth, y: window.innerHeight + m };
      default: return { x: -m, y: Math.random() * window.innerHeight };
    }
  }

  private spawnShielded(target: { x: number; y: number; t: number; el: Element }) {
    const pos = this.spawnOffScreen();
    const segments = [1, 3, 5, 7][Math.floor(Math.random() * 4)];
    this.monsters.push({
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      targetT: target.t, targetX: target.x, targetY: target.y,
      size: 38, hitRadius: 76,
      colorIdx: Math.floor(Math.random() * MONSTER_COLORS.length),
      wingPhase: Math.random() * Math.PI * 2,
      alive: true, spawnAnim: 0, eatingTimer: 0, targetEl: target.el,
      hp: 1, isBig: true, isHuge: false, flashTimer: 0,
      id: `m${monsterIdCounter++}`,
      isShooter: false, orbitAngle: 0, shootCooldown: 0,
      isShielded: true, shieldSegments: segments, shieldFlash: new Array(8).fill(0),
    });
  }

  spawn() {
    if (this.monsters.length >= this.maxMonsters) return;
    if (this.gameOver) return;
    const target = this.findTarget();
    if (!target) return;

    // Level 7: only shielded enemies
    if (this.level === SHIELDED_FIRST_LEVEL) {
      this.spawnShielded(target);
      return;
    }

    // Shielded chance at level 8+
    if (this.level > SHIELDED_FIRST_LEVEL && Math.random() < 0.15) {
      this.spawnShielded(target);
      return;
    }

    // Shooter chance: 50% at level 5, tapering to 20% at higher levels
    const shooterChance = this.level >= SHOOTER_FIRST_LEVEL
      ? Math.max(0.2, 0.5 - (this.level - SHOOTER_FIRST_LEVEL) * 0.06)
      : 0;
    if (Math.random() < shooterChance) {
      const pos = this.spawnOffScreen();
      this.monsters.push({
        x: pos.x, y: pos.y, vx: 0, vy: 0,
        targetT: target.t, targetX: target.x, targetY: target.y,
        size: 34, hitRadius: 68,
        colorIdx: Math.floor(Math.random() * SHOOTER_COLORS.length),
        wingPhase: Math.random() * Math.PI * 2,
        alive: true, spawnAnim: 0, eatingTimer: 0, targetEl: target.el,
        hp: 2, isBig: false, isHuge: false, flashTimer: 0,
        id: `m${monsterIdCounter++}`,
        isShooter: true, orbitAngle: Math.random() * Math.PI * 2,
        shootCooldown: SHOOTER_COOLDOWN,
        isShielded: false, shieldSegments: 0, shieldFlash: [],
      });
      return;
    }

    const canSpawnBig = this.level >= 6;
    const canSpawnHuge = this.level >= 10;
    const roll = Math.random();
    const isHuge = canSpawnHuge && roll < 0.15;
    const isBig = !isHuge && canSpawnBig && roll < 0.40;

    let size: number, hp: number;
    if (isHuge) {
      size = 50 + Math.random() * 15;
      hp = 4 + Math.floor((this.level - 9) / 3);
    } else if (isBig) {
      size = 35 + Math.random() * 10;
      hp = 2 + Math.floor((this.level - 5) / 3);
    } else {
      size = 20 + Math.random() * 8;
      hp = 1;
    }

    const pos = this.spawnOffScreen();

    this.monsters.push({
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      targetT: target.t, targetX: target.x, targetY: target.y,
      size, hitRadius: size * 2.0,
      colorIdx: Math.floor(Math.random() * MONSTER_COLORS.length),
      wingPhase: Math.random() * Math.PI * 2,
      alive: true, spawnAnim: 0, eatingTimer: 0, targetEl: target.el,
      hp, isBig: isBig || isHuge, isHuge, flashTimer: 0,
      id: `m${monsterIdCounter++}`,
      isShooter: false, orbitAngle: 0, shootCooldown: 0,
      isShielded: false, shieldSegments: 0, shieldFlash: [],
    });
  }

  checkYarnBallHit(ballX: number, ballY: number, ballRadius: number): number {
    let hits = 0;
    for (const m of this.monsters) {
      if (!m.alive || m.flashTimer > 0) continue;
      const dx = m.x - ballX;
      const dy = m.y - ballY;
      const distSq = dx * dx + dy * dy;
      const hitThreshold = m.hitRadius + ballRadius;
      if (distSq < hitThreshold * hitThreshold) {
        const dist = Math.sqrt(distSq);
        const nx = dist > 0 ? dx / dist : 0;
        const ny = dist > 0 ? dy / dist : -1;

        // Shield check for shielded enemies
        if (m.isShielded && m.shieldSegments > 0) {
          const frontAngle = m.targetEl
            ? Math.atan2(m.targetY - m.y, m.targetX - m.x) : 0;
          const hitAngle = Math.atan2(ballY - m.y, ballX - m.x);
          let rel = hitAngle - frontAngle;
          rel = ((rel % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          const segIdx = Math.floor((rel + Math.PI / 8) / (Math.PI / 4)) % 8;
          const half = Math.floor(m.shieldSegments / 2);
          const shielded = segIdx <= half || segIdx >= 8 - half;
          if (shielded) {
            // Bounce off shield — glow + push ball away + brief invulnerability
            m.shieldFlash[segIdx] = 0.3;
            m.flashTimer = 0.15;
            m.vx = nx * 80;
            m.vy = ny * 80;
            // Bounce the ball off the shield
            const impulse = (window as any).__yarnCursorApplyImpulse;
            if (impulse) impulse(ballX, ballY, -nx * 1500, -ny * 1500);
            hits++;
            continue;
          }
        }

        const dmgMul = (window as any).__upgradeDamageMultiplier;
        m.hp -= dmgMul ? dmgMul() : 1;

        const c = m.isShooter ? SHOOTER_COLORS[m.colorIdx] : MONSTER_COLORS[m.colorIdx];

        if (m.hp <= 0) {
          m.alive = false;
          if (m.targetEl) (m.targetEl as HTMLElement).style.transform = "";
          this.score += m.isShielded ? SHIELDED_SCORE : 1;
          hits++;
          const count = m.isHuge ? 40 : m.isBig ? 28 : 18;
          for (let i = 0; i < count; i++) {
            const spread = (Math.random() - 0.5) * Math.PI * 0.8;
            const angle = Math.atan2(ny, nx) + spread;
            const speed = 200 + Math.random() * 400;
            const life = 0.6 + Math.random() * 0.6;
            this.particles.push({
              x: m.x + (Math.random() - 0.5) * m.size * 0.5,
              y: m.y + (Math.random() - 0.5) * m.size * 0.5,
              vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
              life, maxLife: life, size: m.isHuge ? 4 + Math.random() * 8 : m.isBig ? 3 + Math.random() * 6 : 2 + Math.random() * 5,
              color: [c.body, "ring" in c ? c.ring : c.wing, c.eye, "#ecf0f1"][Math.floor(Math.random() * 4)],
            });
          }
        } else {
          m.flashTimer = 0.3;
          const force = m.isShooter ? 150 + Math.random() * 100 : m.isHuge ? 100 + Math.random() * 80 : 300 + Math.random() * 200;
          m.vx = nx * force; m.vy = ny * force;
          m.eatingTimer = 0;
          if (m.targetEl) (m.targetEl as HTMLElement).style.transform = "";
          hits++;
          for (let i = 0; i < 6; i++) {
            const angle = Math.atan2(ny, nx) + (Math.random() - 0.5) * 1.2;
            const speed = 100 + Math.random() * 200;
            this.particles.push({
              x: m.x, y: m.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
              life: 0.3, maxLife: 0.3, size: 2 + Math.random() * 3, color: c.eye,
            });
          }
        }
      }
    }
    return hits;
  }

  private damageCardAt(el: Element, dmg: number, hitX: number, hitY: number, sourceId: string) {
    // Shield absorption
    const absorb = (window as any).__upgradeAbsorbDamage;
    if (absorb) {
      dmg = absorb(dmg);
      if (dmg <= 0) return;
    }

    const key = cardKey(el);
    const cur = damageMap.get(key) || 0;
    const next = Math.min(MAX_CARD_HP, cur + dmg);
    damageMap.set(key, next);
    const pct = next / MAX_CARD_HP;

    // Grow crack tree on the card (throttled to once per second per card)
    const now = performance.now() / 1000;
    const lastUpdate = crackLastUpdate.get(key) || 0;
    if (now - lastUpdate >= CRACK_UPDATE_INTERVAL) {
      crackLastUpdate.set(key, now);
      const rect = getCachedRect(el);
      const lx = (hitX - rect.left) / rect.width;
      const ly = (hitY - rect.top) / rect.height;
      const cx = 0.5, cy = 0.5;
      const angle = Math.atan2(cy - ly, cx - lx);
      const tree = getOrCreateCrackTree(key, sourceId, lx, ly, angle);
      extendCrackTree(tree);
      if (pct > 0.05) applyCrackOverlay(el, pct);
    }

    // Progressive grayscale as damage increases
    const html = el as HTMLElement;
    const gs = pct * 0.85;
    const br = 1 - pct * 0.3;
    html.style.filter = `grayscale(${gs.toFixed(2)}) brightness(${br.toFixed(2)})`;

    updateHpIndicator(el, next, this.level);

    if (next >= MAX_CARD_HP) {
      (el as HTMLElement).classList.add("card-destroyed");
      addDestroyedLabel(el);
      getDestroyedSet().add(key);
      for (const mon of this.monsters) {
        if (mon.targetEl === el) {
          const t = this.findTarget();
          if (t) { mon.targetEl = t.el; mon.targetT = t.t; mon.eatingTimer = 0; }
        }
      }
      (el as HTMLElement).style.transform = "";
      if (this.getAliveCards().length === 0) this.gameOver = true;
    }
  }

  private restoreCardVisuals() {
    const destroyed = getDestroyedSet();
    for (const el of cachedCardElements) {
      const key = cardKey(el);
      const html = el as HTMLElement;
      if (destroyed.has(key)) {
        html.classList.add("card-destroyed");
        addDestroyedLabel(el);
        if (cardCracks.has(key)) applyCrackOverlay(el, 1);
      } else {
        const dmg = damageMap.get(key) || 0;
        updateHpIndicator(el, dmg, this.level);
        if (dmg > 0) {
          const pct = dmg / MAX_CARD_HP;
          if (cardCracks.has(key)) applyCrackOverlay(el, pct);
          const gs = pct * 0.85;
          const br = 1 - pct * 0.3;
          html.style.filter = `grayscale(${gs.toFixed(2)}) brightness(${br.toFixed(2)})`;
        }
      }
    }
    if (this.getAliveCards().length === 0 && cachedCardElements.length > 0) {
      this.gameOver = true;
    }
  }

  skipToNextLevel() {
    const nextIdx = this.levelThresholds.findIndex(t => this.score < t);
    if (nextIdx >= 0) {
      this.score = this.levelThresholds[nextIdx];
    }
  }

  retarget() {
    this.restoreCardVisuals();
    this.gameOver = false;
    if (this.getAliveCards().length === 0 && cachedCardElements.length > 0) {
      this.gameOver = true;
    }
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const t = this.findTarget();
      if (t) { m.targetEl = t.el; m.targetT = t.t; m.eatingTimer = 0; }
    }
  }

  update(dt: number) {
    newRectCacheFrame();
    if (this.levelUpTimer > 0) this.levelUpTimer -= dt;

    // Track scroll — shift all monsters & particles by scroll delta
    const scrollY = window.scrollY;
    const scrollDelta = scrollY - prevScrollY;
    if (scrollDelta !== 0) {
      for (const m of this.monsters) { m.y -= scrollDelta; m.targetY -= scrollDelta; }
      for (const p of this.projectiles) { p.y -= scrollDelta; }
      for (const p of this.particles) { p.y -= scrollDelta; }
      for (const p of this.eatParticles) { p.y -= scrollDelta; }
    }
    prevScrollY = scrollY;

    if (this.paused || this.gameOver) {
      this.updateParticles(dt);
      return;
    }

    this.spawnTimer += dt;

    let newLevel = 1;
    for (const t of this.levelThresholds) {
      if (this.score >= t) newLevel++; else break;
    }
    if (newLevel > this.level) {
      this.prevLevel = this.level;
      this.level = newLevel;
      this.levelUpTimer = 2.5;
    }

    if (this.engaged) {
      this.engageTimer += dt;
      if (this.mobile) {
        this.maxMonsters = Math.min(6, 2 + Math.floor((this.level - 1) * 0.4) + Math.floor(this.engageTimer / 20));
        this.spawnInterval = Math.max(0.8, (2.5 / this.level) - this.engageTimer * 0.005);
      } else {
        this.maxMonsters = Math.min(12, 2 + Math.floor(this.level * 0.6) + Math.floor(this.engageTimer / 10));
        this.spawnInterval = Math.max(0.3, (1.5 / this.level) - this.engageTimer * 0.01);
      }
    } else {
      this.maxMonsters = this.mobile ? 2 + Math.floor((this.level - 1) * 0.4) : 2 + Math.floor(this.level * 0.6);
    }
    // Level 7: fewer enemies (shielded-only level)
    if (this.level === SHIELDED_FIRST_LEVEL) {
      this.maxMonsters = Math.min(this.maxMonsters, this.mobile ? 2 : 3);
      this.spawnInterval = Math.max(this.spawnInterval, 3);
    }

    if (this.spawnTimer > this.spawnInterval) {
      this.spawnTimer = 0;
      const toSpawn = this.maxMonsters - this.monsters.length;
      for (let i = 0; i < toSpawn; i++) this.spawn();
    }

    // Sawtooth speed: drops every 5 levels, then ramps back up
    // posInCycle: 0 at the drop (level 5,10,15...), up to 4 before next drop
    const posInCycle = ((this.level - 1) % 5);
    // Base rises with level, cycle dips then recovers over 5 levels
    const cycleMin = 0.5; // drop to 50% of current base at cycle start
    const cycleFrac = cycleMin + (1 - cycleMin) * (posInCycle / 4);
    const baseSpeed = this.mobile
      ? 0.6 + (this.level - 1) * 0.25
      : 1 + (this.level - 1) * 0.5;
    const speedMult = baseSpeed * cycleFrac;

    for (const m of this.monsters) {
      if (!m.alive) continue;
      m.spawnAnim = Math.min(1, m.spawnAnim + dt * 3);
      m.wingPhase += dt * (m.isShooter ? 3 : m.isBig ? 10 : 14);
      if (m.flashTimer > 0) m.flashTimer -= dt;
      if (m.isShielded) for (let i = 0; i < 8; i++) if (m.shieldFlash[i] > 0) m.shieldFlash[i] -= dt;

      if (m.flashTimer > 0) {
        m.x += m.vx * dt; m.y += m.vy * dt;
        m.vx *= 0.9; m.vy *= 0.9;
        continue;
      }

      if (m.targetEl && getDestroyedSet().has(cardKey(m.targetEl))) {
        const t = this.findTarget();
        if (t) { m.targetEl = t.el; m.targetT = t.t; m.eatingTimer = 0; }
        else continue;
      }

      if (m.isShooter) {
        // ── Shooter: orbit around target card and fire projectiles ──
        if (!m.targetEl) continue;
        const rect = getCachedRect(m.targetEl);
        const ccx = rect.left + rect.width / 2;
        const ccy = rect.top + rect.height / 2;
        const orbitR = Math.max(rect.width, rect.height) / 2 + SHOOTER_ORBIT_PADDING;

        m.orbitAngle += SHOOTER_ORBIT_SPEED * dt;
        const goalX = ccx + Math.cos(m.orbitAngle) * orbitR;
        const goalY = ccy + Math.sin(m.orbitAngle) * orbitR;

        const dx = goalX - m.x;
        const dy = goalY - m.y;
        const distSq = dx * dx + dy * dy;
        const shooterSpeed = 80 * speedMult * 0.5;
        if (distSq > 9) {
          const dist = Math.sqrt(distSq);
          m.vx += (dx / dist) * shooterSpeed * dt * 10;
          m.vy += (dy / dist) * shooterSpeed * dt * 10;
          const spd = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
          if (spd > shooterSpeed) { m.vx = (m.vx / spd) * shooterSpeed; m.vy = (m.vy / spd) * shooterSpeed; }
        }
        m.x += m.vx * dt; m.y += m.vy * dt;
        m.vx *= 0.92; m.vy *= 0.92;

        // Shooting — only when reachable by player
        m.shootCooldown -= dt;
        if (m.shootCooldown <= 0 && this.canShooterFire(m)) {
          const sc = SHOOTER_COLORS[m.colorIdx];
          this.projectiles.push({
            x: m.x, y: m.y,
            targetEl: m.targetEl,
            shooterId: m.id,
            life: 4,
            color: sc.ring,
          });
          m.shootCooldown = SHOOTER_COOLDOWN;
        }
        continue;
      }

      // ── Moth: move toward card perimeter and eat ──
      if (m.targetEl) {
        const rect = getCachedRect(m.targetEl);
        const pt = pointOnPerimeter(rect, m.targetT);
        m.targetX = pt.x; m.targetY = pt.y;
      }

      const dx = m.targetX - m.x;
      const dy = m.targetY - m.y;
      const distSq = dx * dx + dy * dy;
      const sizeSpeedFactor = m.isHuge ? 0.35 : m.isBig ? 0.55 : 1;

      if (distSq > 25) {
        const dist = Math.sqrt(distSq);
        const accel = 200 * speedMult * sizeSpeedFactor;
        m.vx += (dx / dist) * accel * dt;
        m.vy += (dy / dist) * accel * dt;
        const spdSq = m.vx * m.vx + m.vy * m.vy;
        const maxSpd = 220 * speedMult * sizeSpeedFactor;
        if (spdSq > maxSpd * maxSpd) { const spd = Math.sqrt(spdSq); m.vx = (m.vx / spd) * maxSpd; m.vy = (m.vy / spd) * maxSpd; }
        m.x += m.vx * dt; m.y += m.vy * dt;
        m.vx *= 0.96; m.vy *= 0.96;
      }

      if (distSq < 625) {
        m.eatingTimer += dt;
        if (m.targetEl && m.eatingTimer > 0.3) {
          const shake = Math.sin(m.eatingTimer * 25) * (m.isHuge ? 8 : m.isBig ? 5 : 3);
          (m.targetEl as HTMLElement).style.transform = `translateX(${shake}px)`;
          const dmgMult = m.isHuge ? 1.8 : m.isBig ? 1.2 : 1;
          const mobileDmg = this.mobile ? 0.5 : 1;
          const lvlDmg = this.level <= 1 ? 0.05 : 1;
          this.damageCardAt(m.targetEl, DAMAGE_PER_SECOND * dmgMult * mobileDmg * lvlDmg * dt, m.x, m.y, m.id);
          if (Math.random() < dt * 8) {
            for (let i = 0; i < 2; i++) {
              const a = Math.random() * Math.PI * 2;
              const sp = 30 + Math.random() * 60;
              this.eatParticles.push({
                x: m.x + (Math.random() - 0.5) * 10, y: m.y + (Math.random() - 0.5) * 10,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
                life: 0.4 + Math.random() * 0.3, maxLife: 0.5, size: 2 + Math.random() * 3,
                color: ["#dfe6e9", "#b2bec3", "#636e72"][Math.floor(Math.random() * 3)],
              });
            }
          }
        }
      } else if (m.targetEl && m.eatingTimer > 0) {
        (m.targetEl as HTMLElement).style.transform = "";
        m.eatingTimer = 0;
      }
    }

    // ── Update projectiles ──
    this.updateProjectiles(dt);

    this.updateParticles(dt);
    for (const m of this.monsters) {
      if (!m.alive && m.targetEl) (m.targetEl as HTMLElement).style.transform = "";
    }
    compact(this.monsters, m => m.alive);
  }

  checkProjectileHit(ballX: number, ballY: number, ballRadius: number) {
    const hitRadius = ballRadius + 5; // projectile is ~5px
    for (const p of this.projectiles) {
      const dx = p.x - ballX;
      const dy = p.y - ballY;
      if (dx * dx + dy * dy < hitRadius * hitRadius) {
        // Destroy projectile with small burst
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 40 + Math.random() * 60;
          this.particles.push({
            x: p.x, y: p.y,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 0.2, maxLife: 0.2, size: 2 + Math.random() * 2, color: p.color,
          });
        }
        p.life = 0;
      }
    }
  }

  private canShooterFire(m: Monster): boolean {
    // Must be within horizontal viewport (no horizontal scroll)
    if (m.x < 0 || m.x > window.innerWidth) return false;
    // Must be reachable by scrolling vertically (within page bounds)
    const pageY = m.y + window.scrollY;
    return pageY >= 0 && pageY <= document.documentElement.scrollHeight;
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      // Home toward target card center
      const rect = getCachedRect(p.targetEl);
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = cx - p.x;
      const dy = cy - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        p.x += (dx / dist) * PROJECTILE_SPEED * dt;
        p.y += (dy / dist) * PROJECTILE_SPEED * dt;
      }
      p.life -= dt;

      // Hit card when within bounds
      if (p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom) {
        this.damageCardAt(p.targetEl, PROJECTILE_DAMAGE, p.x, p.y, p.shooterId);
        // Impact particles
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 50 + Math.random() * 80;
          this.particles.push({
            x: p.x, y: p.y,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 0.3, maxLife: 0.3, size: 2 + Math.random() * 3, color: p.color,
          });
        }
        p.life = 0;
      }
    }
    compact(this.projectiles, p => p.life > 0);
  }

  private updateParticles(dt: number) {
    const getBallPos = (window as any).__yarnCursorGetBallPos;
    const ballPos = getBallPos ? getBallPos() : null;
    for (const p of this.particles) {
      if (ballPos) {
        const dx = p.x - ballPos.x; const dy = p.y - ballPos.y;
        const dSq = dx * dx + dy * dy;
        if (dSq < 900 && dSq > 0) { const d = Math.sqrt(dSq); p.vx += (dx / d) * 800 / (d + 5); p.vy += (dy / d) * 800 / (d + 5); }
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 150 * dt; p.vx *= 0.99; p.life -= dt;
    }
    compact(this.particles, p => p.life > 0);
    for (const p of this.eatParticles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 100 * dt; p.life -= dt;
    }
    compact(this.eatParticles, p => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D, time: number) {
    const px = (x: number, y: number, w: number, h: number) => {
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };

    const prevAlpha = ctx.globalAlpha;
    for (const p of this.eatParticles) {
      ctx.globalAlpha = Math.min(1, p.life * 2.5); ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.min(1, t * 2.5); ctx.fillStyle = p.color;
      const s = p.size * (0.3 + t * 0.7);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = prevAlpha;

    if (this.levelUpTimer > 0) {
      ctx.save();
      const duration = 2.5;
      const elapsed = duration - this.levelUpTimer;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;

      // Phase 1 (0–0.4s): slam in — scale from 3x to 1x with elastic bounce
      // Phase 2 (0.4–2.0s): hold with gentle wobble
      // Phase 3 (2.0–2.5s): fade out rising upward
      let scale = 1, alpha = 1, yOff = 0, rotation = 0;

      if (elapsed < 0.4) {
        // Elastic slam: overshoot then settle
        const t = elapsed / 0.4;
        const bounce = 1 + (1 - t) * 2 * Math.exp(-t * 3) * Math.cos(t * 12);
        scale = bounce;
        alpha = Math.min(1, elapsed / 0.15);
        rotation = (1 - t) * 0.08 * Math.sin(t * 15);
      } else if (elapsed < 2.0) {
        // Hold with wobble
        const t = elapsed - 0.4;
        scale = 1 + Math.sin(t * 4) * 0.02;
        yOff = Math.sin(t * 2.5) * 4;
      } else {
        // Fade out rising
        const t = (elapsed - 2.0) / 0.5;
        alpha = 1 - t;
        yOff = -t * 30;
        scale = 1 + t * 0.1;
      }

      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy + yOff);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);

      // Shadow for readability
      ctx.font = "bold 64px Caveat, cursive";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillText(`Level ${this.level}!`, 3, 3);
      ctx.fillStyle = "#ff6b6b";
      ctx.fillText(`Level ${this.level}!`, 0, 0);

      ctx.font = "bold 28px Caveat, cursive";
      ctx.fillStyle = "#2d3436";
      const msgs = this.level >= 10 ? "Colossal beasts incoming!"
        : this.level >= 7 ? "Shielded foes! Hit them from behind!"
        : this.level >= 6 ? "Bigger creatures approaching..."
        : this.level >= 5 ? "Ranged enemies spotted!"
        : "They're getting faster...";
      ctx.fillText(msgs, 0, 45);

      ctx.restore();
    }

    // ── Draw projectiles (pixel art style) ──
    for (const proj of this.projectiles) {
      ctx.save();
      const rect = getCachedRect(proj.targetEl);
      const tcx = rect.left + rect.width / 2;
      const tcy = rect.top + rect.height / 2;
      const a = Math.atan2(tcy - proj.y, tcx - proj.x);
      // Trail: shrinking squares
      ctx.fillStyle = proj.color;
      for (let i = 3; i >= 1; i--) {
        ctx.globalAlpha = 0.15 + (3 - i) * 0.05;
        const ts = 6 - i * 1.5;
        const tx = proj.x - Math.cos(a) * i * 7;
        const ty = proj.y - Math.sin(a) * i * 7;
        px(tx - ts / 2, ty - ts / 2, ts, ts);
      }
      // Main pixel
      ctx.globalAlpha = 0.9;
      px(proj.x - 3, proj.y - 3, 6, 6);
      // Bright center
      ctx.fillStyle = "#ecf0f1";
      px(proj.x - 1.5, proj.y - 1.5, 3, 3);
      ctx.restore();
    }

    // ── Draw monsters ──
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const s = m.size * m.spawnAnim;
      if (s < 0.5) continue;

      ctx.save(); ctx.translate(m.x, m.y);
      if (m.flashTimer > 0 && Math.sin(m.flashTimer * 40) > 0) ctx.globalAlpha = 0.5;

      if (m.isShielded) {
        // ── Shielded: bulky pixel art moth with shield plates ──
        const sc = MONSTER_COLORS[m.colorIdx];
        const p = s / 7;
        const wingUp = Math.sin(m.wingPhase) * 0.4;

        // Wings — wider and thicker than regular moth
        ctx.fillStyle = sc.wing;
        px(-5.5 * p, (-1 + wingUp) * p, 3 * p, 4 * p);
        px(-4.5 * p, (-3 + wingUp) * p, 2 * p, 2 * p);
        px(2.5 * p, (-1 + wingUp) * p, 3 * p, 4 * p);
        px(2.5 * p, (-3 + wingUp) * p, 2 * p, 2 * p);

        // Body — wider and taller
        ctx.fillStyle = sc.body;
        px(-3 * p, -3 * p, 6 * p, 7 * p);
        px(-2 * p, -4 * p, 4 * p, 1 * p);
        px(-2 * p, 4 * p, 4 * p, 1 * p);
        // Armor plates on body
        ctx.fillStyle = "#5d6d7e";
        px(-2.5 * p, -2 * p, 1 * p, 4 * p);
        px(1.5 * p, -2 * p, 1 * p, 4 * p);
        px(-1 * p, -3.5 * p, 2 * p, 1 * p);
        px(-1 * p, 3 * p, 2 * p, 1 * p);

        // Eyes
        ctx.fillStyle = sc.eye;
        px(-1.5 * p, -2 * p, 1.2 * p, 1.2 * p);
        px(0.5 * p, -2 * p, 1.2 * p, 1.2 * p);
        // Mouth
        ctx.fillStyle = "#2c3e50";
        px(-1.2 * p, 0.5 * p, 2.4 * p, 1.2 * p);
        ctx.fillStyle = "#ecf0f1";
        const eating = m.eatingTimer > 0.3;
        const jawOpen = eating ? Math.abs(Math.sin(m.eatingTimer * 12)) * p * 1 : 0;
        px(-0.8 * p, 0.5 * p + jawOpen, 0.6 * p, 0.6 * p);
        px(0.3 * p, 0.5 * p + jawOpen, 0.6 * p, 0.6 * p);

        // Trail particles (same as moth)
        ctx.fillStyle = sc.wing; ctx.globalAlpha = 0.35;
        for (let i = 0; i < 4; i++) {
          const tx = Math.sin(time * 3.5 + i * 1.8 + m.wingPhase) * s * 0.9;
          const ty = Math.cos(time * 2.5 + i * 2.5 + m.wingPhase) * s * 0.4 + s;
          ctx.fillRect(tx - p * 0.6, ty - p * 0.6, p * 1.2, p * 1.2);
        }
        ctx.globalAlpha = 1;

        // ── Shield segments ──
        const frontAngle = m.targetEl
          ? Math.atan2(m.targetY - m.y, m.targetX - m.x) : 0;
        const half = Math.floor(m.shieldSegments / 2);
        const shieldR = s * 1.4;

        for (let i = 0; i < 8; i++) {
          const isActive = i <= half || i >= 8 - half;
          if (!isActive) continue;
          const segAngle = frontAngle + i * (Math.PI / 4);
          const flash = m.shieldFlash[i] > 0;
          ctx.fillStyle = flash ? SHIELDED_SHIELD_GLOW : SHIELDED_SHIELD_COLOR;
          ctx.globalAlpha = flash ? 0.95 : 0.7;
          // Draw 3 pixel blocks per segment in an arc
          for (let j = -1; j <= 1; j++) {
            const a = segAngle + j * (Math.PI / 16);
            const bx = Math.cos(a) * shieldR;
            const by = Math.sin(a) * shieldR;
            px(bx - p * 0.6, by - p * 0.6, p * 1.2, p * 1.2);
          }
        }
      } else if (m.isShooter) {
        // ── Shooter: pixel art floating eye turret ──
        const sc = SHOOTER_COLORS[m.colorIdx];
        const p = s / 7;
        const bob = Math.sin(m.wingPhase) * p * 0.5;

        // Charge glow (pixel squares around body when about to fire)
        const chargeT = 1 - Math.min(1, m.shootCooldown / SHOOTER_CHARGE_TIME);
        if (chargeT > 0) {
          ctx.fillStyle = sc.ring;
          ctx.globalAlpha = chargeT * 0.5;
          const glow = Math.floor(chargeT * 3) + 1;
          for (let i = 0; i < 4; i++) {
            const ga = (i / 4) * Math.PI * 2 + m.wingPhase;
            const gr = (3.5 + glow) * p;
            px(Math.cos(ga) * gr - p * 0.4, Math.sin(ga) * gr - p * 0.4 + bob, p * 0.8, p * 0.8);
          }
          ctx.globalAlpha = m.flashTimer > 0 ? 0.5 : 1;
        }

        // Body: blocky hexagonal shape
        ctx.fillStyle = sc.body;
        px(-2.5 * p, -1.5 * p + bob, 5 * p, 3 * p); // wide center
        px(-1.5 * p, -2.5 * p + bob, 3 * p, 1 * p); // top
        px(-1.5 * p, 1.5 * p + bob, 3 * p, 1 * p);  // bottom

        // Dark inner
        ctx.fillStyle = "#1a1a2e";
        px(-1.5 * p, -1 * p + bob, 3 * p, 2.5 * p);

        // Eye white
        ctx.fillStyle = "#ecf0f1";
        px(-1 * p, -0.5 * p + bob, 2 * p, 1.5 * p);

        // Pupil — tracks target
        let pupilDx = 0, pupilDy = 0;
        if (m.targetEl) {
          const tRect = getCachedRect(m.targetEl);
          const angle = Math.atan2(
            tRect.top + tRect.height / 2 - m.y,
            tRect.left + tRect.width / 2 - m.x,
          );
          pupilDx = Math.cos(angle) * p * 0.4;
          pupilDy = Math.sin(angle) * p * 0.4;
        }
        ctx.fillStyle = sc.eye;
        px(-0.5 * p + pupilDx, -0.2 * p + bob + pupilDy, 1 * p, 1 * p);
        // Highlight
        ctx.fillStyle = "#ecf0f1";
        px(-0.5 * p + pupilDx + p * 0.15, -0.2 * p + bob + pupilDy + p * 0.1, p * 0.3, p * 0.3);

        // "Legs" / antenna — small pixel appendages
        ctx.fillStyle = sc.ring;
        px(-3 * p, -0.5 * p + bob, 0.8 * p, 0.8 * p); // left
        px(2.2 * p, -0.5 * p + bob, 0.8 * p, 0.8 * p); // right
        px(-0.4 * p, 2.5 * p + bob, 0.8 * p, 0.8 * p); // bottom barrel

        // HP pips above
        if (m.hp > 1) {
          ctx.fillStyle = sc.ring;
          for (let i = 0; i < m.hp; i++) {
            const pipX = -((m.hp - 1) * p * 0.8) / 2 + i * p * 0.8;
            px(pipX - p * 0.3, -3.5 * p + bob, p * 0.6, p * 0.5);
          }
        }
      } else {
        // ── Moth: original pixel art ──
        const c = MONSTER_COLORS[m.colorIdx];
        const p = s / 7;
        const wingUp = Math.sin(m.wingPhase) * 0.6;
        ctx.fillStyle = c.wing;
        px(-4.5 * p, (-1 + wingUp) * p, 2.5 * p, 3.5 * p);
        px(-3.5 * p, (-2.5 + wingUp) * p, 1.5 * p, 1.5 * p);
        px(2 * p, (-1 + wingUp) * p, 2.5 * p, 3.5 * p);
        px(2 * p, (-2.5 + wingUp) * p, 1.5 * p, 1.5 * p);
        ctx.fillStyle = c.body;
        px(-2.5 * p, -2.5 * p, 5 * p, 6 * p);
        px(-1.5 * p, -3.5 * p, 3 * p, 1 * p);
        px(-1.5 * p, 3.5 * p, 3 * p, 1 * p);

        if (m.isBig && m.hp > 1) {
          ctx.fillStyle = "#e74c3c";
          for (let i = 0; i < m.hp; i++) {
            const pipX = -((m.hp - 1) * p * 0.8) / 2 + i * p * 0.8;
            ctx.fillRect(pipX - p * 0.3, -4 * p, p * 0.6, p * 0.5);
          }
        }

        ctx.fillStyle = c.eye;
        px(-1.5 * p, -1.5 * p, 1.2 * p, 1.2 * p);
        px(0.5 * p, -1.5 * p, 1.2 * p, 1.2 * p);
        ctx.fillStyle = "#2c3e50";
        px(-1.2 * p, 1 * p, 2.4 * p, 1.2 * p);
        ctx.fillStyle = "#ecf0f1";
        const eating = m.eatingTimer > 0.3;
        const jawOpen = eating ? Math.abs(Math.sin(m.eatingTimer * 12)) * p * 1.2 : 0;
        px(-0.8 * p, 1 * p + jawOpen, 0.6 * p, 0.6 * p);
        px(0.3 * p, 1 * p + jawOpen, 0.6 * p, 0.6 * p);
        ctx.fillStyle = c.wing; ctx.globalAlpha = 0.35;
        for (let i = 0; i < 4; i++) {
          const tx = Math.sin(time * 3.5 + i * 1.8 + m.wingPhase) * s * 0.9;
          const ty = Math.cos(time * 2.5 + i * 2.5 + m.wingPhase) * s * 0.4 + s;
          ctx.fillRect(tx - p * 0.6, ty - p * 0.6, p * 1.2, p * 1.2);
        }
      }
      ctx.restore();
    }
  }

  cleanup() {
    for (const m of this.monsters) {
      if (m.targetEl) (m.targetEl as HTMLElement).style.transform = "";
    }
    this.monsters = [];
    this.projectiles = [];
    this.particles = [];
    this.eatParticles = [];
  }
}
