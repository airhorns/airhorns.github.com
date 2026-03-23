// WebGPU compute-based boid simulation
// O(n²) brute force on GPU — fast enough for ~5000+ boids
/* eslint-disable @typescript-eslint/no-explicit-any */

const WORKGROUP_SIZE = 64;

// WebGPU constants (avoid TS global lookup issues)
const GPU_STORAGE = 0x0080;
const GPU_COPY_SRC = 0x0004;
const GPU_COPY_DST = 0x0008;
const GPU_UNIFORM = 0x0040;
const GPU_MAP_READ = 0x0001;

const SHADER = /* wgsl */ `

struct SimParams {
  boidCount: u32,
  maxSpeed: f32,
  minSpeed: f32,
  visualRange: f32,
  visualRangeSq: f32,
  separationDist: f32,
  separationDistSq: f32,
  cohesionFactor: f32,
  alignmentFactor: f32,
  separationFactor: f32,
  bounds: f32,
  centerPull: f32,
  zFlatten: f32,
  edgeMargin: f32,
  edgeForce: f32,
  jitter: f32,
  mouseX: f32,
  mouseY: f32,
  mouseActive: u32,
  mouseRange: f32,
  mouseRangeSq: f32,
  mouseFactor: f32,
  seed: f32,
  _pad1: f32,
  _pad2: f32,
  _pad3: f32,
};

// Positions and velocities stored as vec4 (w unused) for alignment
@group(0) @binding(0) var<uniform> params: SimParams;
@group(0) @binding(1) var<storage, read> posIn: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> velIn: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> posOut: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> velOut: array<vec4<f32>>;

// Simple hash for pseudo-random per-boid jitter
fn rand(seed: f32, id: f32) -> f32 {
  return fract(sin(seed * 78.233 + id * 43758.5453) * 43758.5453);
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.boidCount) { return; }

  let fi = f32(i);
  let myPos = posIn[i].xyz;
  let myVel = velIn[i].xyz;

  var cohSum = vec3<f32>(0.0);
  var aliSum = vec3<f32>(0.0);
  var sepSum = vec3<f32>(0.0);
  var cohCount: f32 = 0.0;
  var aliCount: f32 = 0.0;

  for (var j: u32 = 0u; j < params.boidCount; j++) {
    if (j == i) { continue; }

    let otherPos = posIn[j].xyz;
    let otherVel = velIn[j].xyz;
    let delta = otherPos - myPos;
    let distSq = dot(delta, delta);

    if (distSq < params.visualRangeSq) {
      cohSum += delta;
      cohCount += 1.0;
      aliSum += otherVel;
      aliCount += 1.0;
    }

    if (distSq < params.separationDistSq && distSq > 0.0) {
      let dist = sqrt(distSq);
      sepSum -= delta * (1.0 / dist);
    }
  }

  var newVel = myVel;

  if (cohCount > 0.0) {
    let inv = 1.0 / cohCount;
    newVel += cohSum * inv * params.cohesionFactor;
  }
  if (aliCount > 0.0) {
    let inv = 1.0 / aliCount;
    newVel += (aliSum * inv - myVel) * params.alignmentFactor;
  }
  newVel += sepSum * params.separationFactor;

  // Soft boundary + edge steering
  newVel -= myPos * params.centerPull;
  newVel.z -= myPos.z * params.zFlatten;

  var ef = vec3<f32>(0.0);
  let edgeStart = params.bounds * 0.5 - params.edgeMargin;

  if (myPos.x > edgeStart) { edgeForce.x -= (myPos.x - edgeStart) / params.edgeMargin * params.edgeForce; }
  if (myPos.x < -edgeStart) { edgeForce.x -= (myPos.x + edgeStart) / params.edgeMargin * params.edgeForce; }
  if (myPos.y > edgeStart) { edgeForce.y -= (myPos.y - edgeStart) / params.edgeMargin * params.edgeForce; }
  if (myPos.y < -edgeStart) { edgeForce.y -= (myPos.y + edgeStart) / params.edgeMargin * params.edgeForce; }
  if (myPos.z > edgeStart) { edgeForce.z -= (myPos.z - edgeStart) / params.edgeMargin * params.edgeForce; }
  if (myPos.z < -edgeStart) { edgeForce.z -= (myPos.z + edgeStart) / params.edgeMargin * params.edgeForce; }

  newVel += edgeForce;

  // Mouse avoidance
  if (params.mouseActive == 1u) {
    let mouseVec = vec3<f32>(myPos.x - params.mouseX, myPos.y - params.mouseY, myPos.z);
    let mDistSq = dot(mouseVec, mouseVec);
    if (mDistSq < params.mouseRangeSq && mDistSq > 0.0) {
      let mDist = sqrt(mDistSq);
      let force = pow((params.mouseRange - mDist) / params.mouseRange, 2.0);
      newVel += (mouseVec / mDist) * force * params.mouseFactor;
    }
  }

  // Jitter
  let r1 = rand(params.seed, fi) - 0.5;
  let r2 = rand(params.seed + 1.0, fi) - 0.5;
  let r3 = rand(params.seed + 2.0, fi) - 0.5;
  newVel += vec3<f32>(r1 * params.jitter, r2 * params.jitter, r3 * params.jitter * 0.3);

  // Speed limits
  let speedSq = dot(newVel, newVel);
  let maxSpeedSq = params.maxSpeed * params.maxSpeed;
  let minSpeedSq = params.minSpeed * params.minSpeed;
  if (speedSq > maxSpeedSq) {
    newVel *= params.maxSpeed / sqrt(speedSq);
  } else if (speedSq < minSpeedSq && speedSq > 0.0) {
    newVel *= params.minSpeed / sqrt(speedSq);
  }

  // Move
  var newPos = myPos + newVel;

  // Clamp instead of wrap
  let halfBounds = params.bounds * 0.5;
  newPos = clamp(newPos, vec3<f32>(-halfBounds), vec3<f32>(halfBounds));

  posOut[i] = vec4<f32>(newPos, 0.0);
  velOut[i] = vec4<f32>(newVel, 0.0);
}
`;

