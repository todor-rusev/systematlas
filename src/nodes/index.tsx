import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { DIMS } from "../layout";
import type { NodeData } from "../model";
import { IconEnter } from "../shell/icons";
import { NodeIcon } from "./NodeIcon";
import { InlineMarkdown } from "../shell/Markdown";
import { plainText } from "../core/markdown";
import { nodeGeometry } from "../visual-geometry";
import { drillStroke, FLOW_LABEL } from "../theme";
import { actorTone, detailInk, DEFAULT_PRESET, VISUAL_PRESETS } from "../visual-tokens";

                                                                             
                                                                             

                                                                           
                                                                              
                                                                               
                                                                                
const handleStyle: CSSProperties = {
  width: 7,
  height: 7,
  background: "transparent",
  border: "none",
  opacity: 0,
};

const SIDES: { pos: Position; key: string }[] = [
  { pos: Position.Top, key: "top" },
  { pos: Position.Right, key: "right" },
  { pos: Position.Bottom, key: "bottom" },
  { pos: Position.Left, key: "left" },
];

const TEXT = "#2A2722";
const CLASSIC_FILL = "#FFFFFF";
                                                                                         
                                                                             
const NODE_SHADOW = {
  normal: { dy: 4, blur: 10, color: "rgba(74,60,30,.18)" },
  selected: { dy: 8, blur: 22, color: "rgba(74,60,30,.20)" },
};
function nodeShadow(selected: boolean, svg = false): string {
  const { dy, blur, color } = NODE_SHADOW[selected ? "selected" : "normal"];
  return svg
    ? `drop-shadow(0 ${dy}px ${blur / 2}px ${color})`
    : `0 ${dy}px ${blur}px ${color}`;
}
                                                                          
                                                                            
const SEL_TRANSITION = "transform .13s ease, box-shadow .13s ease";
const lift = (selected: boolean): CSSProperties => ({
  transform: selected ? "scale(1.045)" : "scale(1)",
  transformOrigin: "center",
  transition: SEL_TRANSITION,
});

function Handles() {
  return (
    <>
      {SIDES.flatMap((s) => [
        <Handle
          key={`t-${s.key}`}
          id={`t-${s.key}`}
          type="target"
          position={s.pos}
          style={handleStyle}
        />,
        <Handle
          key={`s-${s.key}`}
          id={`s-${s.key}`}
          type="source"
          position={s.pos}
          style={handleStyle}
        />,
      ])}
    </>
  );
}

                                                                                 
                                                                                
                                                                                  
                                                                                  
                                                                                  
                                    
  
                                                                                  
                                                                                
                                                                         
