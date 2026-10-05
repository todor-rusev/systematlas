import { test } from "node:test";
import assert from "node:assert/strict";
import { validateFlow } from "./validate";
import type { FlowDocument } from "./types";

function doc(over: Partial<FlowDocument> = {}): FlowDocument {
  return {
    version: "1",
    id: "t",
    title: "T",
    actors: [{ id: "api", label: "API", kind: "service" }],
    nodes: [{ id: "a", type: "step", label: "A", description: ["does A"], owner: "api" }],
    edges: [],
    ...over,
  };
}

const codes = (r: { errors: { code: string }[]; warnings: { code: string }[] }) => ({
  errors: r.errors.map((e) => e.code),
  warnings: r.warnings.map((w) => w.code),
});

test("valid document passes with no issues", () => {
                                                            
  const r = validateFlow(
    doc({
      nodes: [
        { id: "start", type: "terminal", label: "Start", description: ["entry"] },
        { id: "a", type: "step", label: "A", description: ["does A"], owner: "api" },
        { id: "done", type: "terminal", label: "Done", description: ["exit"] },
      ],
      edges: [
        { from: "start", to: "a", type: "flow" },
        { from: "a", to: "done", type: "flow" },
      ],
    }),
  );
  assert.equal(r.ok, true);
  assert.equal(r.errors.length, 0);
  assert.equal(r.warnings.length, 0);
});

test("node.sequence to a missing document is advised (dangling-sequence)", () => {
  const r = validateFlow(
    doc({
      nodes: [{ id: "a", type: "step", label: "A", description: ["x"], owner: "api", sequence: "no-such-seq" }],
    }),
  );
  assert.equal(r.ok, true);            
  assert.ok(codes(r).warnings.includes("dangling-sequence"));
});

test("flow without Start/Done terminals is advised (warning, not error)", () => {
  const r = validateFlow(doc());                             
  assert.equal(r.ok, true);
  assert.ok(codes(r).warnings.includes("no-start-terminal"));
  assert.ok(codes(r).warnings.includes("no-done-terminal"));
});

test("actors declared but nodes have no owner is advised (nodes-without-owner)", () => {
                                                                           
  const r = validateFlow(
    doc({
      actors: [
        { id: "api", label: "API", kind: "service" },
        { id: "db", label: "DB", kind: "infra" },
      ],
      nodes: [
        { id: "start", type: "terminal", label: "Start", description: ["entry"] },
        { id: "a", type: "step", label: "A", description: ["does A"] },            
        { id: "done", type: "terminal", label: "Done", description: ["exit"] },
      ],
      edges: [
        { from: "start", to: "a", type: "flow" },
        { from: "a", to: "done", type: "flow" },
      ],
    }),
  );
  assert.equal(r.ok, true);                          
  assert.ok(codes(r).warnings.includes("nodes-without-owner"));
});

test("terminals without owner do NOT trigger nodes-without-owner", () => {
                                                                             
  const r = validateFlow(
    doc({
      nodes: [
        { id: "start", type: "terminal", label: "Start", description: ["entry"] },
        { id: "a", type: "step", label: "A", description: ["does A"], owner: "api" },
        { id: "done", type: "terminal", label: "Done", description: ["exit"] },
      ],
      edges: [
        { from: "start", to: "a", type: "flow" },
        { from: "a", to: "done", type: "flow" },
      ],
    }),
  );
  assert.ok(!codes(r).warnings.includes("nodes-without-owner"));
});

test("schema violation — unknown node type", () => {
  const bad = doc({ nodes: [{ id: "a", type: "frobnicate" as never, label: "A", description: ["x"] }] });
  const r = validateFlow(bad);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.code.startsWith("schema/")));
});

test("schema violation — missing description", () => {
  const bad = doc({ nodes: [{ id: "a", type: "step", label: "A", owner: "api" } as never] });
  const r = validateFlow(bad);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.code.startsWith("schema/")));
});

test("dangling owner reference", () => {
  const r = validateFlow(doc({ nodes: [{ id: "a", type: "step", label: "A", description: ["x"], owner: "ghost" }] }));
  assert.equal(r.ok, false);
  assert.ok(codes(r).errors.includes("dangling-owner"));
});

