                                                                                   
                                                                                    
                                              
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectSplits, type SplitCandidate } from "./split";
import type { Actor, FlowDocument, FlowNode } from "./types";

const DIRECTOR: Actor = { id: "dir", label: "Director", kind: "human" };
const HR: Actor = { id: "hr", label: "HR", kind: "human" };

const step = (id: string, label: string, extra: Partial<FlowNode> = {}): FlowNode => ({
  id,
  type: "step",
  text: label,
  owner: "dir",
  details: label,
  ...extra,
});
                                                                     
function process(id: string, node: FlowNode, actors: Actor[] = [DIRECTOR, HR]): FlowDocument {
  return {
    version: "2",
    id,
    title: id,
    actors,
    nodes: [
      { id: "start", type: "terminal", text: "Start", details: "entry" },
      { id: "collect", type: "step", text: "Collect documents", owner: "hr", details: "collects" },
      node,
      { id: "done", type: "terminal", text: "Done", details: "exit" },
    ],
    edges: [
      { from: "start", to: "collect", type: "flow" },
      { from: "collect", to: node.id, type: "flow" },
      { from: node.id, to: "done", type: "flow" },
    ],
  };
}
                                                                                           
function between(a: FlowNode, b: FlowNode, actorsA?: Actor[], actorsB?: Actor[]): SplitCandidate | undefined {
  return detectSplits(process("hiring", a, actorsA), [process("promotion", b, actorsB)]).find((c) => c.a.id === a.id);
}

                                                                                    

test("the same step in two processes is a similar candidate, and linking it is admissible", () => {
  const c = between(step("approve", "Approve by director"), step("prom.approve", "Approve by director"));
  assert.equal(c?.evidence, "similar");
  assert.equal(c?.admissible, true);
  assert.match(c!.suggestion, /shared: true/);
  assert.doesNotMatch(c!.suggestion, /code|source/);                           
});

test("the message shows the existing step well enough to judge without opening its flow", () => {
  const c = between(step("approve", "Approve by director"), step("prom.approve", "Approve by director", { details: "The director signs the request off." }));
  assert.match(c!.message, /"prom\.approve" \(flow promotion\) is "Approve by director", by Director, after "Collect documents", before "Done"; "The director signs the request off\."/);
});

test("a reworded or renamed step is still found", () => {
  assert.equal(between(step("a", "Approve request"), step("b", "Approve requests"))?.evidence, "similar");
  assert.equal(between(step("a", "Approve by director"), step("b", "Approve by finance director"))?.evidence, "similar");
  assert.equal(between(step("a", "Одобрение от директор"), step("b", "Одобрение от финансов директор"))?.evidence, "similar");
});

                                                                                               
function inOtherContexts(a: FlowNode, b: FlowNode): SplitCandidate | undefined {
  const other = process("promotion", b);
  other.nodes = other.nodes.map((n) => (n.id === "collect" ? { ...n, label: "Collect evaluation" } : n));
  return detectSplits(process("hiring", a), [other]).find((c) => c.a.id === a.id);
}

test("a similar label by the same participant is found in another context", () => {
  assert.equal(inOtherContexts(step("approve", "Approve by director"), step("prom.approve", "Approve by finance director"))?.evidence, "similar");
  assert.equal(inOtherContexts(step("approve", "Approve by director"), step("other-id", "Approve by director"))?.evidence, "similar");
});

test("one changed word is not a similar label, however alike the letters", () => {
  assert.equal(inOtherContexts(step("a", "Approve request"), step("b", "Archive request")), undefined);
  assert.equal(inOtherContexts(step("a", "Send offer letter"), step("b", "Send rejection letter")), undefined);
});

test("a renamed participant still counts, though less than the same name", () => {
  const renamed: Actor = { id: "dir", label: "Finance director", kind: "human" };
  const c = between(step("a", "Approve request"), step("b", "Approve request"), [DIRECTOR, HR], [renamed, HR]);
  assert.equal(c?.evidence, "similar");
  assert.ok(c!.signals.some((s) => s.includes("different participant names")));
});

test("a participant renamed everywhere does not hide the shared context", () => {
                                                                          
  const finance: Actor = { id: "fin", label: "Finance", kind: "human" };
  const department: Actor = { id: "fin", label: "Finance department", kind: "human" };
  const doc = (id: string, actor: Actor, stepId: string): FlowDocument => {
    const d = process(id, step(stepId, "Approve request", { owner: "fin" }), [actor]);
    d.nodes = d.nodes.map((n) => (n.type === "terminal" ? n : { ...n, owner: "fin" }));
    return d;
  };
  const c = detectSplits(doc("hiring", finance, "a"), [doc("promotion", department, "b")]).find((x) => x.a.id === "a");
  assert.equal(c?.evidence, "similar");
  assert.equal(c?.admissible, true);
});

