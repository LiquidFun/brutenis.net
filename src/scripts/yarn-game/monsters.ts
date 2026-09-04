import { CANVAS_HEADING_FONT } from "../fonts";
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

const SNARL_FIRST_LEVEL = 11;
const SNARL_MAX_ALIVE = 2; // from level 12 on; level 11 raises it to teach
const SNARL_SCORE = 3;
const SNARL_SEEK_RANGE = 140; // how close to the yarn it must get to spin a web
const SNARL_ATTACH_RANGE = 170; // how far the web itself can reach for yarn
// It plants itself and telegraphs for this long before the web fires, drawing
// the exact reach — long enough to swing your yarn clear, or to squash it.
const SNARL_WINDUP = 0.6;
const SNARL_WEB_LIFETIME = 5;
const SNARL_RETRY_COOLDOWN = 2.5;
// Silk reads against the cream page background, so it is mid-grey rather than
// white — same reason the Queen's cage strands are purple.
const SNARL_COLORS = [
  { body: "#1e1b2e", eye: "#f1c40f", leg: "#4a3f6b", web: "#7f8c8d" },
  { body: "#2d1b1b", eye: "#e74c3c", leg: "#6b3f3f", web: "#96786f" },
];
const SNARL_STRAIN_WARN = "#e74c3c"; // silk glows red as it's about to snap

const BOSS_FIRST_LEVEL = 10;
const BOSS_SCORE = 25;
const BOSS_HP = 12;
const BOSS_SIZE = 70;
const BOSS_INVULN_TIME = 1.5;
const BOSS_PHASE1_COOLDOWN = 2.0;
const BOSS_PHASE2_BURST_COOLDOWN = 0.2;
const BOSS_PHASE2_BURST_COUNT = 5;
const BOSS_PHASE2_CYCLE_TIME = 4.0;
const BOSS_PROJECTILE_SPEED = 200;
const BOSS_SHIELD_COLOR = "#8e44ad";
const BOSS_SHIELD_GLOW = "#d2b4de";
const BOSS_COLORS = [
  { body: "#4a0e4e", eye: "#e74c3c", wing: "#8e44ad", accent: "#d4ac0d" },
  { body: "#1b2631", eye: "#f39c12", wing: "#5b2c6f", accent: "#c0392b" },
];

// ── Loom Queen (level 15) ──
// Caged behind rotating web strands: cut them all to expose her, then burst
// her down before she re-spins the cage.
const QUEEN_LEVEL = 15;
const QUEEN_SCORE = 40;
const QUEEN_HP = 15; // 3 capped windows of 3, then a 6 HP unravelled phase
const QUEEN_SIZE = 80;
const QUEEN_PHASE2_HP = 12;
const QUEEN_PHASE3_HP = 6;
// She recoils between hits, so parking the ball on her is not free damage —
// the fight is about re-opening the cage, not about grinding contact.
const QUEEN_INVULN = 0.7;
const QUEEN_EXPEL_FORCE = 2600; // the cage snapping taut throws caught yarn out
// She only ever gives up this many hits before slamming a fresh cage shut. The
// fight is therefore a fixed number of cut-dive-strike cycles, which is what
// stops "hold the ball on her and wait" from being a winning line.
const QUEEN_HITS_PER_WINDOW = 3;
// Her strands snare the yarn exactly like a Snarl's web — the mechanic level 11
// teaches. This is what makes idly grinding the ball against the cage a losing
// habit: you spend the fight stuck to it instead of getting inside.
const QUEEN_SNARE_TIME = 1.2;
const QUEEN_SNARE_COOLDOWN = 1.5; // across the whole cage, so it stays fair
const QUEEN_WALL_COUNT = 3;
const QUEEN_WALL_HP = 2;
const QUEEN_WALL_DIST = 145; // cage inradius on a roomy viewport
const QUEEN_CAGE_MAX_FRAC = 0.19; // ...but never more than this of the short side
const QUEEN_CAGE_OVERLAP = 1.06; // strand overshoot so the corners visibly meet
const QUEEN_STRAND_THICKNESS = 7; // collision half-width of a cage strand
const QUEEN_WALL_RESPIN = 4; // exposed window before the cage comes back
const QUEEN_CAGE_SPIN = 0.35; // rad/s
const QUEEN_SPREAD_COOLDOWN = 2.2;
const QUEEN_RING_COOLDOWN = 6;
const QUEEN_RING_COUNT = 8;
const QUEEN_ADD_INTERVAL = 5;
const QUEEN_MAX_ADDS = 2;
const QUEEN_COLORS = {
  body: "#2c1338", eye: "#f5b7b1", leg: "#5b2c6f",
  accent: "#f7dc6f", rage: "#e74c3c",
  strand: "#7d3c98", // cage silk — must stand out on the cream background
  strandHit: "#f7dc6f", // a strand flaring as the ball cuts it
  ring: "#9b59b6", // phase 2 ring-burst projectiles
};

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

