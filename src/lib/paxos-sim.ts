// Paxos consensus algorithm simulation
// Simplified port from CoffeeScript/Batman.js/D3 implementation

export type ReplicaState = "idle" | "awaiting-promises" | "muted";

export interface Replica {
  id: number;
  x: number;
  y: number;
  state: ReplicaState;
  value: number | null;
  highestSeenSequenceNumber: number;
  roundAttempt: RoundAttempt | null;
}

export interface RoundAttempt {
  sequenceNumber: number;
  value: number;
  promisesReceived: number;
}

export interface Client {
  id: number;
  x: number;
  y: number;
  targetReplicaId: number | null;
  readValue: number | null;
}

export type MessageType =
  | "prepare"
  | "promise"
  | "reject"
  | "accept"
  | "query"
  | "queryResponse"
  | "setValue"
  | "setValueResult";

export interface FlyingMessage {
  id: number;
  type: MessageType;
  sender: number;
  destination: number;
  value: number | null;
  sequenceNumber: number;
  // Animation state
  x: number;
  y: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startTime: number;
  duration: number;
}

export interface PaxosConfig {
  replicaCount: number;
  clientCount: number;
  baseNetworkDelay: number;
  networkDelayVariability: number;
  width: number;
  height: number;
  // Behavior overrides
  mutedReplicas?: Set<number>;
  disableAcceptance?: boolean;
  replicaClass?: "normal" | "timePrecedence";
  clientTargets?: Record<number, number>; // clientId -> replicaId
}

export interface PaxosState {
  replicas: Replica[];
  clients: Client[];
  messages: FlyingMessage[];
  nextMessageId: number;
  nextValue: number;
  roundNumber: number;
  config: PaxosConfig;
  events: PaxosEvent[];
}

export interface PaxosEvent {
  type: "valueAccepted" | "proposalFailed" | "proposalSucceeded" | "readComplete";
  replicaId?: number;
  clientId?: number;
  value?: number | null;
  time: number;
}

function layoutReplicas(count: number, width: number, height: number, clientMargin: number): { x: number; y: number }[] {
  const margin = 40;
  const cx = width / 2 + clientMargin / 2;
  const cy = height / 2;
  const rx = (width - margin * 2 - clientMargin) / 2;
  const ry = (height - margin * 2) / 2;

  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
    };
  });
}

function layoutClients(count: number, height: number): { x: number; y: number }[] {
  const margin = 60;
  if (count === 1) return [{ x: 30, y: height / 2 }];
  return Array.from({ length: count }, (_, i) => ({
    x: 30,
    y: margin + (i / (count - 1)) * (height - margin * 2),
  }));
}

export function initPaxos(config: PaxosConfig): PaxosState {
  const replicaPositions = layoutReplicas(config.replicaCount, config.width, config.height, config.clientCount > 0 ? 60 : 0);
  const clientPositions = layoutClients(config.clientCount, config.height);

  const replicas: Replica[] = replicaPositions.map((pos, i) => ({
    id: i + 1,
    x: pos.x,
    y: pos.y,
    state: config.mutedReplicas?.has(i + 1) ? "muted" : "idle",
    value: null,
    highestSeenSequenceNumber: 0,
    roundAttempt: null,
  }));

  const clients: Client[] = clientPositions.map((pos, i) => ({
    id: -(i + 1),
    x: pos.x,
    y: pos.y,
    targetReplicaId: null,
    readValue: null,
  }));

  return {
    replicas,
    clients,
    messages: [],
    nextMessageId: 0,
    nextValue: 0,
    roundNumber: 0,
    config,
    events: [],
  };
}

function getEntity(state: PaxosState, id: number): Replica | Client | undefined {
  if (id > 0) return state.replicas.find((r) => r.id === id);
  return state.clients.find((c) => c.id === id);
}

function nextSequenceNumber(replica: Replica, replicaCount: number): number {
  const rounds = Math.floor(replica.highestSeenSequenceNumber / replicaCount);
  const base = rounds * replicaCount;
  return base + replica.id;
}

