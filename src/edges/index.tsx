import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useStore,
  type EdgeProps,
} from "@xyflow/react";
import { useId, type MouseEvent } from "react";
import type { DrillHandler, EdgeType } from "../model";
import { LABEL_MAX_W } from "../layout";
import { IconEnter } from "../shell/icons";
import type { EdgeStyle } from "../core/visual-vocabulary";
import { clipToOutline, type Point } from "../visual-geometry";
import { DEFAULT_PRESET, VISUAL_PRESETS, type PresetName } from "../visual-tokens";
import { smoothRoute } from "../edge-routing";
import { InlineMarkdown } from "../shell/Markdown";
import { plainText } from "../core/markdown";

                                                                                
                                                                             

                                                                           
                                                                            
                                         
const SELECT = "#2D2A24";
const DOT = "#FCFAF4";                                                        
const DUR = 4.2;                                              

export interface FtEdgeData {
  edgeType: EdgeType;
                                            
  text?: string;
  style?: EdgeStyle;
  visualPreset?: PresetName;
                                                                        
  drillTarget?: string;
  drillKind?: "flow" | "sequence";
  canDrill?: boolean;
  onDrill?: DrillHandler;
                                                                   
  points?: { x: number; y: number }[];
                                                                             
  path?: string;
                                                                                  
                                                                                            
  sourceBox?: {
    x: number;
    y: number;
    w: number;
    h: number;
    outline?: Point[];
    anchor?: Point;
  };
  targetBox?: {
    x: number;
    y: number;
    w: number;
    h: number;
    outline?: Point[];
    anchor?: Point;
  };
                                                                      
  labelXY?: { x: number; y: number };
                                                                                   
  onSelect?: () => void;
  [key: string]: unknown;
}

                                                                                 
                                                                                     
                                                                                        
const clipToBox = clipToOutline;

                                                                               
                                                                                 
                                                                        
                                                                            
