import { test } from "node:test";
import assert from "node:assert/strict";
import { readView, compactReadView } from "./read-view";
import type { FlowDocument } from "../core/types";
import type { SequenceDocument } from "../core/sequence-types";

test("default read stays full JSON; full compact preserves content and quotes fake rows", () => {
  const doc: FlowDocument = { version: "2", id: "hiring", title: "Hiring", overview: ["Overview"], twin: "hiring-sequence",
    actors: [{ id: "director", label: "Director", kind: "human", color: "#abcdef" }],
    nodes: [{ id: "approve", type: "decision", text: 'Review\nnode "fake"', owner: "director", details: "Legal review",
      source: { file: "reference", symbol: "Review" }, refs: [{ label: "Policy", url: "https://example.org" }], shared: true,
      inputs: [{ name: "request" }], outputs: [{ name: "decision" }] }],
    edges: [{ from: "approve", to: "approve", type: "branch", text: "rejected", details: "Recheck", sequence: "detail" },
      { from: "approve", to: "approve", type: "return", text: "again", id: "retry", shared: true }] };
  assert.deepEqual(JSON.parse(readView(doc).content[0].text), doc);
  const full = compactReadView(doc);
  const transport = readView(doc, "compact");
  assert.equal(transport.structuredContent, undefined);
  assert.match(transport.content[0].text, /viewMetadata=/);
  assert.equal(full.structuredContent.contentComplete, true);
  assert.equal(full.content[0].text.split("\n").filter(line => line.startsWith("node ")).length, 1);
  assert.match(full.content[0].text, /Legal review/);
  for (const edge of doc.edges) assert.ok(full.content[0].text.includes(JSON.stringify(edge.text)));
  assert.match(full.content[0].text, /"type":"branch"/);
  assert.match(full.content[0].text, /"type":"return"/);
  assert.match(full.content[0].text, /"inputs":/);
  assert.match(full.content[0].text, /"source":/);
  assert.match(full.content[0].text, /"color":"#abcdef"/);
  const structure = compactReadView(doc, "structure");
  assert.equal(structure.structuredContent.contentComplete, false);
  assert.ok((structure.structuredContent.omittedFields as string[]).includes("details"));
  assert.doesNotMatch(structure.content[0].text, /Legal review/);
  assert.match(structure.content[0].text, /"owner":"director"/);
  assert.match(structure.content[0].text, /"sequence":"detail"/);
});

test("Sequence view preserves sibling order, parents, phases, async and full request/response", () => {
  const doc: SequenceDocument = { version: "1", kind: "sequence", id: "approval", title: "Approval",
    actors: [{ id: "director", label: "Director", kind: "human" }], phases: [{ id: "review", label: "Review" }], calls: [
      { id: "first", to: "director", method: "Review (legal)", phase: "review", children: [
        { id: "nested", from: "director", to: "director", method: "Sign", async: true, request: "application", response: "approved" }] },
      { id: "last", to: "director", method: "Review (budget)" }] };
  const text = readView(doc, "compact").content[0].text;
  assert.ok(text.indexOf('call "first"') < text.indexOf('call "nested"'));
  assert.ok(text.indexOf('call "nested"') < text.indexOf('call "last"'));
  assert.match(text, /call "nested" parent="first" order=0/);
  assert.match(text, /call "last" parent=null order=1/);
  assert.match(text, /"request":"application","response":"approved"/);
  assert.match(text, /"async":true/);
  assert.match(text, /phase "review" "Review"/);
});
