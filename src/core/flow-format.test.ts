import { test } from "node:test";
import assert from "node:assert/strict";
import { isLegacyFlow, pointsToMarkdown, upgradeFlow } from "./flow-format";
import { parseBlocks } from "./markdown";
import { validateFlow } from "./validate";

const v1 = {
  version: "1",
  id: "pay",
  title: "Pay",
  actors: [{ id: "shop", label: "Shop", kind: "service" }],
  nodes: [
    { id: "start", type: "terminal", label: "Start", description: ["Begins."] },
    { id: "charge", type: "step", label: "Charge", owner: "shop", description: ["Calls the bank.", "Retries twice\non timeout."] },
    { id: "done", type: "terminal", label: "Done", description: ["Ends."] },
  ],
  edges: [
    { from: "start", to: "charge", type: "flow" },
    { from: "charge", to: "done", type: "branch", label: "ok", description: ["Approved."] },
  ],
};

test("version 1 upgrades mechanically: label → text, description → details", () => {
  const up = upgradeFlow(v1) as Record<string, any>;
  assert.equal(up.version, "2");
  assert.deepEqual(up.nodes[0], { id: "start", type: "terminal", text: "Start", details: "Begins." });
  assert.deepEqual(Object.keys(up.nodes[1]), ["id", "type", "text", "owner", "details"]);
  assert.equal(up.nodes[1].details, "- Calls the bank.\n- Retries twice\n  on timeout.");
  assert.deepEqual(up.edges[1], { from: "charge", to: "done", type: "branch", text: "ok", details: "Approved." });
  assert.deepEqual(up.actors, v1.actors, "actors keep their label");
  assert.equal(validateFlow(up).ok, true);
});

test("several points stay a list of the same points; nothing is lost", () => {
  const blocks = parseBlocks(pointsToMarkdown(["a", "b\nc"]) as string);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, "list");
});

test("current documents, sequences and malformed input pass through unchanged", () => {
  const v2 = upgradeFlow(v1);
  assert.equal(upgradeFlow(v2), v2);
  const sequence = { version: "1", kind: "sequence", id: "s", title: "S", actors: [], calls: [] };
  assert.equal(upgradeFlow(sequence), sequence);
  assert.equal(isLegacyFlow(sequence), false);
  assert.equal(upgradeFlow(null), null);
  assert.equal(upgradeFlow("x"), "x");
});

test("the input document is never modified", () => {
  const copy = JSON.parse(JSON.stringify(v1));
  upgradeFlow(copy);
  assert.deepEqual(copy, v1);
});