function simplify(
  pts: { x: number; y: number }[],
  eps: number,
): { x: number; y: number }[] {
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const dist = Math.abs((b.x - a.x) * dy - (b.y - a.y) * dx) / len;
    if (dist > eps) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function FtEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps) {
  const d = (data ?? {}) as FtEdgeData;
  const preset = VISUAL_PRESETS[d.visualPreset ?? DEFAULT_PRESET];
  const zoom = useStore(state => state.transform[2]);
  const markerId = `ft-marker-${useId().replace(/:/g, "-")}`;
  const isReturn = d.edgeType === "return";
  let path: string;
  let labelX: number;
  let labelY: number;
  if (d.points && d.points.length >= 2) {
                                                                                 
                                                                              
                                                                                     
                                                                           
                                                                                   
                                                                                  
                   
                                                                                      
                                                                                         
                                                                                           
                                                                                       
    const pts = simplify(
      d.points.map((p) => ({ x: p.x, y: p.y })),
      2.5,
    );
    const GAP = d.style?.start === "circle" || d.style?.start === "cross" ? 6 : 2;
                                                                                    
                                            
    const towardTarget = pts[pts.length - 2];
    const towardSource = pts[1];
                                                                                      
                                                                                
    if (d.targetBox) {
      pts[pts.length - 1] = clipToBox(d.targetBox, towardTarget, 6);
    } else {
      const last = { x: targetX, y: targetY };
      const dx = last.x - towardTarget.x;
      const dy = last.y - towardTarget.y;
      const len = Math.hypot(dx, dy) || 1;
      pts[pts.length - 1] =
        len > GAP
          ? { x: last.x - (dx / len) * GAP, y: last.y - (dy / len) * GAP }
          : last;
    }
                                                                                       
                                                                                      
    if (d.sourceBox) {
      pts[0] = clipToBox(d.sourceBox, towardSource, GAP);
    } else {
      pts[0] = { x: sourceX, y: sourceY };
      const sdx = towardSource.x - pts[0].x;
      const sdy = towardSource.y - pts[0].y;
      const slen = Math.hypot(sdx, sdy) || 1;
      if (slen > GAP)
        pts[0] = {
          x: pts[0].x + (sdx / slen) * GAP,
          y: pts[0].y + (sdy / slen) * GAP,
        };
    }
    path = d.path ?? smoothRoute(pts, [], [], 9, preset.edge.headSize + 3);
    const m = d.labelXY ?? pts[Math.floor(pts.length / 2)];
    labelX = m.x;
    labelY = m.y;
  } else if (isReturn) {
    const bow = Math.max(70, Math.abs(sourceY - targetY) * 0.35);
    const cx = Math.max(sourceX, targetX) + bow;
    path = `M ${sourceX},${sourceY} C ${cx},${sourceY} ${cx},${targetY} ${targetX},${targetY}`;
    labelX = cx - 6;
    labelY = (sourceY + targetY) / 2;
  } else {
    [path, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: 10,
    });
  }
  const stroke = selected ? SELECT : preset.edge.ink;
  const line = d.style?.line ?? (isReturn ? "dashed" : "solid");
  const dash =
    line === "dashed"
      ? isReturn && !d.style?.line ? preset.edge.returnDash : "7 5"
      : line === "dotted"
        ? preset.edge.asyncDash
        : line === "dash-dot"
          ? "8 4 1 4"
          : undefined;
  const lineWidth = preset.edge.width * (d.style?.width === "thick" ? 1.8 : 1);
  const invisible = line === "invisible" && !selected;
  const end = d.style?.end ?? "arrow",
    start = d.style?.start ?? "none";

                                                               
  const dist = Math.abs(targetX - sourceX) + Math.abs(targetY - sourceY);
  const dotCount = Math.max(2, Math.min(5, Math.round(dist / 130)));

  const noun = d.drillKind === "sequence" ? "sequence" : "sub-flow";
  const openDrill = (e: MouseEvent) => {
    e.stopPropagation();
    if (d.canDrill && d.drillTarget)
      d.onDrill?.(d.drillTarget, { kind: "edge", id });
  };

  return (
    <>
      <defs>
          {(["start", "end"] as const).map((side) => {
            const kind = side === "start" ? start : end;
            if (kind === "none") return null;
            return (
              <marker
                key={side}
                id={`${markerId}-${side}`}
                viewBox="0 0 10 10"
                refX={kind === "arrow" ? 8 : 5}
                refY={5}
                markerWidth={kind === "arrow" ? preset.edge.headSize : 8}
                markerHeight={kind === "arrow" ? preset.edge.headSize : 8}
                markerUnits="userSpaceOnUse"
                orient="auto-start-reverse"
              >
                {kind === "arrow" ? (
                  <path d={preset.edge.head === "solid" ? "M2,2 L8,5 L2,8 Z" : "M2,2 L8,5 L2,8"} fill={preset.edge.head === "solid" ? stroke : "none"} stroke={stroke} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
                ) : kind === "circle" ? (
                  <circle
                    cx={5}
                    cy={5}
                    r={3}
                    fill="#FCFAF4"
                    stroke={stroke}
                    strokeWidth={1.4}
                  />
                ) : (
                  <path
                    d="M2,2 L8,8 M8,2 L2,8"
                    stroke={stroke}
                    strokeWidth={1.8}
                  />
                )}
              </marker>
            );
          })}
      </defs>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={
          invisible || end === "none"
            ? undefined
            : `url(#${markerId}-end)`
        }
        markerStart={
          invisible || start === "none" ? undefined : `url(#${markerId}-start)`
        }
        interactionWidth={36}
        style={{
          stroke: invisible ? "transparent" : stroke,
          strokeWidth:
            line === "double"
              ? lineWidth * 2 + 1.75
              : selected
                ? lineWidth + 1.1
                : lineWidth,
          strokeDasharray: dash,
          strokeLinecap: "round",
          transition: "stroke .12s ease, stroke-width .12s ease",
        }}
      />
      {line === "double" ? (
        <path
          d={path}
          fill="none"
          stroke={preset.canvas.background}
          strokeWidth={1.75}
          style={{ pointerEvents: "none" }}
        />
      ) : null}
      {selected
        ? Array.from({ length: dotCount }).map((_, i) => (
            <circle
              key={i}
              r={4 / zoom}
              fill={DOT}
              stroke={SELECT}
              strokeWidth={1.25 / zoom}
              style={{ pointerEvents: "none" }}
            >
              <animateMotion
                dur={`${DUR}s`}
                repeatCount="indefinite"
                path={path}
                rotate="auto"
                begin={`${-(DUR / dotCount) * i}s`}
              />
            </circle>
          ))
        : null}

      {                                                                            
                                                                                    
                                                                                     
                                                                                     
                                                                                         }
      {d.drillTarget || d.text ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
              pointerEvents: "none",                                     
              zIndex: selected ? 5 : 1,
            }}
          >
            {d.drillTarget ? (
              <button
                className="nodrag nopan"
                onClick={openDrill}
                disabled={!d.canDrill}
                title={
                  d.canDrill
                    ? `Open ${noun}: ${d.drillTarget}`
                    : `${noun} '${d.drillTarget}' not found in workspace`
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: selected ? 4 : 0,
                  padding: selected ? "3px 9px 3px 7px" : "3px 7px",
                  border: `1px solid ${d.canDrill ? SELECT : "#d9d2c4"}`,
                  borderRadius: 7,
                  background: d.canDrill
                    ? selected
                      ? SELECT
                      : "#fffdf8"
                    : "#f4f1ea",
                  color: d.canDrill ? (selected ? "#fff" : SELECT) : "#b8b1a2",
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: d.canDrill ? "pointer" : "not-allowed",
                  lineHeight: 1,
                  pointerEvents: "all",
                  boxShadow: "0 2px 6px rgba(74,60,30,.18)",
                  transition: "background .12s ease, color .12s ease",
                }}
              >
                <IconEnter size={12} />
                {selected ? "Open" : null}
              </button>
            ) : null}
            {d.text ? (
                                                                                    
                                                                                      
              <div
                className="nodrag nopan"
                title={plainText(d.text)}
                onClick={(e) => {
                  e.stopPropagation();
                  d.onSelect?.();
                }}
                style={{
                  maxWidth: LABEL_MAX_W,
                  whiteSpace: "normal",
                  overflowWrap: "break-word",
                  textAlign: "center",
                  lineHeight: 1.25,
                  background: "#fffdf8",
                  border: `1px solid ${selected ? SELECT : "#e7e1d4"}`,
                  padding: "2px 6px",
                  borderRadius: 6,
                  boxShadow: selected
                    ? "0 2px 6px rgba(74,60,30,.18)"
                    : "0 1px 2px rgba(74,60,30,.07)",
                  fontFamily: preset.label.family,
                  fontSize: preset.edge.labelSize,
                  fontWeight: 500,
                  color: selected ? SELECT : preset.edge.labelInk,
                  cursor: "pointer",
                  pointerEvents: "all",
                }}
              >
                <InlineMarkdown text={d.text} />
              </div>
            ) : null}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const edgeTypes = { ft: FtEdge };
