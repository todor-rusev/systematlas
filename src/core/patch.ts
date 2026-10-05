import type { AnyDoc } from "./validate-doc";
import { docKind } from "./validate-doc";
import type { FlowDocument } from "./types";
import type { SequenceCall, SequenceDocument } from "./sequence-types";

                                                                                  
                                                                                 
                                                                               
                                                                         
  
                                                                                  
                                                                                    
                                                                                 
                                 

                                                                               
export interface EdgeSelector {
  from: string;
  to: string;
  type?: string;
  label?: string;
}

export type PatchOp =
  | { op: "set-field"; target: "doc" | "node" | "call"; id?: string; field: string; value: unknown }
  | { op: "set-field"; target: "edge"; id?: string; edge?: EdgeSelector; field: string; value: unknown }
  | { op: "upsert-node"; node: Record<string, unknown> }
  | { op: "remove-node"; id: string }
  | { op: "upsert-edge"; edge: Record<string, unknown> }
  | { op: "remove-edge"; id?: string; edge?: EdgeSelector }
  | { op: "upsert-call"; call: Record<string, unknown>; parent?: string }
  | { op: "remove-call"; id: string };

type AnyObj = Record<string, unknown>;
type FlowEdge = FlowDocument["edges"][number];

const describeEdge = (e: FlowEdge) => `${e.from} -> ${e.to} (${e.type}${e.label ? `, "${e.label}"` : ""}${e.id ? `, id ${e.id}` : ""})`;

                                                                                                 
function edgeIndex(edges: FlowEdge[], op: string, id: string | undefined, sel: EdgeSelector | undefined): number {
  if (id != null) {
    const i = edges.findIndex((e) => e.id === id);
    if (i < 0) throw new Error(`${op}: edge "${id}" not found${edges.some((e) => !e.id) ? " (edges without an id are addressed by edge: {from, to})" : ""}`);
    return i;
  }
  if (!sel?.from || !sel?.to) throw new Error(`${op}: give the edge's id, or edge: {from, to, type?, label?}`);
  const hits = edges
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.from === sel.from && e.to === sel.to && (sel.type == null || e.type === sel.type) && (sel.label == null || e.label === sel.label));
  if (hits.length === 1) return hits[0].i;
  if (hits.length === 0) {
    const from = edges.filter((e) => e.from === sel.from);
    throw new Error(`${op}: no edge ${sel.from} -> ${sel.to}${from.length ? `; edges from ${sel.from}: ${from.map(describeEdge).join("; ")}` : ""}`);
  }
  throw new Error(`${op}: ${hits.length} edges ${sel.from} -> ${sel.to} — add type or label: ${hits.map(({ e }) => describeEdge(e)).join("; ")}`);
}

function findCall(calls: SequenceCall[], id: string): SequenceCall | null {
  for (const c of calls) {
    if (c.id === id) return c;
    if (c.children?.length) {
      const hit = findCall(c.children, id);
      if (hit) return hit;
    }
  }
  return null;
}
function removeCall(calls: SequenceCall[], id: string): boolean {
  const i = calls.findIndex((c) => c.id === id);
  if (i >= 0) {
    calls.splice(i, 1);
    return true;
  }
  for (const c of calls) if (c.children?.length && removeCall(c.children, id)) return true;
  return false;
}

                                                                                   
export function applyPatch(doc: AnyDoc, ops: PatchOp[]): AnyDoc {
  const d = structuredClone(doc) as AnyDoc;
  const kind = docKind(d);
  const flow = () => d as unknown as FlowDocument;
  const seq = () => d as unknown as SequenceDocument;

  for (const op of ops) {
    switch (op.op) {
      case "set-field": {
        if (op.target === "doc") {
          (d as unknown as AnyObj)[op.field] = op.value;
        } else if (op.target === "node") {
          const n = flow().nodes.find((x) => x.id === op.id);
          if (!n) throw new Error(`set-field: node "${op.id}" not found`);
          (n as unknown as AnyObj)[op.field] = op.value;
        } else if (op.target === "edge") {
          const edges = flow().edges;
          const e = edges[edgeIndex(edges, "set-field", op.id, op.edge)];
          (e as unknown as AnyObj)[op.field] = op.value;
        } else {
          const c = findCall(seq().calls, op.id ?? "");
          if (!c) throw new Error(`set-field: call "${op.id}" not found`);
          (c as unknown as AnyObj)[op.field] = op.value;
        }
        break;
      }
      case "upsert-node": {
        const nodes = flow().nodes as unknown as AnyObj[];
        const id = op.node.id;
        const i = nodes.findIndex((n) => n.id === id);
        if (i >= 0) nodes[i] = op.node;
        else nodes.push(op.node);
        break;
      }
      case "remove-node": {
        const f = flow();
        if (!f.nodes.some((n) => n.id === op.id)) throw new Error(`remove-node: node "${op.id}" not found`);
        f.nodes = f.nodes.filter((n) => n.id !== op.id);
        break;
      }
      case "upsert-edge": {
        const edges = flow().edges as unknown as AnyObj[];
        const id = op.edge.id;
        const i = id != null ? edges.findIndex((e) => e.id === id) : -1;
        if (i >= 0) edges[i] = op.edge;
        else edges.push(op.edge);
        break;
      }
      case "remove-edge": {
        const edges = flow().edges;
        edges.splice(edgeIndex(edges, "remove-edge", op.id, op.edge), 1);
        break;
      }
      case "upsert-call": {
        const s = seq();
        const existing = findCall(s.calls, String(op.call.id));
        if (existing) {
          Object.assign(existing, op.call);
        } else if (op.parent) {
          const parent = findCall(s.calls, op.parent);
          if (!parent) throw new Error(`upsert-call: parent "${op.parent}" not found`);
          (parent.children ??= []).push(op.call as unknown as SequenceCall);
        } else {
          s.calls.push(op.call as unknown as SequenceCall);
        }
        break;
      }
      case "remove-call": {
        if (!removeCall(seq().calls, op.id)) throw new Error(`remove-call: call "${op.id}" not found`);
        break;
      }
      default: {
        throw new Error(`unknown op "${(op as { op: string }).op}"`);
      }
    }
    void kind;
  }
  return d;
}