export interface BoidGPUState {
  device: GPUDevice;
  pipeline: GPUComputePipeline;
  bindGroups: [GPUBindGroup, GPUBindGroup];
  paramsBuf: GPUBuffer;
  posBufs: [GPUBuffer, GPUBuffer];
  velBufs: [GPUBuffer, GPUBuffer];
  readBuf: GPUBuffer;
  boidCount: number;
  frame: number;
}

export interface SimParams {
  maxSpeed: number;
  minSpeed: number;
  visualRange: number;
  separationDist: number;
  cohesionFactor: number;
  alignmentFactor: number;
  separationFactor: number;
  bounds: number;
  centerPull: number;
  zFlatten: number;
  edgeMargin: number;
  edgeForce: number;
  jitter: number;
  mouseX: number;
  mouseY: number;
  mouseActive: boolean;
  mouseRange: number;
  mouseFactor: number;
}

export async function initBoidGPU(
  boidCount: number,
  initialPositions: Float32Array, // flat xyz per boid
  initialVelocities: Float32Array,
): Promise<BoidGPUState | null> {
  if (!navigator.gpu) return null;

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return null;

  const device = await adapter.requestDevice();

  const module = device.createShaderModule({ code: SHADER });

  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module, entryPoint: 'main' },
  });

  // Pack positions/velocities as vec4 (w=0)
  const posData = new Float32Array(boidCount * 4);
  const velData = new Float32Array(boidCount * 4);
  for (let i = 0; i < boidCount; i++) {
    posData[i * 4] = initialPositions[i * 3];
    posData[i * 4 + 1] = initialPositions[i * 3 + 1];
    posData[i * 4 + 2] = initialPositions[i * 3 + 2];
    posData[i * 4 + 3] = 0;
    velData[i * 4] = initialVelocities[i * 3];
    velData[i * 4 + 1] = initialVelocities[i * 3 + 1];
    velData[i * 4 + 2] = initialVelocities[i * 3 + 2];
    velData[i * 4 + 3] = 0;
  }

  const bufSize = boidCount * 4 * 4; // vec4<f32> per boid

  const createBuf = (data: Float32Array, usage: number) => {
    const buf = device.createBuffer({ size: bufSize, usage, mappedAtCreation: true });
    new Float32Array(buf.getMappedRange()).set(data);
    buf.unmap();
    return buf;
  };

  const storageUsage = GPU_STORAGE | GPU_COPY_SRC;
  const posBuf0 = createBuf(posData, storageUsage);
  const posBuf1 = createBuf(posData, storageUsage);
  const velBuf0 = createBuf(velData, storageUsage);
  const velBuf1 = createBuf(velData, storageUsage);

  // Params uniform — 24 floats = 96 bytes (aligned to 16)
  const paramsBuf = device.createBuffer({
    size: 112,
    usage: GPU_UNIFORM | GPU_COPY_DST,
  });

  // Read-back buffer for positions
  const readBuf = device.createBuffer({
    size: bufSize,
    usage: GPU_MAP_READ | GPU_COPY_DST,
  });

  // Ping-pong bind groups
  const createBindGroup = (posR: GPUBuffer, velR: GPUBuffer, posW: GPUBuffer, velW: GPUBuffer) =>
    device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: paramsBuf } },
        { binding: 1, resource: { buffer: posR } },
        { binding: 2, resource: { buffer: velR } },
        { binding: 3, resource: { buffer: posW } },
        { binding: 4, resource: { buffer: velW } },
      ],
    });

  const bg0 = createBindGroup(posBuf0, velBuf0, posBuf1, velBuf1);
  const bg1 = createBindGroup(posBuf1, velBuf1, posBuf0, velBuf0);

  return {
    device,
    pipeline,
    bindGroups: [bg0, bg1],
    paramsBuf,
    posBufs: [posBuf0, posBuf1],
    velBufs: [velBuf0, velBuf1],
    readBuf,
    boidCount,
    frame: 0,
  };
}

