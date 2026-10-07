import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPatch } from "./patch";
import type { FlowDocument, FlowNode } from "./types";
import type { SequenceDocument } from "./sequence-types";

const flow = (): FlowDocument => ({
  version: "2",
  id: "f",
  title: "F",
  actors: [],
  nodes: [{ id: "a", type: "step", text: "A", details: "x" }],
  edges: [],
});

test("set-field on a node (the common 'add one field' case)", () => {
  const out = applyPatch(flow(), [{ op: "set-field", target: "node", id: "a", field: "text", value: "A2" }]) as FlowDocument;
  assert.equal(out.nodes[0].text, "A2");
});

test("set-field on the doc", () => {
  const out = applyPatch(flow(), [{ op: "set-field", target: "doc", field: "title", value: "New" }]) as FlowDocument;
  assert.equal(out.title, "New");
});

test("upsert-node adds then replaces by id; remove-node removes", () => {
  let out = applyPatch(flow(), [{ op: "upsert-node", node: { id: "b", type: "terminal", text: "B", details: "b" } }]) as FlowDocument;
  assert.equal(out.nodes.length, 2);
  out = applyPatch(out, [{ op: "upsert-node", node: { id: "b", type: "terminal", text: "B2", details: "b" } }]) as FlowDocument;
  assert.equal(out.nodes.length, 2);
  assert.equal(out.nodes.find((n) => n.id === "b")?.text, "B2");
  out = applyPatch(out, [{ op: "remove-node", id: "b" }]) as FlowDocument;
  assert.equal(out.nodes.length, 1);
});

test("upsert-edge / remove-edge by id", () => {
  let out = applyPatch(flow(), [{ op: "upsert-edge", edge: { id: "e1", from: "a", to: "a", type: "flow" } }]) as FlowDocument;
  assert.equal(out.edges.length, 1);
  out = applyPatch(out, [{ op: "remove-edge", id: "e1" }]) as FlowDocument;
  assert.equal(out.edges.length, 0);
});

                                                                                        
const chain = (): FlowDocument => ({
  ...flow(),
  nodes: [
    ...["a", "b", "c"].map((id): FlowNode => ({ id, type: "step", text: id.toUpperCase(), details: "x" })),
    { id: "d", type: "decision", text: "D?", details: "x" },
  ],
  edges: [
    { from: "a", to: "b", type: "flow" },
    { from: "b", to: "c", type: "flow" },
    { from: "d", to: "a", type: "branch", text: "yes" },
    { from: "d", to: "a", type: "branch", text: "retry" },
  ],
});

test("an edge without an id is removed by its ends — inserting a step between two", () => {
  const out = applyPatch(chain(), [
    { op: "upsert-node", node: { id: "x", type: "step", text: "X", details: "x" } },
    { op: "remove-edge", edge: { from: "a", to: "b" } },
    { op: "upsert-edge", edge: { from: "a", to: "x", type: "flow" } },
    { op: "upsert-edge", edge: { from: "x", to: "b", type: "flow" } },
  ]) as FlowDocument;
  const ends = out.edges.map((e) => `${e.from}>${e.to}`);
  assert.ok(!ends.includes("a>b"));
  assert.ok(ends.includes("a>x") && ends.includes("x>b") && ends.includes("b>c"));
});

test("an edge without an id is changed by its ends; type or text picks one of several", () => {
  let out = applyPatch(chain(), [{ op: "set-field", target: "edge", edge: { from: "b", to: "c" }, field: "text", value: "next" }]) as FlowDocument;
  assert.equal(out.edges.find((e) => e.from === "b")?.text, "next");
  out = applyPatch(chain(), [{ op: "remove-edge", edge: { from: "d", to: "a", text: "retry" } }]) as FlowDocument;
  assert.deepEqual(out.edges.filter((e) => e.from === "d").map((e) => e.text), ["yes"]);
});

test("an ambiguous or missing edge is an error that names the candidates", () => {
  assert.throws(() => applyPatch(chain(), [{ op: "remove-edge", edge: { from: "d", to: "a" } }]), /2 edges d -> a.*"yes".*"retry"/);
  assert.throws(() => applyPatch(chain(), [{ op: "remove-edge", edge: { from: "a", to: "c" } }]), /no edge a -> c; edges from a: a -> b/);
  assert.throws(() => applyPatch(chain(), [{ op: "remove-edge", id: "nope" }]), /edge "nope" not found \(edges without an id are addressed by edge/);
  assert.throws(() => applyPatch(chain(), [{ op: "remove-edge" }]), /give the edge's id, or edge/);
});

test("removing something that does not exist is an error, not a silent no-op", () => {
  assert.throws(() => applyPatch(flow(), [{ op: "remove-node", id: "nope" }]), /node "nope" not found/);
  assert.throws(() => applyPatch(seq(), [{ op: "remove-call", id: "nope" }]), /call "nope" not found/);
});

test("set-field unknown node throws (caught by the tool → reported)", () => {
  assert.throws(() => applyPatch(flow(), [{ op: "set-field", target: "node", id: "nope", field: "label", value: "x" }]));
});

test("does not mutate the input document", () => {
  const original = flow();
  applyPatch(original, [{ op: "set-field", target: "node", id: "a", field: "label", value: "Z" }]);
  assert.equal(original.nodes[0].text, "A");
});

const seq = (): SequenceDocument => ({
  version: "1",
  kind: "sequence",
  id: "s",
  title: "S",
  actors: [{ id: "api", label: "API", kind: "service" }],
  calls: [{ id: "c", to: "api", method: "m", children: [] }],
});

test("upsert-call nests under a parent; remove-call finds it in the tree", () => {
  let out = applyPatch(seq(), [{ op: "upsert-call", call: { id: "c2", to: "api", method: "m2" }, parent: "c" }]) as SequenceDocument;
  assert.equal(out.calls[0].children?.length, 1);
  assert.equal(out.calls[0].children?.[0].id, "c2");
  out = applyPatch(out, [{ op: "remove-call", id: "c2" }]) as SequenceDocument;
  assert.equal(out.calls[0].children?.length, 0);
});
