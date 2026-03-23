import type { SimParams } from "@/lib/boids-gpu";

export const SIM_PARAMS_BUFFER_SIZE = 112;
export const SIM_PARAMS_FLOAT_COUNT = SIM_PARAMS_BUFFER_SIZE / 4;

export interface PackedSimParamsInput extends SimParams {
  boidCount: number;
  seed?: number;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function packSimParams(input: PackedSimParamsInput): ArrayBuffer {
  const paramsData = new Float32Array(SIM_PARAMS_FLOAT_COUNT);

  paramsData[0] = input.boidCount;
  paramsData[1] = input.maxSpeed;
  paramsData[2] = input.minSpeed;
  paramsData[3] = input.visualRange;
  paramsData[4] = input.visualRange * input.visualRange;
  paramsData[5] = input.separationDist;
  paramsData[6] = input.separationDist * input.separationDist;
  paramsData[7] = input.cohesionFactor;
  paramsData[8] = input.alignmentFactor;
  paramsData[9] = input.separationFactor;
  paramsData[10] = input.bounds;
  paramsData[11] = input.centerPull;
  paramsData[12] = input.zFlatten;
  paramsData[13] = input.edgeMargin;
  paramsData[14] = input.edgeForce;
  paramsData[15] = input.jitter;
  paramsData[16] = input.mouseX;
  paramsData[17] = input.mouseY;
  paramsData[18] = input.mouseActive ? 1 : 0;
  paramsData[19] = input.mouseRange;
  paramsData[20] = input.mouseRange * input.mouseRange;
  paramsData[21] = input.mouseFactor;
  paramsData[22] = input.seed ?? 0;

  const dataView = new DataView(paramsData.buffer);
  dataView.setUint32(0, input.boidCount, true);
  dataView.setUint32(18 * 4, input.mouseActive ? 1 : 0, true);

  return paramsData.buffer.slice(0);
}

export function normalizePointerToNdc(clientX: number, clientY: number, rect: RectLike) {
  return {
    x: (clientX - rect.left) / rect.width * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1,
  };
}

export function computeCenterPull(position: Vec3, centerPull: number, zFlatten: number): Vec3 {
  return {
    x: -position.x * centerPull,
    y: -position.y * centerPull,
    z: -position.z * (centerPull + zFlatten),
  };
}

export function computeEdgeForce(position: Vec3, bounds: number, edgeMargin: number, edgeForce: number): Vec3 {
  const edgeStart = bounds * 0.5 - edgeMargin;
  const force = { x: 0, y: 0, z: 0 };

  if (position.x > edgeStart) force.x -= (position.x - edgeStart) / edgeMargin * edgeForce;
  if (position.x < -edgeStart) force.x -= (position.x + edgeStart) / edgeMargin * edgeForce;
  if (position.y > edgeStart) force.y -= (position.y - edgeStart) / edgeMargin * edgeForce;
  if (position.y < -edgeStart) force.y -= (position.y + edgeStart) / edgeMargin * edgeForce;
  if (position.z > edgeStart) force.z -= (position.z - edgeStart) / edgeMargin * edgeForce;
  if (position.z < -edgeStart) force.z -= (position.z + edgeStart) / edgeMargin * edgeForce;

  return force;
}

export function computeMouseAvoidance(position: Vec3, mouse: Pick<Vec3, "x" | "y">, mouseRange: number, mouseFactor: number): Vec3 {
  const dx = position.x - mouse.x;
  const dy = position.y - mouse.y;
  const dz = position.z;
  const distSq = dx * dx + dy * dy + dz * dz;

  if (distSq === 0 || distSq >= mouseRange * mouseRange) {
    return { x: 0, y: 0, z: 0 };
  }

  const dist = Math.sqrt(distSq);
  const strength = ((mouseRange - dist) / mouseRange) ** 2 * mouseFactor;

  return {
    x: dx / dist * strength,
    y: dy / dist * strength,
    z: dz / dist * strength,
  };
}

export function computeBalancedJitter(seed: number, boidIndex: number, axisOffset: number) {
  const pairIndex = Math.floor(boidIndex / 2);
  const direction = boidIndex % 2 === 0 ? 1 : -1;
  const raw = pseudoRandom(seed + axisOffset, pairIndex) - 0.5;

  return raw * direction;
}

export function pseudoRandom(seed: number, index: number) {
  const value = Math.sin(seed * 78.233 + index * 43758.5453) * 43758.5453;
  return value - Math.floor(value);
}