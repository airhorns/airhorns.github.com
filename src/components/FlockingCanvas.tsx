import { useRef, useMemo, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// --- Simulation constants ---
const BOID_COUNT = 3000;
const MAX_SPEED = 0.28;
const MIN_SPEED = 0.1;
const VISUAL_RANGE = 3.5;
const SEPARATION_DIST = 0.6;
const COHESION_FACTOR = 0.006;
const ALIGNMENT_FACTOR = 0.04; // reduced — was causing lock-step
const SEPARATION_FACTOR = 0.07;
const BOUNDS = 25;
const CENTER_PULL = 0.0005;
const MOUSE_RANGE = 8;
const MOUSE_FACTOR = 0.03;
const Z_FLATTEN = 0.002;
const JITTER = 0.008;
const WIND_STRENGTH = 0.012;
const WIND_CYCLE = 0.0003; // how fast wind direction shifts

// Spatial hash grid for O(n) neighbor lookups
class SpatialGrid {
  cellSize: number;
  cells: Map<string, number[]>;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  clear() {
    this.cells.clear();
  }

  key(x: number, y: number, z: number): string {
    const cs = this.cellSize;
    return `${Math.floor(x / cs)},${Math.floor(y / cs)},${Math.floor(z / cs)}`;
  }

  insert(index: number, x: number, y: number, z: number) {
    const k = this.key(x, y, z);
    let cell = this.cells.get(k);
    if (!cell) {
      cell = [];
      this.cells.set(k, cell);
    }
    cell.push(index);
  }

  query(x: number, y: number, z: number, range: number): number[] {
    const results: number[] = [];
    const cs = this.cellSize;
    const minX = Math.floor((x - range) / cs);
    const maxX = Math.floor((x + range) / cs);
    const minY = Math.floor((y - range) / cs);
    const maxY = Math.floor((y + range) / cs);
    const minZ = Math.floor((z - range) / cs);
    const maxZ = Math.floor((z + range) / cs);

    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        for (let cz = minZ; cz <= maxZ; cz++) {
          const cell = this.cells.get(`${cx},${cy},${cz}`);
          if (cell) {
            for (let i = 0; i < cell.length; i++) {
              results.push(cell[i]);
            }
          }
        }
      }
    }
    return results;
  }
}

