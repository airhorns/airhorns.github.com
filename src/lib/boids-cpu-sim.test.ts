/**
 * CPU replica of the GPU boid shader, used to test for systematic drift/bias.
 * Mirrors the WGSL shader in boids-gpu.ts exactly.
 */
import { describe, it, expect } from "vitest";

// --- Simulation constants (matching FlockingCanvas.tsx) ---
const BOID_COUNT = 500; // fewer for speed; bias should still show
const MAX_SPEED = 0.28;
const MIN_SPEED = 0.1;
const VISUAL_RANGE = 2.8;
const VISUAL_RANGE_SQ = VISUAL_RANGE * VISUAL_RANGE;
const SEPARATION_DIST = 0.7;
const SEPARATION_DIST_SQ = SEPARATION_DIST * SEPARATION_DIST;
const COHESION_FACTOR = 0.004;
const ALIGNMENT_FACTOR = 0.05;
const SEPARATION_FACTOR = 0.05;
const BOUNDS_X = 76;
const BOUNDS_Y = 60;
const BOUNDS_Z = 15;
const CENTER_PULL = 0.0;
const EDGE_MARGIN = 8;
const EDGE_FORCE = 0.12;
const Z_FLATTEN = 0.03;
const JITTER = 0.003;

// --- PRNG matching the shader's rand() ---
function shaderRand(seed: number, id: number): number {
  const v = Math.sin(seed * 78.233 + id * 43758.5453) * 43758.5453;
  return v - Math.floor(v); // fract
}

interface BoidState {
  px: Float64Array;
  py: Float64Array;
  pz: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  vz: Float64Array;
}

// Seeded PRNG for deterministic initial conditions
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createBoids(seed: number): BoidState {
  const rng = mulberry32(seed);
  const px = new Float64Array(BOID_COUNT);
  const py = new Float64Array(BOID_COUNT);
  const pz = new Float64Array(BOID_COUNT);
  const vx = new Float64Array(BOID_COUNT);
  const vy = new Float64Array(BOID_COUNT);
  const vz = new Float64Array(BOID_COUNT);

  let sumPx = 0, sumPy = 0, sumPz = 0;
  let sumVx = 0, sumVy = 0, sumVz = 0;

  for (let i = 0; i < BOID_COUNT; i++) {
    px[i] = (rng() - 0.5) * BOUNDS_X * 0.5;
    py[i] = (rng() - 0.5) * BOUNDS_Y * 0.5;
    pz[i] = (rng() - 0.5) * BOUNDS_Z * 0.15;
    // Isotropic velocity via rejection sampling on unit sphere
    let dx, dy, dz, lenSq;
    do {
      dx = rng() * 2 - 1; dy = rng() * 2 - 1; dz = rng() * 2 - 1;
      lenSq = dx * dx + dy * dy + dz * dz;
    } while (lenSq > 1 || lenSq === 0);
    const len = Math.sqrt(lenSq);
    const speed = MIN_SPEED + rng() * (MAX_SPEED - MIN_SPEED);
    vx[i] = (dx / len) * speed;
    vy[i] = (dy / len) * speed;
    vz[i] = (dz / len) * speed;
    sumPx += px[i]; sumPy += py[i]; sumPz += pz[i];
    sumVx += vx[i]; sumVy += vy[i]; sumVz += vz[i];
  }

  const meanPx = sumPx / BOID_COUNT;
  const meanPy = sumPy / BOID_COUNT;
  const meanPz = sumPz / BOID_COUNT;
  const meanVx = sumVx / BOID_COUNT;
  const meanVy = sumVy / BOID_COUNT;
  const meanVz = sumVz / BOID_COUNT;

  for (let i = 0; i < BOID_COUNT; i++) {
    px[i] -= meanPx; py[i] -= meanPy; pz[i] -= meanPz;
    vx[i] -= meanVx; vy[i] -= meanVy; vz[i] -= meanVz;
  }

  return { px, py, pz, vx, vy, vz };
}

