import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { SHAPE_NAMES, ICON_NAMES, LINE_STYLES, END_MARKERS } from "./core/visual-vocabulary";
import { validateDoc, docKind, type AnyDoc } from "./core/validate-doc";
import type { FlowDocument } from "./core/types";
import { nodeGeometry, clipToOutline } from "./visual-geometry";
import { visualDemoDocs } from "./data/visual-demo";

const folder = new URL("../examples/visual-demo/", import.meta.url);
const docs = readdirSync(folder).filter(name => name.endsWith(".json"))
  .map(name => JSON.parse(readFileSync(new URL(name, folder), "utf8")) as AnyDoc);
const flows = docs.filter(d => docKind(d) === "flow") as FlowDocument[];

test("the visual demo covers every shape, built-in icon, line and marker with valid cross-document drills", () => {
                                                                                              
  assert.deepEqual(docs.map(d => d.id).sort(), visualDemoDocs.map(d => d.id).sort());
  const ids = new Set(docs.map(d => d.id));
  assert.equal(ids.size, docs.length);
  for (const doc of docs) {
    const result = validateDoc(doc, docs);
    assert.equal(result.ok, true, `${doc.id}: ${JSON.stringify(result)}`);
  }
  const nodes = flows.flatMap(f => f.nodes), edges = flows.flatMap(f => f.edges);
  const sorted = (values: Iterable<string>) => [...new Set(values)].sort();
  assert.deepEqual(sorted(nodes.flatMap(n => n.shape ? [n.shape] : [])), sorted(SHAPE_NAMES));
  assert.deepEqual(sorted(nodes.flatMap(n => n.icon?.kind === "builtin" ? [n.icon.name] : [])), sorted(ICON_NAMES));
  assert.deepEqual(sorted(edges.flatMap(e => e.style?.line ? [e.style.line] : [])), sorted(LINE_STYLES));
  assert.deepEqual(sorted(edges.flatMap(e => [e.style?.start, e.style?.end].filter((m): m is NonNullable<typeof m> => !!m))), sorted(END_MARKERS));
  assert.ok(nodes.some(n => n.icon?.kind === "emoji"));
  assert.ok(nodes.filter(n => n.icon?.kind === "svg").length >= 5);
  assert.ok(nodes.some(n => n.subflow));
  assert.ok(nodes.some(n => n.sequence));
  for (const node of nodes) {
    for (const target of [node.subflow, node.sequence]) {
      if (target) assert.ok(ids.has(target), target);
    }
  }
});

test("picture slots fit above captions and incoming/outgoing routes clear their complete footprint", () => {
  for (const node of flows.flatMap(f => f.nodes).filter(n => n.shape === "image")) {
    const g = nodeGeometry(node), s = g.symbol!;
    assert.ok(s && s.w === 48 && s.h === 48, node.id);
    assert.equal(g.content.y - (s.y + s.h), 8, node.id);
    assert.ok(s.x >= 0 && s.y >= 0 && s.x + s.w <= g.w && s.y + s.h < g.content.y, node.id);
    const bounds = { x: 0, y: 0, w: g.w, h: g.h, outline: g.outline };
    assert.ok(clipToOutline(bounds, { x: g.w / 2, y: -g.h }, 0).y <= s.y, node.id);
    assert.ok(clipToOutline(bounds, { x: g.w / 2, y: g.h * 2 }, 0).y >= g.content.y + g.content.h - 1, node.id);
  }
});