function sendMessage(
  state: PaxosState,
  senderId: number,
  destinationId: number,
  type: MessageType,
  value: number | null,
  sequenceNumber: number,
  now: number,
): void {
  const sender = getEntity(state, senderId);
  const dest = getEntity(state, destinationId);
  if (!sender || !dest) return;

  const delay =
    state.config.baseNetworkDelay +
    Math.floor(Math.random() * state.config.networkDelayVariability * state.config.baseNetworkDelay);

  state.messages.push({
    id: ++state.nextMessageId,
    type,
    sender: senderId,
    destination: destinationId,
    value,
    sequenceNumber,
    x: sender.x,
    y: sender.y,
    startX: sender.x,
    startY: sender.y,
    endX: dest.x,
    endY: dest.y,
    startTime: now,
    duration: delay,
  });
}

function broadcastToReplicas(
  state: PaxosState,
  senderId: number,
  type: MessageType,
  value: number | null,
  sequenceNumber: number,
  now: number,
): void {
  for (const replica of state.replicas) {
    if (replica.id !== senderId && replica.state !== "muted") {
      sendMessage(state, senderId, replica.id, type, value, sequenceNumber, now);
    }
  }
}

function processMessageArrival(state: PaxosState, msg: FlyingMessage, now: number): void {
  const dest = getEntity(state, msg.destination);
  if (!dest) return;

  if ("state" in dest) {
    // It's a replica
    const replica = dest as Replica;
    if (replica.state === "muted") return;

    switch (msg.type) {
      case "setValue":
        handleSetValue(state, replica, msg, now);
        break;
      case "prepare":
        handlePrepare(state, replica, msg, now);
        break;
      case "promise":
        handlePromise(state, replica, msg, now);
        break;
      case "reject":
        handleReject(state, replica, now);
        break;
      case "accept":
        handleAccept(state, replica, msg, now);
        break;
      case "query":
        sendMessage(state, replica.id, msg.sender, "queryResponse", replica.value, 0, now);
        break;
    }
  } else {
    // It's a client
    const client = dest as Client;
    if (msg.type === "queryResponse") {
      client.readValue = msg.value;
      state.events.push({ type: "readComplete", clientId: client.id, value: msg.value, time: now });
    }
  }
}

function handleSetValue(state: PaxosState, replica: Replica, msg: FlyingMessage, now: number): void {
  if (msg.value === null) return;
  const seqNum = nextSequenceNumber(replica, state.config.replicaCount);
  replica.highestSeenSequenceNumber = seqNum;
  replica.state = "awaiting-promises";
  replica.roundAttempt = {
    sequenceNumber: seqNum,
    value: msg.value,
    promisesReceived: 0,
  };

  broadcastToReplicas(state, replica.id, "prepare", msg.value, seqNum, now);
}

function handlePrepare(state: PaxosState, replica: Replica, msg: FlyingMessage, now: number): void {
  if (state.config.replicaClass === "timePrecedence") {
    // TimePrecedenceReplica: just accept whatever comes last (broken, for demo)
    if (replica.state === "awaiting-promises") {
      replica.state = "idle";
      replica.roundAttempt = null;
    }
    sendMessage(state, replica.id, msg.sender, "promise", null, 0, now);
    if (msg.value !== null) {
      replica.value = msg.value;
      state.events.push({ type: "valueAccepted", replicaId: replica.id, value: msg.value, time: now });
    }
    return;
  }

  if (msg.sequenceNumber > replica.highestSeenSequenceNumber) {
    replica.highestSeenSequenceNumber = msg.sequenceNumber;
    if (replica.state === "awaiting-promises") {
      replica.state = "idle";
      replica.roundAttempt = null;
      state.events.push({ type: "proposalFailed", replicaId: replica.id, time: now });
    }
    sendMessage(state, replica.id, msg.sender, "promise", replica.value, 0, now);
    // Stage value if no existing value or same value
    if (replica.value === null || replica.value === msg.value) {
      if (msg.value !== null) {
        replica.value = msg.value;
        state.events.push({ type: "valueAccepted", replicaId: replica.id, value: msg.value, time: now });
      }
    }
  } else {
    sendMessage(state, replica.id, msg.sender, "reject", null, replica.highestSeenSequenceNumber, now);
  }
}

