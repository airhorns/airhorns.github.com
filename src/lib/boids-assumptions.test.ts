import { describe, expect, it } from "vitest";

import {
  SIM_PARAMS_BUFFER_SIZE,
  computeCenterPull,
  computeEdgeForce,
  computeMouseAvoidance,
  normalizePointerToNdc,
  packSimParams,
} from "@/lib/boids-assumptions";

const baseParams = {
  boidCount: 3000,
  maxSpeed: 0.28,
  minSpeed: 0.1,
  visualRange: 3.5,
  separationDist: 0.6,
  cohesionFactor: 0.006,
  alignmentFactor: 0.04,
  separationFactor: 0.07,
  bounds: 40,
  centerPull: 0.00035,
  zFlatten: 0.002,
  edgeMargin: 5,
  edgeForce: 0.08,
  jitter: 0.008,
  mouseX: 0,
  mouseY: 0,
  mouseActive: true,
  mouseRange: 8,
  mouseFactor: 0.03,
  seed: 123,
};

describe("boid assumptions", () => {
  it("packs GPU params at the expected byte size and offsets", () => {
    const buffer = packSimParams(baseParams);
    const view = new DataView(buffer);

    expect(buffer.byteLength).toBe(SIM_PARAMS_BUFFER_SIZE);
    expect(view.getUint32(0, true)).toBe(baseParams.boidCount);
    expect(view.getFloat32(4, true)).toBeCloseTo(baseParams.maxSpeed);
    expect(view.getFloat32(16, true)).toBeCloseTo(baseParams.visualRange ** 2);
    expect(view.getUint32(72, true)).toBe(1);
    expect(view.getFloat32(76, true)).toBeCloseTo(baseParams.mouseRange);
    expect(view.getFloat32(80, true)).toBeCloseTo(baseParams.mouseRange ** 2);
    expect(view.getFloat32(88, true)).toBeCloseTo(baseParams.seed);
  });

  it("normalizes pointer coordinates against the actual canvas rect", () => {
    const rect = { left: 100, top: 200, width: 400, height: 600 };

    expect(normalizePointerToNdc(300, 500, rect)).toEqual({ x: 0, y: 0 });
    expect(normalizePointerToNdc(100, 200, rect)).toEqual({ x: -1, y: 1 });
    expect(normalizePointerToNdc(500, 800, rect)).toEqual({ x: 1, y: -1 });
  });

  it("keeps center pull perfectly mirrored across opposite positions", () => {
    const right = computeCenterPull({ x: 12, y: 7, z: 3 }, baseParams.centerPull, baseParams.zFlatten);
    const left = computeCenterPull({ x: -12, y: -7, z: -3 }, baseParams.centerPull, baseParams.zFlatten);

    expect(right.x).toBeCloseTo(-left.x);
    expect(right.y).toBeCloseTo(-left.y);
    expect(right.z).toBeCloseTo(-left.z);
  });

  it("keeps edge steering mirrored across left/right and top/bottom", () => {
    const right = computeEdgeForce({ x: 18, y: 0, z: 0 }, baseParams.bounds, baseParams.edgeMargin, baseParams.edgeForce);
    const left = computeEdgeForce({ x: -18, y: 0, z: 0 }, baseParams.bounds, baseParams.edgeMargin, baseParams.edgeForce);
    const top = computeEdgeForce({ x: 0, y: 18, z: 0 }, baseParams.bounds, baseParams.edgeMargin, baseParams.edgeForce);
    const bottom = computeEdgeForce({ x: 0, y: -18, z: 0 }, baseParams.bounds, baseParams.edgeMargin, baseParams.edgeForce);

    expect(right.x).toBeCloseTo(-left.x);
    expect(top.y).toBeCloseTo(-bottom.y);
    expect(right.y).toBe(0);
    expect(top.x).toBe(0);
  });

  it("keeps mouse avoidance mirrored for mirrored boid positions", () => {
    const a = computeMouseAvoidance({ x: 2, y: 1, z: 0 }, { x: 0, y: 0 }, baseParams.mouseRange, baseParams.mouseFactor);
    const b = computeMouseAvoidance({ x: -2, y: -1, z: 0 }, { x: 0, y: 0 }, baseParams.mouseRange, baseParams.mouseFactor);

    expect(a.x).toBeCloseTo(-b.x);
    expect(a.y).toBeCloseTo(-b.y);
    expect(a.z).toBeCloseTo(-b.z);
  });
});