import { useEffect, useRef, useCallback } from "react";

interface Boid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hue: number;
  size: number;
}

const BOID_COUNT = 100;
const MAX_SPEED = 2.2;
const MIN_SPEED = 0.8;
const VISUAL_RANGE = 80;
const SEPARATION_DIST = 30;
const COHESION_FACTOR = 0.003;
const ALIGNMENT_FACTOR = 0.045;
const SEPARATION_FACTOR = 0.05;
const MOUSE_RANGE = 180;
const MOUSE_FACTOR = 0.08;

function createBoid(w: number, h: number): Boid {
  const angle = Math.random() * Math.PI * 2;
  const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    hue: 210 + (Math.random() - 0.5) * 40, // 190-230 range
    size: 2.5 + Math.random() * 2,
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
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const dprRef = useRef(1);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
    boidsRef.current = Array.from({ length: BOID_COUNT }, () => createBoid(w, h));
  }, []);

  useEffect(() => {
    init();
    const handleResize = () => init();
    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    };
    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    const animate = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = dprRef.current;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const boids = boidsRef.current;
      const mouse = mouseRef.current;

      // Clear fully — no ghosting
      ctx.clearRect(0, 0, w, h);

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

        // Mouse avoidance
        if (mouse.active) {
          const mdx = b.x - mouse.x;
          const mdy = b.y - mouse.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mdist < MOUSE_RANGE && mdist > 0) {
            const force = (MOUSE_RANGE - mdist) / MOUSE_RANGE;
            b.vx += (mdx / mdist) * force * MOUSE_FACTOR;
            b.vy += (mdy / mdist) * force * MOUSE_FACTOR;
          }
        }

        limitSpeed(b);

        b.x = (b.x + b.vx + w) % w;
        b.y = (b.y + b.vy + h) % h;
      }

      // Draw boids
      ctx.save();
      for (const b of boids) {
        const angle = Math.atan2(b.vy, b.vx);
        const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        const t = speed / MAX_SPEED;
        const alpha = 0.35 + t * 0.55;
        const s = b.size;

        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(angle);

        // Elongated body shape
        ctx.beginPath();
        ctx.moveTo(s * 2.5, 0);
        ctx.quadraticCurveTo(s * 0.5, -s * 0.6, -s * 1.2, -s * 0.15);
        ctx.quadraticCurveTo(-s * 0.2, 0, -s * 1.2, s * 0.15);
        ctx.quadraticCurveTo(s * 0.5, s * 0.6, s * 2.5, 0);
        ctx.closePath();

        const sat = 45 + t * 20;
        const light = 35 + (1 - t) * 15;
        ctx.fillStyle = `hsla(${b.hue}, ${sat}%, ${light}%, ${alpha})`;
        ctx.fill();

        ctx.restore();
      }
      ctx.restore();

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [init]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0"
      style={{ zIndex: 0 }}
    />
  );
};

export default FlockingCanvas;
