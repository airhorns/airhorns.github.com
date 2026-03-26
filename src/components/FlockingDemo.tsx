import { useRef, useEffect, useCallback, useState } from "react";
import {
  type FlockConfig,
  type BoidOptions,
  createBoids,
  renderFlockFrame,
  Vec2,
  type Boid,
} from "@/lib/flocking-2d";

interface FlockingDemoProps {
  width?: number;
  height?: number;
  numBoids?: number;
  scale?: number;
  boidOptions?: Partial<BoidOptions>;
  inspectOne?: boolean;
  startRunning?: boolean;
  showBorder?: boolean;
  className?: string;
}

export function FlockingDemo({
  width = 300,
  height = 300,
  numBoids = 15,
  scale = 1,
  boidOptions = {},
  inspectOne = false,
  startRunning = true,
  showBorder = true,
  className,
}: FlockingDemoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boidsRef = useRef<Boid[]>([]);
  const runningRef = useRef(startRunning);
  const mouseRef = useRef<Vec2 | null>(null);
  const rafRef = useRef<number>(0);
  const [running, setRunning] = useState(startRunning);

  // Create boids on mount
  useEffect(() => {
    const config: FlockConfig = {
      width,
      height,
      numBoids,
      scale,
      boidOptions,
      inspectOne,
      startRunning,
      showBorder,
    };
    boidsRef.current = createBoids(config);

    if (inspectOne && boidsRef.current.length > 0) {
      boidsRef.current[boidsRef.current.length - 1].forceInspection = true;
    }
  }, [width, height, numBoids, scale, inspectOne, startRunning, showBorder]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = 0;
    const frameInterval = 1000 / 30; // ~30fps

    const animate = (time: number) => {
      rafRef.current = requestAnimationFrame(animate);
      const delta = time - lastTime;
      if (delta < frameInterval) return;
      lastTime = time - (delta % frameInterval);

      const boids = boidsRef.current;
      const mouse = mouseRef.current;

      if (runningRef.current) {
        for (const boid of boids) {
          boid.step(boids, mouse);
        }
      }

      const inspector =
        inspectOne && boids.length > 0 ? boids[boids.length - 1] : null;
      renderFlockFrame(ctx, boids, width, height, mouse, inspector, scale, showBorder);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [width, height, scale, inspectOne, showBorder]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      mouseRef.current = new Vec2(
        ((e.clientX - rect.left) / rect.width) * width / scale,
        ((e.clientY - rect.top) / rect.height) * height / scale,
      );
    },
    [width, height, scale],
  );

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = null;
  }, []);

  const handleClick = useCallback(() => {
    runningRef.current = !runningRef.current;
    setRunning(runningRef.current);
    // When paused, make boids inspectable on hover
    for (const boid of boidsRef.current) {
      boid.inspectable = !runningRef.current;
    }
  }, []);

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: "block", maxWidth: "100%", cursor: "pointer" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
      <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
        {running ? "Click to pause" : "Click to resume"} · Move mouse to repel boids
      </div>
    </div>
  );
}
