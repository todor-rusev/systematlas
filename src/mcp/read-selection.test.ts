import { test } from "node:test";
import assert from "node:assert/strict";
import { selectRead } from "./read-selection";
import { readView, readViewInput, dotReadView } from "./read-view";
import type { FlowDocument } from "../core/types";
import type { SequenceDocument } from "../core/sequence-types";
import { validateDoc } from "../core/validate-doc";

function fixture(): FlowDocument {
  return { version: "1", id: "hiring", title: "Hiring", twin: "hiring-sequence",
    actors: [{ id: "director", label: "Director", kind: "human" }, { id: "unused", label: "Other", kind: "system" }],
    nodes: ["a", "b", "c", "d", "e"].map(id => ({ id, type: id === "c" ? "subflow" : "step", label: id === "b" ? 'Review\n"quoted" \\ path' : id,
      owner: "director", description: ["Description " + id], ...(id === "c" ? { subflow: "detail" } : {}) })),
    edges: [{ from: "a", to: "b", type: "flow" }, { id: "yes", from: "b", to: "c", type: "branch", label: "yes" },
      { from: "b", to: "c", type: "branch", label: "no" }, { from: "c", to: "d", type: "flow" },
      { from: "d", to: "b", type: "return", label: "retry" }, { from: "d", to: "e", type: "flow" }] };
}

test("focus uses undirected edge distance, preserves parallel/cycle edges and labels the boundary", () => {
  const doc = fixture(), before = JSON.stringify(doc);
  const selection = selectRead(doc, { around: "b", depth: 0 });
  assert.deepEqual((selection.document as FlowDocument).nodes.map(node => node.id), ["b"]);
  assert.deepEqual(selection.edges.map(row => row.index), [0, 1, 2, 4]);
  assert.deepEqual(selection.boundaryNodes.map(node => node.id), ["a", "c", "d"]);
  assert.equal(selection.boundaryNodes[1].label, "c");
  assert.equal(selection.scope.omittedEdges, 2);
  assert.equal(selection.scope.distance, "undirected-flow-edges");
  const one = selectRead(doc, { around: "b" });
  assert.deepEqual((one.document as FlowDocument).nodes.map(node => node.id), ["a", "b", "c", "d"]);
  assert.deepEqual(one.boundaryNodes.map(node => node.id), ["e"]);
  assert.equal(one.edges.length, 6);
  assert.equal(JSON.stringify(doc), before);
  assert.deepEqual((one.document as FlowDocument).actors.map(actor => actor.id), ["director"]);
});

test("JSON and DOT focus contain the same selection, full metadata and original revision", () => {
  const doc = fixture();
  const json = readView(doc, "json", "full", { around: "b", depth: 0 });
  const data = json.structuredContent as { readOnly: boolean; nodes: { id: string }[]; edges: { index: number; label?: string }[];
    boundaryNodes: { id: string }[]; viewMetadata: { revision: string; structureComplete: boolean; scope: object } };
  assert.equal(data.readOnly, true);
  assert.deepEqual(data.nodes.map(node => node.id), ["b"]);
  assert.deepEqual(data.edges.map(edge => edge.index), [0, 1, 2, 4]);
  assert.equal(data.viewMetadata.structureComplete, false);
  const dot = dotReadView(doc, "full", selectRead(doc, { around: "b", depth: 0 }));
  assert.equal(dot.structuredContent.revision, data.viewMetadata.revision);
  assert.equal(dot.structuredContent.revision, dotReadView(doc).structuredContent.revision);
  assert.deepEqual(dot.structuredContent.scope, data.viewMetadata.scope);
  const text = readView(doc, "dot", "full", { around: "b", depth: 0 }).content[0].text;
  assert.ok(text.startsWith('digraph "hiring" {'));
  assert.equal(text.split("\n").filter(line => line.includes(' -> ')).length, 4);
  assert.ok(text.includes('"hiring/b" -> "hiring/c"'));
  assert.ok(text.includes('"label"="yes"'));
  assert.ok(text.includes('"label"="no"'));
  assert.ok(text.includes('"type"="return"'));
  assert.ok(text.includes('"object_kind"="boundary"'));
  assert.ok(text.includes('"edge_index"="4"'));
  assert.ok(text.includes(JSON.stringify(doc.nodes[1].label)));
  assert.equal(readView(doc, "dot").structuredContent, undefined);
  assert.deepEqual(JSON.parse(readView(doc).content[0].text), doc);
  const structure = readView(doc, "json", "structure", { around: "c", depth: 0 });
  assert.doesNotMatch(structure.content[0].text, /Description c/);
  assert.match(structure.content[0].text, /"subflow":"detail"/);
  assert.match(structure.content[0].text, /"omittedFields":\["description"\]/);
});

