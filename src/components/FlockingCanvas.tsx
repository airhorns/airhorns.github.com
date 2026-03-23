import { useRef, useMemo, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// --- Simulation constants ---
const BOID_COUNT = 3000;
const MAX_SPEED = 0.28;
const MIN_SPEED = 0.1;
const VISUAL_RANGE = 3.5;
const VISUAL_RANGE_SQ = VISUAL_RANGE * VISUAL_RANGE;
const SEPARATION_DIST = 0.6;
const SEPARATION_DIST_SQ = SEPARATION_DIST * SEPARATION_DIST;
const COHESION_FACTOR = 0.006;
const ALIGNMENT_FACTOR = 0.04;
const SEPARATION_FACTOR = 0.07;
const BOUNDS = 25;
const CENTER_PULL = 0.0005;
const MOUSE_RANGE = 8;
const MOUSE_RANGE_SQ = MOUSE_RANGE * MOUSE_RANGE;
const MOUSE_FACTOR = 0.03;
const Z_FLATTEN = 0.002;
const JITTER = 0.008;

// Integer-keyed spatial hash — avoids string alloc per cell
class SpatialGrid {
  cellSize: number;
  invCellSize: number;
  cells: Map<number, Int32Array>;
  counts: Map<number, number>;
  // Pre-allocated neighbor buffer
  neighborBuf: Int32Array;
  neighborCount: number;

  constructor(cellSize: number, maxNeighbors: number) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    this.cells = new Map();
    this.counts = new Map();
    this.neighborBuf = new Int32Array(maxNeighbors);
    this.neighborCount = 0;
  }

  clear() {
    // Reset counts instead of clearing map — reuse allocated arrays
    this.counts.forEach((_, k) => this.counts.set(k, 0));
  }

  // Spatial hash using integer math — no string allocation
  hash(ix: number, iy: number, iz: number): number {
    // Large primes for spatial hashing
    return ((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) | 0;
  }

  insert(index: number, x: number, y: number, z: number) {
    const ix = Math.floor(x * this.invCellSize);
    const iy = Math.floor(y * this.invCellSize);
    const iz = Math.floor(z * this.invCellSize);
    const k = this.hash(ix, iy, iz);

    let cell = this.cells.get(k);
    let count = this.counts.get(k) || 0;

    if (!cell) {
      cell = new Int32Array(64); // pre-allocate reasonable capacity
      this.cells.set(k, cell);
    } else if (count >= cell.length) {
      const newCell = new Int32Array(cell.length * 2);
      newCell.set(cell);
      cell = newCell;
      this.cells.set(k, cell);
    }

    cell[count] = index;
    this.counts.set(k, count + 1);
  }

  // Query neighbors into pre-allocated buffer — zero allocation
  queryInto(x: number, y: number, z: number, range: number): number {
    let total = 0;
    const inv = this.invCellSize;
    const minX = Math.floor((x - range) * inv);
    const maxX = Math.floor((x + range) * inv);
    const minY = Math.floor((y - range) * inv);
    const maxY = Math.floor((y + range) * inv);
    const minZ = Math.floor((z - range) * inv);
    const maxZ = Math.floor((z + range) * inv);
    const buf = this.neighborBuf;

    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        for (let cz = minZ; cz <= maxZ; cz++) {
          const k = this.hash(cx, cy, cz);
          const count = this.counts.get(k);
          if (!count) continue;
          const cell = this.cells.get(k)!;
          for (let i = 0; i < count; i++) {
            buf[total++] = cell[i];
          }
        }
      }
    }
    this.neighborCount = total;
    return total;
  }
}

