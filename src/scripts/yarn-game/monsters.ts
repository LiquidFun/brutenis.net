const MONSTER_COLORS = [
  { body: "#6c3483", eye: "#e74c3c", wing: "#8e44ad" },
  { body: "#1a5276", eye: "#f39c12", wing: "#2980b9" },
  { body: "#7b241c", eye: "#f1c40f", wing: "#c0392b" },
  { body: "#0e6655", eye: "#e74c3c", wing: "#148f77" },
  { body: "#4a235a", eye: "#2ecc71", wing: "#7d3c98" },
];

const MAX_CARD_HP = 5;
const DAMAGE_PER_SECOND = 0.8;

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

/** Extend tip nodes of a crack tree — balanced growth rate regardless of tip count */
function extendCrackTree(tree: CrackTree, amount: number) {
  const tips: CrackNode[] = [];
  let totalNodes = 0;
  function walk(n: CrackNode) {
    totalNodes++;
    if (n.children.length === 0) tips.push(n);
    else for (const c of n.children) walk(c);
  }
  walk(tree.root);

  if (tips.length === 0) return;

  // Grow only 1 tip per call — pick one at random
  const tip = tips[Math.floor(Math.random() * tips.length)];

  const jitter = (Math.random() - 0.5) * (0.5 + tip.depth * 0.1);
  const newAngle = tip.angle + jitter;
  // Longer segments for bolder cracks
  const len = Math.max(0.02, 0.05 - tip.depth * 0.003) + Math.random() * 0.03;
  const child: CrackNode = {
    x: tip.x + Math.cos(newAngle) * len,
    y: tip.y + Math.sin(newAngle) * len,
    angle: newAngle,
    depth: tip.depth + 1,
    children: [],
  };
  tip.children.push(child);

  // Branch only every ~8 segments, with a wide fork
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
  const rect = html.getBoundingClientRect();
  const strokeW = 1.8 + pct * 2.2;
  const alpha = 0.35 + pct * 0.45;
  overlay.innerHTML = renderCracks(trees, rect.width, rect.height, strokeW, alpha);
}

// ── Types ──

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
}

interface Monster {
  x: number; y: number; vx: number; vy: number;
  targetT: number; targetX: number; targetY: number;
  size: number; hitRadius: number;
  colorIdx: number; wingPhase: number;
  alive: boolean; spawnAnim: number;
  eatingTimer: number; targetEl: Element | null;
  hp: number; isBig: boolean; flashTimer: number;
  id: string; // unique id for crack tree association
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

// ── Manager ──

export class MonsterManager {
  monsters: Monster[] = [];
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
  private levelThresholds = [5, 15, 30, 50, 80, 120, 170, 230, 300];

  private getAliveCards(): Element[] {
    const destroyed = getDestroyedSet();
    return [...document.querySelectorAll(".post-card, .project-card, .ctf-card")]
      .filter(el => !destroyed.has(cardKey(el)));
  }

