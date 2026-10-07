import dagre from "dagre";
import { type Edge, type Node } from "@xyflow/react";
import type { ActorColors } from "./theme";
import { NEUTRAL } from "./theme";
import type {
  DrillHandler,
  FlowDocument,
  FlowEdge,
  FlowNode,
  NodeData,
  NodeType,
} from "./model";
import { nodeGeometry, type VisualMode } from "./visual-geometry";
import { hasMarkup, plainText } from "./core/markdown";
import { DEFAULT_PRESET, VISUAL_PRESETS, type PresetName } from "./visual-tokens";
import { routeReturn, clipRoute, curvedRoute, loopRoute, smoothRoute, type RouteBox } from "./edge-routing";

                                                                               
                                                                                
export function edgeKey(e: FlowEdge, i: number): string {
  return e.id ?? `e${i}`;
}

                                                                               
                                                       
export const DIMS: Record<NodeType, { w: number; h: number }> = {
  terminal: { w: 130, h: 44 },
  step: { w: 200, h: 58 },
  decision: { w: 130, h: 130 },
  subflow: { w: 210, h: 66 },
  io: { w: 200, h: 58 },
};

                                                                             
                                                                                
                                                                                 
                                                                                 
                                                                              
                                                                                
                                                                            
const DECISION_MIN_FONT = 8;                                                   
const DECISION_CHAR_W = 0.62;                                                    
const DECISION_LINE_H = 1.25;

                                                                                   
                                                                                     
                                                                               
const CLASSIC_CHAR_W = 7.2;                                                              
const CLASSIC_INNER_W: Record<NodeType, number> = { terminal: 98, step: 176, decision: Infinity, subflow: 142, io: 160 };
export function fitsClassicBox(n: Pick<FlowNode, "type" | "text">): boolean {
  if (hasMarkup(n.text) || n.text.includes("\n")) return false;
  const width = CLASSIC_INNER_W[n.type];
  return n.text.length * CLASSIC_CHAR_W <= 2 * width && Math.max(...n.text.split(/\s+/).map((w) => w.length * CLASSIC_CHAR_W)) <= width;
}

                                                                     
export function decisionSize(label: string): number {
  const f = DECISION_MIN_FONT;
  const longest = label
    .trim()
    .split(/\s+/)
    .reduce((m, w) => Math.max(m, w.length), 0);
                                                                                   
  const byWord = longest * f * DECISION_CHAR_W;
  const byArea = Math.sqrt(
    label.length * (f * DECISION_CHAR_W) * (f * DECISION_LINE_H) * 1.4,
  );
  const inscribed = Math.max(byWord, byArea);
  const s = Math.ceil(inscribed * 2);                                 
  return Math.max(DIMS.decision.w, Math.min(240, s));
}

                                                                                     
function nodeDims(n: Node): { w: number; h: number } {
  const geometry = (n.data as NodeData).geometry;
  if (geometry) return geometry;
  if (n.type === "decision") {
    const s = (n.data as NodeData).decisionSize ?? DIMS.decision.w;
    return { w: s, h: s };
  }
  return DIMS[n.type as NodeType];
}

                                                                             
                                                                            
                                                                                
                                                                              
                                                                               
                                                                              
                                                                               
export const LABEL_MAX_W = 200;                                           
                                                                                         
                                                                                 
const WIDE_TURN = 120;
const LABEL_CHAR_W = 6.2;                                           
const LABEL_LINE_H = 15;                       
const LABEL_PAD_X = 12;                        
const LABEL_PAD_Y = 4;                        

                                                                           
export function labelBox(label: string): { width: number; height: number } {
  const textW = plainText(label).length * LABEL_CHAR_W;
  const innerW = LABEL_MAX_W - LABEL_PAD_X;
  const lines = Math.max(1, Math.ceil(textW / innerW));
  return {
    width: Math.min(LABEL_MAX_W, Math.ceil(textW) + LABEL_PAD_X),
    height: lines * LABEL_LINE_H + LABEL_PAD_Y,
  };
}

                                                                                 
export interface DrillOptions {
                                                                                 
  flowsSet?: Set<string>;
                                                             
  onDrill?: DrillHandler;
  visualMode?: VisualMode;
  visualPreset?: PresetName;
  measureText?: (text: string) => number;
                                                                                              
  lines?: LineStyle;
}

                                                                                 
                                                                              
export const FLOW_SPACING = { default: 50, min: 40, max: 130 } as const;

export type FlowDirection = "TB" | "LR";
export type LineStyle = "rounded" | "curved";

                                                                          
                                                                       
