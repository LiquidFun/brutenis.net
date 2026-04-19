const YARN_COLORS = [
  "#ff6b6b", "#ffe66d", "#a06cd5", "#ff8fab",
  "#74b9ff", "#55efc4", "#fdcb6e",
];

interface Collectible {
  x: number;
  y: number;
  radius: number;
  color: string;
  bobOffset: number;
  bobSpeed: number;
  collected: boolean;
  collectAnim: number;
}

export class CollectibleManager {
  items: Collectible[] = [];
  score: number = 0;

  spawn(count: number) {
    for (let i = 0; i < count; i++) {
      this.items.push({
        x: 60 + Math.random() * (window.innerWidth - 120),
        y: 60 + Math.random() * (window.innerHeight - 120),
        radius: 8 + Math.random() * 4,
        color: YARN_COLORS[Math.floor(Math.random() * YARN_COLORS.length)],
        bobOffset: Math.random() * Math.PI * 2,
        bobSpeed: 1.5 + Math.random(),
        collected: false,
        collectAnim: 0,
      });
    }
  }

  checkCollision(charX: number, charY: number, charRadius: number) {
    for (const item of this.items) {
      if (item.collected) continue;
      const dx = item.x - charX;
      const dy = item.y - charY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < charRadius + item.radius) {
        item.collected = true;
        item.collectAnim = 1;
        this.score++;
      }
    }
  }

  update(dt: number) {
    for (const item of this.items) {
      if (item.collected) {
        item.collectAnim -= dt * 3;
      }
    }
    // Remove fully animated collected items
    const before = this.items.length;
    this.items = this.items.filter((i) => !i.collected || i.collectAnim > 0);

    // Respawn if we collected some
    const removed = before - this.items.length;
    if (removed > 0) {
      this.spawn(removed);
    }
  }

  draw(ctx: CanvasRenderingContext2D, time: number) {
    for (const item of this.items) {
      ctx.save();

      const bob = Math.sin(time * item.bobSpeed + item.bobOffset) * 4;

      if (item.collected) {
        ctx.globalAlpha = item.collectAnim;
        const scale = 1 + (1 - item.collectAnim) * 0.5;
        ctx.translate(item.x, item.y + bob);
        ctx.scale(scale, scale);
      } else {
        ctx.translate(item.x, item.y + bob);
      }

      // Mini yarn ball
      ctx.beginPath();
      ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
      ctx.fillStyle = item.color;
      ctx.fill();

      // Tiny wrap lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, item.radius * 0.6, 0, 1.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, item.radius * 0.6, 2, 3.2);
      ctx.stroke();

      ctx.restore();
    }
  }
}