test("the same participant under another local id is found, but linking needs the owner aligned first", () => {
  const boss: Actor = { id: "boss", label: "Director", kind: "human" };
  const c = between(step("a", "Approve request"), step("b", "Approve request", { owner: "boss" }), [DIRECTOR, HR], [boss, HR]);
  assert.equal(c?.evidence, "similar");
  assert.equal(c?.admissible, false);
  assert.match(c!.suggestion, /same owner/);
});

test("a different node type is not a candidate: a step and a decision play different roles", () => {
  assert.equal(between(step("a", "Approve request"), step("b", "Approve request", { type: "decision" })), undefined);
});

test("different actions in a non-Latin script are not a match", () => {
  assert.equal(between(step("save", "Запази"), step("delete", "Изтрий")), undefined);
});

test("labels with no letters or digits are no evidence", () => {
  assert.equal(between(step("a", "—"), step("b", "...")), undefined);
});

test("unrelated steps are not candidates", () => {
  assert.equal(between(step("a", "Approve request"), step("b", "Archive the file", { owner: "hr" })), undefined);
});

test("terminals are never compared", () => {
  const found = detectSplits(process("hiring", step("a", "Approve")), [process("promotion", step("b", "Archive"))]);
  assert.ok(!found.some((c) => c.a.id === "start" || c.a.id === "done"));
});

test("nodes inside one flow are never compared (repeated occurrences)", () => {
  const doc = process("checkout", step("log1", "Log error"));
  doc.nodes.push(step("log2", "Log error"));
  assert.deepEqual(detectSplits(doc, []), []);
});

test("an id already shared on both sides is linked, not a candidate", () => {
  assert.equal(between(step("approve", "Approve", { shared: true }), step("approve", "Approve", { shared: true })), undefined);
});

                                                                                    

                                                                                      
const templates = (n: number) => Array.from({ length: n }, (_, i) => process(`p${i}`, step(`review-${i}`, "Review")));

test("a node gets at most three candidates, however many look alike", () => {
  const found = detectSplits(process("hiring", step("review", "Review")), templates(300)).filter((c) => c.a.id === "review");
  assert.equal(found.length, 3);
});

test("a step with rare words outranks template look-alikes", () => {
  const target = process("hiring", step("review", "Review"));
  target.nodes.push(step("vendor", "Audit vendor insurance certificate"));
  const special = process("procurement", step("vendor2", "Audit vendor insurance certificate"));
  const found = detectSplits(target, [...templates(300), special]);
  assert.equal(found[0].b.id, "vendor2");
});

                                                                                    

const ref = (symbol: string, file = "payment.ts", line?: number) => ({ file, symbol, ...(line ? { line } : {}) });

test("the same definition with an admissible link is a same-definition warning, whatever the wording", () => {
  assert.equal(between(step("a", "Charge card", { source: ref("Payment.charge") }), step("b", "Take the payment", { source: ref("Payment.charge") }))?.evidence, "same-definition");
  assert.equal(between(step("a", "Плати", { source: ref("Payment.charge", "payment.ts", 10) }), step("b", "Таксувай", { source: ref("Payment.charge", "payment.ts", 20) }))?.evidence, "same-definition");
});

test("the same definition without an admissible link falls back to similarity", () => {
  const boss: Actor = { id: "boss", label: "Director", kind: "human" };
  const c = between(step("a", "Check policy", { source: ref("Policy.check") }), step("b", "Check policy", { owner: "boss", source: ref("Policy.check") }), [DIRECTOR, HR], [boss, HR]);
  assert.equal(c?.evidence, "similar");
  assert.equal(c?.admissible, false);
});

test("the same definition under a different node type is not a candidate", () => {
  assert.equal(between(step("a", "Check policy", { source: ref("Policy.check") }), step("b", "Check policy", { type: "decision", source: ref("Policy.check") })), undefined);
});

test("different sources do not rule a look-alike out; they are shown as evidence", () => {
  const c = between(step("a", "Save", { source: ref("Order.save") }), step("b", "Save", { source: ref("Audit.save") }));
  assert.equal(c?.evidence, "similar");
  assert.ok(c!.signals.some((s) => s.startsWith("different sources")));
});

test("a symbol naming a class still asks the author to check the role", () => {
  const c = between(step("debit", "Debit", { source: ref("PaymentService") }), step("credit", "Credit", { source: ref("PaymentService") }));
  assert.equal(c?.evidence, "same-definition");
  assert.match(c!.suggestion, /class/);
});

test("same-definition candidates come before similar ones", () => {
  const target = process("hiring", step("c", "Charge", { source: ref("Payment.charge") }));
  target.nodes.push(step("v", "Validate request"));
  const other = process("promotion", step("c2", "Pay", { source: ref("Payment.charge") }));
  other.nodes.push(step("v2", "Validate request"));
  const evidence = detectSplits(target, [other]).filter((x) => x.a.id !== "collect").map((x) => x.evidence);
  assert.deepEqual(evidence, ["same-definition", "similar"]);
});