test("focus refuses invalid or oversized selections explicitly rather than claiming a complete graph", () => {
  const doc = fixture();
  assert.throws(() => selectRead(doc, { around: "missing" }), /No Flow node/);
  assert.throws(() => selectRead(doc, { depth: 1 }), /requires around/);
  for (const depth of [-1, 1.5, 6]) assert.throws(() => selectRead(doc, { around: "a", depth }), /integer/);
  assert.equal(readViewInput.format.parse("dot"), "dot");
  assert.throws(() => readViewInput.depth.parse(6));
  const big: FlowDocument = { ...doc, nodes: Array.from({ length: 502 }, (_, i) => ({ id: "n" + i, type: "step", label: "N", description: ["N"] })),
    edges: Array.from({ length: 501 }, (_, i) => ({ from: "n0", to: "n" + (i + 1), type: "flow" })) };
  assert.throws(() => selectRead(big, { around: "n0", depth: 1 }), /exceeds 500/);
  doc.nodes[1].description = ["x".repeat(130_000)];
  assert.throws(() => readView(doc, "dot", "full", { around: "b", depth: 0 }), /128 KB/);
  assert.throws(() => readView(doc, "json", "full", { around: "b", depth: 0 }), /128 KB/);
});

test("Sequence DOT preserves distinct calls, nesting, sibling order, phases, participants and async", () => {
  const doc: SequenceDocument = { version: "1", kind: "sequence", id: "s", title: "S", actors: [{ id: "first", label: "Actor", kind: "human" }],
    phases: [{ id: "legal", label: "Legal" }], calls: [
      { id: "first", to: "first", method: "Review", phase: "legal", children: [
        { id: "child", from: "first", to: "first", method: "Sign", async: true, request: "request", response: "response" }] },
      { id: "last", to: "first", method: "Review" }] };
  const text = readView(doc, "dot").content[0].text;
  assert.match(text, /"s\/@actor\/first"/);
  assert.match(text, /"s\/@phase\/legal"/);
  assert.match(text, /"s\/first" -> "s\/child" \[relation="activation", order="0"\]/);
  assert.match(text, /"s\/first" -> "s\/last" \[relation="next-sibling"\]/);
  assert.match(text, /"parent"="first", "order"="0"/);
  assert.match(text, /"parent"="null", "order"="1"/);
  assert.match(text, /"request"="request", "response"="response"/);
  assert.match(text, /"async"="true"/);
  assert.throws(() => readView(doc, "dot", "full", { around: "first" }), /Flow nodes only/);
});

test("multiple alternative entries are valid and focus preserves both incoming paths", () => {
  const doc: FlowDocument = { version: "1", id: "entries", title: "Entries", actors: [],
    nodes: ["start-a", "start-b", "done"].map(id => ({ id, type: "terminal", label: id, description: [id] })),
    edges: [{ from: "start-a", to: "done", type: "flow" }, { from: "start-b", to: "done", type: "flow" }] };
  assert.equal(validateDoc(doc, []).ok, true);
  assert.deepEqual(selectRead(doc, { around: "done", depth: 1 }).edges.map(row => row.edge.from), ["start-a", "start-b"]);
});

test("stored revision is the same in JSON, compact, DOT and focused views without entering the editable model", () => {
  const doc = fixture(), revision = "stored-revision";
  const full = readView(doc, "json", "full", {}, revision).structuredContent as { document: FlowDocument; revision: string };
  assert.deepEqual(full.document, doc);
  assert.equal(full.revision, revision);
  assert.equal("revision" in full.document, false);
  for (const format of ["compact", "dot"] as const) {
    const result = readView(doc, format, "full", { around: "b" }, revision);
    assert.ok(result.content[0].text.includes(revision));
  }
  const focused = readView(doc, "json", "full", { around: "b" }, revision).structuredContent as { viewMetadata: { revision: string } };
  assert.equal(focused.viewMetadata.revision, revision);
});
