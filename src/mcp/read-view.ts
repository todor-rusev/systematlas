                                                                            
import { createHash } from "node:crypto";
import { z } from "zod";
import { docKind, type AnyDoc } from "../core/validate-doc";
import type { FlowDocument } from "../core/types";
import type { SequenceCall, SequenceDocument } from "../core/sequence-types";
import { selectRead, type ReadFocus, type ReadSelection } from "./read-selection";

export const readViewInput = {
  format: z.enum(["json", "compact", "dot"]).optional().describe("Default json returns {document,revision}; only document is editable. compact/dot are read-only views with real ids. With around, every format is a partial read-only view; patch by local ids, never write a view as a document."),
  detail: z.enum(["full", "structure"]).optional().describe("View detail: full (default) includes descriptions; structure explicitly omits explanatory fields. Ignored for whole-document JSON. Use full when identical labels need disambiguation."),
  around: z.string().min(1).optional().describe("Focus on this LOCAL Flow node id, with incident edges and labeled boundary nodes. Does not open drill targets. Sequence focus is not supported."),
  depth: z.number().int().min(0).max(5).optional().describe("Requires around. Default 1. Distance counts Flow edges in both directions; 0 selects only the center plus incident edges/boundary references."),
};

                                                                                           
                                                                            
const structural = new Set(["version", "kind", "title", "method", "layout", "twin", "type", "owner", "shared", "subflow", "sequence", "id", "label", "from", "to", "phase", "async", "shape", "style"]);
const q = (value: unknown) => JSON.stringify(value);

export function readView(doc: AnyDoc, format: "json" | "compact" | "dot" = "json", detail: "full" | "structure" = "full", focus: ReadFocus = {}, storedRevision?: string): { content: { type: "text"; text: string }[]; structuredContent?: Record<string, unknown> } {
  const selection = selectRead(doc, focus);
  if (format === "json" && selection.scope.kind === "document") {
    const data = storedRevision === undefined ? doc : { document: doc, revision: storedRevision };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data as unknown as Record<string, unknown> };
  }
  const view = format === "dot" ? dotReadView(doc, detail, selection, storedRevision) : compactReadView(doc, detail, selection, storedRevision);
  if (format === "json") {
    const fields = fieldFilter(detail);
    const flow = selection.document as FlowDocument;
    const data = { readOnly: true, viewMetadata: { ...view.structuredContent, format: "json" },
      document: fields.pick(flow, ["actors", "nodes", "edges"]), actors: flow.actors.map(actor => fields.pick(actor)),
      nodes: flow.nodes.map(node => fields.pick(node)), edges: selection.edges.map(({ index, edge }) => ({ index, ...fields.pick(edge) })),
      boundaryNodes: selection.boundaryNodes };
    const text = JSON.stringify(data);
    const response = { content: [{ type: "text" as const, text }], structuredContent: data };
    assertFocusSize(response);
    return response;
  }
                                                                                 
                                                                                 
                                                                             
  const text = format === "dot" ? view.content[0].text : `${view.content[0].text}\nviewMetadata=${JSON.stringify(view.structuredContent)}`;
  const response = { content: [{ type: "text" as const, text }] };
  if (selection.scope.kind === "focus") assertFocusSize(response);
  return response;
}

function assertFocusSize(response: object) {
  if (Buffer.byteLength(JSON.stringify(response), "utf8") > 128_000) throw new Error("Focus response exceeds 128 KB; use structure detail or a smaller focus");
}

function fieldFilter(detail: "full" | "structure") {
  const omitted = new Set<string>();
  const pick = (object: object, excluded: string[] = []) => {
    const values = Object.entries(object).filter(([name]) => !excluded.includes(name)).filter(([name]) => {
      if (detail === "full" || structural.has(name)) return true;
      omitted.add(name); return false;
    });
    return Object.fromEntries(values);
  };
  return { pick, omitted };
}

