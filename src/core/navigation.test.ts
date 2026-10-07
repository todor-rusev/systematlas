import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { navigationIndex, ProjectNavigation } from "./navigation";
import type { FlowDocument } from "./types";
import type { SequenceDocument } from "./sequence-types";
import { BRAND } from "../brand";

const flow = (id: string): FlowDocument => ({ version: "2", id, title: id, actors: [],
  nodes: [{ id: "same", text: "Same", type: "step", details: "x" }], edges: [] });
const seq = (id: string): SequenceDocument => ({ version: "1", id, title: id, kind: "sequence",
  actors: [{ id: "director", label: "Director", kind: "human" }], calls: [{ id: "call", to: "director", method: "Sign" }] });

test("index distinguishes node/edge drills, target kinds, twins and shared/local identity", () => {
  const a = flow("a"), b = flow("b"), c = seq("c");
  a.nodes[0] = { ...a.nodes[0], type: "subflow", shared: true, subflow: "b", sequence: "c" };
  a.twin = "c"; c.twin = "a";
  a.edges = [{ from: "same", to: "same", type: "return", text: "again", subflow: "b" },
    { from: "same", to: "same", type: "return", text: "again", sequence: "c", id: "shared-edge", shared: true }];
  const index = navigationIndex([c, b, a]);
  assert.equal(index.query({ kind: "links", document: "b", direction: "incoming" }).length, 2);
  const incoming = index.query({ kind: "links", document: "c", direction: "incoming", relations: ["sequence"] });
  assert.equal(incoming.length, 2);
  assert.ok(incoming.every(x => "targetKind" in x && x.targetKind === "sequence"));
  assert.equal(index.query({ kind: "links", document: "c", direction: "both", relations: ["twin"] }).length, 2);
  assert.deepEqual(index.query({ kind: "shared", id: "same" }).map(x => x.document), ["a"]);
  assert.equal(index.query({ kind: "shared", id: "shared-edge", objectKind: "edge" }).length, 1);
  assert.equal(index.query({ kind: "shared", id: "shared-edge", objectKind: "node" }).length, 0);
});

test("parallel id-less edges remain separate and missing targets are explicit", () => {
  const a = flow("a");
  a.edges = Array.from({ length: 2 }, () => ({ from: "same", to: "same", type: "return", subflow: "missing" }));
  const rows = navigationIndex([a]).query({ kind: "links", document: "missing", direction: "incoming" });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(x => "source" in x && x.source.kind === "edge" ? x.source.index : -1), [0, 1]);
  assert.ok(rows.every(x => "targetExists" in x && !x.targetExists));
});

test("navigation reloads external edits, additions, deletion, categories and arbitrary manifest paths", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sa-navigation-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const loader = new ProjectNavigation();
  const file = path.join(root, "a.flow.json");
  const a = flow("a"); a.nodes[0].type = "subflow"; a.nodes[0].subflow = "b";
  await fs.writeFile(file, JSON.stringify(a));
  const first = await loader.load(root);
  assert.equal(first.query({ kind: "links", document: "b", direction: "incoming" }).length, 1);
  assert.equal(await loader.load(root), first);
  a.nodes[0].subflow = "c";
  await fs.writeFile(file, JSON.stringify(a));
  const second = await loader.load(root);
  assert.notEqual(first.snapshot, second.snapshot);
  assert.equal(second.query({ kind: "links", document: "b", direction: "incoming" }).length, 0);
  await fs.writeFile(path.join(root, "c.sequence.json"), JSON.stringify(seq("c")));
  const added = await loader.load(root);
  assert.equal(added.catalog.length, 2);
  await fs.mkdir(path.join(root, BRAND.storeDir));
  await fs.writeFile(path.join(root, BRAND.storeDir, "project.json"), JSON.stringify({ version: "1", documents: [
    { id: "a", path: "a.flow.json", category: "HR/Approval" }, { id: "c", path: "c.sequence.json" }] }));
  assert.equal((await loader.load(root)).catalog[0].category, "HR/Approval");
  await fs.writeFile(path.join(root, BRAND.storeDir, "project.json"), JSON.stringify({ version: "1", documents: [{ id: "a", path: "a.flow.json" }] }));
  assert.equal((await loader.load(root)).catalog.length, 1);
  await fs.unlink(file);
  await assert.rejects(loader.load(root), /ENOENT/);
});

test("unparseable, invalid and conflicting documents cannot yield a falsely complete index", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sa-navigation-bad-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, "a.flow.json"), loader = new ProjectNavigation();
  await fs.writeFile(file, "{");
  await assert.rejects(loader.load(root));
  await fs.writeFile(file, JSON.stringify({ ...flow("a"), nodes: [{ id: "same" }] }));
  await assert.rejects(loader.load(root), /Invalid document/);
  await fs.writeFile(file, JSON.stringify(flow("other-id")));
  await assert.rejects(loader.load(root), /differs/);
  await fs.mkdir(path.join(root, BRAND.storeDir));
  await fs.writeFile(path.join(root, BRAND.storeDir, "project.json"), "{");
  await assert.rejects(loader.load(root));
});
