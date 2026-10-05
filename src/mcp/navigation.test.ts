import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { listNavigation, navigationInput } from "./navigation";
import { ProjectNavigation } from "../core/navigation";
import { z } from "zod";

test("paged catalog and shared queries return all results without duplicates; cursors bind query and revision", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sa-navigation-page-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (let i = 0; i < 7; i++) await fs.writeFile(path.join(root, `p${i}.flow.json`), JSON.stringify({
    version: "1", id: `p${i}`, title: "Approval", actors: [],
    nodes: [{ id: "approve", type: "step", label: "Approval", description: ["Sign"], shared: true }], edges: [] }));
  const loader = new ProjectNavigation();
  const request = { query: { kind: "shared" as const, id: "approve" }, limit: 3 };
  const first = await listNavigation(root, request, loader);
  assert.equal(first.structuredContent.total, 7);
  assert.equal(first.structuredContent.complete, false);
  assert.ok(first.structuredContent.nextCursor);
  const second = await listNavigation(root, { ...request, cursor: first.structuredContent.nextCursor }, loader);
  const third = await listNavigation(root, { ...request, cursor: second.structuredContent.nextCursor }, loader);
  assert.equal(third.structuredContent.complete, true);
  const ids = [first, second, third].flatMap(x => "results" in x.structuredContent ?
    x.structuredContent.results.map(row => "document" in row ? row.document : "") : []);
  assert.deepEqual(ids, Array.from({ length: 7 }, (_, i) => `p${i}`));
  const catalog = await listNavigation(root, { limit: 2 }, loader);
  assert.ok("flows" in catalog.structuredContent);
  assert.equal(catalog.structuredContent.flows.length, 2);
  await assert.rejects(listNavigation(root, { query: { kind: "shared", id: "different" }, cursor: first.structuredContent.nextCursor }, loader), /another query/);
  await fs.unlink(path.join(root, "p0.flow.json"));
  await assert.rejects(listNavigation(root, { ...request, cursor: first.structuredContent.nextCursor }, loader), /Workspace changed/);
  await assert.rejects(listNavigation(root, { cursor: "bad" }, loader), /Invalid navigation cursor/);
  await assert.rejects(listNavigation(root, { cursor: Buffer.from("null").toString("base64url") }, loader), /Invalid navigation cursor/);
});

test("actual response size includes escaped labels and structuredContent; every reduced page is recoverable", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sa-navigation-bytes-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (let i = 0; i < 3; i++) await fs.writeFile(path.join(root, `p${i}.flow.json`), JSON.stringify({
    version: "1", id: `p${i}`, title: "\\".repeat(4000), actors: [],
    nodes: [{ id: "a", type: "step", label: "A", description: ["x"] }], edges: [] }));
  const loader = new ProjectNavigation();
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const response = await listNavigation(root, { limit: 100, cursor }, loader);
    assert.ok(Buffer.byteLength(JSON.stringify(response)) <= 48_000);
    assert.ok("flows" in response.structuredContent);
    ids.push(...response.structuredContent.flows.map(row => "id" in row ? row.id : ""));
    cursor = response.structuredContent.nextCursor;
  } while (cursor);
  assert.deepEqual(ids, ["p0", "p1", "p2"]);
});

test("schema rejects unbounded or ambiguous queries", () => {
  const schema = z.object(navigationInput).strict();
  for (const invalid of [{ limit: 101 }, { limit: 0 }, { query: { kind: "shared" } },
    { query: { kind: "links", document: "a", direction: "sideways" } }]) assert.equal(schema.safeParse(invalid).success, false);
});