export function compactReadView(original: AnyDoc, detail: "full" | "structure" = "full", selection = selectRead(original), storedRevision?: string) {
  const doc = selection.document;
  const fields = fieldFilter(detail);
  const metadata = (object: object, excluded: string[]) => {
    const values = fields.pick(object, excluded);
    return Object.keys(values).length ? ` ${q(values)}` : "";
  };
  const lines = [
    `READ-ONLY compact view; document=${q(doc.id)}; detail=${detail}. Actual ids are edit targets; labels are not.`,
    "Arrows are typed control flow. Drill subflow/sequence means part-of; twin means the same whole scenario at another altitude.",
    `document ${q(doc.id)} ${q(doc.title)}${metadata(doc, ["id", "title", "actors", "nodes", "edges", "calls", "phases"])}`,
  ];
  for (const actor of doc.actors) lines.push(`actor ${q(actor.id)} ${q(actor.label)}${metadata(actor, ["id", "label"])}`);
  if (docKind(doc) === "flow") {
    const flow = doc as FlowDocument;
    for (const node of flow.nodes) lines.push(`node ${q(node.id)} ${q(node.label)}${metadata(node, ["id", "label"])}`);
    for (const node of selection.boundaryNodes) lines.push(`boundary ${q(node.id)} ${q(node.label)}${q({ type: node.type, owner: node.owner })}`);
    selection.edges.forEach(({ edge, index }) => lines.push(`edge[${index}] ${q(edge.from)} -> ${q(edge.to)}${metadata(edge, ["from", "to"])}`));
    lines.push("Note: edge[index] is a position in this read, not an edge id. Preserve parallel edges; use actual ids or an unambiguous supported selector when patching.");
  } else {
    const sequence = doc as SequenceDocument;
    for (const phase of sequence.phases ?? []) lines.push(`phase ${q(phase.id)} ${q(phase.label)}`);
    const walk = (calls: SequenceCall[], parent: string | null) => {
      calls.forEach((call, order) => {
        lines.push(`call ${q(call.id)} parent=${q(parent)} order=${order} ${q(call.from ?? null)} -> ${q(call.to)} ${q(call.method)}${metadata(call, ["id", "from", "to", "method", "children"])}`);
        if (call.children) walk(call.children, call.id);
      });
    };
    walk(sequence.calls, null);
    lines.push("Call parent/order preserves activation nesting and sibling chronology; null from means implicit caller, not an actor id.");
  }
  const omittedFields = [...fields.omitted].sort();
  if (selection.scope.kind === "focus") lines.push(`scope=${q(selection.scope)}. Boundary nodes are references, not fully read nodes. Drill targets are not opened.`);
  lines.push(`omittedFields=${q(omittedFields)}. Read format=json for a whole-document write; this view is not accepted as a model.`);
  return { content: [{ type: "text" as const, text: lines.join("\n") }], structuredContent: {
    id: doc.id, kind: docKind(doc), format: "compact", detail, structureComplete: selection.scope.kind === "document", contentComplete: selection.scope.kind === "document" && omittedFields.length === 0,
    revision: storedRevision ?? createHash("sha256").update(JSON.stringify(original)).digest("hex"), omittedFields, scope: selection.scope,
  } };
}

                                                                               
                                                                                    
export function dotReadView(original: AnyDoc, detail: "full" | "structure" = "full", selection: ReadSelection = selectRead(original), storedRevision?: string) {
  const doc = selection.document;
  const fields = fieldFilter(detail);
  const attrs = (object: object) => Object.entries(object).filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${q(key)}=${q(typeof value === "string" ? value : JSON.stringify(value))}`).join(", ");
  const address = (id: string) => `${doc.id}/${id}`;
  const lines = [`digraph ${q(doc.id)} {`,
    `  graph [${attrs({ ...fields.pick(doc, ["actors", "nodes", "edges", "calls", "phases"]), object_kind: "document", read_only: true })}];`];
  for (const actor of doc.actors) lines.push(`  ${q(`${doc.id}/@actor/${actor.id}`)} [${attrs({ ...fields.pick(actor), object_kind: "actor" })}];`);
  if (docKind(doc) === "flow") {
    const flow = doc as FlowDocument;
    for (const node of flow.nodes) lines.push(`  ${q(address(node.id))} [${attrs({ ...fields.pick(node), object_kind: "node" })}];`);
    for (const node of selection.boundaryNodes) lines.push(`  ${q(address(node.id))} [${attrs({ ...node, object_kind: "boundary", boundary: true })}];`);
    for (const { edge, index } of selection.edges) lines.push(`  ${q(address(edge.from))} -> ${q(address(edge.to))} [${attrs({ ...fields.pick(edge, ["from", "to"]), object_kind: "edge", edge_index: index })}];`);
  } else {
    const sequence = doc as SequenceDocument;
    for (const phase of sequence.phases ?? []) lines.push(`  ${q(`${doc.id}/@phase/${phase.id}`)} [${attrs({ ...phase, object_kind: "phase" })}];`);
    const walk = (calls: SequenceCall[], parent: string | null) => {
      calls.forEach((call, order) => {
        lines.push(`  ${q(address(call.id))} [${attrs({ ...fields.pick(call, ["children"]), label: call.method, object_kind: "call", parent, order })}];`);
        if (parent) lines.push(`  ${q(address(parent))} -> ${q(address(call.id))} [relation="activation", order="${order}"];`);
        if (order) lines.push(`  ${q(address(calls[order - 1].id))} -> ${q(address(call.id))} [relation="next-sibling"];`);
        if (call.children) walk(call.children, call.id);
      });
    };
    walk(sequence.calls, null);
  }
  const omittedFields = [...fields.omitted].sort();
  const metadata = { id: original.id, kind: docKind(original), format: "dot", detail, readOnly: true,
    revision: storedRevision ?? createHash("sha256").update(JSON.stringify(original)).digest("hex"), scope: selection.scope, omittedFields,
    structureComplete: selection.scope.kind === "document", contentComplete: selection.scope.kind === "document" && !omittedFields.length };
  lines.push(`  graph [viewMetadata=${q(JSON.stringify(metadata))}];`,
    '  // Qualified node names are addresses; patch with local ids. edge_index is not an id.',
    '  // Flow type marks control flow; subflow/sequence are unopened drill targets, twin is whole-to-whole.',
    '  // Sequence activation and next-sibling preserve nesting/order; they are not Flow transitions.',
    "}");
  return { content: [{ type: "text" as const, text: lines.join("\n") }], structuredContent: metadata };
}
