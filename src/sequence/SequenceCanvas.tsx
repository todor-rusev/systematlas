import { useEffect, useMemo, useRef, useState } from "react";
import type { SequenceCall, SequenceDocument } from "../core/sequence-types";
import { buildActorColors, NEUTRAL } from "../theme";
import { tokens } from "../tokens";
import { IconCallee, IconCaller } from "../shell/icons";
import { arrowHead, laneX, SEQ } from "./geometry";
import { buildSequence, type SeqRow } from "./layout";

                                                                             
function fitLabel(label: string, boxW: number): string {
  const max = Math.max(3, Math.floor((boxW - 16) / 7.2));
  return label.length > max ? `${label.slice(0, Math.max(3, max - 1))}…` : label;
}

const SELECT = "#2D2A24";                                                      
const EDGE = "#9a9384";
const TEXT = "#2A2722";
const CALLER = "#3C6E91";                                     
const CALLEE = "#BE7A2A";                                           
const REUSE = "#5E54A8";                                             
const ACT_HW = 5;                                                                                      

                                                                                   
function barX(lane: number, inset: number): number {
  return lane + inset * SEQ.depthInset;
}

function Message({
  row,
  width,
  laneGap,
  actorIndex,
  colors,
  selected,
  onSelect,
  onHover,
}: {
  row: SeqRow;
  width: number;
  laneGap: number;
  actorIndex: Record<string, number>;
  colors: Record<string, string>;
  selected: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const c = row.call;
  const toIdx = actorIndex[c.to] ?? 0;
  const fromIdx = c.from != null ? actorIndex[c.from] : undefined;
  const isEntry = fromIdx == null;
  const yc = row.yc;

                                                                            
  const hit = (
    <rect
      x={0}
      y={row.y}
      width={width}
      height={row.h}
      fill="transparent"
      style={{ cursor: "pointer" }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(c.id);
      }}
      onMouseEnter={() => onHover(c.id)}
      onMouseLeave={() => onHover(null)}
    />
  );

                                                               
  if (row.kind === "return") {
    const fromLane = laneX(fromIdx as number, laneGap);
    const toLane = laneX(toIdx, laneGap);
    const dir = fromLane > toLane ? 1 : -1;                                  
                                                                                      
                                                
    const startX = row.toInset != null ? barX(toLane, row.toInset) + dir * ACT_HW : toLane;
    const headX = row.fromInset != null ? barX(fromLane, row.fromInset) - dir * ACT_HW : fromLane;
    const col = selected ? SELECT : colors[c.to] ?? EDGE;
    const label = c.returnType ?? (c.returns?.length ? c.returns.map((r) => r.name).join(", ") : "");
    return (
      <g>
        <line
          x1={startX}
          y1={yc}
          x2={headX - dir * SEQ.ahead}
          y2={yc}
          stroke={col}
          strokeWidth={selected ? 2 : 1.3}
          strokeDasharray="5 4"
          strokeOpacity={selected ? 1 : 0.8}
        />
        <polygon points={arrowHead(headX, yc, dir > 0 ? 1 : -1)} fill={col} fillOpacity={selected ? 1 : 0.8} />
        {label ? (
          <text
            x={(startX + headX) / 2}
            y={yc - 5}
            textAnchor="middle"
            fontSize={10.5}
            fontStyle="italic"
            fontWeight={selected ? 700 : 500}
            fill={tokens.color.muted}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {label}
          </text>
        ) : null}
        {hit}
      </g>
    );
  }

                            
  const toLane = laneX(toIdx, laneGap);
  const self = !isEntry && fromIdx === toIdx;
                                                                                   
                                                                     
  const dir = isEntry || self ? 1 : toLane >= laneX(fromIdx as number, laneGap) ? 1 : -1;
                                                                                      
  const x2 = row.toInset != null ? barX(toLane, row.toInset) - dir * ACT_HW : toLane;
                                                                               
                                                                                
                                                   
  const ENTRY_STUB = 56;
  let x1: number;
  if (isEntry) {
    x1 = Math.max(8, x2 - ENTRY_STUB);
  } else {
    const fromLane = laneX(fromIdx as number, laneGap);
                                                                                      
    x1 = row.fromInset != null ? barX(fromLane, row.fromInset) + dir * ACT_HW : fromLane;
  }
  const col = selected ? SELECT : c.from ? (colors[c.from] ?? EDGE) : EDGE;
  const sw = selected ? 2.4 : 1.6;
  const dash = c.async ? "7 4" : undefined;

  const label = c.returnType ? `${c.method} → ${c.returnType}` : c.method;
  const labelX = self ? x1 + SEQ.selfW + 8 : (x1 + x2) / 2;
  const labelAnchor = self ? "start" : "middle";

  return (
    <g>
      {self ? (
        <>
          <path
            d={`M ${x1} ${yc - 8} h ${SEQ.selfW} v 16 h -${SEQ.selfW}`}
            fill="none"
            stroke={col}
            strokeWidth={sw}
            strokeDasharray={dash}
            strokeLinejoin="round"
          />
          <polygon points={arrowHead(x1, yc + 8, -1)} fill={col} />
        </>
      ) : (
        <>
          <line
            x1={x1}
            y1={yc}
            x2={x2 - dir * SEQ.ahead}
            y2={yc}
            stroke={col}
            strokeWidth={sw}
            strokeDasharray={dash}
          />
          <polygon points={arrowHead(x2, yc, dir)} fill={col} />
        </>
      )}
      <text
        x={labelX}
        y={yc - 8}
        textAnchor={labelAnchor}
        fontSize={12}
        fontWeight={selected ? 800 : 600}
        fill={TEXT}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {label}
      </text>
      {hit}
    </g>
  );
}