function FitLabel({
  text,
  max = 13,
  min = 8.5,
  weight = 600,
  color = TEXT,
  fixedHeight = false,
}: {
  text: string;
  max?: number;
  min?: number;
  weight?: number;
  color?: string;
  fixedHeight?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fs, setFs] = useState(max);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let size = max;
    el.style.fontSize = `${size}px`;
    const fits = () =>
      el.scrollWidth <= el.clientWidth + 0.5 &&
      (!fixedHeight || el.scrollHeight <= el.clientHeight + 0.5);
    while (size > min && !fits()) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
    }
    setFs(size);
  }, [text, max, min, fixedHeight]);
  return (
    <div
      ref={ref}
      style={{
        width: "100%",
        height: fixedHeight ? "100%" : "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        overflow: "hidden",
        overflowWrap: "normal",                                                
        wordBreak: "normal",
        hyphens: "none",
        lineHeight: 1.22,
        fontSize: fs,
        fontWeight: weight,
        color,
      }}
    >
      {text}
    </div>
  );
}

                                                                                    
                                                                               
                                                                                   
function DrillBadge({
  id,
  d,
  pos,
  compact,
  inline,
  accent,
  ink,
}: {
  id: string;
  d: NodeData;
  pos?: CSSProperties;
  compact?: boolean;
  inline?: boolean;
  accent?: string;
  ink?: string;
}) {
  if (!d.drillTarget) return null;
  const canDrill = d.canDrill === true;
  const color = accent ?? d.color;
  const noun = d.drillKind === "sequence" ? "sequence" : "sub-flow";
  const open = (e: MouseEvent) => {
    e.stopPropagation();
    if (canDrill && d.drillTarget)
      d.onDrill?.(d.drillTarget, { kind: "node", id });
  };
  return (
    <button
      className={inline ? "nodrag ft-node-open" : "nodrag"}
      aria-label={`Open ${d.drillKind ?? "flow"}: ${d.drillTarget}`}
      onClick={open}
      disabled={!canDrill}
      title={
        canDrill
          ? `Open ${noun}: ${d.drillTarget}`
          : `${noun} '${d.drillTarget}' not found in workspace`
      }
      style={{
        position: inline ? "static" : "absolute",
        top: inline ? undefined : 6,
        right: inline ? undefined : 6,
        ...pos,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        flex: inline ? "0 0 auto" : undefined,
        whiteSpace: "nowrap",
        padding: compact ? 0 : "2px 6px 2px 5px",
        width: compact ? 24 : undefined,
        height: compact ? 24 : undefined,
        border: `1px solid ${canDrill ? (ink ?? `${color}66`) : "#e0d9cc"}`,
        borderRadius: compact ? 7 : 6,
        background: canDrill ? (ink ?? `${color}14`) : "#f4f1ea",
        color: canDrill ? (ink ? "#FFFFFF" : color) : "#9c9487",
        fontSize: 10.5,
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: canDrill ? "pointer" : "not-allowed",
        lineHeight: 1,
      }}
    >
      <IconEnter size={compact ? 13 : 12} />
      {compact ? null : "Open"}
    </button>
  );
}

export function TerminalNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  return (
    <div
      style={{
        width: DIMS.terminal.w,
        height: DIMS.terminal.h,
        background: CLASSIC_FILL,
        border: "1px solid #d8d1c2",
        borderRadius: 999,
        padding: "4px 16px",
        boxSizing: "border-box",
        boxShadow: nodeShadow(selected),
        ...lift(selected),
      }}
    >
      <Handles />
      <FitLabel
        text={d.text}
        max={13}
        min={9}
        weight={700}
        color="#4a463d"
        fixedHeight
      />
    </div>
  );
}

