import { getCachedRect } from "./monsters";

// ── Upgrade Types & Interfaces ──

export type UpgradeType =
  | "extra-ball"
  | "regen-shield"
  | "larger-balls"
  | "magnet"
  | "double-damage"
  | "card-repair";

interface UpgradePickup {
  x: number;
  y: number;
  radius: number;
  type: UpgradeType;
  bobOffset: number;
  bobSpeed: number;
  timer: number; // seconds remaining, Infinity for first
  collected: boolean;
  collectAnim: number; // 1 → 0 shrink
  isFirst: boolean;
}

interface UpgradeState {
  extraBallCount: number;
  shieldActive: boolean;
  shieldHP: number;
  ballRadiusBonus: number;
  magnetActive: boolean;
  damageMultiplier: number;
  cardRepairActive: boolean;
}

// ── Constants ──

const FIRST_UPGRADE_LEVEL = 3;
const UPGRADE_LEVEL_INTERVAL = 1;
const DESPAWN_TIME = Infinity;
const MAX_SHIELD_HP = 3;
const SHIELD_REGEN_RATE = 0.15;
const BALL_RADIUS_INCREASE = 5;
const PICKUP_RADIUS = 18;
const MAGNET_RADIUS = 200;
const MAGNET_FORCE = 8000;
const CARD_REPAIR_RATE = 0.3; // HP per second

const UPGRADE_VISUALS: Record<UpgradeType, { color: string; label: string }> = {
  "extra-ball": { color: "#74b9ff", label: "Extra Ball!" },
  "regen-shield": { color: "#55efc4", label: "Shield!" },
  "larger-balls": { color: "#fdcb6e", label: "Bigger Balls!" },
  "magnet": { color: "#a29bfe", label: "Magnet!" },
  "double-damage": { color: "#ff7675", label: "Power Hit!" },
  "card-repair": { color: "#81ecec", label: "Repair!" },
};

// ── Monster interface (minimal, for magnet) ──

interface MonsterLike {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  eatingTimer: number;
  targetEl: Element | null;
}

// ── Card helpers (for shield + repair) ──

interface DamageMapAccess {
  getDamage(key: string): number;
  setDamage(key: string, value: number): void;
  cardKey(el: Element): string;
  getAliveCards(): Element[];
  refreshCardVisual(el: Element, damage: number, maxHP: number): void;
}

// ── Manager ──

export class UpgradeManager {
  pickups: UpgradePickup[] = [];
  state: UpgradeState = {
    extraBallCount: 0,
    shieldActive: false,
    shieldHP: 0,
    ballRadiusBonus: 0,
    magnetActive: false,
    damageMultiplier: 1,
    cardRepairActive: false,
  };

  private spawnedAtLevels = new Set<number>();
  private firstSpawned = false;
  private shieldFlashTimer = 0;
  private dmAccess: DamageMapAccess | null = null;
  private activeUpgrade: UpgradeType | null = null;
  private activeUpgradeLevel = 0;

  setDamageMapAccess(access: DamageMapAccess) {
    this.dmAccess = access;
  }

  // ── Spawn logic ──

  checkLevelUp(level: number) {
    if (level < FIRST_UPGRADE_LEVEL) return;
    if ((level - FIRST_UPGRADE_LEVEL) % UPGRADE_LEVEL_INTERVAL !== 0) return;
    if (this.spawnedAtLevels.has(level)) return;
    this.spawnedAtLevels.add(level);
    this.spawnPickup();
  }

  private getEligibleTypes(): UpgradeType[] {
    return ["extra-ball", "regen-shield", "larger-balls", "magnet", "double-damage", "card-repair"];
  }

  private spawnPickup() {
    const types = this.getEligibleTypes();
    if (types.length === 0) return;

    const type = types[Math.floor(Math.random() * types.length)];
    const isFirst = !this.firstSpawned;
    if (!this.firstSpawned) this.firstSpawned = true;

    // Find a position avoiding edges and cards
    let x = 0, y = 0;
    for (let attempt = 0; attempt < 15; attempt++) {
      x = 80 + Math.random() * (window.innerWidth - 160);
      y = 140 + Math.random() * (window.innerHeight - 280);
      if (!this.overlapsCard(x, y)) break;
    }

    this.pickups.push({
      x, y,
      radius: PICKUP_RADIUS,
      type,
      bobOffset: Math.random() * Math.PI * 2,
      bobSpeed: 1.5 + Math.random() * 0.5,
      timer: Infinity,
      collected: false,
      collectAnim: 0,
      isFirst,
    });

  }

