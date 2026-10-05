import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { vocabularyDocs } from "./vocabulary-docs";
import { readView } from "./read-view";
import { END_MARKERS, ICON_NAMES, LINE_STYLES, SHAPE_NAMES } from "../core/visual-vocabulary";
import type { FlowDocument } from "../core/types";

const schema = JSON.parse(readFileSync(new URL("../../schema/flow.schema.json", import.meta.url), "utf8"));

test("the docs describe exactly the values the schema accepts", () => {
  const node = schema.$defs.node.properties, style = schema.$defs.edgeStyle.properties;
  const builtin = schema.$defs.nodeIcon.oneOf.find((v: { properties: { kind: { const: string } } }) => v.properties.kind.const === "builtin");
  assert.deepEqual([...node.shape.enum].sort(), [...SHAPE_NAMES].sort());
  assert.deepEqual([...builtin.properties.name.enum].sort(), [...ICON_NAMES].sort());
  assert.deepEqual(style.line.enum, [...LINE_STYLES]);
  assert.deepEqual(style.end.enum, [...END_MARKERS]);
  const all = vocabularyDocs();
  for (const name of [...SHAPE_NAMES, ...ICON_NAMES]) assert.match(all, new RegExp(`^- ${name.replace(/[-]/g, "\\-")}: `, "m"), name);
  for (const name of [...LINE_STYLES, ...END_MARKERS]) assert.ok(all.includes(name), name);
});

test("query returns matching entries only, exact names first", () => {
  const db = vocabularyDocs("database");
  assert.match(db, /- cyl: Database/);
  assert.match(db, /- database: Database/);
  assert.doesNotMatch(db, /- flag:/);
  assert.doesNotMatch(db, /Meaning first/, "a search result omits the rules");
  const queue = vocabularyDocs("queue").split("\n").filter((l) => l.startsWith("- "));
  assert.equal(queue[0], "- queue: Message queue");
  assert.match(vocabularyDocs("DASHED"), /dashed/);
});

test("a query without matches lists every name instead of an empty answer", () => {
  const none = vocabularyDocs("zzzz");
  assert.match(none, /No vocabulary entry matches "zzzz"/);
  for (const name of [...SHAPE_NAMES, ...ICON_NAMES, ...LINE_STYLES]) assert.ok(none.includes(name), name);
  assert.equal(vocabularyDocs("  "), vocabularyDocs());
});

test("structure detail keeps shape and style, omits icon and says so", () => {
  const doc: FlowDocument = { version: "1", id: "store", title: "Store", actors: [],
    nodes: [{ id: "db", type: "step", label: "Orders", description: ["Keeps orders"], shape: "cyl",
      icon: { kind: "svg", viewBox: [0, 0, 24, 24], paths: [{ d: "M0 0L24 24" }] } },
      { id: "w", type: "step", label: "Worker", description: ["Works"] }],
    edges: [{ from: "db", to: "w", type: "flow", style: { line: "dashed", end: "circle" } }] };
  const view = readView(doc, "json", "structure", { around: "db", depth: 1 }).structuredContent as {
    nodes: Record<string, unknown>[]; edges: Record<string, unknown>[]; viewMetadata: { omittedFields: string[] } };
  assert.equal(view.nodes.find((n) => n.id === "db")?.shape, "cyl");
  assert.equal(view.nodes.find((n) => n.id === "db")?.icon, undefined);
  assert.deepEqual(view.edges[0].style, { line: "dashed", end: "circle" });
  assert.ok(view.viewMetadata.omittedFields.includes("icon"));
  const full = readView(doc, "json", "full", { around: "db", depth: 1 }).structuredContent as { nodes: Record<string, unknown>[] };
  assert.ok(full.nodes.find((n) => n.id === "db")?.icon);
});