export function StepNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData;
                                                                              
                                                                               
                                                                              
  const drillable = !!d.drillTarget;
  const border = drillable
    ? { border: `2px solid ${d.color}` }
    : { border: "1px solid #e8e2d6", borderLeft: `4px solid ${d.color}` };
  const halo = drillable ? `0 0 0 3px ${d.color}22, ` : "";
  return (
    <div
      style={{
        width: DIMS.step.w,
        minHeight: DIMS.step.h,
        background: CLASSIC_FILL,
        ...border,
        borderRadius: 10,
        boxShadow: `${halo}${nodeShadow(selected)}`,
        ...lift(selected),
        padding: "9px 12px",
        boxSizing: "border-box",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <Handles />
      <DrillBadge id={id} d={d} />
      <div style={{ paddingRight: d.drillTarget ? 44 : 0 }}>
        <FitLabel text={d.text} max={13} min={9} />
      </div>
    </div>
  );
}

export function SubflowNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData;
  return (
    <div
      style={{
        width: DIMS.subflow.w,
        minHeight: DIMS.subflow.h,
        background: CLASSIC_FILL,
        border: `2px solid ${d.color}`,
        borderRadius: 10,
        boxShadow: `0 0 0 3px ${d.color}22, ${nodeShadow(selected)}`,
        ...lift(selected),
        padding: "9px 12px 9px 12px",
        boxSizing: "border-box",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <Handles />
      {                                                                          }
      <DrillBadge id={id} d={d} />
      <div style={{ paddingRight: 44 }}>
        <FitLabel text={d.text} max={13} min={9} />
      </div>
    </div>
  );
}

export function DecisionNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData;
                                                                                
                                                                            
  const s = d.decisionSize ?? DIMS.decision.w;
  const diamondInset = Math.round(s * 0.138);                                       
  const labelInset = Math.round(s / 4);                                             
                                                                                
                                                      
  const drillable = !!d.drillTarget;
  const diamondBorder = drillable
    ? {
        borderTop: `2.5px solid ${d.color}`,
        borderRight: `2.5px solid ${d.color}`,
        borderBottom: `2.5px solid ${d.color}`,
        borderLeft: `2.5px solid ${d.color}`,
      }
    : {
        borderTop: "1.5px solid #e8e2d6",
        borderRight: "1.5px solid #e8e2d6",
        borderBottom: `4px solid ${d.color}`,
        borderLeft: `4px solid ${d.color}`,
      };
  const halo = drillable ? `0 0 0 3px ${d.color}22, ` : "";
  return (
    <div
      style={{ width: s, height: s, position: "relative", ...lift(selected) }}
    >
      <Handles />
      <div
        style={{
          position: "absolute",
          inset: diamondInset,
          transform: "rotate(45deg)",
          background: CLASSIC_FILL,
                                                                                    
                                                                          
          ...diamondBorder,
          borderRadius: 8,
          boxShadow: `${halo}${nodeShadow(selected)}`,
        }}
      />
      {                                                                           
                                                                                    
                                                                }
      <div style={{ position: "absolute", inset: labelInset }}>
        <FitLabel text={d.text} max={12.5} min={8} weight={600} fixedHeight />
      </div>
      {                                                                             
                                                                                  }
      <DrillBadge id={id} d={d} compact pos={{ top: 4, right: 4 }} />
    </div>
  );
}

export function IoNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  return (
    <div
      style={{
        width: DIMS.io.w,
        height: DIMS.io.h,
        position: "relative",
        ...lift(selected),
      }}
    >
      <Handles />
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: "skewX(-12deg)",
          background: CLASSIC_FILL,
          border: "1px solid #e8e2d6",
          borderLeft: `4px solid ${d.color}`,
          borderRadius: 6,
          boxShadow: nodeShadow(selected),
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "6px 20px",
          boxSizing: "border-box",
        }}
      >
        <FitLabel text={d.text} max={13} min={9} weight={600} fixedHeight />
      </div>
    </div>
  );
}

