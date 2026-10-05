import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { Project, RevisionConflictError } from "./project";
import { LockTimeoutError, withWriteLock } from "./write-lock";
import type { FlowDocument } from "./types";
import type { SequenceDocument } from "./sequence-types";

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), "ft-proj-"));
const flow = (id: string): FlowDocument => ({
  version: "1",
  id,
  title: `T ${id}`,
  actors: [],
  nodes: [{ id: "a", type: "step", label: "A", description: ["x"] }],
  edges: [],
});
const seq = (id: string): SequenceDocument => ({
  version: "1",
  kind: "sequence",
  id,
  title: `S ${id}`,
  actors: [{ id: "api", label: "API", kind: "service" }],
  calls: [{ id: "c", to: "api", method: "m" }],
});
const write = (dir: string, rel: string, obj: unknown) =>
  fs.mkdir(path.dirname(path.join(dir, rel)), { recursive: true }).then(() =>
    fs.writeFile(path.join(dir, rel), JSON.stringify(obj)),
  );

test("scan fallback (no manifest) lists both kinds, ungrouped", async () => {
  const dir = await tmp();
  await write(dir, "f1.flow.json", flow("f1"));
  await write(dir, "s1.sequence.json", seq("s1"));
  const es = await new Project(dir).entries();
  assert.deepEqual(
    es.map((e) => `${e.id}:${e.kind}:${e.category}`).sort(),
    ["f1:flow:", "s1:sequence:"],
  );
});

test("manifest: nested category + arbitrary path resolution", async () => {
  const dir = await tmp();
  await write(dir, "flows/x.flow.json", flow("txn"));
  await write(dir, ".flowtrace/project.json", {
    version: "1",
    name: "P",
    documents: [{ id: "txn", path: "flows/x.flow.json", category: "A/B" }],
  });
  const p = new Project(dir);
  const es = await p.entries();
  assert.equal(es.length, 1);
  assert.equal(es[0].id, "txn");
  assert.equal(es[0].category, "A/B");
  assert.equal((await p.read("txn")).id, "txn");
});

test("setCategory seeds a manifest from a scan", async () => {
  const dir = await tmp();
  await write(dir, "f1.flow.json", flow("f1"));
  const p = new Project(dir);
  await p.setCategory("f1", "Group/Sub");
  const m = await p.loadManifest();
  assert.ok(m);
  assert.equal(m!.documents.find((d) => d.id === "f1")?.category, "Group/Sub");
});

test("write with category creates manifest + file", async () => {
  const dir = await tmp();
  const p = new Project(dir);
  await p.write(flow("new1"), { category: "Cat" });
  const m = await p.loadManifest();
  assert.ok(m);
  assert.equal(m!.documents.find((d) => d.id === "new1")?.category, "Cat");
  assert.equal((await p.read("new1")).title, "T new1");
});

test("renameCategory rewrites the category and everything nested under it", async () => {
  const dir = await tmp();
  const p = new Project(dir);
  await p.write(flow("a"), { category: "Payments" });
  await p.write(flow("b"), { category: "Payments/Internals" });
  await p.write(flow("c"), { category: "Payments/Internals/Deep" });
  await p.write(flow("d"), { category: "Other" });
  await p.renameCategory("Payments", "Billing");
  const cat = (id: string) =>
    p.loadManifest().then((m) => m!.documents.find((e) => e.id === id)?.category);
  assert.equal(await cat("a"), "Billing");
  assert.equal(await cat("b"), "Billing/Internals");
  assert.equal(await cat("c"), "Billing/Internals/Deep");
  assert.equal(await cat("d"), "Other");
});

test("renameCategory to empty string ungroups the subtree", async () => {
  const dir = await tmp();
  const p = new Project(dir);
  await p.write(flow("a"), { category: "Tmp" });
  await p.write(flow("b"), { category: "Tmp/Sub" });
  await p.renameCategory("Tmp", "");
  const m = await p.loadManifest();
  assert.equal(m!.documents.find((e) => e.id === "a")?.category, "");
  assert.equal(m!.documents.find((e) => e.id === "b")?.category, "Sub");
});

test("rename changes title; remove deletes file + manifest entry", async () => {
  const dir = await tmp();
  const p = new Project(dir);
  await p.write(flow("r1"), { category: "C" });
  await p.rename("r1", "Renamed");
  assert.equal((await p.read("r1")).title, "Renamed");
  await p.remove("r1");
  assert.equal((await p.entries()).length, 0);
});

test("a revision fingerprints the stored content and changes when it does", async () => {
  const dir = await tmp();
  const p = new Project(dir);
  const first = await p.write(flow("r"));
  const read = await p.readWithRevision("r");
  assert.equal(read.revision, first.revision);
  const again = await p.write({ ...flow("r"), title: "Changed" });
  assert.notEqual(again.revision, first.revision);
});

