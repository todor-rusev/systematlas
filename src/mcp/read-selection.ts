                                                                                 
import { docKind, type AnyDoc } from "../core/validate-doc";
import type { FlowDocument, FlowEdge, FlowNode } from "../core/types";

export interface ReadFocus { around?: string; depth?: number }
export interface ReadSelection {
  document: AnyDoc;
  edges: { index: number; edge: FlowEdge }[];
  boundaryNodes: Pick<FlowNode, "id" | "label" | "type" | "owner">[];
  scope: {
    kind: "document" | "focus";
    around?: string;
    depth?: number;
    distance?: "undirected-flow-edges";
    includedNodes: number;
    includedEdges: number;
    totalNodes: number;
    totalEdges: number;
    omittedNodes: number;
    omittedEdges: number;
  };
}

export function selectRead(doc: AnyDoc, focus: ReadFocus = {}): ReadSelection {
  if (focus.depth !== undefined && focus.around === undefined) throw new Error("depth requires around (a local Flow node id)");
  const flow = docKind(doc) === "flow" ? doc as FlowDocument : undefined;
  if (!focus.around) {
    if (focus.around !== undefined) throw new Error("around must be a non-empty local Flow node id");
    return { document: doc, edges: flow?.edges.map((edge, index) => ({ edge, index })) ?? [], boundaryNodes: [],
      scope: { kind: "document", includedNodes: flow?.nodes.length ?? 0, includedEdges: flow?.edges.length ?? 0,
        totalNodes: flow?.nodes.length ?? 0, totalEdges: flow?.edges.length ?? 0, omittedNodes: 0, omittedEdges: 0 } };
  }
  if (!flow) throw new Error("around/depth currently supports Flow nodes only; read the complete Sequence with explicit parent/order instead");
  const depth = focus.depth ?? 1;
  if (!Number.isInteger(depth) || depth < 0 || depth > 5) throw new Error("depth must be an integer from 0 to 5");
  const byId = new Map(flow.nodes.map(node => [node.id, node]));
  if (!byId.has(focus.around)) throw new Error(`No Flow node ${JSON.stringify(focus.around)} in document ${JSON.stringify(doc.id)}`);
  const neighbors = new Map<string, Set<string>>();
  for (const edge of flow.edges) {
    for (const [from, to] of [[edge.from, edge.to], [edge.to, edge.from]]) {
      const bucket = neighbors.get(from) ?? new Set<string>();
      bucket.add(to); neighbors.set(from, bucket);
    }
  }
  const included = new Set([focus.around]);
  let frontier = [focus.around];
  for (let hop = 0; hop < depth && frontier.length; hop++) {
    const next: string[] = [];
    for (const id of frontier) for (const neighbor of neighbors.get(id) ?? []) {
      if (!included.has(neighbor) && byId.has(neighbor)) { included.add(neighbor); next.push(neighbor); }
      if (included.size > 500) throw new Error("Focus exceeds 500 nodes; request a smaller depth or a different center");
    }
    frontier = next;
  }
                                                                                      
  const edges = flow.edges.map((edge, index) => ({ edge, index })).filter(({ edge }) => included.has(edge.from) || included.has(edge.to));
  if (edges.length > 2000) throw new Error("Focus exceeds 2000 incident edges; request a narrower focus");
  const boundary = new Set(edges.flatMap(({ edge }) => [edge.from, edge.to]).filter(id => !included.has(id)));
  if (boundary.size > 1000) throw new Error("Focus exceeds 1000 boundary nodes; request a narrower focus");
  const nodes = flow.nodes.filter(node => included.has(node.id));
  const owners = new Set(nodes.map(node => node.owner).filter(Boolean));
  const boundaryNodes = flow.nodes.filter(node => boundary.has(node.id)).map(({ id, label, type, owner }) => ({ id, label, type, ...(owner ? { owner } : {}) }));
  for (const node of boundaryNodes) if (node.owner) owners.add(node.owner);
  return { document: { ...flow, nodes, edges: edges.map(row => row.edge), actors: flow.actors.filter(actor => owners.has(actor.id)) },
    edges, boundaryNodes, scope: { kind: "focus", around: focus.around, depth, distance: "undirected-flow-edges",
      includedNodes: nodes.length, includedEdges: edges.length, totalNodes: flow.nodes.length, totalEdges: flow.edges.length,
      omittedNodes: flow.nodes.length - nodes.length, omittedEdges: flow.edges.length - edges.length } };
}
