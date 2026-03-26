// 2D flocking simulation for the blog post demo
// Ported from the original CoffeeScript/Processing.js implementation

export class Vec2 {
  constructor(
    public x: number = 0,
    public y: number = 0,
  ) {}

  copy(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize(): Vec2 {
    const m = this.magnitude();
    if (m > 0) {
      this.x /= m;
      this.y /= m;
    }
    return this;
  }

  limit(max: number): Vec2 {
    if (this.magnitude() > max) {
      this.normalize();
      this.x *= max;
      this.y *= max;
    }
    return this;
  }

  heading(): number {
    return -1 * Math.atan2(-1 * this.y, this.x);
  }

  add(other: Vec2): Vec2 {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  subtract(other: Vec2): Vec2 {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  multiply(n: number): Vec2 {
    this.x *= n;
    this.y *= n;
    return this;
  }

  divide(n: number): Vec2 {
    this.x /= n;
    this.y /= n;
    return this;
  }

  dot(other: Vec2): number {
    return this.x * other.x + this.y * other.y;
  }

  static subtract(a: Vec2, b: Vec2): Vec2 {
    return new Vec2(a.x - b.x, a.y - b.y);
  }

  static add(a: Vec2, b: Vec2): Vec2 {
    return new Vec2(a.x + b.x, a.y + b.y);
  }

  wrapRelativeTo(location: Vec2, width: number, height: number): Vec2 {
    const v = this.copy();
    const dx = this.x - location.x;
    const dy = this.y - location.y;
    if (Math.abs(dx) > width / 2) {
      v.x = dx > 0 ? (width - this.x) * -1 : this.x + width;
    }
    if (Math.abs(dy) > height / 2) {
      v.y = dy > 0 ? (height - this.y) * -1 : this.y + height;
    }
    return v;
  }
}

export interface BoidIndicators {
  separation: boolean;
  separationRadius: boolean;
  alignment: boolean;
  alignmentNeighbours: boolean;
  cohesion: boolean;
  cohesionMean: boolean;
  cohesionNeighbours: boolean;
  velocity: boolean;
  neighbours: boolean;
  neighbourRadius: boolean;
}

export interface BoidOptions {
  maxSpeed: number;
  maxForce: number;
  radius: number;
  neighbourRadius: number;
  desiredSeparation: number;
  wrapFactor: number;
  mousePhobic: boolean;
  weights: { separation: number; alignment: number; cohesion: number; gravity: number };
  indicators: BoidIndicators;
}

const defaultIndicators: BoidIndicators = {
  separation: true,
  separationRadius: false,
  alignment: true,
  alignmentNeighbours: false,
  cohesion: true,
  cohesionMean: false,
  cohesionNeighbours: false,
  velocity: true,
  neighbours: true,
  neighbourRadius: true,
};

export const defaultBoidOptions: BoidOptions = {
  maxSpeed: 2,
  maxForce: 0.05,
  radius: 3,
  neighbourRadius: 50,
  desiredSeparation: 6,
  wrapFactor: 1,
  mousePhobic: true,
  weights: { separation: 2, alignment: 1, cohesion: 1, gravity: 6 },
  indicators: { ...defaultIndicators },
};

export class Boid {
  location: Vec2;
  velocity: Vec2;
  options: BoidOptions;

  // Wrap bounds
  private wrapWidth: number;
  private wrapHeight: number;
  private wrapNorth: number;
  private wrapSouth: number;
  private wrapWest: number;
  private wrapEast: number;

  // Cached component vectors for rendering indicators
  _separation = new Vec2();
  _alignment = new Vec2();
  _cohesion = new Vec2();
  _cohesionMean = new Vec2();

  renderedThisStep = false;
  forceInspection = false;
  inspectable = false;

  constructor(
    startPosition: Vec2,
    velocity: Vec2,
    fieldWidth: number,
    fieldHeight: number,
    options: Partial<BoidOptions> = {},
  ) {
    this.options = {
      ...defaultBoidOptions,
      ...options,
      indicators: { ...defaultIndicators, ...options.indicators },
      weights: { ...defaultBoidOptions.weights, ...options.weights },
    };
    this.location = startPosition.copy();
    this.velocity = velocity;

    const twor = this.options.radius * 2 * this.options.wrapFactor;
    this.wrapNorth = -twor;
    this.wrapSouth = fieldHeight + twor;
    this.wrapWest = -twor;
    this.wrapEast = fieldWidth + twor;
    this.wrapWidth = fieldWidth + 2 * twor;
    this.wrapHeight = fieldHeight + 2 * twor;
  }

  step(neighbours: Boid[], mouse: Vec2 | null): void {
    const accel = this.flock(neighbours);
    accel.add(this.gravitate(mouse));
    this.wrapIfNeeded();
    this.velocity.add(accel).limit(this.options.maxSpeed);
    this.location.add(this.velocity);
  }

  private wrapIfNeeded(): void {
    if (this.location.x < this.wrapWest) this.location.x = this.wrapEast;
    if (this.location.y < this.wrapNorth) this.location.y = this.wrapSouth;
    if (this.location.x > this.wrapEast) this.location.x = this.wrapWest;
    if (this.location.y > this.wrapSouth) this.location.y = this.wrapNorth;
  }

  private flock(neighbours: Boid[]): Vec2 {
    const sepMean = new Vec2();
    const aliMean = new Vec2();
    const cohMean = new Vec2();
    let sepCount = 0;
    let aliCount = 0;
    let cohCount = 0;
    const desiredSep = this.options.desiredSeparation * this.options.radius;

    for (const boid of neighbours) {
      if (boid === this) continue;
      const d = this.location.copy().subtract(boid.location).magnitude();
      if (d <= 0) continue;
      if (d < desiredSep) {
        sepMean.add(Vec2.subtract(this.location, boid.location).normalize().divide(d));
        sepCount++;
      }
      if (d < this.options.neighbourRadius) {
        aliMean.add(boid.velocity);
        aliCount++;
        cohMean.add(boid.location.wrapRelativeTo(this.location, this.wrapWidth, this.wrapHeight));
        cohCount++;
      }
    }

    if (sepCount > 0) sepMean.divide(sepCount);
    if (aliCount > 0) aliMean.divide(aliCount);

    if (cohCount > 0) {
      cohMean.divide(cohCount);
    } else {
      cohMean.x = this.location.x;
      cohMean.y = this.location.y;
    }

    this._cohesionMean = cohMean.copy().subtract(this.location);
    const cohDir = this.steerTo(cohMean);
    aliMean.limit(this.options.maxForce);

    this._separation = sepMean.multiply(this.options.weights.separation);
    this._alignment = aliMean.multiply(this.options.weights.alignment);
    this._cohesion = cohDir.multiply(this.options.weights.cohesion);

    return new Vec2(
      this._separation.x + this._alignment.x + this._cohesion.x,
      this._separation.y + this._alignment.y + this._cohesion.y,
    );
  }

  private gravitate(mouse: Vec2 | null): Vec2 {
    const gravity = new Vec2();
    if (!this.options.mousePhobic || !mouse) return gravity;

    const toMouse = Vec2.subtract(mouse, this.location);
    let d = toMouse.magnitude() - 5; // mouseRadius
    if (d < 0.01) d = 0.01;
    if (d > 0 && d < this.options.neighbourRadius * 5) {
      gravity.add(toMouse.normalize().divide(d * d).multiply(-1));
    }
    return gravity.multiply(this.options.weights.gravity);
  }

  private steerTo(target: Vec2): Vec2 {
    const desired = Vec2.subtract(target, this.location);
    const d = desired.magnitude();
    if (d > 0) {
      desired.normalize();
      if (d < 100) {
        desired.multiply(this.options.maxSpeed * (d / 100));
      } else {
        desired.multiply(this.options.maxSpeed);
      }
      const steer = desired.subtract(this.velocity);
      steer.limit(this.options.maxForce);
      return steer;
    }
    return new Vec2();
  }

  isInspecting(mouse: Vec2 | null): boolean {
    if (this.forceInspection) return true;
    if (!this.inspectable || !mouse) return false;
    return Vec2.subtract(mouse, this.location).magnitude() < this.options.radius * 2;
  }
}

// Rendering helpers
export function renderBoid(
  ctx: CanvasRenderingContext2D,
  boid: Boid,
  fillColor: string,
  strokeColor: string,
): void {
  const r = boid.options.radius;
  const theta = boid.velocity.heading() + Math.PI / 2;
  ctx.save();
  ctx.translate(boid.location.x, boid.location.y);
  ctx.rotate(theta);
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -r * 2);
  ctx.lineTo(-r, r * 2);
  ctx.lineTo(r, r * 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function renderArrow(
  ctx: CanvasRenderingContext2D,
  vec: Vec2,
  scale: number = 10,
): void {
  const m = vec.magnitude() * scale;
  const r = 2;
  const theta = vec.heading() - Math.PI / 2;
  ctx.save();
  ctx.rotate(theta);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, m);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, m);
  ctx.lineTo(-r, m - r * 2);
  ctx.lineTo(r, m - r * 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function renderFlockFrame(
  ctx: CanvasRenderingContext2D,
  boids: Boid[],
  width: number,
  height: number,
  mouse: Vec2 | null,
  inspectBoid: Boid | null,
  scale: number,
  showBorder: boolean,
): void {
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.scale(scale, scale);

  const scaledW = width / scale;
  const scaledH = height / scale;

  // Reset render flags
  for (const b of boids) b.renderedThisStep = false;

  // Render non-inspected boids
  for (const boid of boids) {
    if (inspectBoid && boid === inspectBoid) continue;
    if (boid.isInspecting(mouse)) continue;
    renderBoid(ctx, boid, "#464646", "#0000ff");
    boid.renderedThisStep = true;
  }

  // Render inspected boid with indicators
  const inspector = inspectBoid ?? boids.find((b) => b.isInspecting(mouse));
  if (inspector) {
    const ind = inspector.options.indicators;

    // Neighbour radius
    if (ind.neighbourRadius) {
      ctx.save();
      ctx.translate(inspector.location.x, inspector.location.y);
      ctx.fillStyle = "rgba(100,200,50,0.4)";
      ctx.strokeStyle = "rgba(100,200,50,0.8)";
      ctx.beginPath();
      ctx.arc(0, 0, inspector.options.neighbourRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Separation radius
    if (ind.separationRadius) {
      const desiredSep = inspector.options.desiredSeparation * inspector.options.radius;
      ctx.save();
      ctx.translate(inspector.location.x, inspector.location.y);
      ctx.fillStyle = "rgba(200,10,10,0.4)";
      ctx.strokeStyle = "rgba(200,10,10,0.8)";
      ctx.beginPath();
      ctx.arc(0, 0, desiredSep, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Highlight neighbours
    if (ind.neighbours) {
      const desiredSep = inspector.options.desiredSeparation * inspector.options.radius;
      for (const boid of boids) {
        if (boid === inspector) continue;
        const d = Vec2.subtract(inspector.location, boid.location).magnitude();
        if (d > 0 && d < inspector.options.neighbourRadius) {
          if (d < desiredSep && ind.separation) {
            renderBoid(ctx, boid, "#fa0000", "#640000");
          } else {
            renderBoid(ctx, boid, "#006400", "#006400");
          }
          boid.renderedThisStep = true;

          // Alignment neighbour velocity arrows
          if (ind.alignmentNeighbours) {
            ctx.save();
            ctx.translate(boid.location.x, boid.location.y);
            ctx.strokeStyle = "#00af00";
            ctx.fillStyle = "#00af00";
            const v = boid.velocity.copy().add(boid.velocity.copy().normalize().multiply(1.5));
            renderArrow(ctx, v, 7);
            ctx.restore();
          }
        }
      }
    }

    // Render the inspector boid itself
    renderBoid(ctx, inspector, "#c800c8", "#fa00fa");
    inspector.renderedThisStep = true;

    // Component vectors
    ctx.save();
    ctx.translate(inspector.location.x, inspector.location.y);

    if (ind.velocity) {
      ctx.strokeStyle = "#000";
      ctx.fillStyle = "#000";
      renderArrow(ctx, inspector.velocity, 10);
    }
    if (ind.separation) {
      ctx.strokeStyle = "#fa0000";
      ctx.fillStyle = "#fa0000";
      renderArrow(ctx, inspector._separation, 100);
    }
    if (ind.alignment) {
      ctx.strokeStyle = "#00fa00";
      ctx.fillStyle = "#00fa00";
      renderArrow(ctx, inspector._alignment, 300);
    }
    if (ind.cohesion) {
      ctx.strokeStyle = "#0000fa";
      ctx.fillStyle = "#0000fa";
      renderArrow(ctx, inspector._cohesion, 300);
    }
    if (ind.cohesionMean) {
      ctx.strokeStyle = "#fa00fa";
      ctx.fillStyle = "#fa00fa";
      renderArrow(ctx, inspector._cohesionMean, 1);
    }
    if (ind.cohesionNeighbours) {
      ctx.strokeStyle = "#640064";
      ctx.fillStyle = "#640064";
      ctx.save();
      ctx.translate(inspector._cohesionMean.x, inspector._cohesionMean.y);
      const spot = Vec2.add(inspector._cohesionMean, inspector.location);
      for (const boid of boids) {
        if (boid === inspector) continue;
        const d = Vec2.subtract(inspector.location, boid.location).magnitude();
        if (d > 0 && d < inspector.options.neighbourRadius) {
          renderArrow(ctx, Vec2.subtract(boid.location, spot), 1);
        }
      }
      ctx.restore();
    }

    ctx.restore();
  }

  if (showBorder) {
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1 / scale;
    ctx.strokeRect(0, 0, scaledW, scaledH);
  }

  ctx.restore();
}

export interface FlockConfig {
  width: number;
  height: number;
  numBoids: number;
  scale: number;
  boidOptions: Partial<BoidOptions>;
  inspectOne: boolean;
  startRunning: boolean;
  showBorder: boolean;
}

export function createBoids(config: FlockConfig): Boid[] {
  const scaledW = config.width / config.scale;
  const scaledH = config.height / config.scale;
  const start = new Vec2(scaledW / 2, scaledH / 2);

  return Array.from({ length: config.numBoids }, () => {
    const velocity = new Vec2(Math.random() * 2 - 1, Math.random() * 2 - 1);
    return new Boid(start, velocity, scaledW, scaledH, config.boidOptions);
  });
}