export function buildGraph(
  doc: FlowDocument,
  colors: ActorColors,
  drill?: DrillOptions,
  gap: number = FLOW_SPACING.default,
  direction: FlowDirection = doc.layout ?? "TB",
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = doc.nodes.map((n) => {
    const data: NodeData = {
      text: n.text,
      color: n.owner ? (colors[n.owner] ?? NEUTRAL) : NEUTRAL,
      owner: n.owner,
      shared: n.shared,
      visualMode: drill?.visualMode ?? "actors",
      visualPreset: drill?.visualPreset,
      shape: n.shape,
      icon: n.icon,
    };
    if (data.visualMode !== "classic" || n.shape || n.icon || !fitsClassicBox(n))
      data.geometry = nodeGeometry(n, drill?.measureText, drill?.visualPreset);
    if (n.type === "decision") data.decisionSize = decisionSize(plainText(n.text));
                                                                                        
    const subTarget = n.type === "subflow" ? n.subflow : undefined;
    const target = subTarget ?? n.sequence;
    if (target) {
      data.drillTarget = target;
      data.drillKind = subTarget ? "flow" : "sequence";
      data.canDrill = drill?.flowsSet ? drill.flowsSet.has(target) : false;
      data.onDrill = drill?.onDrill;
    }
    const dim = data.geometry;
    const fallback =
      n.type === "decision"
        ? { w: data.decisionSize!, h: data.decisionSize! }
        : DIMS[n.type];
    return {
      id: n.id,
      type: dim ? "visual" : n.type,
      position: { x: 0, y: 0 },
      data,
      ...(dim
        ? { width: dim.w, height: dim.h }
        : { measured: { width: fallback.w, height: fallback.h } }),
    };
  });

  const edges: Edge[] = doc.edges.map((e, i) => {
                                                                                   
                                                                                 
                                        
    const target = e.subflow ?? e.sequence;
    return {
      id: edgeKey(e, i),
      source: e.from,
      target: e.to,
      type: "ft",
      data: {
        edgeType: e.type,
        visualPreset: drill?.visualPreset,
        text: e.text,
        style: e.style,
        drillTarget: target,
        drillKind: e.subflow
          ? ("flow" as const)
          : e.sequence
            ? ("sequence" as const)
            : undefined,
        canDrill: target ? (drill?.flowsSet?.has(target) ?? false) : false,
        onDrill: drill?.onDrill,
      },
    };
  });

  return layout(nodes, edges, direction, gap, drill?.lines ?? "rounded");
}