export function SequenceCanvas({
  doc,
  laneGap,
  rowH,
  selectedId,
  reuseCount,
  occIndex,
  callerId,
  calleeIds,
  scrollToId,
  scrollNonce,
  onSelectCall,
  onNavigate,
  onPaneClick,
}: {
  doc: SequenceDocument;
  laneGap: number;
  rowH: number;
  selectedId: string | null;
                                                                       
  reuseCount: Map<string, number>;
                                                                              
  occIndex: Map<string, number>;
                                                   
  callerId: string | null;
                                                 
  calleeIds: Set<string>;
                                                                                
  scrollToId: string | null;
  scrollNonce: number;
  onSelectCall: (id: string) => void;
  onNavigate: (id: string) => void;
  onPaneClick: () => void;
}) {
  const colors = useMemo(() => buildActorColors(doc.actors), [doc]);
  const layout = useMemo(() => buildSequence(doc, { laneGap, rowH }), [doc, laneGap, rowH]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const vpRef = useRef<HTMLDivElement>(null);

  const contentH = SEQ.headerH + layout.height;
  const callRows = useMemo(() => layout.rows.filter((r) => r.kind === "call"), [layout]);
                                                                                  
  const ycById = useMemo(() => {
    const m = new Map<string, number>();
    callRows.forEach((r) => m.set(r.call.id, r.yc));
    return m;
  }, [callRows]);

                                                                              
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !scrollToId) return;
    const yc = ycById.get(scrollToId);
    if (yc == null) return;
    el.scrollTo({ top: Math.max(0, SEQ.headerH + yc - el.clientHeight / 2), behavior: "smooth" });
                                                           
  }, [scrollNonce]);

                                                                                 
                                    
  const syncViewport = () => {
    const el = scrollRef.current;
    const vp = vpRef.current;
    if (!el || !vp) return;
    const sh = el.scrollHeight || 1;
    vp.style.top = `${(el.scrollTop / sh) * 100}%`;
    vp.style.height = `${(el.clientHeight / sh) * 100}%`;
  };
  useEffect(syncViewport, [layout]);

  const jumpFromRail = (e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    const r = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientY - r.top) / r.height;
    el.scrollTo({ top: Math.max(0, frac * el.scrollHeight - el.clientHeight / 2), behavior: "smooth" });
  };

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", background: tokens.color.canvas }}>
      {                                                                        }
      <div
        onClick={jumpFromRail}
        title="Jump"
        style={{
          flex: `0 0 ${SEQ.railW}px`,
          width: SEQ.railW,
          position: "relative",
          background: "#EFEADF",
          borderRight: `1px solid ${tokens.color.border}`,
          cursor: "pointer",
          overflow: "hidden",
        }}
      >
        {callRows.map((r) => (
          <div
            key={`mm-${r.call.id}`}
            style={{
              position: "absolute",
              left: 5,
              right: 5,
              height: 2,
              borderRadius: 1,
              top: `${((SEQ.headerH + r.yc) / contentH) * 100}%`,
              background: colors[r.call.from ?? ""] ?? NEUTRAL,
              opacity: r.call.id === selectedId ? 1 : 0.5,
            }}
          />
        ))}
        <div
          ref={vpRef}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            background: "rgba(94,84,168,0.16)",
            borderTop: `1px solid ${tokens.color.violet}`,
            borderBottom: `1px solid ${tokens.color.violet}`,
            pointerEvents: "none",
          }}
        />
        {                                                                             }
        {[...occIndex.entries()].map(([id, n]) => {
          const yc = ycById.get(id);
          if (yc == null) return null;
          return (
            <div
              key={`od-${id}`}
              title={`occurrence ${n}`}
              onClick={(e) => {
                e.stopPropagation();
                onNavigate(id);
              }}
              style={{
                position: "absolute",
                left: "50%",
                transform: "translate(-50%,-50%)",
                top: `${((SEQ.headerH + yc) / contentH) * 100}%`,
                width: 15,
                height: 15,
                borderRadius: "50%",
                background: REUSE,
                color: "#fff",
                fontSize: 9,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #fff",
                cursor: "pointer",
              }}
            >
              {n}
            </div>
          );
        })}
      </div>

      {                                                       }
      <div ref={scrollRef} onScroll={syncViewport} style={{ flex: "1 1 auto", overflow: "auto", position: "relative" }}>
        {                                                                         }
        <div style={{ position: "sticky", top: 0, zIndex: 2, width: layout.width, height: SEQ.headerH, background: tokens.color.canvas, borderBottom: `1px solid ${tokens.color.borderSoft}` }}>
          <svg width={layout.width} height={SEQ.headerH} style={{ display: "block" }}>
            {doc.actors.map((a, i) => {
              const x = laneX(i, laneGap);
              const col = colors[a.id] ?? NEUTRAL;
                                                                                             
              const bw = Math.max(SEQ.actorBoxMinW, Math.min(SEQ.actorBoxW, laneGap - SEQ.actorBoxGap));
              const bh = SEQ.actorBoxH;
              const ah = SEQ.actorAccentH;
              const bx = x - bw / 2;
              const by = 6;
              const label = fitLabel(a.label, bw);
              return (
                <g key={a.id}>
                  {                                                                 }
                  <line x1={x} y1={by + bh} x2={x} y2={SEQ.headerH} stroke={col} strokeWidth={1.5} strokeOpacity={0.4} strokeDasharray="2 5" />
                  <rect x={bx} y={by} width={bw} height={bh} rx={3} fill="#fff" stroke={tokens.color.border} />
                  <rect x={bx + 1} y={by + bh - ah} width={bw - 2} height={ah} fill={col} />
                  <text x={x} y={by + bh / 2 + 3} textAnchor="middle" fontSize={12} fontWeight={700} fill="#4a463d" style={{ pointerEvents: "none", userSelect: "none" }}>
                    {label}
                    {label !== a.label ? <title>{a.label}</title> : null}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <svg width={layout.width} height={layout.height} style={{ display: "block" }}>
          <rect width={layout.width} height={layout.height} fill="transparent" onClick={onPaneClick} />

          {                                              }
          {layout.rows.map((r) => {
            const sel = r.call.id === selectedId;
            const hov = r.call.id === hoverId;
            if (!sel && !hov) return null;
            return <rect key={`band-${r.kind}-${r.call.id}`} x={0} y={r.y} width={layout.width} height={r.h} fill={sel ? "rgba(45,42,36,0.07)" : "rgba(45,42,36,0.035)"} pointerEvents="none" />;
          })}

          {               }
          {doc.actors.map((a, i) => {
            const x = laneX(i, laneGap);
            const col = colors[a.id] ?? NEUTRAL;
            return <line key={a.id} x1={x} y1={0} x2={x} y2={layout.height - 12} stroke={col} strokeWidth={1.5} strokeOpacity={0.4} strokeDasharray="2 5" />;
          })}

          {                      }
          {layout.seps.map((s) => {
            const yc = s.y + SEQ.sepH / 2;
            return (
              <g key={s.id}>
                <line x1={20} y1={yc} x2={layout.width - 16} y2={yc} stroke="#ddd5c6" strokeWidth={1} strokeDasharray="2 4" />
                <rect x={laneX(0, laneGap) - 56} y={yc - 9} width={112} height={18} rx={9} fill={tokens.color.canvas} />
                <text x={laneX(0, laneGap)} y={yc + 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="#b0a892" style={{ pointerEvents: "none", userSelect: "none", letterSpacing: "0.08em" }}>
                  {s.label.toUpperCase()}
                </text>
              </g>
            );
          })}

          {                                                                           
                                                                                         }
          {layout.acts.map((a, i) => {
            const x = barX(laneX(a.actorIdx, laneGap), a.inset);
            const actor = doc.actors[a.actorIdx];
            const col = actor ? (colors[actor.id] ?? NEUTRAL) : NEUTRAL;
            const h = Math.max(2, a.y2 - a.y1);
            return (
              <g key={i}>
                <rect x={x - ACT_HW} y={a.y1} width={ACT_HW * 2} height={h} rx={2} fill="#FFFFFF" />
                <rect x={x - ACT_HW} y={a.y1} width={ACT_HW * 2} height={h} rx={2} fill={`${col}26`} stroke={col} strokeOpacity={0.55} />
              </g>
            );
          })}

          {                                                                               }
          {callRows.map((r) => {
            const id = r.call.id;
            const yc = r.yc;
            const occ = occIndex.get(id);
            const n = reuseCount.get(id);
            const rel = id === callerId ? "caller" : calleeIds.has(id) ? "callee" : null;
            if (!occ && !n && !rel) return null;
            return (
              <g key={`mk-${id}`}>
                {rel ? (
                  <g>
                    <circle cx={24} cy={yc} r={9} fill={rel === "caller" ? CALLER : CALLEE} fillOpacity={0.16} />
                    <g transform={`translate(${24 - 7.2},${yc - 7.2})`} style={{ color: rel === "caller" ? CALLER : CALLEE }}>
                      {rel === "caller" ? <IconCaller size={14.4} /> : <IconCallee size={14.4} />}
                    </g>
                  </g>
                ) : null}
                {occ ? (
                  <g>
                    <circle cx={48} cy={yc} r={8} fill={REUSE} />
                    <text x={48} y={yc + 3} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff" style={{ pointerEvents: "none", userSelect: "none" }}>
                      {occ}
                    </text>
                  </g>
                ) : n ? (
                  <g>
                    <rect x={39} y={yc - 8} width={26} height={16} rx={8} fill={tokens.color.violetBg} />
                    <text x={52} y={yc + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill={REUSE} style={{ pointerEvents: "none", userSelect: "none" }}>
                      ×{n}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}

          {                               }
          {layout.rows.map((r) => (
            <Message key={`${r.kind}-${r.call.id}`} row={r} width={layout.width} laneGap={laneGap} actorIndex={layout.actorIndex} colors={colors} selected={r.call.id === selectedId} onSelect={onSelectCall} onHover={setHoverId} />
          ))}
        </svg>
      </div>
    </div>
  );
}

                                                                                  
export function flattenCalls(calls: SequenceCall[]): SequenceCall[] {
  const out: SequenceCall[] = [];
  const walk = (cs: SequenceCall[]) => {
    for (const c of cs) {
      out.push(c);
      if (c.children?.length) walk(c.children);
    }
  };
  walk(calls);
  return out;
}