  private overlapsCard(x: number, y: number): boolean {
    if (!this.dmAccess) return false;
    const cards = this.dmAccess.getAliveCards();
    const pad = 40;
    for (const card of cards) {
      const r = getCachedRect(card);
      if (
        x > r.left - pad && x < r.right + pad &&
        y > r.top - pad && y < r.bottom + pad
      ) return true;
    }
    return false;
  }

  // ── Collision ──

  checkCollision(balls: Array<{ x: number; y: number; radius: number }>, level: number) {
    for (const pickup of this.pickups) {
      if (pickup.collected) continue;
      for (const ball of balls) {
        const dx = pickup.x - ball.x;
        const dy = pickup.y - ball.y;
        const threshold = pickup.radius + ball.radius;
        if (dx * dx + dy * dy < threshold * threshold) {
          pickup.collected = true;
          pickup.collectAnim = 1;
          this.applyUpgrade(pickup.type, level);
          break;
        }
      }
    }
  }

  private applyUpgrade(type: UpgradeType, level: number) {
    // Deactivate previous upgrade before applying new one
    if (this.activeUpgrade) {
      this.deactivateUpgrade();
    }

    this.activeUpgrade = type;
    this.activeUpgradeLevel = level;

    const visual = UPGRADE_VISUALS[type];
    const toast = (window as any).__gameShowToast;
    if (toast) toast(visual.label);

    switch (type) {
      case "extra-ball":
        this.state.extraBallCount = 1;
        const addBall = (window as any).__yarnCursorAddBall;
        if (addBall) addBall();
        break;
      case "regen-shield":
        this.state.shieldActive = true;
        this.state.shieldHP = MAX_SHIELD_HP;
        break;
      case "larger-balls":
        this.state.ballRadiusBonus = BALL_RADIUS_INCREASE;
        const setBonus = (window as any).__yarnCursorSetRadiusBonus;
        if (setBonus) setBonus(this.state.ballRadiusBonus);
        break;
      case "magnet":
        this.state.magnetActive = true;
        break;
      case "double-damage":
        this.state.damageMultiplier = 2;
        break;
      case "card-repair":
        this.state.cardRepairActive = true;
        break;
    }
  }

  private deactivateUpgrade() {
    if (!this.activeUpgrade) return;

    switch (this.activeUpgrade) {
      case "extra-ball":
        this.state.extraBallCount = 0;
        const removeBall = (window as any).__yarnCursorRemoveBall;
        if (removeBall) removeBall();
        break;
      case "regen-shield":
        this.state.shieldActive = false;
        this.state.shieldHP = 0;
        break;
      case "larger-balls":
        this.state.ballRadiusBonus = 0;
        const setBonus = (window as any).__yarnCursorSetRadiusBonus;
        if (setBonus) setBonus(0);
        break;
      case "magnet":
        this.state.magnetActive = false;
        break;
      case "double-damage":
        this.state.damageMultiplier = 1;
        break;
      case "card-repair":
        this.state.cardRepairActive = false;
        break;
    }

    this.activeUpgrade = null;
  }

  // ── Shield ──

  absorbDamage(dmg: number): number {
    if (!this.state.shieldActive || this.state.shieldHP <= 0) return dmg;
    const absorbed = Math.min(dmg, this.state.shieldHP);
    this.state.shieldHP -= absorbed;
    if (absorbed > 0) this.shieldFlashTimer = 0.2;
    return dmg - absorbed;
  }

  getDamageMultiplier(): number {
    return this.state.damageMultiplier;
  }

  getBallRadiusBonus(): number {
    return this.state.ballRadiusBonus;
  }

  // ── Magnet ──