function layout(
  nodes: Node[],
  edges: Edge[],
  dir: FlowDirection,
  gap: number,
  lines: LineStyle,
): { nodes: Node[]; edges: Edge[] } {
                                                                             
                                                                                 
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setDefaultEdgeLabel(() => ({}));
                                                                                     
  g.setGraph({
    rankdir: dir,
    nodesep: Math.round(gap * 0.7),
    ranksep: gap,
    marginx: 24,
    marginy: 24,
  });

  nodes.forEach((n) => {
    const dim = nodeDims(n);
    g.setNode(n.id, { width: dim.w, height: dim.h });
  });
                                                                                   
                               
                                                                                  
                               
  edges.forEach((e) => {
    const label = (e.data as { text?: string } | undefined)?.text;
                                                                                 
                                                                               
    const lbl = label ? { ...labelBox(label), labelpos: "c" as const } : {};
    g.setEdge(e.source, e.target, lbl, e.id);
  });

  dagre.layout(g);

  const positioned = nodes.map((n) => {
    const dim = nodeDims(n);
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - dim.w / 2, y: p.y - dim.h / 2 } };
  });

                                                                                  
                                                                                   
                                                                                
                                                                                
                                                                                    
                                                                                      
                                                                                
                                                                                    
                                                                                        
  const sideOf = (
    p: { x: number; y: number },
    n: { x: number; y: number; width: number; height: number },
  ): string => {
    const dl = Math.abs(p.x - (n.x - n.width / 2));
    const dr = Math.abs(p.x - (n.x + n.width / 2));
    const dt = Math.abs(p.y - (n.y - n.height / 2));
    const db = Math.abs(p.y - (n.y + n.height / 2));
    const m = Math.min(dl, dr, dt, db);
    return m === dt ? "top" : m === db ? "bottom" : m === dl ? "left" : "right";
  };

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const boxes = nodes.map(n => { const p = g.node(n.id), dim = nodeDims(n); return { x: p.x - dim.w / 2, y: p.y - dim.h / 2, w: dim.w, h: dim.h }; });
  const returnLanes = new Map(edges.filter(e => e.data?.edgeType === "return").map((e, index) => [e.id, index]));
  const returnLabels = edges.filter(e => e.data?.edgeType === "return").map(e => labelBox((e.data?.text as string | undefined) ?? ""));
  const laneWidth = Math.max(0, ...returnLabels.map(size => size.width));
  const laneHeight = Math.max(0, ...returnLabels.map(size => size.height));
  const outerRight = Math.max(...nodes.map(n => g.node(n.id).x + nodeDims(n).w / 2));
  const outerBottom = Math.max(...nodes.map(n => g.node(n.id).y + nodeDims(n).h / 2));
                                                                                 
  const routed = edges.map((e) => {
    const ge = g.edge(e.source, e.target, e.id) as
      | { points?: { x: number; y: number }[]; x?: number; y?: number }
      | undefined;
    let points = ge?.points;
    const sc = g.node(e.source) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    const tc = g.node(e.target) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    let returnLabel: { x: number; y: number } | undefined;
    let returnReach: number | undefined;
    if (returnLanes.has(e.id)) {
                                                                              
                                                                                    
      const lane = returnLanes.get(e.id)!;
      const outerLane = dir === "TB" ? outerRight + 32 + laneWidth / 2 + lane * (laneWidth + 24) : outerBottom + 32 + laneHeight / 2 + lane * (laneHeight + 24);
      const routedReturn = routeReturn(boxes,
        { x: sc.x - sc.width / 2, y: sc.y - sc.height / 2, w: sc.width, h: sc.height },
        { x: tc.x - tc.width / 2, y: tc.y - tc.height / 2, w: tc.width, h: tc.height }, dir, outerLane);
      points = routedReturn.points;
      returnLabel = routedReturn.label;
      returnReach = routedReturn.reach;
    }
    if (!points || points.length < 2) return e;
    const sourceHandle = `s-${sideOf(points[0], sc)}`;
    const targetHandle = `t-${sideOf(points[points.length - 1], tc)}`;
    const labelXY = returnLabel ?? (
      ge && typeof ge.x === "number"
        ? { x: ge.x, y: ge.y as number }
        : undefined);
                                                                                     
                                                                                    
                                                                                   
                                               
    const tn = nodeById.get(e.target);
    const td = tn ? nodeDims(tn) : undefined;
    const targetBox = td
      ? {
          x: tc.x - td.w / 2,
          y: tc.y - td.h / 2,
          w: td.w,
          h: td.h,
          outline: (tn?.data as NodeData)?.geometry?.outline,
          anchor: (tn?.data as NodeData)?.geometry?.anchor,
        }
      : undefined;
    const sn = nodeById.get(e.source);
    const sd = sn ? nodeDims(sn) : undefined;
    const sourceBox = sd
      ? {
          x: sc.x - sd.w / 2,
          y: sc.y - sd.h / 2,
          w: sd.w,
          h: sd.h,
          outline: (sn?.data as NodeData)?.geometry?.outline,
          anchor: (sn?.data as NodeData)?.geometry?.anchor,
        }
      : undefined;
    return {
      ...e,
      sourceHandle,
      targetHandle,
      data: { ...e.data, points, labelXY, returnReach, sourceBox, targetBox },
    };
  });

                                                                              
  const clipped = routed.map(e => clipRoute(e.data!.points as { x: number; y: number }[], e.data!.sourceBox as RouteBox, e.data!.targetBox as RouteBox,
    ["circle", "cross"].includes((e.data!.style as { start?: string } | undefined)?.start ?? "") ? 6 : 2));
  const labels = routed.flatMap(e => {
    const p = e.data?.labelXY as { x: number; y: number } | undefined;
    if (!p || !e.data?.text) return [];
    const size = labelBox(e.data.text as string);
    return [{ edgeId: e.id, x: p.x - size.width / 2, y: p.y - size.height / 2, w: size.width, h: size.height }];
  });
  const boxOf = new Map(nodes.map((n, i) => [n.id, boxes[i]]));
  return { nodes: positioned, edges: routed.map((e, i) => {
    const others = clipped.filter((_, j) => i !== j);
    const otherLabels = labels.filter(label => label.edgeId !== e.id);
    const shaft = VISUAL_PRESETS[(e.data?.visualPreset as PresetName | undefined) ?? DEFAULT_PRESET].edge.headSize + 3;
    if (lines === "curved") {
                                                                                      
                                                                                        
                                                                                          
                                                     
      const own = new Set([boxOf.get(e.source), boxOf.get(e.target)]);
      const obstacles = [...boxes.filter(box => !own.has(box)), ...otherLabels];
                                                                                             
                                                                                             
      const reach = e.data?.returnReach as number | undefined;
      const at = e.data?.labelXY as { x: number; y: number } | undefined;
      if (reach !== undefined && at) {
        const route = clipped[i], axis = dir === "TB" ? "x" : "y";
        const loop = loopRoute(route, reach, axis === "x" ? at.y : at.x, axis, obstacles, others, shaft);
        const size = e.data?.text ? labelBox(e.data.text as string) : { width: 0, height: 0 };
        const box = { x: loop.label.x - size.width / 2, y: loop.label.y - size.height / 2, w: size.width, h: size.height };
        const overlaps = (r: { x: number; y: number; w: number; h: number }) =>
          box.x < r.x + r.w && r.x < box.x + box.w && box.y < r.y + r.h && r.y < box.y + box.h;
        if (loop.clear && !boxes.some(overlaps) && !otherLabels.some(overlaps))
          return { ...e, data: { ...e.data, path: loop.path, labelXY: loop.label } };
      }
      const curve = curvedRoute(clipped[i], obstacles, others, shaft);
      if (curve.clear) return { ...e, data: { ...e.data, path: curve.path } };
      return { ...e, data: { ...e.data, path: smoothRoute(clipped[i], [...boxes, ...otherLabels], others, WIDE_TURN, shaft) } };
    }
    return { ...e, data: { ...e.data, path: smoothRoute(clipped[i], [...boxes, ...otherLabels], others, 36, shaft) } };
  }) };
}