test("dangling edge endpoint", () => {
  const r = validateFlow(doc({ edges: [{ from: "a", to: "missing", type: "flow" }] }));
  assert.equal(r.ok, false);
  assert.ok(codes(r).errors.includes("dangling-edge"));
});

test("duplicate node id", () => {
  const r = validateFlow(
    doc({
      nodes: [
        { id: "a", type: "step", label: "A", description: ["x"], owner: "api" },
        { id: "a", type: "step", label: "A2", description: ["y"], owner: "api" },
      ],
    }),
  );
  assert.equal(r.ok, false);
  assert.ok(codes(r).errors.includes("dup-node-id"));
});

test("merge — shared id with conflicting owner across flows", () => {
  const target = doc({
    id: "txn",
    actors: [{ id: "payment", label: "Payment", kind: "system" }],
    nodes: [{ id: "charge", type: "step", label: "Charge", description: ["charges"], owner: "payment", shared: true }],
  });
  const other = doc({
    id: "shipping",
    actors: [{ id: "db", label: "DB", kind: "infra" }],
    nodes: [{ id: "charge", type: "step", label: "Charge", description: ["charges"], owner: "db", shared: true }],
  });
  const r = validateFlow(target, { others: [other] });
  assert.equal(r.ok, false);
  assert.ok(codes(r).errors.includes("shared-conflict"));
});

test("merge — a conflict between two OTHER flows does not block an unrelated document", () => {
  const pay = (id: string, owner: string) =>
    doc({
      id,
      actors: [{ id: owner, label: owner, kind: "system" }],
      nodes: [{ id: "pay", type: "step", label: "Pay", description: ["pays"], owner, shared: true }],
    });
  const online = pay("pay-online", "api");
  const inStore = pay("pay-in-store", "store");
  const unrelated = validateFlow(doc({ id: "greeting" }), { others: [online, inStore] });
  assert.ok(!codes(unrelated).errors.includes("shared-conflict"));
                                                                  
  const involved = validateFlow(online, { others: [inStore] });
  assert.equal(involved.ok, false);
  assert.ok(codes(involved).errors.includes("shared-conflict"));
});

test("merge — an id shared here but local in another flow is a one-sided link (warning)", () => {
  const approve = (id: string, shared: boolean) =>
    doc({ id, nodes: [{ id: "approve", type: "step", label: "Approve", description: ["x"], owner: "api", ...(shared ? { shared } : {}) }] });
  const r = validateFlow(approve("promotion", true), { others: [approve("hiring", false)] });
  assert.equal(r.ok, true);
  assert.ok(codes(r).warnings.includes("shared-one-sided"));
  assert.ok(!r.hints.some((h) => h.code === "similar-node"));                               
  const both = validateFlow(approve("promotion", true), { others: [approve("hiring", true)] });
  assert.ok(!codes(both).warnings.includes("shared-one-sided"));
});

test("merge — a shared id with a different label across flows is a divergence (warning)", () => {
  const auth = (id: string, label: string) =>
    doc({ id, nodes: [{ id: "auth", type: "step", label, description: ["x"], owner: "api", shared: true }] });
  const r = validateFlow(auth("login", "Authenticate user"), { others: [auth("checkout", "Charge credit card")] });
  assert.equal(r.ok, true);
  assert.ok(codes(r).warnings.includes("shared-divergence"));
                                                                        
  const same = validateFlow(auth("login", "Authenticate user"), { others: [auth("checkout", "authenticate user.")] });
  assert.ok(!codes(same).warnings.includes("shared-divergence"));
});

test("merge — a shared id with a different source definition is a divergence (warning)", () => {
  const charge = (id: string, symbol: string) =>
    doc({
      id,
      nodes: [{ id: "charge", type: "step", label: "Charge", description: ["x"], owner: "api", shared: true, source: { file: "pay.ts", symbol } }],
    });
  const r = validateFlow(charge("a", "Pay.debit"), { others: [charge("b", "Pay.credit")] });
  assert.equal(r.ok, true);
  assert.ok(codes(r).warnings.includes("shared-divergence"));
});

test("split — the same source definition is a warning (possible-split)", () => {
  const charge = (id: string, nodeId: string) =>
    doc({
      id,
      nodes: [{ id: nodeId, type: "step", label: "Charge", description: ["x"], owner: "api", source: { file: "pay.ts", symbol: "Pay.charge" } }],
    });
  const r = validateFlow(charge("checkout", "charge"), { others: [charge("renewal", "renew.charge")] });
  assert.equal(r.ok, true);                                  
  assert.ok(codes(r).warnings.includes("possible-split"));
});