  applyMagnetForce(
    monsters: MonsterLike[],
    balls: Array<{ x: number; y: number }>,
    dt: number,
  ) {
    if (!this.state.magnetActive) return;
    for (const m of monsters) {
      if (!m.alive) continue;
      for (const ball of balls) {
        const dx = m.x - ball.x;
        const dy = m.y - ball.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < MAGNET_RADIUS * MAGNET_RADIUS && distSq > 25) {
          const dist = Math.sqrt(distSq);
          // Pull toward ball (negative = attraction)
          const strength = MAGNET_FORCE * (1 - dist / MAGNET_RADIUS);
          m.vx -= (dx / dist) * strength * dt;
          m.vy -= (dy / dist) * strength * dt;
          // Reset eating if being pulled away
          if (m.eatingTimer > 0) {
            m.eatingTimer = 0;
            if (m.targetEl) (m.targetEl as HTMLElement).style.transform = "";
          }
        }
      }
    }
  }

  // ── Card Repair ──

  healCards(dt: number) {
    if (!this.state.cardRepairActive || !this.dmAccess) return;
    const cards = this.dmAccess.getAliveCards();
    if (cards.length === 0) return;

    // Find most damaged card
    let worstEl: Element | null = null;
    let worstDmg = 0;
    for (const el of cards) {
      const key = this.dmAccess.cardKey(el);
      const dmg = this.dmAccess.getDamage(key);
      if (dmg > worstDmg) {
        worstDmg = dmg;
        worstEl = el;
      }
    }

    if (!worstEl || worstDmg <= 0) return;

    const key = this.dmAccess.cardKey(worstEl);
    const newDmg = Math.max(0, worstDmg - CARD_REPAIR_RATE * dt);
    this.dmAccess.setDamage(key, newDmg);
    this.dmAccess.refreshCardVisual(worstEl, newDmg, 5); // MAX_CARD_HP = 5
  }

  // ── Update ──

  update(dt: number) {
    // Despawn timers
    for (const pickup of this.pickups) {
      if (pickup.collected) {
        pickup.collectAnim -= dt * 3;
        continue;
      }
      if (pickup.timer !== Infinity) {
        pickup.timer -= dt;
      }
    }
    // Remove fully animated or despawned pickups (in-place to avoid allocation)
    let w = 0;
    for (let i = 0; i < this.pickups.length; i++) {
      const p = this.pickups[i];
      if ((p.collected && p.collectAnim > 0) || (!p.collected && p.timer > 0)) {
        if (i !== w) this.pickups[w] = p;
        w++;
      }
    }
    this.pickups.length = w;

    // Shield regen
    if (this.state.shieldActive && this.state.shieldHP < MAX_SHIELD_HP) {
      this.state.shieldHP = Math.min(
        MAX_SHIELD_HP,
        this.state.shieldHP + SHIELD_REGEN_RATE * dt,
      );
    }
    if (this.shieldFlashTimer > 0) this.shieldFlashTimer -= dt;
  }

  // ── Draw ──

  draw(ctx: CanvasRenderingContext2D, time: number) {
    this.drawPickups(ctx, time);
    this.drawShield(ctx, time);
    this.drawMagnetRings(ctx, time);
  }

  private drawPickups(ctx: CanvasRenderingContext2D, time: number) {
    for (const pickup of this.pickups) {
      const visual = UPGRADE_VISUALS[pickup.type];
      const bobY = Math.sin(time * pickup.bobSpeed + pickup.bobOffset) * 6;
      const x = pickup.x;
      const y = pickup.y + bobY;

      ctx.save();

      // Collect animation
      if (pickup.collected) {
        const t = pickup.collectAnim;
        ctx.globalAlpha = t;
        ctx.translate(x, y);
        ctx.scale(1 + (1 - t) * 0.5, 1 + (1 - t) * 0.5);
        ctx.translate(-x, -y);
      }

      // Blink in last 2 seconds
      if (!pickup.collected && pickup.timer < 2 && pickup.timer !== Infinity) {
        if (Math.sin(pickup.timer * 8) < 0) {
          ctx.globalAlpha = 0.3;
        }
      }

      // Glow ring
      ctx.beginPath();
      ctx.arc(x, y, pickup.radius + 6 + Math.sin(time * 3) * 2, 0, Math.PI * 2);
      ctx.fillStyle = visual.color;
      ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.15;
      ctx.fill();

      // Restore alpha for main body
      ctx.globalAlpha = pickup.collected ? pickup.collectAnim : 1;
      if (!pickup.collected && pickup.timer < 2 && pickup.timer !== Infinity) {
        if (Math.sin(pickup.timer * 8) < 0) ctx.globalAlpha = 0.3;
      }

      // Main circle
      ctx.beginPath();
      ctx.arc(x, y, pickup.radius, 0, Math.PI * 2);
      ctx.fillStyle = visual.color;
      ctx.fill();

      // Icon per type
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px Caveat, cursive";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      this.drawPickupIcon(ctx, x, y, pickup.type, pickup.radius, time);

      // Despawn countdown arc
      if (!pickup.collected && pickup.timer !== Infinity) {
        const frac = pickup.timer / DESPAWN_TIME;
        ctx.beginPath();
        ctx.arc(x, y, pickup.radius + 3, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        ctx.strokeStyle = visual.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private drawPickupIcon(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    type: UpgradeType,
    r: number,
    _time: number,
  ) {
    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    switch (type) {
      case "extra-ball": {
        // Small ball + "+"
        ctx.beginPath();
        ctx.arc(x - 3, y, r * 0.35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 4, y - 5);
        ctx.lineTo(x + 4, y + 5);
        ctx.moveTo(x - 1, y);
        ctx.lineTo(x + 9, y);
        ctx.stroke();
        break;
      }
      case "regen-shield": {
        // Shield shape
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.55);
        ctx.lineTo(x + r * 0.45, y - r * 0.15);
        ctx.lineTo(x + r * 0.35, y + r * 0.4);
        ctx.lineTo(x, y + r * 0.55);
        ctx.lineTo(x - r * 0.35, y + r * 0.4);
        ctx.lineTo(x - r * 0.45, y - r * 0.15);
        ctx.closePath();
        ctx.stroke();
        break;
      }
      case "larger-balls": {
        // Ball with outward arrows
        ctx.beginPath();
        ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
        ctx.stroke();
        // Arrows pointing out
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 - Math.PI / 4;
          const ox = Math.cos(a) * r * 0.55;
          const oy = Math.sin(a) * r * 0.55;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * r * 0.35, y + Math.sin(a) * r * 0.35);
          ctx.lineTo(x + ox, y + oy);
          ctx.stroke();
        }
        break;
      }
      case "magnet": {
        // U-shape magnet
        ctx.beginPath();
        ctx.arc(x, y + 2, r * 0.35, 0, Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - r * 0.35, y + 2);
        ctx.lineTo(x - r * 0.35, y - r * 0.4);
        ctx.moveTo(x + r * 0.35, y + 2);
        ctx.lineTo(x + r * 0.35, y - r * 0.4);
        ctx.stroke();
        break;
      }
      case "double-damage": {
        // "2x" text
        ctx.font = "bold 14px Caveat, cursive";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("2x", x, y);
        break;
      }
      case "card-repair": {
        // Wrench / healing cross
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.35, y);
        ctx.lineTo(x + r * 0.35, y);
        ctx.moveTo(x, y - r * 0.35);
        ctx.lineTo(x, y + r * 0.35);
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }

  private drawShield(ctx: CanvasRenderingContext2D, time: number) {
    if (!this.state.shieldActive || !this.dmAccess) return;
    const cards = this.dmAccess.getAliveCards();
    if (cards.length === 0) return;

    const hpFrac = this.state.shieldHP / MAX_SHIELD_HP;
    if (hpFrac <= 0) return;

    ctx.save();
    const baseAlpha = hpFrac * 0.4 + Math.sin(time * 3) * 0.05;
    const flashBoost = this.shieldFlashTimer > 0 ? 0.4 : 0;
    ctx.globalAlpha = Math.min(1, baseAlpha + flashBoost);
    ctx.strokeStyle = this.shieldFlashTimer > 0 ? "#fff" : "#55efc4";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 4]);
    ctx.lineDashOffset = -time * 20;

    for (const card of cards) {
      const r = getCachedRect(card);
      const pad = 6;
      const radius = 8;
      this.roundRect(
        ctx,
        r.left - pad,
        r.top - pad,
        r.width + pad * 2,
        r.height + pad * 2,
        radius,
      );
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawMagnetRings(ctx: CanvasRenderingContext2D, time: number) {
    if (!this.state.magnetActive) return;

    const getAllBalls = (window as any).__yarnCursorGetAllBallPositions;
    if (!getAllBalls) return;
    const balls = getAllBalls();

    ctx.save();
    ctx.globalAlpha = 0.08 + Math.sin(time * 2) * 0.03;
    ctx.strokeStyle = "#a29bfe";
    ctx.lineWidth = 1.5;

    for (const ball of balls) {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, MAGNET_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    w: number, h: number,
    r: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  cleanup() {
    this.deactivateUpgrade();
    this.pickups = [];
  }
}