/** One simulation step — mirrors the GPU shader exactly */
function stepBoids(state: BoidState, frameSeed: number): BoidState {
  const { px, py, pz, vx, vy, vz } = state;
  const n = BOID_COUNT;
  const npx = new Float64Array(n);
  const npy = new Float64Array(n);
  const npz = new Float64Array(n);
  const nvx = new Float64Array(n);
  const nvy = new Float64Array(n);
  const nvz = new Float64Array(n);

  const edgeStartX = BOUNDS_X * 0.5 - EDGE_MARGIN;
  const edgeStartY = BOUNDS_Y * 0.5 - EDGE_MARGIN;
  const edgeStartZ = BOUNDS_Z * 0.5 - EDGE_MARGIN;

  for (let i = 0; i < n; i++) {
    const myPx = px[i], myPy = py[i], myPz = pz[i];
    const myVx = vx[i], myVy = vy[i], myVz = vz[i];

    let cohSumX = 0, cohSumY = 0, cohSumZ = 0;
    let aliSumX = 0, aliSumY = 0, aliSumZ = 0;
    let sepSumX = 0, sepSumY = 0, sepSumZ = 0;
    let cohCount = 0, aliCount = 0;

    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dx = px[j] - myPx;
      const dy = py[j] - myPy;
      const dz = pz[j] - myPz;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < VISUAL_RANGE_SQ) {
        cohSumX += dx; cohSumY += dy; cohSumZ += dz;
        cohCount++;
        aliSumX += vx[j]; aliSumY += vy[j]; aliSumZ += vz[j];
        aliCount++;
      }

      if (distSq < SEPARATION_DIST_SQ && distSq > 0) {
        const dist = Math.sqrt(distSq);
        const inv = 1.0 / dist;
        sepSumX -= dx * inv;
        sepSumY -= dy * inv;
        sepSumZ -= dz * inv;
      }
    }

    let newVx = myVx, newVy = myVy, newVz = myVz;

    if (cohCount > 0) {
      const inv = 1.0 / cohCount;
      newVx += cohSumX * inv * COHESION_FACTOR;
      newVy += cohSumY * inv * COHESION_FACTOR;
      newVz += cohSumZ * inv * COHESION_FACTOR;
    }
    if (aliCount > 0) {
      const inv = 1.0 / aliCount;
      newVx += (aliSumX * inv - myVx) * ALIGNMENT_FACTOR;
      newVy += (aliSumY * inv - myVy) * ALIGNMENT_FACTOR;
      newVz += (aliSumZ * inv - myVz) * ALIGNMENT_FACTOR;
    }
    newVx += sepSumX * SEPARATION_FACTOR;
    newVy += sepSumY * SEPARATION_FACTOR;
    newVz += sepSumZ * SEPARATION_FACTOR;

    // Edge forces
    let efx = 0, efy = 0, efz = 0;
    if (myPx > edgeStartX) efx -= (myPx - edgeStartX) / EDGE_MARGIN * EDGE_FORCE;
    if (myPx < -edgeStartX) efx -= (myPx + edgeStartX) / EDGE_MARGIN * EDGE_FORCE;
    if (myPy > edgeStartY) efy -= (myPy - edgeStartY) / EDGE_MARGIN * EDGE_FORCE;
    if (myPy < -edgeStartY) efy -= (myPy + edgeStartY) / EDGE_MARGIN * EDGE_FORCE;
    if (myPz > edgeStartZ) efz -= (myPz - edgeStartZ) / EDGE_MARGIN * EDGE_FORCE;
    if (myPz < -edgeStartZ) efz -= (myPz + edgeStartZ) / EDGE_MARGIN * EDGE_FORCE;
    newVx += efx; newVy += efy; newVz += efz;

    // No mouse

    // Jitter
    const fi = i;
    const r1 = shaderRand(frameSeed, fi * 3.0) - 0.5;
    const r2 = shaderRand(frameSeed, fi * 3.0 + 1.0) - 0.5;
    const r3 = shaderRand(frameSeed, fi * 3.0 + 2.0) - 0.5;
    newVx += r1 * JITTER;
    newVy += r2 * JITTER;
    newVz += r3 * JITTER * 0.3;

    // Speed clamping
    let speedSq = newVx * newVx + newVy * newVy + newVz * newVz;
    const maxSpeedSq = MAX_SPEED * MAX_SPEED;
    const minSpeedSq = MIN_SPEED * MIN_SPEED;
    if (speedSq > maxSpeedSq) {
      const s = MAX_SPEED / Math.sqrt(speedSq);
      newVx *= s; newVy *= s; newVz *= s;
    } else if (speedSq < minSpeedSq && speedSq > 0) {
      const s = MIN_SPEED / Math.sqrt(speedSq);
      newVx *= s; newVy *= s; newVz *= s;
    }

    // Post-clamp forces (z-flatten and center pull)
    newVz *= (1 - Z_FLATTEN);
    newVx -= myPx * CENTER_PULL;
    newVy -= myPy * CENTER_PULL;
    newVz -= myPz * CENTER_PULL;

    npx[i] = myPx + newVx;
    npy[i] = myPy + newVy;
    npz[i] = myPz + newVz;
    nvx[i] = newVx;
    nvy[i] = newVy;
    nvz[i] = newVz;
  }

  return { px: npx, py: npy, pz: npz, vx: nvx, vy: nvy, vz: nvz };
}