/** Boss health bar, drawn in the boss's translated pixel-art space. */
function drawHpBar(
  px: (x: number, y: number, w: number, h: number) => void,
  ctx: CanvasRenderingContext2D,
  s: number, p: number, frac: number,
) {
  const w = s * 2;
  const h = p * 1.2;
  const y = s * 1.2;
  ctx.fillStyle = "#2c3e50";
  px(-w / 2, y, w, h);
  ctx.fillStyle = frac > 0.5 ? "#8e44ad" : frac > 0.25 ? "#e67e22" : "#e74c3c";
  px(-w / 2, y, w * frac, h);
  ctx.fillStyle = "#ecf0f1";
  px(-w / 2 - 1, y - 1, 1, h + 2);
  px(w / 2, y - 1, 1, h + 2);
  px(-w / 2, y - 1, w, 1);
  px(-w / 2, y + h, w, 1);
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

type MonsterKind = "moth" | "shooter" | "shielded" | "boss" | "snarl" | "queen";

/** One strand of the Loom Queen's cage, stored as an angle around her. */
interface WebWall {
  angle: number;
  hp: number;
  flash: number;
}

interface Monster {
  x: number; y: number; vx: number; vy: number;
  targetT: number; targetX: number; targetY: number;
  size: number; hitRadius: number;
  colorIdx: number; wingPhase: number;
  alive: boolean; spawnAnim: number;
  eatingTimer: number; targetEl: Element | null;
  hp: number; maxHp: number; isBig: boolean; isHuge: boolean; flashTimer: number;
  id: string;
  kind: MonsterKind;
  scoreValue: number;
  isShooter: boolean;
  orbitAngle: number;
  shootCooldown: number;
  isShielded: boolean;
  shieldSegments: number;
  shieldFlash: number[];
  isBoss: boolean;
  bossOpenSegment: number;
  bossInvulnTimer: number;
  bossAttackTimer: number;
  bossPhase2Cycle: number; // tracks time within phase 2 cycle (burst vs spawn)
  bossBurstsFired: number; // how many bursts fired in current machine gun volley
  bossWanderTarget: { x: number; y: number } | null;
  bossWanderTimer: number;
  isSnarl: boolean;
  snarlAttached: boolean;
  snarlTimer: number;
  snarlStrain: number;
  snarlLeashX: number;
  snarlLeashY: number;
  snarlWindup: number;
  isQueen: boolean;
  queenWalls: WebWall[];
  queenSpin: number;
  queenRespinTimer: number;
  queenRingTimer: number;
  queenAddTimer: number;
  queenHitsThisWindow: number;
  queenSnareTimer: number;
  queenSnareCooldown: number;
}

interface SpawnTarget { x: number; y: number; t: number; el: Element }

const KILL_EVENTS: Record<MonsterKind, string> = {
  moth: "kill_moth",
  shooter: "kill_shooter",
  shielded: "kill_shielded",
  boss: "kill_boss",
  snarl: "kill_snarl",
  queen: "kill_queen",
};

/**
 * How much of a card must be on screen before a monster will pick it as a
 * target. Half, so a card barely peeking past an edge does not start a fight the
 * player has to scroll to reach.
 */
const TARGETABLE_VISIBLE_FRACTION = 0.5;

/** Off-screen markers: how far in from the viewport edge they sit, and their size. */
const OFFSCREEN_MARGIN = 14;
const OFFSCREEN_DOT = 5;
/** Beyond this distance past the edge a marker stops fading further out. */
const OFFSCREEN_FADE_DIST = 600;

/** Palette a monster bursts into when it dies. */
function deathColors(m: Monster): { body: string; eye: string; trim: string } {
  if (m.isQueen) return { body: QUEEN_COLORS.body, eye: QUEEN_COLORS.eye, trim: QUEEN_COLORS.accent };
  if (m.isSnarl) {
    const c = SNARL_COLORS[m.colorIdx];
    return { body: c.body, eye: c.eye, trim: c.leg };
  }
  if (m.isBoss) {
    const c = BOSS_COLORS[m.colorIdx];
    return { body: c.body, eye: c.eye, trim: c.accent };
  }
  if (m.isShooter) {
    const c = SHOOTER_COLORS[m.colorIdx];
    return { body: c.body, eye: c.eye, trim: c.ring };
  }
  const c = MONSTER_COLORS[m.colorIdx];
  return { body: c.body, eye: c.eye, trim: c.wing };
}

let monsterIdCounter = 0;
/** How many webs the player has torn free — the tutorial hint stops after one. */
let snarlSnapCount = 0;

/**
 * Single construction point for every monster — the behaviour branches below
 * still read the `is*` booleans, but only this factory decides them.
 */
function createMonster(
  kind: MonsterKind,
  x: number, y: number,
  target: SpawnTarget | null,
  over: Partial<Monster> = {},
): Monster {
  const size = over.size ?? 24;
  const hp = over.hp ?? 1;
  return {
    x, y, vx: 0, vy: 0,
    targetT: target?.t ?? 0, targetX: target?.x ?? x, targetY: target?.y ?? y,
    targetEl: target?.el ?? null,
    size, hitRadius: size * 2.0,
    colorIdx: 0, wingPhase: Math.random() * Math.PI * 2,
    alive: true, spawnAnim: 0, eatingTimer: 0,
    hp, maxHp: hp, isBig: false, isHuge: false, flashTimer: 0,
    id: `m${monsterIdCounter++}`,
    kind, scoreValue: 1,
    isShooter: kind === "shooter", orbitAngle: 0, shootCooldown: 0,
    isShielded: kind === "shielded", shieldSegments: 0, shieldFlash: new Array(8).fill(0),
    isBoss: kind === "boss" || kind === "queen",
    bossOpenSegment: 0, bossInvulnTimer: 0, bossAttackTimer: 0,
    bossPhase2Cycle: 0, bossBurstsFired: 0,
    bossWanderTarget: null, bossWanderTimer: 0,
    isSnarl: kind === "snarl",
    snarlAttached: false, snarlTimer: 0, snarlStrain: 0,
    snarlLeashX: x, snarlLeashY: y, snarlWindup: 0,
    isQueen: kind === "queen",
    queenWalls: [], queenSpin: 0, queenRespinTimer: 0,
    queenRingTimer: 0, queenAddTimer: 0, queenHitsThisWindow: 0,
    queenSnareTimer: 0, queenSnareCooldown: 0,
    ...over,
  };
}

// ── Per-level overrides ──
// Levels not listed here use the default mixed spawn table and the banner
// cascade in `bannerFor`.

interface LevelRule {
  /** This level is a boss fight — nothing else spawns until it is beaten. */
  boss?: "boss" | "queen";
  /** Spawn this kind instead of rolling the normal table... */
  featured?: MonsterKind;
  /** ...this often. 1 (the default) means exclusively. */
  featuredChance?: number;
  /** Cap on concurrent monsters; exact for boss levels, a ceiling otherwise. */
  maxMonsters?: number;
  maxMonstersMobile?: number;
  /** Floor on the spawn interval, in seconds. */
  minSpawnInterval?: number;
  /** Overrides the usual 2-spider cap. */
  maxSnarls?: number;
  banner?: string;
}

const LEVEL_RULES: Record<number, LevelRule> = {
  5: { banner: "Ranged enemies spotted!" },
  6: { banner: "Bigger creatures approaching..." },
  7: {
    featured: "shielded", maxMonsters: 3, maxMonstersMobile: 2, minSpawnInterval: 3,
    banner: "Shielded foes! Hit them from behind!",
  },
  10: { boss: "boss", maxMonsters: 1, minSpawnInterval: 1, banner: "BOSS! Find the opening in its shield!" },
  // Spider debut. Mostly spiders so the mechanic gets room to teach itself, but
  // a couple of moths still chew on the cards — that is what makes being pinned
  // feel like a threat instead of a curiosity.
  11: {
    featured: "snarl", featuredChance: 0.8, maxSnarls: 3,
    maxMonsters: 5, maxMonstersMobile: 3, minSpawnInterval: 1.4,
    banner: "Spiders! They pin your yarn — shake them off!",
  },
  15: { boss: "queen", maxMonsters: 1, minSpawnInterval: 1, banner: "THE LOOM QUEEN! Cut her cage to reach her!" },
};

function bannerFor(level: number): string {
  const rule = LEVEL_RULES[level];
  if (rule?.banner) return rule.banner;
  if (level > QUEEN_LEVEL) return "The swarm thickens...";
  if (level >= SNARL_FIRST_LEVEL) return "Spiders on the prowl!";
  if (level >= BOSS_FIRST_LEVEL) return "Colossal beasts incoming!";
  if (level >= SHIELDED_FIRST_LEVEL) return "Shielded foes! Hit them from behind!";
  return "They're getting faster...";
}

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

  private findNearestCard(x: number, y: number): Element | null {
    const cards = this.getAliveCards();
    if (cards.length === 0) return null;
    let best: Element | null = null;
    let bestDist = Infinity;
    for (const card of cards) {
      const rect = getCachedRect(card);
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const d = (cx - x) ** 2 + (cy - y) ** 2;
      if (d < bestDist) { bestDist = d; best = card; }
    }
    return best;
  }

  /**
   * Alive cards that are at least half on screen.
   *
   * The comparison is against `min(card size, viewport size)` on each axis so a
   * card taller than the viewport still counts once it fills it — otherwise it
   * could never reach the fraction and would be permanently untargetable on a
   * small screen.
   */
  private getVisibleAliveCards(): Element[] {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return this.getAliveCards().filter((el) => {
      const r = getCachedRect(el);
      if (r.width <= 0 || r.height <= 0) return false;
      const visibleW = Math.min(r.right, vw) - Math.max(r.left, 0);
      const visibleH = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      return (
        visibleW >= Math.min(r.width, vw) * TARGETABLE_VISIBLE_FRACTION &&
        visibleH >= Math.min(r.height, vh) * TARGETABLE_VISIBLE_FRACTION
      );
    });
  }

  /**
   * Picks the card a new monster will go after, and the spot on its perimeter.
   *
   * Restricted to cards on screen at the moment of spawning: a monster sent
   * after something three screens down is a fight the player cannot see, let
   * alone win. The choice is then fixed for that monster's life — it keeps
   * `targetEl`, and scrolling moves monsters with the page, so it stays on the
   * card it set out for.
   *
   * When nothing visible is left alive the restriction lifts and any surviving
   * card is fair game, so the level cannot stall with monsters that have nowhere
   * to go.
   *
   * Also used by retarget() after a client-side navigation, which is what keeps
   * a tab switch pointing monsters at cards on the page you just opened.
   */
  private findTarget(): SpawnTarget | null {
    const visible = this.getVisibleAliveCards();
    const cards = visible.length > 0 ? visible : this.getAliveCards();
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

  private spawnShielded(target: SpawnTarget, at?: { x: number; y: number }) {
    const pos = at ?? this.spawnOffScreen();
    this.monsters.push(createMonster("shielded", pos.x, pos.y, target, {
      size: 38, hp: 1, isBig: true, scoreValue: SHIELDED_SCORE,
      colorIdx: Math.floor(Math.random() * MONSTER_COLORS.length),
      shieldSegments: [1, 3, 5, 7][Math.floor(Math.random() * 4)],
    }));
  }

  private spawnShooter(target: SpawnTarget, at?: { x: number; y: number }) {
    const pos = at ?? this.spawnOffScreen();
    this.monsters.push(createMonster("shooter", pos.x, pos.y, target, {
      size: 34, hp: 2,
      colorIdx: Math.floor(Math.random() * SHOOTER_COLORS.length),
      orbitAngle: Math.random() * Math.PI * 2,
      shootCooldown: SHOOTER_COOLDOWN,
    }));
  }

  private spawnSnarl(target: SpawnTarget, at?: { x: number; y: number }) {
    const pos = at ?? this.spawnOffScreen();
    this.monsters.push(createMonster("snarl", pos.x, pos.y, target, {
      size: 22, hp: 1, scoreValue: SNARL_SCORE,
      colorIdx: Math.floor(Math.random() * SNARL_COLORS.length),
    }));
  }

  private spawnKind(kind: MonsterKind, target: SpawnTarget, at?: { x: number; y: number }) {
    switch (kind) {
      case "queen": this.spawnQueen(target); break;
      case "boss": this.spawnBoss(target); break;
      case "snarl": this.spawnSnarl(target, at); break;
      case "shielded": this.spawnShielded(target, at); break;
      case "shooter": this.spawnShooter(target, at); break;
      case "moth": this.spawnMoth(target, at); break;
    }
  }

  private spawnBoss(target: SpawnTarget) {
    const pos = this.spawnOffScreen();
    this.monsters.push(createMonster("boss", pos.x, pos.y, target, {
      size: BOSS_SIZE, hp: BOSS_HP, isBig: true, isHuge: true, scoreValue: BOSS_SCORE,
      colorIdx: Math.floor(Math.random() * BOSS_COLORS.length),
      bossOpenSegment: Math.floor(Math.random() * 8),
      bossAttackTimer: BOSS_PHASE1_COOLDOWN,
    }));
  }

  private spawnQueen(target: SpawnTarget) {
    const pos = this.spawnOffScreen();
    const queen = createMonster("queen", pos.x, pos.y, target, {
      size: QUEEN_SIZE, hp: QUEEN_HP, isBig: true, isHuge: true, scoreValue: QUEEN_SCORE,
      // Just her body, well inside the cage radius. The yarn ball trails its
      // cursor by a fair margin, so a roomier hurtbox let a single circling
      // motion cut strands and land hits at the same time — which made
      // "grind the ball along the cage" strictly the best strategy.
      hitRadius: QUEEN_SIZE * 0.6,
      bossAttackTimer: QUEEN_SPREAD_COOLDOWN,
      queenRingTimer: QUEEN_RING_COOLDOWN,
      queenAddTimer: QUEEN_ADD_INTERVAL,
    });
    this.spinCage(queen);
    this.monsters.push(queen);
  }

  /** (Re)build the Loom Queen's ring of web strands at a fresh orientation. */
  private spinCage(q: Monster) {
    const base = Math.random() * Math.PI * 2;
    q.queenWalls = [];
    for (let i = 0; i < QUEEN_WALL_COUNT; i++) {
      q.queenWalls.push({
        angle: base + (i / QUEEN_WALL_COUNT) * Math.PI * 2,
        hp: QUEEN_WALL_HP,
        // Flare on materialising, so a cage re-forming is unmissable
        flash: 0.25,
      });
    }
    q.queenRespinTimer = 0;
    q.queenHitsThisWindow = 0;
    this.expelFromCage(q);
  }

  private cageRadius(): number {
    return Math.min(
      QUEEN_WALL_DIST,
      Math.min(window.innerWidth, window.innerHeight) * QUEEN_CAGE_MAX_FRAC,
    );
  }

  /**
   * Silk snapping taut throws any yarn caught inside back out. Without this a
   * player can simply park the ball in orbit and let each new cage form around
   * them, which turns the whole fight into "hold still and win".
   */
  private expelFromCage(q: Monster) {
    const getBalls = (window as any).__yarnCursorGetAllBallPositions;
    const impulse = (window as any).__yarnCursorApplyImpulse;
    if (!getBalls || !impulse) return;
    const r = this.cageRadius();
    for (const b of getBalls()) {
      const dx = b.x - q.x;
      const dy = b.y - q.y;
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      const nx = d > 0 ? dx / d : 1;
      const ny = d > 0 ? dy / d : 0;
      impulse(b.x, b.y, nx * QUEEN_EXPEL_FORCE, ny * QUEEN_EXPEL_FORCE);
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 80 + Math.random() * 160;
        this.particles.push({
          x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.4, maxLife: 0.4, size: 2 + Math.random() * 3,
          color: Math.random() < 0.5 ? QUEEN_COLORS.strand : QUEEN_COLORS.accent,
        });
      }
    }
  }

  /**
   * World-space endpoints of one cage strand. The strands are the sides of a
   * regular polygon with the queen at its centre, so a full cage genuinely
   * encloses her — the ball cannot slip through a corner and hit an
   * invulnerable target with no feedback.
   */
  private wallSegment(q: Monster, w: WebWall) {
    const r = this.cageRadius();
    const half = r * Math.tan(Math.PI / QUEEN_WALL_COUNT) * QUEEN_CAGE_OVERLAP;
    const a = w.angle + q.queenSpin;
    const cx = q.x + Math.cos(a) * r;
    const cy = q.y + Math.sin(a) * r;
    const px = -Math.sin(a) * half;
    const py = Math.cos(a) * half;
    return { x1: cx - px, y1: cy - py, x2: cx + px, y2: cy + py };
  }

  private cageIsUp(q: Monster): boolean {
    return q.queenWalls.some(w => w.hp > 0);
  }

  spawn() {
    if (this.monsters.length >= this.maxMonsters) return;
    if (this.gameOver) return;
    const target = this.findTarget();
    if (!target) return;

    const rule = LEVEL_RULES[this.level];
    if (rule?.boss) {
      // One at a time; the fight spawns its own adds
      if (this.monsters.some(m => m.isBoss && m.alive)) return;
      this.spawnKind(rule.boss, target);
      return;
    }

    const snarlCap = rule?.maxSnarls ?? SNARL_MAX_ALIVE;
    const snarlsAlive = this.monsters.reduce((n, m) => n + (m.isSnarl && m.alive ? 1 : 0), 0);

    // A featured kind crowds out the normal table; spiders still respect their
    // cap, falling through to an ordinary spawn once the web is full
    if (rule?.featured && Math.random() < (rule.featuredChance ?? 1)) {
      if (rule.featured !== "snarl" || snarlsAlive < snarlCap) {
        this.spawnKind(rule.featured, target);
        return;
      }
    }

    // Steady trickle of spiders from level 12 on
    if (this.level > SNARL_FIRST_LEVEL && snarlsAlive < snarlCap && Math.random() < 0.2) {
      this.spawnSnarl(target);
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
      this.spawnShooter(target);
      return;
    }

    this.spawnMoth(target);
  }

  private spawnMoth(target: SpawnTarget, at?: { x: number; y: number }) {
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

    const pos = at ?? this.spawnOffScreen();
    this.monsters.push(createMonster("moth", pos.x, pos.y, target, {
      size, hp, isBig: isBig || isHuge, isHuge,
      colorIdx: Math.floor(Math.random() * MONSTER_COLORS.length),
    }));
  }

  /** Drop any web this monster is holding on the player's yarn. */
  private releaseWeb(m: Monster) {
    const release = (window as any).__yarnCursorReleaseWeb;
    if (m.isSnarl && m.snarlAttached) {
      m.snarlAttached = false;
      if (release) release(m.id);
    }
    if (m.isQueen && m.queenSnareTimer > 0) {
      m.queenSnareTimer = 0;
      if (release) release(`${m.id}-snare`);
    }
  }

  /** Single death path: score, event, particles, cleanup. (nx, ny) = blast direction. */
  private killMonster(m: Monster, nx: number, ny: number) {
    m.alive = false;
    this.releaseWeb(m);
    if (m.targetEl) (m.targetEl as HTMLElement).style.transform = "";

    this.score += m.scoreValue;
    const et = (window as any).__gameEventTracker;
    if (et) et.record({
      event_type: KILL_EVENTS[m.kind],
      payload: { score_delta: m.scoreValue, running_score: this.score, running_level: this.level },
    });

    // Boss kill: immediately advance to next level
    if (m.isBoss) {
      const nextIdx = this.levelThresholds.findIndex(t => this.score < t);
      if (nextIdx >= 0) this.score = this.levelThresholds[nextIdx];
    }

    const c = deathColors(m);
    const count = m.isBoss ? 60 : m.isHuge ? 40 : m.isBig ? 28 : 18;
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * Math.PI * 0.8;
      const angle = Math.atan2(ny, nx) + spread;
      const speed = 200 + Math.random() * 400;
      const life = 0.6 + Math.random() * 0.6;
      this.particles.push({
        x: m.x + (Math.random() - 0.5) * m.size * 0.5,
        y: m.y + (Math.random() - 0.5) * m.size * 0.5,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life, maxLife: life,
        size: m.isBoss ? 5 + Math.random() * 10 : m.isHuge ? 4 + Math.random() * 8 : m.isBig ? 3 + Math.random() * 6 : 2 + Math.random() * 5,
        color: [c.body, c.trim, c.eye, "#ecf0f1"][Math.floor(Math.random() * 4)],
      });
    }
  }

  /** Ball vs one cage strand. Returns true if it made contact. */
  private hitWebWall(q: Monster, w: WebWall, bx: number, by: number, r: number): boolean {
    const { x1, y1, x2, y2 } = this.wallSegment(q, w);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq > 0
      ? Math.max(0, Math.min(1, ((bx - x1) * dx + (by - y1) * dy) / lenSq))
      : 0;
    const cx = x1 + dx * t;
    const cy = y1 + dy * t;
    const ox = bx - cx;
    const oy = by - cy;
    const reach = r + QUEEN_STRAND_THICKNESS;
    const distSq = ox * ox + oy * oy;
    if (distSq > reach * reach) return false;

    const dist = Math.sqrt(distSq) || 1;
    const nx = ox / dist;
    const ny = oy / dist;
    // flash doubles as a per-strand hit cooldown so one pass can't shred it
    if (w.flash <= 0) {
      w.hp--;
      w.flash = 0.3;
      const c = QUEEN_COLORS;
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 120;
        this.particles.push({
          x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.35, maxLife: 0.35, size: 2 + Math.random() * 3,
          color: Math.random() < 0.5 ? c.strand : c.accent,
        });
      }
    }
    const impulse = (window as any).__yarnCursorApplyImpulse;
    if (impulse) impulse(bx, by, nx * 1800, ny * 1800);

    if (q.queenSnareCooldown <= 0 && q.queenSnareTimer <= 0) {
      const attach = (window as any).__yarnCursorAttachWeb;
      if (attach && attach(`${q.id}-snare`, cx, cy, 200)) {
        q.queenSnareTimer = QUEEN_SNARE_TIME;
        q.queenSnareCooldown = QUEEN_SNARE_COOLDOWN;
      }
    }
    return true;
  }

  checkYarnBallHit(ballX: number, ballY: number, ballRadius: number): number {
    let hits = 0;
    for (const m of this.monsters) {
      if (!m.alive) continue;

      // The Loom Queen's cage blocks the ball before anything else
      if (m.isQueen) {
        let caged = false;
        for (const w of m.queenWalls) {
          if (w.hp <= 0) continue;
          if (this.hitWebWall(m, w, ballX, ballY, ballRadius)) { hits++; }
          caged = true;
        }
        if (caged) continue; // untouchable until every strand is cut
      }

      if (m.flashTimer > 0) continue;
      // Boss invulnerability window
      if (m.isBoss && m.bossInvulnTimer > 0) continue;
      const dx = m.x - ballX;
      const dy = m.y - ballY;
      const distSq = dx * dx + dy * dy;
      const hitThreshold = m.hitRadius + ballRadius;
      if (distSq < hitThreshold * hitThreshold) {
        const dist = Math.sqrt(distSq);
        const nx = dist > 0 ? dx / dist : 0;
        const ny = dist > 0 ? dy / dist : -1;

        // Boss shield check: 7/8 segments active, 1 open
        if (m.kind === "boss") {
          const hitAngle = Math.atan2(ballY - m.y, ballX - m.x);
          let norm = ((hitAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          const segIdx = Math.floor((norm + Math.PI / 8) / (Math.PI / 4)) % 8;
          if (segIdx !== m.bossOpenSegment) {
            // Hit shielded segment — bounce off
            m.shieldFlash[segIdx] = 0.3;
            m.vx = nx * 60;
            m.vy = ny * 60;
            const impulse = (window as any).__yarnCursorApplyImpulse;
            if (impulse) impulse(ballX, ballY, -nx * 2000, -ny * 2000);
            hits++;
            continue;
          }
          // Hit the open segment — take damage, then become invulnerable and rotate opening
        }

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

        if (m.hp <= 0) {
          this.killMonster(m, nx, ny);
          hits++;
        } else {
          m.flashTimer = 0.3;
          const c = deathColors(m);
          // Boss: become invulnerable and rotate opening. The Queen is exposed
          // for a fixed window instead, so she gets no invulnerability here.
          if (m.kind === "boss") {
            m.bossInvulnTimer = BOSS_INVULN_TIME;
            // Pick new random open segment (different from current)
            let newOpen = Math.floor(Math.random() * 8);
            while (newOpen === m.bossOpenSegment) newOpen = Math.floor(Math.random() * 8);
            m.bossOpenSegment = newOpen;
          } else if (m.isQueen) {
            m.bossInvulnTimer = QUEEN_INVULN;
            // Enough hits landed — weave a fresh cage and throw the player out
            if (++m.queenHitsThisWindow >= QUEEN_HITS_PER_WINDOW
                && m.hp > QUEEN_PHASE3_HP) {
              this.spinCage(m);
            }
          }
          const force = m.isBoss ? 50 + Math.random() * 30 : m.isShooter ? 150 + Math.random() * 100 : m.isHuge ? 100 + Math.random() * 80 : 300 + Math.random() * 200;
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
      const et = (window as any).__gameEventTracker;
      if (et) et.record({ event_type: "card_destroyed", payload: { card_id: key } });
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

  /** Dev only (cheat panel): wipe the field, releasing any webs it holds. */
  devClear() {
    for (const m of this.monsters) this.releaseWeb(m);
    this.monsters.length = 0;
  }

  /** Dev only (cheat panel): force one monster into existence. */
  devSpawn(kind: MonsterKind) {
    const target = this.findTarget();
    if (target) this.spawnKind(kind, target);
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

  /** Drift between random spots near the surviving cards. */
  private wander(m: Monster, dt: number, speed: number) {
    m.bossWanderTimer -= dt;
    if (!m.bossWanderTarget || m.bossWanderTimer <= 0) {
      const cards = this.getAliveCards();
      if (cards.length > 0) {
        const card = cards[Math.floor(Math.random() * cards.length)];
        const rect = getCachedRect(card);
        const margin = 180;
        m.bossWanderTarget = {
          x: rect.left + rect.width / 2 + (Math.random() - 0.5) * margin * 2,
          y: rect.top + rect.height / 2 + (Math.random() - 0.5) * margin,
        };
        m.bossWanderTimer = 2 + Math.random() * 3;
      }
    }

    if (m.bossWanderTarget) {
      const dx = m.bossWanderTarget.x - m.x;
      const dy = m.bossWanderTarget.y - m.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > 100) {
        const dist = Math.sqrt(distSq);
        m.vx += (dx / dist) * speed * dt * 3;
        m.vy += (dy / dist) * speed * dt * 3;
        const spd = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
        if (spd > speed) { m.vx = (m.vx / spd) * speed; m.vy = (m.vy / spd) * speed; }
      }
    }
    m.x += m.vx * dt; m.y += m.vy * dt;
    m.vx *= 0.95; m.vy *= 0.95;
  }

  /** Fire a homing projectile from `m` toward `card` along `angle`. */
  private fireProjectile(m: Monster, card: Element, angle: number, color: string, offset: number) {
    this.projectiles.push({
      x: m.x + Math.cos(angle) * offset,
      y: m.y + Math.sin(angle) * offset,
      targetEl: card,
      shooterId: m.id,
      life: 5,
      color,
    });
  }

  // ── Snarl: steals the player's yarn instead of chewing cards ──

  private updateSnarl(m: Monster, dt: number) {
    if (m.snarlAttached) {
      const getInfo = (window as any).__yarnCursorWebInfo;
      const info = getInfo ? getInfo(m.id) : null;
      if (!info) {
        // The yarn it was holding is gone (upgrade expired, page changed)
        m.snarlAttached = false;
        m.snarlTimer = SNARL_RETRY_COOLDOWN;
        return;
      }
      // Sit on the anchor. On desktop that IS the pinned rope point; on mobile
      // it's the fixed end of the leash, with the ball straining at the far end.
      m.x = info.ax;
      m.y = info.ay;
      m.snarlLeashX = info.bx;
      m.snarlLeashY = info.by;
      m.snarlStrain = info.strain;

      if (info.strain >= 1) {
        // Whipped loose — the web snaps and takes the spider with it
        snarlSnapCount++;
        const dismiss = (window as any).__gameDismissHint;
        if (dismiss) dismiss();
        this.killMonster(m, (Math.random() - 0.5) * 2, -1);
        return;
      }

      m.snarlTimer -= dt;
      if (m.snarlTimer <= 0) {
        // Let go before the player works it out, so nobody stays pinned forever
        this.releaseWeb(m);
        m.snarlTimer = SNARL_RETRY_COOLDOWN;
      }
      return;
    }

    // Winding up: it has committed to this spot and is drawing its reach. It no
    // longer chases, so swinging the yarn out of the ring beats it outright.
    if (m.snarlWindup > 0) {
      m.snarlWindup -= dt;
      m.x += m.vx * dt; m.y += m.vy * dt;
      m.vx *= 0.82; m.vy *= 0.82;
      if (m.snarlWindup <= 0) this.snarlFireWeb(m);
      return;
    }

    m.snarlTimer -= dt;

    const getBall = (window as any).__yarnCursorGetBallPos;
    const ball = getBall ? getBall() : null;
    if (!ball) {
      m.x += m.vx * dt; m.y += m.vy * dt;
      m.vx *= 0.95; m.vy *= 0.95;
      return;
    }

    // Deliberately slower than the yarn ball: keep moving and it never catches you
    const speed = 170 + this.level * 6;
    const dx = ball.x - m.x;
    const dy = ball.y - m.y;
    const dist = Math.hypot(dx, dy) || 1;
    m.vx += (dx / dist) * speed * dt * 4;
    m.vy += (dy / dist) * speed * dt * 4;
    const spd = Math.hypot(m.vx, m.vy);
    if (spd > speed) { m.vx = (m.vx / spd) * speed; m.vy = (m.vy / spd) * speed; }
    m.x += m.vx * dt; m.y += m.vy * dt;
    m.vx *= 0.96; m.vy *= 0.96;

    if (m.snarlTimer <= 0 && dist <= SNARL_SEEK_RANGE) m.snarlWindup = SNARL_WINDUP;
  }

  /** End of the wind-up: grab whatever yarn is still inside the ring. */
  private snarlFireWeb(m: Monster) {
    const attach = (window as any).__yarnCursorAttachWeb;
    const point = attach ? attach(m.id, m.x, m.y, SNARL_ATTACH_RANGE) : null;
    if (!point) {
      m.snarlTimer = SNARL_RETRY_COOLDOWN; // yarn got clear — it has to set up again
      return;
    }
    m.snarlAttached = true;
    m.snarlStrain = 0;
    m.snarlTimer = SNARL_WEB_LIFETIME;
    m.x = point.x;
    m.y = point.y;
    m.snarlLeashX = point.x;
    m.snarlLeashY = point.y;
    // Keep saying it until the player has actually torn one free
    if (snarlSnapCount === 0) {
      const showHint = (window as any).__gameShowHint;
      if (showHint) showHint("Shake your yarn hard to tear the web!");
    }
  }

  // ── Loom Queen: caged boss for level 15 ──

  /**
   * Cage bookkeeping. Runs even while she's flinching from a hit — otherwise a
   * player who keeps landing hits freezes the respin timer and the cage never
   * comes back.
   */
  private tickQueenCage(m: Monster, dt: number) {
    m.queenSpin += QUEEN_CAGE_SPIN * dt;
    for (const w of m.queenWalls) if (w.flash > 0) w.flash -= dt;

    if (m.queenSnareCooldown > 0) m.queenSnareCooldown -= dt;
    if (m.queenSnareTimer > 0) {
      m.queenSnareTimer -= dt;
      const getInfo = (window as any).__yarnCursorWebInfo;
      const info = getInfo ? getInfo(`${m.id}-snare`) : null;
      // Whipping free ends it early, same verb the spiders teach
      if (!info || info.strain >= 1 || m.queenSnareTimer <= 0) {
        m.queenSnareTimer = 0;
        const release = (window as any).__yarnCursorReleaseWeb;
        if (release) release(`${m.id}-snare`);
      }
    }

    // Phase 3: she unravels her own cage and comes for the cards herself
    if (m.hp <= QUEEN_PHASE3_HP) {
      if (m.queenWalls.length > 0) m.queenWalls.length = 0;
      return;
    }

    if (this.cageIsUp(m)) {
      m.queenRespinTimer = QUEEN_WALL_RESPIN;
    } else {
      m.queenRespinTimer -= dt;
      if (m.queenRespinTimer <= 0) this.spinCage(m);
    }
  }

  private updateQueen(m: Monster, dt: number) {
    if (m.hp <= QUEEN_PHASE3_HP) {
      this.queenRampage(m, dt);
      return;
    }

    this.wander(m, dt, 70);

    const card = this.findNearestCard(m.x, m.y);
    if (!card) return;
    const rect = getCachedRect(card);
    const tcx = rect.left + rect.width / 2;
    const tcy = rect.top + rect.height / 2;

    // Spread shot in both cage phases
    m.bossAttackTimer -= dt;
    if (m.bossAttackTimer <= 0) {
      const baseAngle = Math.atan2(tcy - m.y, tcx - m.x);
      for (let i = -1; i <= 1; i++) {
        this.fireProjectile(m, card, baseAngle + i * 0.3, QUEEN_COLORS.accent, m.size * 0.8);
      }
      m.bossAttackTimer = QUEEN_SPREAD_COOLDOWN;
    }

    if (m.hp > QUEEN_PHASE2_HP) return;

    // Phase 2: ring bursts + a pair of spiders on your yarn
    m.queenRingTimer -= dt;
    if (m.queenRingTimer <= 0) {
      const cards = this.getAliveCards();
      for (let i = 0; i < QUEEN_RING_COUNT; i++) {
        const a = (i / QUEEN_RING_COUNT) * Math.PI * 2 + m.queenSpin;
        const dest = cards[Math.floor(Math.random() * cards.length)] ?? card;
        this.fireProjectile(m, dest, a, QUEEN_COLORS.ring, m.size * 0.9);
      }
      m.queenRingTimer = QUEEN_RING_COOLDOWN;
    }

    m.queenAddTimer -= dt;
    if (m.queenAddTimer <= 0) {
      m.queenAddTimer = QUEEN_ADD_INTERVAL;
      const alive = this.monsters.reduce((n, o) => n + (o.isSnarl && o.alive ? 1 : 0), 0);
      for (let i = alive; i < QUEEN_MAX_ADDS; i++) {
        const target = this.findTarget();
        if (!target) break;
        this.spawnSnarl(target, {
          x: m.x + (Math.random() - 0.5) * 90,
          y: m.y + (Math.random() - 0.5) * 90,
        });
      }
    }
  }

  /** Phase 3: charge the nearest card and chew it far faster than a moth. */
  private queenRampage(m: Monster, dt: number) {
    const card = this.findNearestCard(m.x, m.y);
    if (!card) return;
    const rect = getCachedRect(card);
    const tcx = rect.left + rect.width / 2;
    const tcy = rect.top + rect.height / 2;
    const dx = tcx - m.x;
    const dy = tcy - m.y;
    const distSq = dx * dx + dy * dy;
    const speed = 260;

    if (distSq > 3600) {
      const dist = Math.sqrt(distSq);
      m.vx += (dx / dist) * speed * dt * 4;
      m.vy += (dy / dist) * speed * dt * 4;
      const spd = Math.hypot(m.vx, m.vy);
      if (spd > speed) { m.vx = (m.vx / spd) * speed; m.vy = (m.vy / spd) * speed; }
      m.eatingTimer = 0;
      (card as HTMLElement).style.transform = "";
    } else {
      m.eatingTimer += dt;
      m.targetEl = card; // so the shake gets cleared when she dies
      const shake = Math.sin(m.eatingTimer * 25) * 10;
      (card as HTMLElement).style.transform = `translateX(${shake}px)`;
      const mobileDmg = this.mobile ? 0.5 : 1;
      this.damageCardAt(card, DAMAGE_PER_SECOND * 2.5 * mobileDmg * dt, m.x, m.y, m.id);
    }
    m.x += m.vx * dt; m.y += m.vy * dt;
    m.vx *= 0.95; m.vy *= 0.95;
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
      // Never leave the player's yarn pinned while the game isn't running
      for (const m of this.monsters) this.releaseWeb(m);
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
      const et = (window as any).__gameEventTracker;
      if (et) et.record({ event_type: "level_up", payload: { new_level: newLevel } });
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
    const rule = LEVEL_RULES[this.level];
    const cap = (this.mobile ? rule?.maxMonstersMobile : undefined) ?? rule?.maxMonsters;
    if (cap !== undefined) {
      // A boss level pins the count; other levels only lower it
      this.maxMonsters = rule?.boss ? cap : Math.min(this.maxMonsters, cap);
    }
    if (rule?.minSpawnInterval !== undefined) {
      this.spawnInterval = Math.max(this.spawnInterval, rule.minSpawnInterval);
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
      m.wingPhase += dt * (m.isBoss ? 5 : m.isShooter ? 3 : m.isBig ? 10 : 14);
      if (m.flashTimer > 0) m.flashTimer -= dt;
      if (m.isShielded || m.isBoss) for (let i = 0; i < 8; i++) if (m.shieldFlash[i] > 0) m.shieldFlash[i] -= dt;

      if (m.isQueen) this.tickQueenCage(m, dt);

      if (m.isBoss) {
        const prevInvuln = m.bossInvulnTimer;
        m.bossInvulnTimer = Math.max(0, m.bossInvulnTimer - dt);
        // Dash at 0.5s into invulnerability (timer crosses from above 1.0 to at/below 1.0)
        if (prevInvuln > BOSS_INVULN_TIME - 0.5 && m.bossInvulnTimer <= BOSS_INVULN_TIME - 0.5) {
          const dashAngle = Math.random() * Math.PI * 2;
          const dashSpeed = 600;
          m.vx = Math.cos(dashAngle) * dashSpeed;
          m.vy = Math.sin(dashAngle) * dashSpeed;
        }
      }

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

      if (m.isSnarl) {
        this.updateSnarl(m, dt);
        continue;
      }

      if (m.isQueen) {
        this.updateQueen(m, dt);
        continue;
      }

      if (m.isBoss) {
        // ── Boss: wander between random positions near blog entries ──
        this.wander(m, dt, 80);

        // ── Boss attack logic ──
        const bossPhase2 = m.hp <= BOSS_HP / 2;
        m.bossAttackTimer -= dt;

        if (!bossPhase2) {
          // Phase 1: shoot 3 projectiles in a spread toward nearest card
          if (m.bossAttackTimer <= 0) {
            const nearestCard = this.findNearestCard(m.x, m.y);
            if (nearestCard) {
              const bc = BOSS_COLORS[m.colorIdx];
              const rect = getCachedRect(nearestCard);
              const tcx = rect.left + rect.width / 2;
              const tcy = rect.top + rect.height / 2;
              const baseAngle = Math.atan2(tcy - m.y, tcx - m.x);
              const spread = 0.3;
              for (let i = -1; i <= 1; i++) {
                const a = baseAngle + i * spread;
                this.projectiles.push({
                  x: m.x + Math.cos(a) * BOSS_SIZE * 0.8,
                  y: m.y + Math.sin(a) * BOSS_SIZE * 0.8,
                  targetEl: nearestCard,
                  shooterId: m.id,
                  life: 5,
                  color: bc.accent,
                });
              }
              m.bossAttackTimer = BOSS_PHASE1_COOLDOWN;
            }
          }
        } else {
          // Phase 2: alternate between machine gun burst and spawning a shooter
          m.bossPhase2Cycle += dt;
          const halfCycle = BOSS_PHASE2_CYCLE_TIME / 2;

          if (m.bossPhase2Cycle < halfCycle) {
            // Machine gun: 5 bursts with small spread toward nearest card
            if (m.bossAttackTimer <= 0 && m.bossBurstsFired < BOSS_PHASE2_BURST_COUNT) {
              const nearestCard = this.findNearestCard(m.x, m.y);
              if (nearestCard) {
                const bc = BOSS_COLORS[m.colorIdx];
                const rect = getCachedRect(nearestCard);
                const tcx = rect.left + rect.width / 2;
                const tcy = rect.top + rect.height / 2;
                const baseAngle = Math.atan2(tcy - m.y, tcx - m.x);
                const a = baseAngle + (Math.random() - 0.5) * 0.25;
                this.projectiles.push({
                  x: m.x + Math.cos(a) * BOSS_SIZE * 0.8,
                  y: m.y + Math.sin(a) * BOSS_SIZE * 0.8,
                  targetEl: nearestCard,
                  shooterId: m.id,
                  life: 5,
                  color: bc.accent,
                });
                m.bossBurstsFired++;
                m.bossAttackTimer = BOSS_PHASE2_BURST_COOLDOWN;
              }
            }
          } else if (m.bossPhase2Cycle < halfCycle + 0.5) {
            // Spawn 2 shooters (once per cycle, at transition point)
            if (m.bossBurstsFired !== -1) {
              for (let si = 0; si < 3; si++) {
                const target = this.findTarget();
                if (target) {
                  this.spawnShooter(target, {
                    x: m.x + (Math.random() - 0.5) * 80,
                    y: m.y + (Math.random() - 0.5) * 80,
                  });
                }
              }
              m.bossBurstsFired = -1; // mark spawned for this cycle
            }
          }

          if (m.bossPhase2Cycle >= BOSS_PHASE2_CYCLE_TIME) {
            m.bossPhase2Cycle = 0;
            m.bossBurstsFired = 0;
            m.bossAttackTimer = BOSS_PHASE2_BURST_COOLDOWN;
          }
        }
        continue;
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
      ctx.font = `bold 64px ${CANVAS_HEADING_FONT}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillText(`Level ${this.level}!`, 3, 3);
      ctx.fillStyle = "#ff6b6b";
      ctx.fillText(`Level ${this.level}!`, 0, 0);

      ctx.font = `bold 28px ${CANVAS_HEADING_FONT}`;
      ctx.fillStyle = "#2d3436";
      ctx.fillText(bannerFor(this.level), 0, 45);

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
      // Boss invulnerability pulsing
      if (m.isBoss && m.bossInvulnTimer > 0) {
        ctx.globalAlpha = 0.4 + Math.sin(m.bossInvulnTimer * 20) * 0.3;
      }

      if (m.isQueen) {
        // ── Loom Queen: pixel art spider matriarch behind a web cage ──
        const q = QUEEN_COLORS;
        const p = s / 10;
        const rage = m.hp <= QUEEN_PHASE3_HP;
        const bob = Math.sin(m.wingPhase * 0.7) * p * 0.8;

        // Eight arched legs, alternating their gait
        ctx.fillStyle = q.leg;
        for (let side = -1; side <= 1; side += 2) {
          for (let i = 0; i < 4; i++) {
            const a = -0.85 + i * 0.5 + Math.sin(m.wingPhase + i * 0.9) * 0.12;
            for (let j = 1; j <= 5; j++) {
              const r = j * p * 1.7;
              const lx = side * Math.cos(a) * r;
              const ly = Math.sin(a) * r - Math.sin((j / 5) * Math.PI) * p * 2.2;
              px(lx - p * 0.55, ly - p * 0.55 + bob, p * 1.1, p * 1.1);
            }
          }
        }

        // Abdomen
        ctx.fillStyle = q.body;
        px(-3.5 * p, 0.5 * p + bob, 7 * p, 6 * p);
        px(-2.5 * p, -0.5 * p + bob, 5 * p, 1 * p);
        px(-2.5 * p, 6.5 * p + bob, 5 * p, 1 * p);
        // Hourglass marking — turns red when she unravels
        ctx.fillStyle = rage ? q.rage : q.accent;
        px(-1 * p, 2 * p + bob, 2 * p, 1.5 * p);
        px(-1.5 * p, 3.5 * p + bob, 3 * p, 1.5 * p);

        // Head / thorax
        ctx.fillStyle = q.body;
        px(-2.5 * p, -4.5 * p + bob, 5 * p, 4 * p);
        // Crown
        ctx.fillStyle = q.accent;
        px(-2.5 * p, -5.2 * p + bob, 5 * p, 0.8 * p);
        px(-2.5 * p, -6.2 * p + bob, 1 * p, 1.5 * p);
        px(-0.5 * p, -6.8 * p + bob, 1 * p, 2 * p);
        px(1.5 * p, -6.2 * p + bob, 1 * p, 1.5 * p);
        // Six eyes
        ctx.fillStyle = rage ? q.rage : q.eye;
        px(-1.8 * p, -3.8 * p + bob, 1 * p, 1 * p);
        px(0.8 * p, -3.8 * p + bob, 1 * p, 1 * p);
        px(-1.2 * p, -2.5 * p + bob, 0.7 * p, 0.7 * p);
        px(0.5 * p, -2.5 * p + bob, 0.7 * p, 0.7 * p);
        px(-2.4 * p, -2.5 * p + bob, 0.6 * p, 0.6 * p);
        px(1.8 * p, -2.5 * p + bob, 0.6 * p, 0.6 * p);
        if (rage) {
          ctx.globalAlpha = 0.4 + Math.sin(time * 9) * 0.3;
          px(-2.4 * p, -4.2 * p + bob, 2 * p, 2 * p);
          px(0.4 * p, -4.2 * p + bob, 2 * p, 2 * p);
          ctx.globalAlpha = 1;
        }
        // Fangs
        ctx.fillStyle = "#ecf0f1";
        px(-1.3 * p, -1.2 * p + bob, 0.7 * p, 1.4 * p);
        px(0.6 * p, -1.2 * p + bob, 0.7 * p, 1.4 * p);

        // ── The cage: silk strands she hides behind ──
        for (const w of m.queenWalls) {
          if (w.hp <= 0) continue;
          // Same geometry the collision uses, shifted into the queen's local space
          const seg = this.wallSegment(m, w);
          const x1 = seg.x1 - m.x, y1 = seg.y1 - m.y;
          const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
          const len = Math.hypot(dx, dy);
          const nx = -dy / len, ny = dx / len; // strand normal, for the barbs
          const flash = w.flash > 0;
          ctx.fillStyle = flash ? q.strandHit : q.strand;
          ctx.globalAlpha = flash ? 1 : (w.hp >= QUEEN_WALL_HP ? 0.95 : 0.6);
          const steps = Math.max(12, Math.round(len / 11));
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const sz = i % 2 === 0 ? 6 : 4;
            px(x1 + dx * t - sz / 2, y1 + dy * t - sz / 2, sz, sz);
          }
          // Barbs along an intact strand; a frayed one loses them
          if (w.hp >= QUEEN_WALL_HP) {
            for (let i = 1; i < 6; i++) {
              const t = i / 6;
              px(x1 + dx * t - nx * 5 - 1.5, y1 + dy * t - ny * 5 - 1.5, 3, 3);
              px(x1 + dx * t + nx * 5 - 1.5, y1 + dy * t + ny * 5 - 1.5, 3, 3);
            }
          }
        }
        ctx.globalAlpha = 1;

        drawHpBar(px, ctx, s, p, Math.max(0, m.hp / m.maxHp));

      } else if (m.isSnarl) {
        // ── Snarl: little spider squatting on your yarn ──
        const c = SNARL_COLORS[m.colorIdx];
        const p = s / 6;
        const strain = m.snarlStrain;

        if (m.snarlAttached) {
          ctx.fillStyle = strain > 0.6 ? SNARL_STRAIN_WARN : c.web;
          ctx.globalAlpha = 0.35 + strain * 0.55;

          // Leash to the yarn, when the web holds it at a distance (mobile)
          const lx = m.snarlLeashX - m.x;
          const ly = m.snarlLeashY - m.y;
          const leash = Math.hypot(lx, ly);
          if (leash > s) {
            const steps = Math.min(40, Math.round(leash / 9));
            for (let i = 1; i <= steps; i++) {
              const t = i / steps;
              const sag = Math.sin(t * Math.PI) * (1 - strain) * 12;
              px(lx * t - p * 0.35, ly * t + sag - p * 0.35, p * 0.7, p * 0.7);
            }
          }

          // Silk radiating from the bite point, shivering as strain builds
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + m.wingPhase * 0.15;
            for (let j = 2; j <= 6; j++) {
              const r = j * p * 1.5 * (1 + strain * 0.18 * Math.sin(time * 22 + j));
              px(Math.cos(a) * r - p * 0.35, Math.sin(a) * r - p * 0.35, p * 0.7, p * 0.7);
            }
          }
          ctx.globalAlpha = 1;
        }

        // Legs
        ctx.fillStyle = c.leg;
        for (let side = -1; side <= 1; side += 2) {
          for (let i = 0; i < 4; i++) {
            const a = -0.8 + i * 0.5 + Math.sin(m.wingPhase * 1.5 + i) * 0.15;
            for (let j = 1; j <= 3; j++) {
              const r = j * p * 1.3;
              const lx = side * Math.cos(a) * r;
              const ly = Math.sin(a) * r - Math.sin((j / 3) * Math.PI) * p * 1.1;
              px(lx - p * 0.4, ly - p * 0.4, p * 0.8, p * 0.8);
            }
          }
        }
        // Body
        ctx.fillStyle = c.body;
        px(-1.5 * p, -0.4 * p, 3 * p, 3.2 * p);
        px(-1 * p, -2.2 * p, 2 * p, 1.9 * p);
        ctx.fillStyle = c.eye;
        px(-0.85 * p, -1.8 * p, 0.6 * p, 0.6 * p);
        px(0.25 * p, -1.8 * p, 0.6 * p, 0.6 * p);

        // Wind-up telegraph: a closing ring showing exactly how far the web can
        // reach. Get the yarn outside it before it snaps shut and nothing happens.
        if (m.snarlWindup > 0) {
          const t = 1 - m.snarlWindup / SNARL_WINDUP;
          const ringR = SNARL_ATTACH_RANGE * (1 - t * 0.25);
          ctx.fillStyle = SNARL_STRAIN_WARN;
          ctx.globalAlpha = 0.45 + t * 0.5;
          const dots = 54;
          for (let i = 0; i < dots; i++) {
            // Dashes sweep round as it charges, so the ring reads as tightening
            const a = (i / dots) * Math.PI * 2 + t * 0.8;
            const d = 4 + t * 3;
            px(Math.cos(a) * ringR - d / 2, Math.sin(a) * ringR - d / 2, d, d);
          }
          // Spokes reeling inward, pointing at what is about to be grabbed
          ctx.globalAlpha = 0.25 + t * 0.45;
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 - t * 1.2;
            for (let j = 3; j <= 7; j++) {
              const r = ringR * (j / 8) * (1 - t * 0.2);
              px(Math.cos(a) * r - 2, Math.sin(a) * r - 2, 4, 4);
            }
          }
          ctx.globalAlpha = 1;
        }

        // Strain meter — shown from the moment it latches, so the answer to
        // "what do I do?" is on screen rather than in a hint that already faded
        if (m.snarlAttached) {
          const bw = s * 2.2;
          const by = -s * 1.7;
          ctx.fillStyle = "#2c3e50";
          px(-bw / 2 - 1, by - 1, bw + 2, 7);
          ctx.fillStyle = "#ecf0f1";
          px(-bw / 2, by, bw, 5);
          ctx.fillStyle = strain > 0.66 ? SNARL_STRAIN_WARN : strain > 0.33 ? "#f1c40f" : "#e67e22";
          px(-bw / 2, by, bw * strain, 5);
        }

      } else if (m.isBoss) {
        // ── Boss: large pixel art demon moth ──
        const bc = BOSS_COLORS[m.colorIdx];
        const p = s / 10; // finer pixel grid for bigger creature
        const wingUp = Math.sin(m.wingPhase) * 0.5;
        const bob = Math.sin(m.wingPhase * 0.7) * p * 0.8;
        const bossPhase2 = m.hp <= BOSS_HP / 2;

        // Massive wings — 4 wing segments, layered
        ctx.fillStyle = bc.wing;
        // Outer wings
        px(-8 * p, (-2 + wingUp) * p + bob, 4 * p, 6 * p);
        px(-7 * p, (-5 + wingUp) * p + bob, 3 * p, 3 * p);
        px(-6 * p, (-7 + wingUp) * p + bob, 2 * p, 2 * p);
        px(4 * p, (-2 + wingUp) * p + bob, 4 * p, 6 * p);
        px(4 * p, (-5 + wingUp) * p + bob, 3 * p, 3 * p);
        px(4 * p, (-7 + wingUp) * p + bob, 2 * p, 2 * p);
        // Inner wing detail
        ctx.fillStyle = bossPhase2 ? "#c0392b" : bc.body;
        px(-7 * p, (-1 + wingUp) * p + bob, 2 * p, 4 * p);
        px(5 * p, (-1 + wingUp) * p + bob, 2 * p, 4 * p);

        // Large body
        ctx.fillStyle = bc.body;
        px(-4 * p, -5 * p + bob, 8 * p, 10 * p);
        px(-3 * p, -6 * p + bob, 6 * p, 1 * p);
        px(-3 * p, 5 * p + bob, 6 * p, 1.5 * p);
        // Shoulder pads
        px(-5 * p, -4 * p + bob, 1.5 * p, 3 * p);
        px(3.5 * p, -4 * p + bob, 1.5 * p, 3 * p);

        // Armor plating — heavy
        ctx.fillStyle = "#2c3e50";
        px(-3 * p, -4 * p + bob, 6 * p, 2 * p);
        px(-3.5 * p, -2 * p + bob, 1.5 * p, 5 * p);
        px(2 * p, -2 * p + bob, 1.5 * p, 5 * p);
        // Crown / horns
        ctx.fillStyle = bc.accent;
        px(-2 * p, -7 * p + bob, 1.5 * p, 2 * p);
        px(0.5 * p, -7 * p + bob, 1.5 * p, 2 * p);
        px(-3 * p, -6.5 * p + bob, 1 * p, 1.5 * p);
        px(2 * p, -6.5 * p + bob, 1 * p, 1.5 * p);

        // Eyes — larger, menacing
        ctx.fillStyle = "#1a1a2e";
        px(-2.5 * p, -3 * p + bob, 2 * p, 2 * p);
        px(0.5 * p, -3 * p + bob, 2 * p, 2 * p);
        ctx.fillStyle = bc.eye;
        px(-2 * p, -2.5 * p + bob, 1.2 * p, 1.2 * p);
        px(1 * p, -2.5 * p + bob, 1.2 * p, 1.2 * p);
        // Eye glow in phase 2
        if (bossPhase2) {
          ctx.fillStyle = "#e74c3c";
          ctx.globalAlpha = 0.5 + Math.sin(time * 8) * 0.3;
          px(-2.5 * p, -3.5 * p + bob, 2.5 * p, 2.5 * p);
          px(0.3 * p, -3.5 * p + bob, 2.5 * p, 2.5 * p);
          ctx.globalAlpha = m.bossInvulnTimer > 0 ? 0.4 + Math.sin(m.bossInvulnTimer * 20) * 0.3 : (m.flashTimer > 0 ? 0.5 : 1);
        }

        // Mouth — wide gash
        ctx.fillStyle = "#1a1a2e";
        px(-2 * p, 1 * p + bob, 4 * p, 2 * p);
        ctx.fillStyle = bc.accent;
        // Fangs
        px(-1.5 * p, 0.5 * p + bob, 0.8 * p, 1 * p);
        px(0.8 * p, 0.5 * p + bob, 0.8 * p, 1 * p);
        px(-0.5 * p, 2.5 * p + bob, 0.8 * p, 0.8 * p);

        // Tail / lower body detail
        ctx.fillStyle = bc.wing;
        px(-1.5 * p, 6 * p + bob, 3 * p, 1.5 * p);
        px(-1 * p, 7 * p + bob, 2 * p, 1 * p);

        // Trail particles — bigger, more
        ctx.fillStyle = bc.wing; ctx.globalAlpha = 0.3;
        for (let i = 0; i < 6; i++) {
          const tx = Math.sin(time * 2.5 + i * 1.2 + m.wingPhase) * s * 1.1;
          const ty = Math.cos(time * 1.8 + i * 2.0 + m.wingPhase) * s * 0.5 + s * 1.1;
          ctx.fillRect(tx - p * 0.8, ty - p * 0.8, p * 1.6, p * 1.6);
        }
        ctx.globalAlpha = m.bossInvulnTimer > 0 ? 0.4 + Math.sin(m.bossInvulnTimer * 20) * 0.3 : (m.flashTimer > 0 ? 0.5 : 1);

        // ── Boss shield: 7/8 segments, 1 open ──
        const shieldR = s * 1.6;
        for (let i = 0; i < 8; i++) {
          if (i === m.bossOpenSegment) continue; // the opening
          const segAngle = i * (Math.PI / 4);
          const flash = m.shieldFlash[i] > 0;
          ctx.fillStyle = flash ? BOSS_SHIELD_GLOW : BOSS_SHIELD_COLOR;
          ctx.globalAlpha = flash ? 0.95 : (m.bossInvulnTimer > 0 ? 0.9 : 0.65);
          // 4 pixel blocks per segment for larger shield
          for (let j = -1.5; j <= 1.5; j++) {
            const a = segAngle + j * (Math.PI / 20);
            const bx = Math.cos(a) * shieldR;
            const by = Math.sin(a) * shieldR;
            px(bx - p * 0.8, by - p * 0.8, p * 1.6, p * 1.6);
          }
        }
        ctx.globalAlpha = 1;

        drawHpBar(px, ctx, s, p, Math.max(0, m.hp / m.maxHp));

      } else if (m.isShielded) {
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

    this.drawOffScreenMarkers(ctx);
  }

  /**
   * Small marker at the viewport edge for every monster that is currently
   * outside it, pointing at where the monster actually is.
   *
   * Monsters spawn just off-screen and then chase a card, and the page scrolls
   * under them, so a monster can spend a while somewhere you cannot see. Without
   * this the first warning is a card already being eaten.
   *
   * Each marker keeps its monster's own body colour, so a boss or a queen reads
   * differently from a moth, and fades with distance so a far-off spawn is a hint
   * rather than a demand.
   */
  private drawOffScreenMarkers(ctx: CanvasRenderingContext2D) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const prevAlpha = ctx.globalAlpha;

    for (const m of this.monsters) {
      if (!m.alive || m.spawnAnim < 1) continue;

      // A monster only half out of frame is still visible; wait until its body
      // has genuinely cleared the edge.
      const r = m.size * 0.5;
      const outLeft = -(m.x + r);
      const outRight = m.x - r - vw;
      const outTop = -(m.y + r);
      const outBottom = m.y - r - vh;
      const overshoot = Math.max(outLeft, outRight, outTop, outBottom);
      if (overshoot <= 0) continue;

      const colors = deathColors(m);
      // Bosses and queens get a slightly bigger dot: worth interrupting for.
      const dot = OFFSCREEN_DOT * (m.isBoss || m.isQueen ? 1.7 : m.isHuge ? 1.35 : 1);
      const inset = OFFSCREEN_MARGIN + dot;
      const mx = Math.min(vw - inset, Math.max(inset, m.x));
      const my = Math.min(vh - inset, Math.max(inset, m.y));

      ctx.save();
      ctx.globalAlpha = 0.85 - 0.55 * Math.min(1, overshoot / OFFSCREEN_FADE_DIST);
      ctx.translate(mx, my);
      // Point along the direction to the monster, from the clamped position.
      ctx.rotate(Math.atan2(m.y - my, m.x - mx));

      // Arrowhead just outboard of the dot.
      ctx.fillStyle = colors.trim;
      ctx.beginPath();
      ctx.moveTo(dot * 2.4, 0);
      ctx.lineTo(dot * 0.9, -dot * 0.9);
      ctx.lineTo(dot * 0.9, dot * 0.9);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = colors.body;
      ctx.beginPath();
      ctx.arc(0, 0, dot, 0, Math.PI * 2);
      ctx.fill();

      // A single eye pixel, so it reads as a creature rather than a blob.
      ctx.fillStyle = colors.eye;
      ctx.fillRect(-dot * 0.25, -dot * 0.25, Math.max(1, dot * 0.5), Math.max(1, dot * 0.5));
      ctx.restore();
    }

    ctx.globalAlpha = prevAlpha;
  }

  cleanup() {
    const releaseAll = (window as any).__yarnCursorReleaseAllWebs;
    if (releaseAll) releaseAll();
    for (const m of this.monsters) {
      if (m.targetEl) (m.targetEl as HTMLElement).style.transform = "";
    }
    this.monsters = [];
    this.projectiles = [];
    this.particles = [];
    this.eatParticles = [];
  }
}