// --- Boids component using InstancedMesh ---
function Boids() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();

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
      pz[i] = (Math.random() - 0.5) * BOUNDS * 0.15;
      const angle1 = Math.random() * Math.PI * 2;
      const angle2 = Math.random() * Math.PI * 2;
      const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
      vx[i] = Math.cos(angle1) * Math.cos(angle2) * speed;
      vy[i] = Math.sin(angle2) * speed;
      vz[i] = Math.sin(angle1) * Math.cos(angle2) * speed;
    }

    return { px, py, pz, vx, vy, vz };
  }, []);

  const grid = useMemo(() => new SpatialGrid(VISUAL_RANGE, BOID_COUNT * 4), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const mouseWorld = useRef(new THREE.Vector3(0, 0, 0));
  const mouseActive = useRef(false);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouseNDC = useRef(new THREE.Vector2(0, 0));
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const rayTarget = useMemo(() => new THREE.Vector3(), []);

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

    // Update mouse world position — reuse rayTarget
    if (mouseActive.current) {
      raycaster.setFromCamera(mouseNDC.current, camera);
      raycaster.ray.intersectPlane(plane, rayTarget);
      if (rayTarget) mouseWorld.current.copy(rayTarget);
    }

    // Build spatial grid
    grid.clear();
    for (let i = 0; i < BOID_COUNT; i++) {
      grid.insert(i, px[i], py[i], pz[i]);
    }

    const mouseAct = mouseActive.current;
    const mwx = mouseWorld.current.x;
    const mwy = mouseWorld.current.y;
    const half = BOUNDS / 2;
    const buf = grid.neighborBuf;

    // Update boids
    for (let i = 0; i < BOID_COUNT; i++) {
      let cohX = 0, cohY = 0, cohZ = 0, cohCount = 0;
      let aliVx = 0, aliVy = 0, aliVz = 0, aliCount = 0;
      let sepX = 0, sepY = 0, sepZ = 0;

      const pxi = px[i], pyi = py[i], pzi = pz[i];
      const nCount = grid.queryInto(pxi, pyi, pzi, VISUAL_RANGE);

      for (let ni = 0; ni < nCount; ni++) {
        const j = buf[ni];
        if (i === j) continue;

        const dx = px[j] - pxi;
        const dy = py[j] - pyi;
        const dz = pz[j] - pzi;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < VISUAL_RANGE_SQ) {
          cohX += dx; cohY += dy; cohZ += dz;
          cohCount++;
          aliVx += vx[j]; aliVy += vy[j]; aliVz += vz[j];
          aliCount++;
        }

        if (distSq < SEPARATION_DIST_SQ && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const f = 1 / dist;
          sepX -= dx * f;
          sepY -= dy * f;
          sepZ -= dz * f;
        }
      }

      if (cohCount > 0) {
        const inv = 1 / cohCount;
        vx[i] += cohX * inv * COHESION_FACTOR;
        vy[i] += cohY * inv * COHESION_FACTOR;
        vz[i] += cohZ * inv * COHESION_FACTOR;
      }
      if (aliCount > 0) {
        const inv = 1 / aliCount;
        vx[i] += (aliVx * inv - vx[i]) * ALIGNMENT_FACTOR;
        vy[i] += (aliVy * inv - vy[i]) * ALIGNMENT_FACTOR;
        vz[i] += (aliVz * inv - vz[i]) * ALIGNMENT_FACTOR;
      }
      vx[i] += sepX * SEPARATION_FACTOR;
      vy[i] += sepY * SEPARATION_FACTOR;
      vz[i] += sepZ * SEPARATION_FACTOR;

      // Soft boundary
      vx[i] -= pxi * CENTER_PULL;
      vy[i] -= pyi * CENTER_PULL;
      vz[i] -= pzi * CENTER_PULL;

      // Flatten z
      vz[i] -= pzi * Z_FLATTEN;

      // Mouse avoidance
      if (mouseAct) {
        const mx = pxi - mwx;
        const my = pyi - mwy;
        const mDistSq = mx * mx + my * my + pzi * pzi;
        if (mDistSq < MOUSE_RANGE_SQ && mDistSq > 0) {
          const mDist = Math.sqrt(mDistSq);
          const force = ((MOUSE_RANGE - mDist) / MOUSE_RANGE) ** 2;
          const invD = 1 / mDist;
          vx[i] += mx * invD * force * MOUSE_FACTOR;
          vy[i] += my * invD * force * MOUSE_FACTOR;
          vz[i] += pzi * invD * force * MOUSE_FACTOR;
        }
      }

      // Random jitter
      vx[i] += (Math.random() - 0.5) * JITTER;
      vy[i] += (Math.random() - 0.5) * JITTER;
      vz[i] += (Math.random() - 0.5) * JITTER * 0.3;

      // Limit speed
      const speedSq = vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i];
      if (speedSq > MAX_SPEED * MAX_SPEED) {
        const f = MAX_SPEED / Math.sqrt(speedSq);
        vx[i] *= f; vy[i] *= f; vz[i] *= f;
      } else if (speedSq < MIN_SPEED * MIN_SPEED && speedSq > 0) {
        const f = MIN_SPEED / Math.sqrt(speedSq);
        vx[i] *= f; vy[i] *= f; vz[i] *= f;
      }

      // Move
      px[i] += vx[i];
      py[i] += vy[i];
      pz[i] += vz[i];

      // Wrap
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

      const speedSq = vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i];
      if (speedSq > 0.000001) {
        dummy.lookAt(px[i] + vx[i], py[i] + vy[i], pz[i] + vz[i]);
      }

      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

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

// --- Noise overlay ---
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
      style={{ zIndex: 2, width: "100%", height: "100%", opacity: 1 }}
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

  return <div ref={divRef} className="fixed inset-0" style={{ zIndex: -1 }} />;
}

// --- Main export ---
const FlockingCanvas = () => {
  return (
    <>
      <GradientBackground />
      <Canvas
        camera={{ position: [0, 0, 65], fov: 50 }}
        style={{ position: "fixed", inset: 0, zIndex: 1 }}
        gl={{ alpha: true, antialias: false }}
        dpr={[1, 1.5]}
      >
        <Boids />
      </Canvas>
      <NoiseOverlay />
    </>
  );
};

export default FlockingCanvas;
