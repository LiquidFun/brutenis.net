export class YarnCharacter {
  x: number;
  y: number;
  vx: number = 0;
  vy: number = 0;
  radius: number = 20;
  color: string = "#4ecdc4";
  speed: number = 800;
  maxSpeed: number = 500;
  friction: number = 0.92;
  facing: number = 1; // 1 = right, -1 = left
  animFrame: number = 0;
  animTimer: number = 0;
  isMoving: boolean = false;
  bobOffset: number = 0;
  bobTimer: number = 0;
  // Hit reaction
  hitTimer: number = 0;
  squash: number = 1;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  applyForce(fx: number, fy: number) {
    this.vx += fx;
    this.vy += fy;
  }

  update(dt: number, inputX: number, inputY: number) {
    // Apply input acceleration
    this.vx += inputX * this.speed * dt;
    this.vy += inputY * this.speed * dt;

    // Clamp speed
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > this.maxSpeed) {
      this.vx = (this.vx / speed) * this.maxSpeed;
      this.vy = (this.vy / speed) * this.maxSpeed;
    }

    // Apply friction
    this.vx *= this.friction;
    this.vy *= this.friction;

    // Update position
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Keep in bounds with bounce
    if (this.x < this.radius) { this.x = this.radius; this.vx = Math.abs(this.vx) * 0.5; }
    if (this.x > window.innerWidth - this.radius) { this.x = window.innerWidth - this.radius; this.vx = -Math.abs(this.vx) * 0.5; }
    if (this.y < this.radius) { this.y = this.radius; this.vy = Math.abs(this.vy) * 0.5; }
    if (this.y > window.innerHeight - this.radius) { this.y = window.innerHeight - this.radius; this.vy = -Math.abs(this.vy) * 0.5; }

    this.isMoving = speed > 15;

    if (inputX !== 0) {
      this.facing = inputX > 0 ? 1 : -1;
    } else if (Math.abs(this.vx) > 30) {
      this.facing = this.vx > 0 ? 1 : -1;
    }

    // Walking animation
    this.animTimer += dt;
    if (this.isMoving && this.animTimer > 0.1) {
      this.animFrame = (this.animFrame + 1) % 4;
      this.animTimer = 0;
    }

    // Idle bob
    this.bobTimer += dt;
    this.bobOffset = Math.sin(this.bobTimer * 2.5) * 3;

    // Hit squash recovery
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      this.squash = 1 + Math.sin(this.hitTimer * 15) * 0.2 * (this.hitTimer / 0.4);
    } else {
      this.squash = 1;
    }
  }

  onHit() {
    this.hitTimer = 0.4;
  }

  draw(ctx: CanvasRenderingContext2D, alpha: number = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y + this.bobOffset);
    ctx.scale(this.facing * this.squash, 2 - this.squash);

    // Body (yarn ball)
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();

    // Yarn wraps on body
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI + this.animTimer;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.75, angle - 0.5, angle + 0.5);
      ctx.stroke();
    }

    // Eyes
    const eyeOffsetX = 5;
    const eyeOffsetY = -5;
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(eyeOffsetX - 3, eyeOffsetY, 5, 0, Math.PI * 2);
    ctx.arc(eyeOffsetX + 6, eyeOffsetY, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#2d3436";
    ctx.beginPath();
    ctx.arc(eyeOffsetX - 1, eyeOffsetY, 2.5, 0, Math.PI * 2);
    ctx.arc(eyeOffsetX + 8, eyeOffsetY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Legs (little stick legs)
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    const legSpread = this.isMoving ? Math.sin(this.animFrame * Math.PI / 2) * 8 : 0;

    // Left leg
    ctx.beginPath();
    ctx.moveTo(-6, this.radius - 2);
    ctx.lineTo(-8 - legSpread, this.radius + 12);
    ctx.stroke();

    // Right leg
    ctx.beginPath();
    ctx.moveTo(6, this.radius - 2);
    ctx.lineTo(8 + legSpread, this.radius + 12);
    ctx.stroke();

    ctx.restore();
  }
}