test("a write that expects the revision it read is rejected after a concurrent change", async () => {
  const dir = await tmp();
  const agent = new Project(dir);
  const browser = new Project(dir);                                           
  await agent.write(flow("doc"));
  const { revision } = await agent.readWithRevision("doc");
  await browser.rename("doc", "Renamed in the browser");
  await assert.rejects(agent.write({ ...flow("doc"), title: "Agent edit" }, { expectRevision: revision }), RevisionConflictError);
  assert.equal((await agent.read("doc")).title, "Renamed in the browser");                       
  const current = (await agent.readWithRevision("doc")).revision;
  await agent.write({ ...flow("doc"), title: "Agent edit" }, { expectRevision: current });
  assert.equal((await agent.read("doc")).title, "Agent edit");
});

test("expecting a revision of a document that is gone is a conflict", async () => {
  const dir = await tmp();
  const p = new Project(dir);
  const { revision } = await p.write(flow("gone"));
  await p.remove("gone");
  await assert.rejects(p.write(flow("gone"), { expectRevision: revision }), (e: unknown) => e instanceof RevisionConflictError && e.current === null);
});

test("concurrent writers keep every manifest entry (one writer at a time)", async () => {
  const dir = await tmp();
  const ids = Array.from({ length: 12 }, (_, i) => `w${i}`);
  await Promise.all(ids.map((id) => new Project(dir).write(flow(id), { category: "C" })));
  const m = await new Project(dir).loadManifest();
  assert.deepEqual(m!.documents.map((d) => d.id).sort(), [...ids].sort());
});

test("an old lock is never stolen: a paused writer could resume", async () => {
  const dir = await tmp();
  const lock = path.join(dir, ".systematlas", ".write.lock");
  await fs.mkdir(path.dirname(lock), { recursive: true });
  await fs.writeFile(lock, "12345 dead\n");
  const old = new Date(Date.now() - 60_000);
  await fs.utimes(lock, old, old);
  let entered = false;
  await assert.rejects(withWriteLock(lock, async () => { entered = true; }, 20), LockTimeoutError);
  assert.equal(entered, false);
  assert.equal(await fs.readFile(lock, "utf8"), "12345 dead\n");
  await fs.rm(lock);                                                             
  await new Project(dir).write(flow("after-recovery"));
  assert.equal((await new Project(dir).read("after-recovery")).id, "after-recovery");
  await assert.rejects(fs.access(lock));
});

test("separate processes racing the same revision commit once and retain both manifest additions", { timeout: 20_000 }, async (t) => {
  const dir = await tmp();
  const p = new Project(dir);
  const { revision } = await p.write(flow("race"));
  const source = new URL("./project.ts", import.meta.url).href;
  const code = `
    import { Project, RevisionConflictError } from ${JSON.stringify(source)};
    const [root, expected, writer] = process.argv.slice(1);
    const p = new Project(root);
    const doc = await p.read("race");
    console.log("ready");
    await new Promise(resolve => process.stdin.once("data", resolve));
    let outcome;
    try { await p.write({...doc, title:writer}, {expectRevision:expected}); outcome="written"; }
    catch(e) { if(!(e instanceof RevisionConflictError)) throw e; outcome="conflict"; }
    await p.write({...doc, id:writer, title:writer});
    console.log(JSON.stringify({writer,outcome}));
  `;
  const children = ["writer-a", "writer-b"].map(writer => {
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code, dir, revision, writer],
      { stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    const ready = new Promise<void>((resolve, reject) => {
      child.stdout.on("data", data => { out += data; if (out.includes("ready\n")) resolve(); });
      child.once("error", reject);
      child.once("exit", exit => { if (!out.includes("ready\n")) reject(new Error("Writer failed before ready: " + exit + ": " + err)); });
    });
    child.stderr.on("data", data => { err += data; });
    const done = new Promise<{ writer: string; outcome: string }>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", exit => {
        if (exit !== 0) { reject(new Error("Writer failed: " + exit + ": " + err)); return; }
        try {
          const lines = out.trim().split("\n");
          resolve(JSON.parse(lines[lines.length - 1]));
        } catch (e) { reject(e); }
      });
    });
    return { child, ready, done };
  });
  t.after(async () => {
    for (const { child } of children) if (child.exitCode === null) child.kill();
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.match(path.basename(dir), /^ft-proj-/);
    await fs.rm(dir, { recursive: true, force: true });
  });
  await Promise.all(children.map(c => c.ready));
  for (const { child } of children) child.stdin.end("go\n");
  const outcomes = await Promise.all(children.map(c => c.done));
  assert.deepEqual(outcomes.map(o => o.outcome).sort(), ["conflict", "written"]);
  assert.equal((await p.read("race")).title, outcomes.find(o => o.outcome === "written")!.writer);
  assert.deepEqual((await p.entries()).map(e => e.id).sort(), ["race", "writer-a", "writer-b"]);
});