function getMeanPos(state: BoidState) {
  let sx = 0, sy = 0, sz = 0;
  for (let i = 0; i < BOID_COUNT; i++) {
    sx += state.px[i]; sy += state.py[i]; sz += state.pz[i];
  }
  return { x: sx / BOID_COUNT, y: sy / BOID_COUNT, z: sz / BOID_COUNT };
}

function getMeanVel(state: BoidState) {
  let sx = 0, sy = 0, sz = 0;
  for (let i = 0; i < BOID_COUNT; i++) {
    sx += state.vx[i]; sy += state.vy[i]; sz += state.vz[i];
  }
  return { x: sx / BOID_COUNT, y: sy / BOID_COUNT, z: sz / BOID_COUNT };
}

describe("boid simulation bias test", () => {
  it("should show position distribution across 20 seeds after 300 frames", () => {
    const NUM_SEEDS = 20;
    const NUM_FRAMES = 300;
    const results: Array<{ seed: number; meanX: number; meanY: number; meanZ: number }> = [];

    for (let s = 0; s < NUM_SEEDS; s++) {
      let state = createBoids(s * 1000 + 42);
      for (let f = 0; f < NUM_FRAMES; f++) {
        state = stepBoids(state, f * 17.3 + s * 100); // varying seed per frame
      }
      const mean = getMeanPos(state);
      results.push({ seed: s, meanX: mean.x, meanY: mean.y, meanZ: mean.z });
      console.log(
        `seed=${s}: meanPos=(${mean.x.toFixed(1)}, ${mean.y.toFixed(1)}, ${mean.z.toFixed(1)})`
      );
    }

    // Check: if there's a systematic bias, most seeds will have the same sign
    const negX = results.filter((r) => r.meanX < -5).length;
    const negY = results.filter((r) => r.meanY < -5).length;
    console.log(`\n${negX}/${NUM_SEEDS} seeds drifted to negative X (< -5)`);
    console.log(`${negY}/${NUM_SEEDS} seeds drifted to negative Y (< -5)`);

    // Compute overall mean across seeds
    const avgX = results.reduce((s, r) => s + r.meanX, 0) / NUM_SEEDS;
    const avgY = results.reduce((s, r) => s + r.meanY, 0) / NUM_SEEDS;
    console.log(`\nAverage mean position across all seeds: (${avgX.toFixed(2)}, ${avgY.toFixed(2)})`);

    // This test is diagnostic — it will pass but print the bias info
    expect(results.length).toBe(NUM_SEEDS);
  });

  it("should track drift over time for a single seed", () => {
    const NUM_FRAMES = 600;
    let state = createBoids(12345);
    const snapshots: Array<{ frame: number; mx: number; my: number; mz: number; mvx: number; mvy: number; mvz: number }> = [];

    for (let f = 0; f < NUM_FRAMES; f++) {
      state = stepBoids(state, f * 17.3);
      if (f % 30 === 0) {
        const mp = getMeanPos(state);
        const mv = getMeanVel(state);
        snapshots.push({ frame: f, mx: mp.x, my: mp.y, mz: mp.z, mvx: mv.x, mvy: mv.y, mvz: mv.z });
      }
    }

    console.log("\n--- Single seed drift over time ---");
    for (const s of snapshots) {
      console.log(
        `f=${String(s.frame).padStart(4)}: pos=(${s.mx.toFixed(1).padStart(7)}, ${s.my.toFixed(1).padStart(7)}, ${s.mz.toFixed(1).padStart(7)}) vel=(${s.mvx.toFixed(3).padStart(7)}, ${s.mvy.toFixed(3).padStart(7)}, ${s.mvz.toFixed(3).padStart(7)})`
      );
    }

    expect(snapshots.length).toBeGreaterThan(0);
  });

  it("should test with isotropic initial velocities", () => {
    // Test if bias comes from the non-isotropic velocity parametrization
    const NUM_SEEDS = 10;
    const NUM_FRAMES = 300;
    const results: Array<{ seed: number; meanX: number; meanY: number }> = [];

    for (let s = 0; s < NUM_SEEDS; s++) {
      const rng = mulberry32(s * 1000 + 42);
      const state = createBoids(s * 1000 + 42);

      // Overwrite velocities with isotropic distribution
      let svx = 0, svy = 0, svz = 0;
      for (let i = 0; i < BOID_COUNT; i++) {
        // Uniform on sphere via rejection sampling
        let x, y, z, lenSq;
        do {
          x = rng() * 2 - 1; y = rng() * 2 - 1; z = rng() * 2 - 1;
          lenSq = x * x + y * y + z * z;
        } while (lenSq > 1 || lenSq === 0);
        const len = Math.sqrt(lenSq);
        const speed = MIN_SPEED + rng() * (MAX_SPEED - MIN_SPEED);
        state.vx[i] = (x / len) * speed;
        state.vy[i] = (y / len) * speed;
        state.vz[i] = (z / len) * speed;
        svx += state.vx[i]; svy += state.vy[i]; svz += state.vz[i];
      }
      // Subtract mean
      const n = BOID_COUNT;
      for (let i = 0; i < n; i++) {
        state.vx[i] -= svx / n; state.vy[i] -= svy / n; state.vz[i] -= svz / n;
      }

      let s2 = state;
      for (let f = 0; f < NUM_FRAMES; f++) {
        s2 = stepBoids(s2, f * 17.3 + s * 100);
      }
      const mean = getMeanPos(s2);
      results.push({ seed: s, meanX: mean.x, meanY: mean.y });
    }

    const avgX = results.reduce((s, r) => s + r.meanX, 0) / NUM_SEEDS;
    const avgY = results.reduce((s, r) => s + r.meanY, 0) / NUM_SEEDS;
    console.log(`\n--- Isotropic initial velocities ---`);
    results.forEach((r, i) => console.log(`seed=${i}: (${r.meanX.toFixed(1)}, ${r.meanY.toFixed(1)})`));
    console.log(`Average: (${avgX.toFixed(2)}, ${avgY.toFixed(2)})`);

    expect(results.length).toBe(NUM_SEEDS);
  });

  it("should test with equal X/Y bounds", () => {
    // Test if the asymmetric bounds (76 x 60) cause the X bias
    const NUM_SEEDS = 10;
    const NUM_FRAMES = 300;
    const results: Array<{ seed: number; meanX: number; meanY: number }> = [];

    // Temporarily override bounds to be equal
    const origBoundsX = BOUNDS_X;
    // We can't override const, so we'll use a modified stepBoids
    function stepBoidsEqualBounds(state: BoidState, frameSeed: number): BoidState {
      const EQUAL_BOUNDS = 60; // same as Y
      const { px, py, pz, vx, vy, vz } = state;
      const n = BOID_COUNT;
      const npx = new Float64Array(n);
      const npy = new Float64Array(n);
      const npz = new Float64Array(n);
      const nvx = new Float64Array(n);
      const nvy = new Float64Array(n);
      const nvz = new Float64Array(n);

      const edgeStartX = EQUAL_BOUNDS * 0.5 - EDGE_MARGIN;
      const edgeStartY = EQUAL_BOUNDS * 0.5 - EDGE_MARGIN;
      const edgeStartZ = BOUNDS_Z * 0.5 - EDGE_MARGIN;

      for (let i = 0; i < n; i++) {
        const myPx = px[i], myPy = py[i], myPz = pz[i];
        const myVx = vx[i], myVy = vy[i], myVz = vz[i];

        let cohSumX = 0, cohSumY = 0, cohSumZ = 0;
        let aliSumX = 0, aliSumY = 0, aliSumZ = 0;
        let sepSumX = 0, sepSumY = 0, sepSumZ = 0;
        let cohCount = 0, aliCount = 0;

        for (let j = 0; j < n; j++) {
          if (j === i) continue;
          const dx = px[j] - myPx, dy = py[j] - myPy, dz = pz[j] - myPz;
          const distSq = dx * dx + dy * dy + dz * dz;
          if (distSq < VISUAL_RANGE_SQ) {
            cohSumX += dx; cohSumY += dy; cohSumZ += dz;
            cohCount++; aliSumX += vx[j]; aliSumY += vy[j]; aliSumZ += vz[j]; aliCount++;
          }
          if (distSq < SEPARATION_DIST_SQ && distSq > 0) {
            const inv = 1.0 / Math.sqrt(distSq);
            sepSumX -= dx * inv; sepSumY -= dy * inv; sepSumZ -= dz * inv;
          }
        }

        let newVx = myVx, newVy = myVy, newVz = myVz;
        if (cohCount > 0) { const inv = 1/cohCount; newVx += cohSumX*inv*COHESION_FACTOR; newVy += cohSumY*inv*COHESION_FACTOR; newVz += cohSumZ*inv*COHESION_FACTOR; }
        if (aliCount > 0) { const inv = 1/aliCount; newVx += (aliSumX*inv-myVx)*ALIGNMENT_FACTOR; newVy += (aliSumY*inv-myVy)*ALIGNMENT_FACTOR; newVz += (aliSumZ*inv-myVz)*ALIGNMENT_FACTOR; }
        newVx += sepSumX*SEPARATION_FACTOR; newVy += sepSumY*SEPARATION_FACTOR; newVz += sepSumZ*SEPARATION_FACTOR;

        let efx=0,efy=0,efz=0;
        if(myPx>edgeStartX) efx-=(myPx-edgeStartX)/EDGE_MARGIN*EDGE_FORCE;
        if(myPx<-edgeStartX) efx-=(myPx+edgeStartX)/EDGE_MARGIN*EDGE_FORCE;
        if(myPy>edgeStartY) efy-=(myPy-edgeStartY)/EDGE_MARGIN*EDGE_FORCE;
        if(myPy<-edgeStartY) efy-=(myPy+edgeStartY)/EDGE_MARGIN*EDGE_FORCE;
        if(myPz>edgeStartZ) efz-=(myPz-edgeStartZ)/EDGE_MARGIN*EDGE_FORCE;
        if(myPz<-edgeStartZ) efz-=(myPz+edgeStartZ)/EDGE_MARGIN*EDGE_FORCE;
        newVx+=efx; newVy+=efy; newVz+=efz;

        const fi = i;
        newVx += (shaderRand(frameSeed, fi*3)-0.5)*JITTER;
        newVy += (shaderRand(frameSeed, fi*3+1)-0.5)*JITTER;
        newVz += (shaderRand(frameSeed, fi*3+2)-0.5)*JITTER*0.3;

        let speedSq = newVx*newVx+newVy*newVy+newVz*newVz;
        if(speedSq>MAX_SPEED*MAX_SPEED){const s=MAX_SPEED/Math.sqrt(speedSq);newVx*=s;newVy*=s;newVz*=s;}
        else if(speedSq<MIN_SPEED*MIN_SPEED&&speedSq>0){const s=MIN_SPEED/Math.sqrt(speedSq);newVx*=s;newVy*=s;newVz*=s;}

        newVz *= (1 - Z_FLATTEN);
        npx[i]=myPx+newVx; npy[i]=myPy+newVy; npz[i]=myPz+newVz;
        nvx[i]=newVx; nvy[i]=newVy; nvz[i]=newVz;
      }
      return { px: npx, py: npy, pz: npz, vx: nvx, vy: nvy, vz: nvz };
    }

    for (let s = 0; s < NUM_SEEDS; s++) {
      let state = createBoids(s * 1000 + 42);
      // Shrink initial positions to fit equal bounds
      for (let i = 0; i < BOID_COUNT; i++) {
        state.px[i] = state.px[i] * (60 / BOUNDS_X);
      }
      for (let f = 0; f < NUM_FRAMES; f++) {
        state = stepBoidsEqualBounds(state, f * 17.3 + s * 100);
      }
      const mean = getMeanPos(state);
      results.push({ seed: s, meanX: mean.x, meanY: mean.y });
    }

    const avgX = results.reduce((s, r) => s + r.meanX, 0) / NUM_SEEDS;
    const avgY = results.reduce((s, r) => s + r.meanY, 0) / NUM_SEEDS;
    console.log(`\n--- Equal bounds (60x60) ---`);
    results.forEach((r, i) => console.log(`seed=${i}: (${r.meanX.toFixed(1)}, ${r.meanY.toFixed(1)})`));
    console.log(`Average: (${avgX.toFixed(2)}, ${avgY.toFixed(2)})`);

    expect(results.length).toBe(NUM_SEEDS);
  });

  it("should test with no jitter", () => {
    const NUM_SEEDS = 10;
    const NUM_FRAMES = 300;
    const results: Array<{ seed: number; meanX: number; meanY: number }> = [];

    function stepBoidsNoJitter(state: BoidState, frameSeed: number): BoidState {
      const { px, py, pz, vx, vy, vz } = state;
      const n = BOID_COUNT;
      const npx = new Float64Array(n), npy = new Float64Array(n), npz = new Float64Array(n);
      const nvx = new Float64Array(n), nvy = new Float64Array(n), nvz = new Float64Array(n);
      const edgeStartX = BOUNDS_X*0.5-EDGE_MARGIN, edgeStartY = BOUNDS_Y*0.5-EDGE_MARGIN, edgeStartZ = BOUNDS_Z*0.5-EDGE_MARGIN;

      for (let i = 0; i < n; i++) {
        const myPx=px[i],myPy=py[i],myPz=pz[i],myVx=vx[i],myVy=vy[i],myVz=vz[i];
        let cohSumX=0,cohSumY=0,cohSumZ=0,aliSumX=0,aliSumY=0,aliSumZ=0,sepSumX=0,sepSumY=0,sepSumZ=0,cohCount=0,aliCount=0;
        for(let j=0;j<n;j++){if(j===i)continue;const dx=px[j]-myPx,dy=py[j]-myPy,dz=pz[j]-myPz,distSq=dx*dx+dy*dy+dz*dz;
          if(distSq<VISUAL_RANGE_SQ){cohSumX+=dx;cohSumY+=dy;cohSumZ+=dz;cohCount++;aliSumX+=vx[j];aliSumY+=vy[j];aliSumZ+=vz[j];aliCount++;}
          if(distSq<SEPARATION_DIST_SQ&&distSq>0){const inv=1/Math.sqrt(distSq);sepSumX-=dx*inv;sepSumY-=dy*inv;sepSumZ-=dz*inv;}}

        let newVx=myVx,newVy=myVy,newVz=myVz;
        if(cohCount>0){const inv=1/cohCount;newVx+=cohSumX*inv*COHESION_FACTOR;newVy+=cohSumY*inv*COHESION_FACTOR;newVz+=cohSumZ*inv*COHESION_FACTOR;}
        if(aliCount>0){const inv=1/aliCount;newVx+=(aliSumX*inv-myVx)*ALIGNMENT_FACTOR;newVy+=(aliSumY*inv-myVy)*ALIGNMENT_FACTOR;newVz+=(aliSumZ*inv-myVz)*ALIGNMENT_FACTOR;}
        newVx+=sepSumX*SEPARATION_FACTOR;newVy+=sepSumY*SEPARATION_FACTOR;newVz+=sepSumZ*SEPARATION_FACTOR;

        let efx=0,efy=0,efz=0;
        if(myPx>edgeStartX)efx-=(myPx-edgeStartX)/EDGE_MARGIN*EDGE_FORCE;if(myPx<-edgeStartX)efx-=(myPx+edgeStartX)/EDGE_MARGIN*EDGE_FORCE;
        if(myPy>edgeStartY)efy-=(myPy-edgeStartY)/EDGE_MARGIN*EDGE_FORCE;if(myPy<-edgeStartY)efy-=(myPy+edgeStartY)/EDGE_MARGIN*EDGE_FORCE;
        if(myPz>edgeStartZ)efz-=(myPz-edgeStartZ)/EDGE_MARGIN*EDGE_FORCE;if(myPz<-edgeStartZ)efz-=(myPz+edgeStartZ)/EDGE_MARGIN*EDGE_FORCE;
        newVx+=efx;newVy+=efy;newVz+=efz;

        // NO JITTER

        let speedSq=newVx*newVx+newVy*newVy+newVz*newVz;
        if(speedSq>MAX_SPEED*MAX_SPEED){const s=MAX_SPEED/Math.sqrt(speedSq);newVx*=s;newVy*=s;newVz*=s;}
        else if(speedSq<MIN_SPEED*MIN_SPEED&&speedSq>0){const s=MIN_SPEED/Math.sqrt(speedSq);newVx*=s;newVy*=s;newVz*=s;}

        newVz*=(1-Z_FLATTEN);
        npx[i]=myPx+newVx;npy[i]=myPy+newVy;npz[i]=myPz+newVz;nvx[i]=newVx;nvy[i]=newVy;nvz[i]=newVz;
      }
      return {px:npx,py:npy,pz:npz,vx:nvx,vy:nvy,vz:nvz};
    }

    for (let s = 0; s < NUM_SEEDS; s++) {
      let state = createBoids(s * 1000 + 42);
      for (let f = 0; f < NUM_FRAMES; f++) state = stepBoidsNoJitter(state, f);
      const mean = getMeanPos(state);
      results.push({ seed: s, meanX: mean.x, meanY: mean.y });
    }
    const avgX = results.reduce((s, r) => s + r.meanX, 0) / NUM_SEEDS;
    const avgY = results.reduce((s, r) => s + r.meanY, 0) / NUM_SEEDS;
    console.log(`\n--- No jitter ---`);
    results.forEach((r, i) => console.log(`seed=${i}: (${r.meanX.toFixed(1)}, ${r.meanY.toFixed(1)})`));
    console.log(`Average: (${avgX.toFixed(2)}, ${avgY.toFixed(2)})`);
    expect(results.length).toBe(NUM_SEEDS);
  });

  it("should test jitter rand() for systematic bias", () => {
    // Test the shader rand function for bias across many seeds and boid IDs
    const NUM_SEEDS_TEST = 100;
    const NUM_BOIDS_TEST = 500;
    let totalR1 = 0, totalR2 = 0, totalR3 = 0;

    for (let s = 0; s < NUM_SEEDS_TEST; s++) {
      const seed = s * 17.3;
      for (let i = 0; i < NUM_BOIDS_TEST; i++) {
        totalR1 += shaderRand(seed, i * 3.0) - 0.5;
        totalR2 += shaderRand(seed, i * 3.0 + 1.0) - 0.5;
        totalR3 += shaderRand(seed, i * 3.0 + 2.0) - 0.5;
      }
    }

    const n = NUM_SEEDS_TEST * NUM_BOIDS_TEST;
    console.log(`\n--- rand() bias test (${n} samples) ---`);
    console.log(`Mean r1 (X jitter): ${(totalR1 / n).toFixed(6)}`);
    console.log(`Mean r2 (Y jitter): ${(totalR2 / n).toFixed(6)}`);
    console.log(`Mean r3 (Z jitter): ${(totalR3 / n).toFixed(6)}`);

    // Should be close to 0
    expect(Math.abs(totalR1 / n)).toBeLessThan(0.01);
    expect(Math.abs(totalR2 / n)).toBeLessThan(0.01);
    expect(Math.abs(totalR3 / n)).toBeLessThan(0.01);
  });
});