  private findTarget(): { x: number; y: number; t: number; el: Element } | null {
    const cards = this.getAliveCards();
    if (cards.length === 0) return null;
    const card = cards[Math.floor(Math.random() * cards.length)];
    const rect = card.getBoundingClientRect();
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

  spawn() {
    if (this.monsters.length >= this.maxMonsters) return;
    if (this.gameOver) return;
    const target = this.findTarget();
    if (!target) return;

    const canSpawnBig = this.level >= 6;
    const isBig = canSpawnBig && Math.random() < 0.25;
    const size = isBig ? 35 + Math.random() * 10 : 20 + Math.random() * 8;
    const hp = isBig ? 2 + Math.floor((this.level - 5) / 2) : 1;
    const pos = this.spawnOffScreen();

    this.monsters.push({
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      targetT: target.t, targetX: target.x, targetY: target.y,
      size, hitRadius: size * 2.0,
      colorIdx: Math.floor(Math.random() * MONSTER_COLORS.length),
      wingPhase: Math.random() * Math.PI * 2,
      alive: true, spawnAnim: 0, eatingTimer: 0, targetEl: target.el,
      hp, isBig, flashTimer: 0,
      id: `m${monsterIdCounter++}`,
    });
  }

  checkYarnBallHit(ballX: number, ballY: number, ballRadius: number): number {
    let hits = 0;
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const dx = m.x - ballX;
      const dy = m.y - ballY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < m.hitRadius + ballRadius) {
        m.hp--;
        const nx = dist > 0 ? dx / dist : 0;
        const ny = dist > 0 ? dy / dist : -1;

        if (m.hp <= 0) {
          m.alive = false;
          if (m.targetEl) (m.targetEl as HTMLElement).style.transform = "";
          this.score++;
          hits++;
          const c = MONSTER_COLORS[m.colorIdx];
          const count = m.isBig ? 28 : 18;
          for (let i = 0; i < count; i++) {
            const spread = (Math.random() - 0.5) * Math.PI * 0.8;
            const angle = Math.atan2(ny, nx) + spread;
            const speed = 200 + Math.random() * 400;
            const life = 0.6 + Math.random() * 0.6;
            this.particles.push({
              x: m.x + (Math.random() - 0.5) * m.size * 0.5,
              y: m.y + (Math.random() - 0.5) * m.size * 0.5,
              vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
              life, maxLife: life, size: m.isBig ? 3 + Math.random() * 6 : 2 + Math.random() * 5,
              color: [c.body, c.wing, c.eye, "#ecf0f1"][Math.floor(Math.random() * 4)],
            });
          }
        } else {
          m.flashTimer = 0.3;
          const force = 300 + Math.random() * 200;
          m.vx = nx * force; m.vy = ny * force;
          m.eatingTimer = 0;
          if (m.targetEl) (m.targetEl as HTMLElement).style.transform = "";
          hits++;
          const c = MONSTER_COLORS[m.colorIdx];
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

  private damageCard(el: Element, dmg: number, m: Monster) {
    const key = cardKey(el);
    const cur = damageMap.get(key) || 0;
    const next = Math.min(MAX_CARD_HP, cur + dmg);
    damageMap.set(key, next);
    const pct = next / MAX_CARD_HP;

    // Grow this monster's crack tree on the card
    const rect = (el as HTMLElement).getBoundingClientRect();
    const lx = (m.x - rect.left) / rect.width;
    const ly = (m.y - rect.top) / rect.height;
    const cx = 0.5, cy = 0.5;
    const angle = Math.atan2(cy - ly, cx - lx);
    const tree = getOrCreateCrackTree(key, m.id, lx, ly, angle);
    extendCrackTree(tree, dmg);

    if (pct > 0.05) applyCrackOverlay(el, pct);

    // Progressive grayscale as damage increases
    const html = el as HTMLElement;
    const gs = pct * 0.85;
    const br = 1 - pct * 0.3;
    html.style.filter = `grayscale(${gs.toFixed(2)}) brightness(${br.toFixed(2)})`;

    if (next >= MAX_CARD_HP) {
      (el as HTMLElement).classList.add("card-destroyed");
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
    for (const el of document.querySelectorAll(".post-card, .project-card, .ctf-card")) {
      const key = cardKey(el);
      const html = el as HTMLElement;
      if (destroyed.has(key)) {
        html.classList.add("card-destroyed");
        if (cardCracks.has(key)) applyCrackOverlay(el, 1);
      } else {
        const dmg = damageMap.get(key) || 0;
        if (dmg > 0) {
          const pct = dmg / MAX_CARD_HP;
          if (cardCracks.has(key)) applyCrackOverlay(el, pct);
          const gs = pct * 0.85;
          const br = 1 - pct * 0.3;
          html.style.filter = `grayscale(${gs.toFixed(2)}) brightness(${br.toFixed(2)})`;
        }
      }
    }
    if (this.getAliveCards().length === 0 &&
        document.querySelectorAll(".post-card, .project-card, .ctf-card").length > 0) {
      this.gameOver = true;
    }
  }

  retarget() {
    this.restoreCardVisuals();
    this.gameOver = false;
    if (this.getAliveCards().length === 0 &&
        document.querySelectorAll(".post-card, .project-card, .ctf-card").length > 0) {
      this.gameOver = true;
    }
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const t = this.findTarget();
      if (t) { m.targetEl = t.el; m.targetT = t.t; m.eatingTimer = 0; }
    }
  }

  update(dt: number) {
    if (this.levelUpTimer > 0) this.levelUpTimer -= dt;

    // Track scroll — shift all monsters & particles by scroll delta
    const scrollY = window.scrollY;
    const scrollDelta = scrollY - prevScrollY;
    if (scrollDelta !== 0) {
      for (const m of this.monsters) { m.y -= scrollDelta; m.targetY -= scrollDelta; }
      for (const p of this.particles) { p.y -= scrollDelta; }
      for (const p of this.eatParticles) { p.y -= scrollDelta; }
    }
    prevScrollY = scrollY;

    if (this.paused || this.gameOver) {
      this.updateParticles(dt);
      return;
    }

    this.spawnTimer += dt;

    const newLevel = 1 + this.levelThresholds.filter(t => this.score >= t).length;
    if (newLevel > this.level) {
      this.prevLevel = this.level;
      this.level = newLevel;
      this.levelUpTimer = 2.5;
    }

    if (this.engaged) {
      this.engageTimer += dt;
      this.maxMonsters = Math.min(18, (2 + this.level) + Math.floor(this.engageTimer / 6));
      this.spawnInterval = Math.max(0.25, (1.2 / this.level) - this.engageTimer * 0.02);
    } else {
      this.maxMonsters = 2 + this.level;
    }

    if (this.spawnTimer > this.spawnInterval) {
      this.spawnTimer = 0;
      const toSpawn = this.maxMonsters - this.monsters.length;
      for (let i = 0; i < toSpawn; i++) this.spawn();
    }

    const speedMult = 1 + (this.level - 1) * 0.5;

    for (const m of this.monsters) {
      if (!m.alive) continue;
      m.spawnAnim = Math.min(1, m.spawnAnim + dt * 3);
      m.wingPhase += dt * (m.isBig ? 10 : 14);
      if (m.flashTimer > 0) m.flashTimer -= dt;

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

      // getBoundingClientRect already accounts for scroll
      if (m.targetEl) {
        const rect = m.targetEl.getBoundingClientRect();
        const pt = pointOnPerimeter(rect, m.targetT);
        m.targetX = pt.x; m.targetY = pt.y;
      }

      const dx = m.targetX - m.x;
      const dy = m.targetY - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const sizeSpeedFactor = m.isBig ? 0.55 : 1;

      if (dist > 5) {
        const accel = 200 * speedMult * sizeSpeedFactor;
        m.vx += (dx / dist) * accel * dt;
        m.vy += (dy / dist) * accel * dt;
        const spd = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
        const maxSpd = 220 * speedMult * sizeSpeedFactor;
        if (spd > maxSpd) { m.vx = (m.vx / spd) * maxSpd; m.vy = (m.vy / spd) * maxSpd; }
        m.x += m.vx * dt; m.y += m.vy * dt;
        m.vx *= 0.96; m.vy *= 0.96;
      }

      if (dist < 25) {
        m.eatingTimer += dt;
        if (m.targetEl && m.eatingTimer > 0.3) {
          const shake = Math.sin(m.eatingTimer * 25) * (m.isBig ? 5 : 3);
          (m.targetEl as HTMLElement).style.transform = `translateX(${shake}px)`;
          const dmgMult = m.isBig ? 1.5 : 1;
          this.damageCard(m.targetEl, DAMAGE_PER_SECOND * dmgMult * dt, m);
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

    this.updateParticles(dt);
    for (const m of this.monsters) {
      if (!m.alive && m.targetEl) (m.targetEl as HTMLElement).style.transform = "";
    }
    this.monsters = this.monsters.filter(m => m.alive);
  }

  private updateParticles(dt: number) {
    const getBallPos = (window as any).__yarnCursorGetBallPos;
    const ballPos = getBallPos ? getBallPos() : null;
    for (const p of this.particles) {
      if (ballPos) {
        const dx = p.x - ballPos.x; const dy = p.y - ballPos.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 30 && d > 0) { p.vx += (dx / d) * 800 / (d + 5); p.vy += (dy / d) * 800 / (d + 5); }
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 150 * dt; p.vx *= 0.99; p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const p of this.eatParticles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 100 * dt; p.life -= dt;
    }
    this.eatParticles = this.eatParticles.filter(p => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D, time: number) {
    const px = (x: number, y: number, w: number, h: number) => {
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };

    for (const p of this.eatParticles) {
      ctx.save(); ctx.globalAlpha = Math.min(1, p.life * 2.5); ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); ctx.restore();
    }
    for (const p of this.particles) {
      ctx.save(); const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.min(1, t * 2.5); ctx.fillStyle = p.color;
      const s = p.size * (0.3 + t * 0.7);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s); ctx.restore();
    }

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
      const msgs = this.level >= 6 ? "Bigger creatures approaching..." : "They're getting faster...";
      ctx.fillText(msgs, 0, 45);

      ctx.restore();
    }

    for (const m of this.monsters) {
      if (!m.alive) continue;
      const c = MONSTER_COLORS[m.colorIdx];
      const s = m.size * m.spawnAnim;
      if (s < 0.5) continue;

      ctx.save(); ctx.translate(m.x, m.y);

      if (m.flashTimer > 0 && Math.sin(m.flashTimer * 40) > 0) ctx.globalAlpha = 0.5;

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
      ctx.restore();
    }
  }

  cleanup() {
    for (const m of this.monsters) {
      if (m.targetEl) (m.targetEl as HTMLElement).style.transform = "";
    }
    this.monsters = [];
    this.particles = [];
    this.eatParticles = [];
  }
}