function handlePromise(state: PaxosState, replica: Replica, msg: FlyingMessage, now: number): void {
  if (!replica.roundAttempt || replica.state !== "awaiting-promises") return;

  // If the promise includes a previously accepted value that differs, abort
  if (msg.value !== null && msg.value !== replica.roundAttempt.value) {
    replica.state = "idle";
    state.events.push({ type: "proposalFailed", replicaId: replica.id, time: now });
    replica.roundAttempt = null;
    return;
  }

  replica.roundAttempt.promisesReceived++;
  const quorum = Math.ceil(state.config.replicaCount / 2);

  if (replica.roundAttempt.promisesReceived >= quorum) {
    replica.state = "idle";
    const val = replica.roundAttempt.value;

    if (!state.config.disableAcceptance) {
      broadcastToReplicas(state, replica.id, "accept", val, replica.roundAttempt.sequenceNumber, now);
    }

    replica.value = val;
    state.events.push({ type: "proposalSucceeded", replicaId: replica.id, value: val, time: now });
    replica.roundAttempt = null;
  }
}

function handleReject(state: PaxosState, replica: Replica, now: number): void {
  if (replica.state === "awaiting-promises") {
    replica.state = "idle";
    state.events.push({ type: "proposalFailed", replicaId: replica.id, time: now });
    replica.roundAttempt = null;
  }
}

function handleAccept(state: PaxosState, replica: Replica, msg: FlyingMessage, now: number): void {
  if (msg.sequenceNumber >= replica.highestSeenSequenceNumber) {
    if (replica.state === "awaiting-promises") {
      replica.state = "idle";
      replica.roundAttempt = null;
    }
    replica.highestSeenSequenceNumber = msg.sequenceNumber;
    replica.value = msg.value;
    state.events.push({ type: "valueAccepted", replicaId: replica.id, value: msg.value, time: now });
  }
}

// Public API

export function propose(state: PaxosState, clientIndex: number, now: number): void {
  state.nextValue++;
  const client = state.clients[clientIndex];
  if (!client) return;

  // Pick target replica
  let targetId: number;
  if (state.config.clientTargets && state.config.clientTargets[client.id] !== undefined) {
    targetId = state.config.clientTargets[client.id];
  } else {
    targetId = state.replicas[Math.floor(Math.random() * state.replicas.length)].id;
  }

  client.targetReplicaId = targetId;
  sendMessage(state, client.id, targetId, "setValue", state.nextValue, 0, now);
}

export function readFromCluster(state: PaxosState, clientIndex: number, now: number): void {
  const client = state.clients[clientIndex];
  if (!client) return;
  for (const replica of state.replicas) {
    sendMessage(state, client.id, replica.id, "query", null, 0, now);
  }
}

export function startNewRound(state: PaxosState): void {
  state.roundNumber++;
  for (const r of state.replicas) {
    r.value = null;
    r.highestSeenSequenceNumber = 0;
    r.roundAttempt = null;
    if (r.state !== "muted") r.state = "idle";
  }
  state.messages = [];
  state.events = [];
}

export function tickMessages(state: PaxosState, now: number): void {
  const arrived: FlyingMessage[] = [];

  for (const msg of state.messages) {
    const t = Math.min(1, (now - msg.startTime) / msg.duration);
    msg.x = msg.startX + (msg.endX - msg.startX) * t;
    msg.y = msg.startY + (msg.endY - msg.startY) * t;
    if (t >= 1) arrived.push(msg);
  }

  for (const msg of arrived) {
    state.messages = state.messages.filter((m) => m.id !== msg.id);
    processMessageArrival(state, msg, now);
  }
}
