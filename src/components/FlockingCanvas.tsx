import { useRef, useMemo, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { initBoidGPU, stepBoidGPU, destroyBoidGPU, type BoidGPUState, type SimParams } from "@/lib/boids-gpu";

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
const BOUNDS = 40;
const CENTER_PULL = 0.002;
const MOUSE_RANGE = 8;
const EDGE_MARGIN = 5;
const EDGE_FORCE = 0.08;
const MOUSE_RANGE_SQ = MOUSE_RANGE * MOUSE_RANGE;
const MOUSE_FACTOR = 0.03;
const Z_FLATTEN = 0.002;
const JITTER = 0.008;

// Spatial hash for CPU fallback
class SpatialGrid {
  cellSize: number;
  invCellSize: number;
  cells: Map<string, Int32Array>;
  counts: Map<string, number>;
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
    this.counts.forEach((_, k) => this.counts.set(k, 0));
  }

  key(ix: number, iy: number, iz: number): string {
    return `${ix},${iy},${iz}`;
  }

  insert(index: number, x: number, y: number, z: number) {
    const ix = Math.floor(x * this.invCellSize);
    const iy = Math.floor(y * this.invCellSize);
    const iz = Math.floor(z * this.invCellSize);
    const k = this.key(ix, iy, iz);
    let cell = this.cells.get(k);
    let count = this.counts.get(k) || 0;
    if (!cell) {
      cell = new Int32Array(64);
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
          const k = this.key(cx, cy, cz);
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

// --- Boids component ---
function Boids() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();

  // Initial state
  const state = useMemo(() => {
    const px = new Float32Array(BOID_COUNT);
    const py = new Float32Array(BOID_COUNT);
    const pz = new Float32Array(BOID_COUNT);
    const vx = new Float32Array(BOID_COUNT);
    const vy = new Float32Array(BOID_COUNT);
    const vz = new Float32Array(BOID_COUNT);

    let sumPx = 0, sumPy = 0, sumPz = 0;
    let sumVx = 0, sumVy = 0, sumVz = 0;

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
      sumPx += px[i];
      sumPy += py[i];
      sumPz += pz[i];
      sumVx += vx[i];
      sumVy += vy[i];
      sumVz += vz[i];
    }

    const meanPx = sumPx / BOID_COUNT;
    const meanPy = sumPy / BOID_COUNT;
    const meanPz = sumPz / BOID_COUNT;
    const meanVx = sumVx / BOID_COUNT;
    const meanVy = sumVy / BOID_COUNT;
    const meanVz = sumVz / BOID_COUNT;

    for (let i = 0; i < BOID_COUNT; i++) {
      px[i] -= meanPx;
      py[i] -= meanPy;
      pz[i] -= meanPz;
      vx[i] -= meanVx;
      vy[i] -= meanVy;
      vz[i] -= meanVz;
    }

    return { px, py, pz, vx, vy, vz };
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const mouseWorld = useRef(new THREE.Vector3(0, 0, 0));
  const mouseActive = useRef(false);
  const hasRealPointerMove = useRef(false);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouseNDC = useRef(new THREE.Vector2(0, 0));
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const rayTarget = useMemo(() => new THREE.Vector3(), []);

  // GPU state
  const gpuRef = useRef<BoidGPUState | null>(null);
  const gpuPending = useRef(false);
  const gpuReady = useRef(false);
  const gpuData = useRef<Float32Array | null>(null);

  // Init GPU
  useEffect(() => {
    const { px, py, pz, vx, vy, vz } = state;
    const positions = new Float32Array(BOID_COUNT * 3);
    const velocities = new Float32Array(BOID_COUNT * 3);
    for (let i = 0; i < BOID_COUNT; i++) {
      positions[i * 3] = px[i];
      positions[i * 3 + 1] = py[i];
      positions[i * 3 + 2] = pz[i];
      velocities[i * 3] = vx[i];
      velocities[i * 3 + 1] = vy[i];
      velocities[i * 3 + 2] = vz[i];
    }

    initBoidGPU(BOID_COUNT, positions, velocities).then((gpu) => {
      if (gpu) {
        gpuRef.current = gpu;
        gpuReady.current = true;
        console.log("🚀 WebGPU boid simulation active");
      } else {
        console.error("WebGPU unavailable — GPU-only mode enabled, so boids will not render here.");
      }
    });

    return () => {
      if (gpuRef.current) {
        destroyBoidGPU(gpuRef.current);
        gpuRef.current = null;
      }
    };
  }, [state]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!hasRealPointerMove.current) {
      if (e.movementX === 0 && e.movementY === 0) return;
      hasRealPointerMove.current = true;
    }

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

  // Kick off GPU step (async, non-blocking)
  const kickGPUStep = useCallback(() => {
    const gpu = gpuRef.current;
    if (!gpu || gpuPending.current) return;

    // Update mouse
    if (mouseActive.current) {
      raycaster.setFromCamera(mouseNDC.current, camera);
      raycaster.ray.intersectPlane(plane, rayTarget);
      if (rayTarget) mouseWorld.current.copy(rayTarget);
    }

    const simParams: SimParams = {
      maxSpeed: MAX_SPEED,
      minSpeed: MIN_SPEED,
      visualRange: VISUAL_RANGE,
      separationDist: SEPARATION_DIST,
      cohesionFactor: COHESION_FACTOR,
      alignmentFactor: ALIGNMENT_FACTOR,
      separationFactor: SEPARATION_FACTOR,
      bounds: BOUNDS,
      centerPull: CENTER_PULL,
      zFlatten: Z_FLATTEN,
      edgeMargin: EDGE_MARGIN,
      edgeForce: EDGE_FORCE,
      jitter: JITTER,
      mouseX: mouseWorld.current.x,
      mouseY: mouseWorld.current.y,
      mouseActive: mouseActive.current,
      mouseRange: MOUSE_RANGE,
      mouseFactor: MOUSE_FACTOR,
    };

    gpuPending.current = true;
    stepBoidGPU(gpu, simParams).then((data) => {
      gpuData.current = data;
      gpuPending.current = false;
    }).catch(() => {
      gpuPending.current = false;
    });
  }, [camera, plane, raycaster, rayTarget]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || !gpuReady.current) return;

    kickGPUStep();

    const data = gpuData.current;
    if (!data) return;

    for (let i = 0; i < BOID_COUNT; i++) {
      const x = data[i * 4];
      const y = data[i * 4 + 1];
      const z = data[i * 4 + 2];
      dummy.position.set(x, y, z);
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
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animId: number;
    const start = Date.now();

    const update = () => {
      const t = (Date.now() - start) / 1000;
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
