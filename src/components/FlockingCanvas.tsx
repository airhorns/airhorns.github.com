import { useRef, useMemo, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { initBoidGPU, stepBoidGPU, destroyBoidGPU, type BoidGPUState, type SimParams } from "@/lib/boids-gpu";

// --- Simulation constants ---
const BOID_COUNT = 4500;
const MAX_SPEED = 0.24;
const MIN_SPEED = 0.14;
const VISUAL_RANGE = 2.8;
const VISUAL_RANGE_SQ = VISUAL_RANGE * VISUAL_RANGE;
const SEPARATION_DIST = 0.7;
const SEPARATION_DIST_SQ = SEPARATION_DIST * SEPARATION_DIST;
const COHESION_FACTOR = 0.005;
const ALIGNMENT_FACTOR = 0.065;
const SEPARATION_FACTOR = 0.035;
const BOUNDS_Z = 15;
const CENTER_PULL = 0.03;
const MOUSE_RANGE = 12;
const EDGE_MARGIN = 10;
const EDGE_FORCE = 0.15;
const MOUSE_RANGE_SQ = MOUSE_RANGE * MOUSE_RANGE;
const MOUSE_FACTOR = 0.03;
const MOUSE_IDLE_MS = 120;
const Z_FLATTEN = 0.03;
const JITTER = 0.002;

// Camera constants (must match Canvas camera props below)
const CAM_Z = 65;
const CAM_FOV = 50;

// --- Boids component ---
function Boids() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { camera, size } = useThree();

  // Derive simulation bounds from the camera frustum so boids fill the full viewport
  const simBounds = useMemo(() => {
    const halfHeight = CAM_Z * Math.tan((CAM_FOV / 2) * Math.PI / 180);
    const aspect = size.width / Math.max(size.height, 1);
    return {
      x: halfHeight * 2 * Math.max(aspect, 1),
      y: halfHeight * 2,
      z: BOUNDS_Z,
    };
  }, [size.height, size.width]);

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
      px[i] = (Math.random() - 0.5) * simBounds.x * 0.5;
      py[i] = (Math.random() - 0.5) * simBounds.y * 0.5;
      pz[i] = (Math.random() - 0.5) * simBounds.z * 0.15;
      // Isotropic velocity via rejection sampling on unit sphere
      let dx, dy, dz, lenSq;
      do {
        dx = Math.random() * 2 - 1;
        dy = Math.random() * 2 - 1;
        dz = Math.random() * 2 - 1;
        lenSq = dx * dx + dy * dy + dz * dz;
      } while (lenSq > 1 || lenSq === 0);
      const len = Math.sqrt(lenSq);
      const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
      vx[i] = (dx / len) * speed;
      vy[i] = (dy / len) * speed;
      vz[i] = (dz / len) * speed;
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
  }, [simBounds.x, simBounds.y, simBounds.z]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const mouseWorld = useRef(new THREE.Vector3(0, 0, 0));
  const mouseActive = useRef(false);
  const hasRealPointerMove = useRef(false);
  const lastMouseMoveAt = useRef(0);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouseNDC = useRef(new THREE.Vector2(0, 0));
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const rayTarget = useMemo(() => new THREE.Vector3(), []);

  const gpuRef = useRef<BoidGPUState | null>(null);
  const gpuPending = useRef(false);
  const gpuReady = useRef(false);
  const gpuData = useRef<Float32Array | null>(null);

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
      gpuReady.current = false;
      gpuData.current = null;
      gpuPending.current = false;
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
    lastMouseMoveAt.current = performance.now();
    mouseActive.current = true;
  }, []);

  const handleCanvasPointerMove = useCallback((event: Event) => {
    const customEvent = event as CustomEvent<{ x: number; y: number }>;
    mouseNDC.current.x = customEvent.detail.x;
    mouseNDC.current.y = customEvent.detail.y;
    lastMouseMoveAt.current = performance.now();
    mouseActive.current = true;
    hasRealPointerMove.current = true;
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseActive.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("boids:pointermove", handleCanvasPointerMove as EventListener);
    window.addEventListener("boids:pointerleave", handleMouseLeave);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("boids:pointermove", handleCanvasPointerMove as EventListener);
      window.removeEventListener("boids:pointerleave", handleMouseLeave);
    };
  }, [handleCanvasPointerMove, handleMouseMove, handleMouseLeave]);

  const kickGPUStep = useCallback(() => {
    const gpu = gpuRef.current;
    if (!gpu || gpuPending.current) return;

    if (mouseActive.current && performance.now() - lastMouseMoveAt.current > MOUSE_IDLE_MS) {
      mouseActive.current = false;
    }

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
      boundsX: simBounds.x,
      boundsY: simBounds.y,
      boundsZ: simBounds.z,
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
  }, [camera, plane, raycaster, rayTarget, simBounds.x, simBounds.y, simBounds.z]);

  const velDir = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || !gpuReady.current) return;

    kickGPUStep();

    const data = gpuData.current;
    if (!data) return;

    // Data layout: first BOID_COUNT*4 floats = positions, next BOID_COUNT*4 = velocities
    const velOffset = BOID_COUNT * 4;

    for (let i = 0; i < BOID_COUNT; i++) {
      const pi = i * 4;
      dummy.position.set(data[pi], data[pi + 1], data[pi + 2]);

      const vi = velOffset + i * 4;
      velDir.set(data[vi], data[vi + 1], data[vi + 2]);
      const speed = velDir.length();
      if (speed > 0.001) {
        velDir.divideScalar(speed);
        dummy.quaternion.setFromUnitVectors(forward, velDir);
      }

      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  const geometry = useMemo(() => new THREE.ConeGeometry(0.06, 0.5, 3), []);

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, BOID_COUNT]}>
      <meshBasicMaterial color="#0a0a18" transparent opacity={0.92} />
    </instancedMesh>
  );
}

import PageBackground from "./PageBackground";

// --- Main export ---
const FlockingCanvas = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0"
      onPointerMove={(event) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect || rect.width === 0 || rect.height === 0) return;

        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;

        const syntheticZeroMove = event.movementX === 0 && event.movementY === 0;
        if (!syntheticZeroMove) {
          const nextX = (localX / rect.width) * 2 - 1;
          const nextY = -(localY / rect.height) * 2 + 1;
          window.dispatchEvent(new CustomEvent("boids:pointermove", {
            detail: { x: nextX, y: nextY },
          }));
        }
      }}
      onPointerLeave={() => {
        window.dispatchEvent(new Event("boids:pointerleave"));
      }}
      style={{ zIndex: 1 }}
    >
      <PageBackground />
      <Canvas
        camera={{ position: [0, 0, 65], fov: 50 }}
        style={{ width: "100%", height: "100%", position: "absolute", inset: 0, zIndex: 1 }}
        gl={{ alpha: true, antialias: false }}
        dpr={[1, 1.5]}
      >
        <Boids />
      </Canvas>
    </div>
  );
};

export default FlockingCanvas;