test("split — a label match alone is a hint, not a warning", () => {
  const target = doc({
    id: "txn",
    nodes: [{ id: "txn.validate", type: "step", label: "Validate request", description: ["validates"], owner: "api" }],
  });
  const other = doc({
    id: "refund",
    nodes: [{ id: "rfnd.validate", type: "step", label: "Validate request", description: ["validates"], owner: "api" }],
  });
  const r = validateFlow(target, { others: [other] });
  assert.equal(r.ok, true);
  assert.ok(!codes(r).warnings.includes("possible-split"));
  assert.deepEqual(
    r.hints.map((h) => [h.code, h.severity]),
    [["similar-node", "hint"]],
  );
});

test("split signals stay bounded in a large workspace, with a count of the rest", () => {
  const review = (id: string, i: number) =>
    doc({ id, nodes: Array.from({ length: 20 }, (_, k) => ({ id: `r${i}-${k}`, type: "step" as const, label: `Review part ${k}`, description: ["x"], owner: "api" })) });
  const others = Array.from({ length: 200 }, (_, i) => review(`p${i}`, i));
  const r = validateFlow(review("target", 999), { others });
  const split = r.hints.filter((h) => h.code === "similar-node");
  assert.equal(split.length, 10);
  assert.match(r.hints.find((h) => h.code === "more-similar-nodes")!.message, /^50 more look-alike pairs not shown/);
});

test("unrelated nodes are NOT flagged as splits (high precision)", () => {
  const target = doc({
    id: "txn",
    actors: [
      { id: "api", label: "API", kind: "service" },
      { id: "db", label: "DB", kind: "infra" },
    ],
    nodes: [{ id: "txn.insert", type: "step", label: "Insert transaction", description: ["persists"], owner: "db" }],
  });
  const other = doc({
    id: "refund",
    nodes: [{ id: "rfnd.validate", type: "step", label: "Validate request", description: ["validates"], owner: "api" }],
  });
  const r = validateFlow(target, { others: [other] });
  assert.ok(!codes(r).warnings.includes("possible-split"));
});

test("edge with content is valid; edge.subflow dangling is advisory", () => {
  const r = validateFlow(
    doc({
      nodes: [
        { id: "a", type: "step", label: "A", description: ["does A"], owner: "api" },
        { id: "b", type: "step", label: "B", description: ["does B"], owner: "api" },
      ],
      edges: [
        { id: "a-b", from: "a", to: "b", type: "flow", description: ["a → b"], inputs: [{ name: "x" }], subflow: "no-such-flow" },
      ],
    }),
  );
  assert.equal(r.ok, true);                    
  assert.ok(codes(r).warnings.includes("dangling-subflow"));
});

test("edge id colliding with a node id is an error (shared object namespace)", () => {
  const r = validateFlow(
    doc({
      nodes: [
        { id: "a", type: "step", label: "A", description: ["x"], owner: "api" },
        { id: "b", type: "step", label: "B", description: ["y"], owner: "api" },
      ],
      edges: [{ id: "a", from: "a", to: "b", type: "flow" }],
    }),
  );
  assert.equal(r.ok, false);
  assert.ok(codes(r).errors.includes("dup-object-id"));
});

test("shared edge inconsistent across flows is a merge conflict", () => {
  const target = doc({
    id: "txn",
    nodes: [
      { id: "a", type: "step", label: "A", description: ["x"], owner: "api" },
      { id: "b", type: "step", label: "B", description: ["y"], owner: "api" },
    ],
    edges: [{ id: "go", from: "a", to: "b", type: "flow", shared: true }],
  });
  const other = doc({
    id: "txn2",
    nodes: [
      { id: "a", type: "step", label: "A", description: ["x"], owner: "api" },
      { id: "b", type: "step", label: "B", description: ["y"], owner: "api" },
    ],
    edges: [{ id: "go", from: "a", to: "b", type: "branch", label: "yes", shared: true }],
  });
  const r = validateFlow(target, { others: [other] });
  assert.equal(r.ok, false);
  assert.ok(codes(r).errors.includes("shared-conflict"));
});