export const nodeTypes = {
  terminal: TerminalNode,
  step: StepNode,
  decision: DecisionNode,
  subflow: SubflowNode,
  io: IoNode,
  visual: VisualNode,
};

                                                                                   
export function VisualNode({ id, data, selected }: NodeProps) {
  const decorationClip = useId();
  const d = data as NodeData;
  const g =
    d.geometry ??
    nodeGeometry({
      type: "step",
      text: d.text,
      shape: d.shape,
      icon: d.icon,
      subflow: d.drillKind === "flow" ? d.drillTarget : undefined,
      sequence: d.drillKind === "sequence" ? d.drillTarget : undefined,
    });
  const filled = d.visualMode !== "classic" && !!d.owner;
  const modern = d.visualMode !== "classic";
  const preset = VISUAL_PRESETS[d.visualPreset ?? DEFAULT_PRESET];
  const tone = d.owner ? actorTone(d.color, preset) : preset.terminal;
  const detail = modern ? detailInk(tone) : d.color;
  const drillable = !!d.drillTarget;
  const accent = modern ? tone.outline : drillStroke(d.color);
  const fill = filled
    ? tone.fill
    : d.visualMode === "classic"
      ? CLASSIC_FILL
      : preset.terminal.fill;
  const c = g.content;
  const symbol = g.captionOutside;
  const icon =
    d.icon && !["icon", "image"].includes(g.shape) ? (
      <span style={{ display: "grid", placeItems: "center", color: modern ? tone.ink : TEXT, padding: modern && preset.node.iconChip ? 5 : 0, borderRadius: "50%", background: modern && preset.node.iconChip ? "#ffffff" : undefined }}>
        <NodeIcon icon={d.icon} size={modern ? preset.node.iconSize : 28} strokeWidth={modern ? preset.node.iconStroke : 1.7} />
      </span>
    ) : null;
  const drill = <DrillBadge id={id} d={d} inline accent={accent} ink={modern ? tone.ink : undefined} />;
  return (
    <div
      className="ft-visual-node"
      data-shape={g.shape}
      data-owner={d.owner}
      data-mode={d.visualMode}
      data-drill={drillable || undefined}
      data-selected={selected || undefined}
      title={d.owner ? `${plainText(d.text)} · ${d.owner}` : plainText(d.text)}
      style={{
        width: g.w,
        height: g.h,
        position: "relative",
        ...lift(selected),
      }}
    >
      <Handles />
      <svg
        width={g.w}
        height={g.h}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          overflow: "visible",
          transition: "filter .13s ease",
          filter: nodeShadow(selected, true),
        }}
      >
        <defs>
          <clipPath id={decorationClip} clipPathUnits="userSpaceOnUse">
            <path d={g.path} />
          </clipPath>
        </defs>
        {selected && modern ? (
          <path d={g.path} fill="none" stroke="#FFFFFF" strokeWidth={8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        ) : null}
        <path
          d={g.path}
          fill={symbol && modern && g.shape !== "sm-circ" ? tone.ink : fill}
          fillOpacity={g.shape === "text" && !drillable ? 0 : 1}
          stroke={
            selected && modern ? "#2D2A24" : drillable
              ? accent
              : modern
                ? symbol ? tone.ink : g.shape === "text" ? "none" : tone.outline
              : filled
                ? "rgba(42,39,34,.10)"
                : d.owner
                  ? d.color
                  : "#e1dbcf"
          }
          strokeWidth={modern ? selected ? 2.5 : drillable ? preset.node.drillOutlineWidth : symbol ? 1.25 : preset.node.outlineWidth : drillable ? 2 : 0.8}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <g clipPath={`url(#${decorationClip})`}>
          {g.decorations.map((path, i) => (
            <path
              key={i}
              d={path}
              fill={symbol ? modern ? tone.ink : d.color : "none"}
              stroke={detail}
              strokeWidth={g.shape === "fr-circ" ? 3 : 1.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      </svg>
      <div
        className="ft-caption-slot"
        style={{
          position: "absolute",
          left: c.x,
          top: c.y,
          width: c.w,
          height: c.h,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="ft-node-caption"
          style={{
            width: "100%",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: g.stacked ? "column" : "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: g.symbol ? 0 : "6px 9px",
            color: modern ? tone.ink : TEXT,
            background: (drillable && symbol) || g.shape === "cross-circ" ? fill : undefined,
            borderRadius: drillable && symbol ? 4 : undefined,
            boxShadow:
              drillable && symbol
                ? `0 0 0 2px ${accent}`
                : undefined,
          }}
        >
          {g.stacked && (icon || drillable) ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {icon}
              {drill}
            </div>
          ) : (
            icon
          )}
          <span
            className="ft-node-label"
            dir="auto"
            style={{
              fontFamily: modern ? preset.label.family : FLOW_LABEL.family,
              fontSize: modern ? preset.label.size : FLOW_LABEL.size,
              fontWeight: modern ? preset.label.weight : FLOW_LABEL.weight,
              lineHeight: `${modern ? preset.label.lineHeight : FLOW_LABEL.lineHeight}px`,
              textAlign: "center",
              flex: "1 1 auto",
              minWidth: 0,
              overflowWrap: "anywhere",
              whiteSpace: "pre-line",
            }}
          >
            <InlineMarkdown text={d.text} />
          </span>
          {!g.stacked ? drill : null}
        </div>
      </div>
      {g.symbol ? (
        <div
          style={{
            position: "absolute",
            top: g.symbol.y,
            left: g.symbol.x,
            color: modern ? tone.ink : TEXT,
          }}
        >
          <NodeIcon
            icon={d.icon ?? { kind: "builtin", name: "file" }}
            size={g.symbol.w}
            strokeWidth={modern ? preset.node.iconStroke : 1.7}
          />
        </div>
      ) : null}
    </div>
  );
}
