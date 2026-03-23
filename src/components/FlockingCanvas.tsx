import { useEffect, useRef, useCallback } from "react";

interface Boid {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const BOID_COUNT = 120;
const MAX_SPEED = 2.5;
const MIN_SPEED = 1.2;
const VISUAL_RANGE = 75;
const SEPARATION_DIST = 28;
const COHESION_FACTOR = 0.003;
const ALIGNMENT_FACTOR = 0.04;
const SEPARATION_FACTOR = 0.05;

function createBoid(w: number, h: number): Boid {
  const angle = Math.random() * Math.PI * 2;
  const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  };
}

function limitSpeed(boid: Boid) {
  const speed = Math.sqrt(boid.vx * boid.vx + boid.vy * boid.vy);
  if (speed > MAX_SPEED) {
    boid.vx = (boid.vx / speed) * MAX_SPEED;
    boid.vy = (boid.vy / speed) * MAX_SPEED;
  }
  if (speed < MIN_SPEED) {
    boid.vx = (boid.vx / speed) * MIN_SPEED;
    boid.vy = (boid.vy / speed) * MIN_SPEED;
  }
}

function wrapDist(a: number, b: number, size: number): number {
  let d = b - a;
  if (d > size / 2) d -= size;
  if (d < -size / 2) d += size;
  return d;
}

const FlockingCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boidsRef = useRef<Boid[]>([]);
  const animRef = useRef<number>(0);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    boidsRef.current = Array.from({ length: BOID_COUNT }, () => createBoid(w, h));
  }, []);

  useEffect(() => {
    init();
    const handleResize = () => init();
    window.addEventListener("resize", handleResize);

    const animate = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const boids = boidsRef.current;

      // Fade trail
      ctx.fillStyle = "hsla(40, 20%, 96%, 0.15)";
      ctx.fillRect(0, 0, w, h);

      // Update boids
      for (let i = 0; i < boids.length; i++) {
        const b = boids[i];
        let cohX = 0, cohY = 0, cohCount = 0;
        let aliVx = 0, aliVy = 0, aliCount = 0;
        let sepX = 0, sepY = 0;

        for (let j = 0; j < boids.length; j++) {
          if (i === j) continue;
          const other = boids[j];
          const dx = wrapDist(b.x, other.x, w);
          const dy = wrapDist(b.y, other.y, h);
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < VISUAL_RANGE) {
            cohX += dx;
            cohY += dy;
            cohCount++;
            aliVx += other.vx;
            aliVy += other.vy;
            aliCount++;
          }

          if (dist < SEPARATION_DIST) {
            sepX -= dx;
            sepY -= dy;
          }
        }

        if (cohCount > 0) {
          b.vx += (cohX / cohCount) * COHESION_FACTOR;
          b.vy += (cohY / cohCount) * COHESION_FACTOR;
        }
        if (aliCount > 0) {
          b.vx += ((aliVx / aliCount) - b.vx) * ALIGNMENT_FACTOR;
          b.vy += ((aliVy / aliCount) - b.vy) * ALIGNMENT_FACTOR;
        }
        b.vx += sepX * SEPARATION_FACTOR;
        b.vy += sepY * SEPARATION_FACTOR;

        limitSpeed(b);

        b.x = (b.x + b.vx + w) % w;
        b.y = (b.y + b.vy + h) % h;
      }

      // Draw boids
      for (const b of boids) {
        const angle = Math.atan2(b.vy, b.vx);
        const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        const alpha = 0.4 + (speed / MAX_SPEED) * 0.6;
        const size = 3 + (speed / MAX_SPEED) * 2;

        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(angle);

        // Triangle boid
        ctx.beginPath();
        ctx.moveTo(size * 2, 0);
        ctx.lineTo(-size, -size * 0.7);
        ctx.lineTo(-size, size * 0.7);
        ctx.closePath();

        ctx.fillStyle = `hsla(220, 50%, 40%, ${alpha})`;
        ctx.fill();

        ctx.shadowColor = "hsla(220, 50%, 40%, 0.15)";
        ctx.shadowBlur = 4;
        ctx.fill();

        ctx.restore();
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, [init]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 0 }}
    />
  );
};

export default FlockingCanvas;