// --- Boids component using InstancedMesh ---
function Boids() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { size, camera } = useThree();

  // Flat arrays for position & velocity (SoA for cache performance)
  const state = useMemo(() => {
    const px = new Float32Array(BOID_COUNT);
    const py = new Float32Array(BOID_COUNT);
    const pz = new Float32Array(BOID_COUNT);
    const vx = new Float32Array(BOID_COUNT);
    const vy = new Float32Array(BOID_COUNT);
    const vz = new Float32Array(BOID_COUNT);

    for (let i = 0; i < BOID_COUNT; i++) {
      px[i] = (Math.random() - 0.5) * BOUNDS * 0.5;
      py[i] = (Math.random() - 0.5) * BOUNDS * 0.5;
      pz[i] = (Math.random() - 0.5) * BOUNDS * 0.15; // start flattened in z
      const angle1 = Math.random() * Math.PI * 2;
      const angle2 = Math.random() * Math.PI * 2;
      const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
      vx[i] = Math.cos(angle1) * Math.cos(angle2) * speed;
      vy[i] = Math.sin(angle2) * speed;
      vz[i] = Math.sin(angle1) * Math.cos(angle2) * speed;
    }

    return { px, py, pz, vx, vy, vz };
  }, []);

  const grid = useMemo(() => new SpatialGrid(VISUAL_RANGE), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const mouseWorld = useRef(new THREE.Vector3(0, 0, 0));
  const frameCount = useRef(0);
  const mouseActive = useRef(false);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouseNDC = useRef(new THREE.Vector2(0, 0));
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseNDC.current.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseNDC.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    mouseActive.current = true;
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseActive.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const { px, py, pz, vx, vy, vz } = state;

    // Update mouse world position
    if (mouseActive.current) {
      raycaster.setFromCamera(mouseNDC.current, camera);
      const target = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, target);
      if (target) mouseWorld.current.copy(target);
    }

    // Build spatial grid
    grid.clear();
    for (let i = 0; i < BOID_COUNT; i++) {
      grid.insert(i, px[i], py[i], pz[i]);
    }

    // Update boids
    for (let i = 0; i < BOID_COUNT; i++) {
      let cohX = 0, cohY = 0, cohZ = 0, cohCount = 0;
      let aliVx = 0, aliVy = 0, aliVz = 0, aliCount = 0;
      let sepX = 0, sepY = 0, sepZ = 0;

      const neighbors = grid.query(px[i], py[i], pz[i], VISUAL_RANGE);

      for (let ni = 0; ni < neighbors.length; ni++) {
        const j = neighbors[ni];
        if (i === j) continue;

        const dx = px[j] - px[i];
        const dy = py[j] - py[i];
        const dz = pz[j] - pz[i];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < VISUAL_RANGE) {
          cohX += dx; cohY += dy; cohZ += dz;
          cohCount++;
          aliVx += vx[j]; aliVy += vy[j]; aliVz += vz[j];
          aliCount++;
        }

        if (dist < SEPARATION_DIST && dist > 0) {
          const f = 1 / dist;
          sepX -= dx * f;
          sepY -= dy * f;
          sepZ -= dz * f;
        }
      }

      if (cohCount > 0) {
        vx[i] += (cohX / cohCount) * COHESION_FACTOR;
        vy[i] += (cohY / cohCount) * COHESION_FACTOR;
        vz[i] += (cohZ / cohCount) * COHESION_FACTOR;
      }
      if (aliCount > 0) {
        vx[i] += ((aliVx / aliCount) - vx[i]) * ALIGNMENT_FACTOR;
        vy[i] += ((aliVy / aliCount) - vy[i]) * ALIGNMENT_FACTOR;
        vz[i] += ((aliVz / aliCount) - vz[i]) * ALIGNMENT_FACTOR;
      }
      vx[i] += sepX * SEPARATION_FACTOR;
      vy[i] += sepY * SEPARATION_FACTOR;
      vz[i] += sepZ * SEPARATION_FACTOR;

      // Soft boundary — pull toward center
      vx[i] -= px[i] * CENTER_PULL;
      vy[i] -= py[i] * CENTER_PULL;
      vz[i] -= pz[i] * CENTER_PULL;

      // Flatten in z — discourage depth spread
      vz[i] -= pz[i] * Z_FLATTEN;

      // Mouse avoidance
      if (mouseActive.current) {
        const mx = px[i] - mouseWorld.current.x;
        const my = py[i] - mouseWorld.current.y;
        const mDist = Math.sqrt(mx * mx + my * my + pz[i] * pz[i]);
        if (mDist < MOUSE_RANGE && mDist > 0) {
          const force = ((MOUSE_RANGE - mDist) / MOUSE_RANGE) ** 2;
          vx[i] += (mx / mDist) * force * MOUSE_FACTOR;
          vy[i] += (my / mDist) * force * MOUSE_FACTOR;
          vz[i] += (pz[i] / mDist) * force * MOUSE_FACTOR;
        }
      }

      // Random jitter to break lock-step
      vx[i] += (Math.random() - 0.5) * JITTER;
      vy[i] += (Math.random() - 0.5) * JITTER;
      vz[i] += (Math.random() - 0.5) * JITTER * 0.3;

      // Limit speed
      const speed = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i]);
      if (speed > MAX_SPEED) {
        const f = MAX_SPEED / speed;
        vx[i] *= f; vy[i] *= f; vz[i] *= f;
      } else if (speed < MIN_SPEED && speed > 0) {
        const f = MIN_SPEED / speed;
        vx[i] *= f; vy[i] *= f; vz[i] *= f;
      }

      // Move
      px[i] += vx[i];
      py[i] += vy[i];
      pz[i] += vz[i];

      // Wrap
      const half = BOUNDS / 2;
      if (px[i] > half) px[i] -= BOUNDS;
      if (px[i] < -half) px[i] += BOUNDS;
      if (py[i] > half) py[i] -= BOUNDS;
      if (py[i] < -half) py[i] += BOUNDS;
      if (pz[i] > half) pz[i] -= BOUNDS;
      if (pz[i] < -half) pz[i] += BOUNDS;
    }

    // Update instance matrices
    for (let i = 0; i < BOID_COUNT; i++) {
      dummy.position.set(px[i], py[i], pz[i]);

      // Orient boid along velocity
      const speed = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i]);
      if (speed > 0.001) {
        dummy.lookAt(px[i] + vx[i], py[i] + vy[i], pz[i] + vz[i]);
      }

      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  // Small elongated shape like a bird silhouette
  const geometry = useMemo(() => {
    const geo = new THREE.ConeGeometry(0.032, 0.16, 3);
    geo.rotateX(Math.PI / 2);
    return geo;
  }, []);

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, BOID_COUNT]}>
      <meshBasicMaterial color="#0a0a18" transparent opacity={0.92} />
    </instancedMesh>
  );
}

// --- Noise overlay as a CSS layer ---
function NoiseOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = 1024;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 10;
    }
    ctx.putImageData(imageData, 0, 0);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 2,
        width: "100%",
        height: "100%",
        opacity: 1,
      }}
    />
  );
}

// --- Gradient background ---
function GradientBackground() {
  const elapsed = useRef(0);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animId: number;
    const start = Date.now();

    const update = () => {
      elapsed.current = (Date.now() - start) / 1000;
      const t = elapsed.current;

      const hue1 = 230 + Math.sin(t * 0.04) * 30;
      const hue2 = 280 + Math.sin(t * 0.025 + 2) * 40;
      const hue3 = 190 + Math.sin(t * 0.033 + 4) * 25;
      const sat1 = 20 + Math.sin(t * 0.02) * 10;
      const sat2 = 25 + Math.sin(t * 0.03 + 1) * 12;
      const angle = (t * 3) % 360;

      if (divRef.current) {
        divRef.current.style.background = `linear-gradient(${angle}deg, 
          hsl(${hue1}, ${sat1}%, 93%), 
          hsl(${hue3}, ${(sat1 + sat2) / 2}%, 94%), 
          hsl(${hue2}, ${sat2}%, 91%))`;
      }

      animId = requestAnimationFrame(update);
    };

    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div
      ref={divRef}
      className="fixed inset-0"
      style={{ zIndex: -1 }}
    />
  );
}

// --- Main export ---
const FlockingCanvas = () => {
  return (
    <>
      <GradientBackground />
      <Canvas
        camera={{ position: [0, 0, 65], fov: 50 }}
        style={{ position: "fixed", inset: 0, zIndex: 1 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <Boids />
      </Canvas>
      <NoiseOverlay />
    </>
  );
};

export default FlockingCanvas;