export async function stepBoidGPU(
  gpu: BoidGPUState,
  simParams: SimParams,
): Promise<Float32Array> {
  const { device, pipeline, bindGroups, paramsBuf, posBufs, readBuf, boidCount } = gpu;
  const ping = gpu.frame % 2;
  gpu.frame++;

  // Write params
  const paramsData = new Float32Array(28);
  paramsData[0] = boidCount;
  paramsData[1] = simParams.maxSpeed;
  paramsData[2] = simParams.minSpeed;
  paramsData[3] = simParams.visualRange;
  paramsData[4] = simParams.visualRange * simParams.visualRange;
  paramsData[5] = simParams.separationDist;
  paramsData[6] = simParams.separationDist * simParams.separationDist;
  paramsData[7] = simParams.cohesionFactor;
  paramsData[8] = simParams.alignmentFactor;
  paramsData[9] = simParams.separationFactor;
  paramsData[10] = simParams.bounds;
  paramsData[11] = simParams.centerPull;
  paramsData[12] = simParams.zFlatten;
  paramsData[13] = simParams.edgeMargin;
  paramsData[14] = simParams.edgeForce;
  paramsData[15] = simParams.jitter;
  paramsData[16] = simParams.mouseX;
  paramsData[17] = simParams.mouseY;
  paramsData[18] = simParams.mouseActive ? 1 : 0;
  paramsData[19] = simParams.mouseRange;
  paramsData[20] = simParams.mouseRange * simParams.mouseRange;
  paramsData[21] = simParams.mouseFactor;
  paramsData[22] = Math.random() * 1000;

  const dv = new DataView(paramsData.buffer);
  dv.setUint32(0, boidCount, true);
  dv.setUint32(18 * 4, simParams.mouseActive ? 1 : 0, true);

  device.queue.writeBuffer(paramsBuf, 0, paramsData);

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroups[ping]);
  pass.dispatchWorkgroups(Math.ceil(boidCount / WORKGROUP_SIZE));
  pass.end();

  // Copy output positions to readback buffer
  const outPosBuf = posBufs[1 - ping];
  encoder.copyBufferToBuffer(outPosBuf, 0, readBuf, 0, boidCount * 16);

  device.queue.submit([encoder.finish()]);

  // Map and read positions
  await readBuf.mapAsync(1); // GPUMapMode.READ = 1
  const data = new Float32Array(readBuf.getMappedRange().slice(0));
  readBuf.unmap();

  return data; // vec4 per boid
}

export function destroyBoidGPU(gpu: BoidGPUState) {
  gpu.posBufs[0].destroy();
  gpu.posBufs[1].destroy();
  gpu.velBufs[0].destroy();
  gpu.velBufs[1].destroy();
  gpu.paramsBuf.destroy();
  gpu.readBuf.destroy();
  gpu.device.destroy();
}
