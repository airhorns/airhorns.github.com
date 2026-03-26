import { useRef, useEffect, useState, useCallback } from "react";
import {
  type PaxosConfig,
  type PaxosState,
  type PaxosEvent,
  initPaxos,
  propose,
  readFromCluster,
  startNewRound,
  tickMessages,
} from "@/lib/paxos-sim";

const VALUE_COLORS = ["#B3EECC", "#ecb3ee", "#eecbb3", "#b3ccee", "#eeb3b3", "#cceeb3"];

interface PaxosDemoProps {
  config: Partial<PaxosConfig>;
  width?: number;
  height?: number;
  autoPropose?: boolean;
  proposeInterval?: number;
  dualPropose?: boolean;
  dualProposeDelay?: number;
  newRoundsOnPropose?: boolean;
  readMode?: boolean;
  label?: string;
}

export function PaxosDemo({
  config: configOverrides,
  width = 500,
  height = 400,
  autoPropose = true,
  proposeInterval = 8000,
  dualPropose = false,
  dualProposeDelay = 3000,
  newRoundsOnPropose = true,
  readMode = false,
  label,
}: PaxosDemoProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const stateRef = useRef<PaxosState | null>(null);
  const rafRef = useRef<number>(0);
  const [, forceRender] = useState(0);
  const [events, setEvents] = useState<PaxosEvent[]>([]);
  const proposeTimerRef = useRef<number>(0);

  // Initialize
  useEffect(() => {
    const fullConfig: PaxosConfig = {
      replicaCount: 5,
      clientCount: 1,
      baseNetworkDelay: 1500,
      networkDelayVariability: 1,
      width,
      height,
      ...configOverrides,
    };
    stateRef.current = initPaxos(fullConfig);
    setEvents([]);
    forceRender((n) => n + 1);
  }, [width, height]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      if (stateRef.current) {
        tickMessages(stateRef.current, performance.now());
        setEvents([...stateRef.current.events]);
        forceRender((n) => n + 1);
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Auto-propose
  useEffect(() => {
    if (!autoPropose) return;
    const doPropose = () => {
      if (!stateRef.current) return;
      const now = performance.now();
      if (newRoundsOnPropose) startNewRound(stateRef.current);

      if (readMode) {
        readFromCluster(stateRef.current, 0, now);
      } else {
        propose(stateRef.current, 0, now);
        if (dualPropose && stateRef.current.clients.length > 1) {
          setTimeout(() => {
            if (stateRef.current) propose(stateRef.current, 1, performance.now());
          }, dualProposeDelay);
        }
      }
    };

    // Initial propose
    const initialTimer = setTimeout(doPropose, 500);
    proposeTimerRef.current = window.setInterval(doPropose, proposeInterval);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(proposeTimerRef.current);
    };
  }, [autoPropose, proposeInterval, dualPropose, dualProposeDelay, newRoundsOnPropose, readMode]);

  const handlePropose = useCallback(() => {
    if (!stateRef.current) return;
    const now = performance.now();
    if (newRoundsOnPropose) startNewRound(stateRef.current);
    propose(stateRef.current, 0, now);
    if (dualPropose && stateRef.current.clients.length > 1) {
      setTimeout(() => {
        if (stateRef.current) propose(stateRef.current, 1, performance.now());
      }, dualProposeDelay);
    }
  }, [newRoundsOnPropose, dualPropose, dualProposeDelay]);

  const state = stateRef.current;
  if (!state) return null;

  return (
    <div>
      {label && <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{label}</div>}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ display: "block", maxWidth: "100%", border: "1px solid #eee", borderRadius: 4, background: "#fafafa" }}
      >
        {/* Links from messages to destinations (dashed lines) */}
        {state.messages.map((msg) => (
          <line
            key={`link-${msg.id}`}
            x1={msg.x}
            y1={msg.y}
            x2={msg.endX}
            y2={msg.endY}
            stroke="#ccc"
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        ))}

        {/* Replicas */}
        {state.replicas.map((r) => (
          <g key={`replica-${r.id}`}>
            {/* Value halo */}
            {r.value !== null && (
              <circle
                cx={r.x}
                cy={r.y}
                r={22}
                fill={VALUE_COLORS[(r.value - 1) % VALUE_COLORS.length]}
                opacity={0.6}
              />
            )}
            <circle
              cx={r.x}
              cy={r.y}
              r={16}
              fill={r.state === "muted" ? "#999" : r.state === "awaiting-promises" ? "#FFB347" : "#00ADA7"}
              stroke={r.value !== null ? VALUE_COLORS[(r.value - 1) % VALUE_COLORS.length] : "none"}
              strokeWidth={r.value !== null ? 3 : 0}
            />
            <text x={r.x} y={r.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#fff" fontWeight="bold">
              {r.value ?? ""}
            </text>
            <text x={r.x} y={r.y - 22} textAnchor="middle" fontSize={9} fill="#666">
              R{r.id}
            </text>
          </g>
        ))}

        {/* Clients */}
        {state.clients.map((c) => (
          <g key={`client-${c.id}`}>
            <circle cx={c.x} cy={c.y} r={14} fill="#DE3961" />
            <text x={c.x} y={c.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#fff" fontWeight="bold">
              C{-c.id}
            </text>
          </g>
        ))}

        {/* Flying messages */}
        {state.messages.map((msg) => (
          <g key={`msg-${msg.id}`}>
            <circle
              cx={msg.x}
              cy={msg.y}
              r={6}
              fill={
                msg.type === "prepare" || msg.type === "setValue"
                  ? "#A4E670"
                  : msg.type === "promise"
                    ? "#70B8E6"
                    : msg.type === "accept"
                      ? "#E6A470"
                      : msg.type === "reject"
                        ? "#E67070"
                        : "#A4E670"
              }
              stroke="#fff"
              strokeWidth={1}
            />
            {msg.value !== null && (
              <circle
                cx={msg.x}
                cy={msg.y - 10}
                r={4}
                fill={VALUE_COLORS[((msg.value ?? 1) - 1) % VALUE_COLORS.length]}
                stroke="#999"
                strokeWidth={0.5}
              />
            )}
          </g>
        ))}
      </svg>

      <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
        {!autoPropose && (
          <button onClick={handlePropose} style={btnStyle}>
            Propose
          </button>
        )}
        <div style={{ fontSize: 11, color: "#888", display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill="#00ADA7" /></svg> Replica
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill="#DE3961" /></svg> Client
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill="#A4E670" /></svg> Prepare
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill="#70B8E6" /></svg> Promise
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill="#E6A470" /></svg> Accept
          </span>
        </div>
      </div>

      {events.length > 0 && (
        <div style={{ fontSize: 11, color: "#666", marginTop: 4, maxHeight: 60, overflow: "auto" }}>
          {events.slice(-5).map((e, i) => (
            <div key={i}>
              {e.type === "valueAccepted" && `R${e.replicaId} accepted value ${e.value}`}
              {e.type === "proposalSucceeded" && `R${e.replicaId} proposal succeeded (value ${e.value})`}
              {e.type === "proposalFailed" && `R${e.replicaId} proposal failed`}
              {e.type === "readComplete" && `Client read value: ${e.value ?? "none"}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "4px 12px",
  fontSize: 13,
  cursor: "pointer",
  background: "#f0f0f0",
  border: "1px solid #ccc",
  borderRadius: 4,
};
