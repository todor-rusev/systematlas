import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { promises as fs } from "node:fs";
import { UpdateService, UPDATE_INTERVAL } from "./updates";
import { handleUpdateApi } from "../cli/update-api";

async function fixture(t: { after(fn: () => Promise<void>): void }, local = false) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "systematlas-updates-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const prefix = path.join(dir, "npm");
  const owner = local ? path.join(dir, "project") : path.join(prefix, process.platform === "win32" ? "" : "lib");
  const packageRoot = path.join(owner, "node_modules", "systematlas");
  await fs.mkdir(packageRoot, { recursive: true });
  const packageFile = path.join(packageRoot, "package.json");
  const save = (version: string) => fs.writeFile(packageFile, JSON.stringify({ name: "systematlas", version }));
  await save("0.3.1");
  if (local) await fs.writeFile(path.join(owner, "package.json"), JSON.stringify({ devDependencies: { systematlas: "^0.3.1" } }));
  let now = 1_800_000_000_000, latest = "0.3.2", checks = 0;
  const commands: string[][] = [];
  const options = {
    packageRoot, stateDir: path.join(dir, "preferences"), now: () => now,
    fetchLatest: async () => { checks++; return latest; },
    runNpm: async (args: string[]) => {
      if (args[0] === "prefix") return prefix;
      commands.push(args);
      await save(args.find(a => a.startsWith("systematlas@"))!.slice("systematlas@".length));
      return "";
    },
  };
  return { dir, owner, options, save, commands, checks: () => checks,
    setLatest: (value: string) => { latest = value; }, advance: (ms: number) => { now += ms; },
    start: async () => { const service = await UpdateService.create(options); await service.check(); return service; } };
}

test("launch checks once across refreshes and concurrent launches, then expires after 24h", async t => {
  const f = await fixture(t);
  const [a, b] = await Promise.all([f.start(), f.start()]);
  assert.equal(f.checks(), 1);
  assert.equal(a.status().available, true);
  assert.equal(b.status().latestVersion, "0.3.2");
  f.advance(UPDATE_INTERVAL - 1);
  await a.check();
  await f.start();
  assert.equal(f.checks(), 1);
  f.advance(1);
  f.setLatest("0.4.0");
  const next = await f.start();
  assert.equal(f.checks(), 2);
  assert.equal(next.status().latestVersion, "0.4.0");
  await a.check();
  assert.equal(f.checks(), 2, "a running app never starts a background polling loop");
});

test("skip persists across projects and launches, but a newer release is offered", async t => {
  const f = await fixture(t);
  const a = await f.start();
  await a.skip("0.3.2");
  const next = await f.start();
  assert.equal(next.status().available, false);
  f.advance(UPDATE_INTERVAL);
  f.setLatest("0.3.3");
  const newer = await f.start();
  assert.equal(newer.status().available, true);
  assert.equal(newer.status().latestVersion, "0.3.3");
  assert.equal(f.checks(), 2);
});

test("semver comparison avoids downgrades and invalid/prerelease registry offers", async t => {
  for (const latest of ["0.3.1", "0.3.0", "garbage", "9.0.0-beta.1", "v0.4.0", "1.2.3; run something"]) {
    const f = await fixture(t);
    f.setLatest(latest);
    assert.equal((await f.start()).status().available, false, latest);
  }
  const f = await fixture(t);
  await f.save("0.9.0");
  f.setLatest("0.10.0");
  assert.equal((await f.start()).status().available, true, "numeric semver, not lexical ordering");
});

test("skip is visible to another running project without a registry request", async t => {
  const f = await fixture(t);
  const [a, b] = await Promise.all([f.start(), f.start()]);
  await b.skip("0.3.2");
  assert.equal((await a.refreshStatus()).available, false);
  await assert.rejects(a.update("0.3.2"), /not the offered/);
  assert.equal(f.checks(), 1);
});

test("offline attempts are persisted and do not repeat on every launch", async t => {
  const f = await fixture(t);
  let attempts = 0;
  f.options.fetchLatest = async () => { attempts++; throw new Error("offline"); };
  assert.equal((await f.start()).status().available, false);
  await f.start();
  assert.equal(attempts, 1);
  f.advance(UPDATE_INTERVAL);
  await f.start();
  assert.equal(attempts, 2);
});

test("corrupt preferences recover, and unwritable preferences do not cause unthrottled requests", async t => {
  const f = await fixture(t);
  await fs.mkdir(f.options.stateDir);
  await fs.writeFile(path.join(f.options.stateDir, "updates.json"), "null");
  assert.equal((await f.start()).status().available, true);
  const locked = await fixture(t);
  await fs.writeFile(locked.options.stateDir, "not a directory");
  await locked.start();
  assert.equal(locked.checks(), 0);
});

test("development checkouts and npm links never check or install registry replacements", async t => {
  const f = await fixture(t);
  f.options.packageRoot = path.join(f.dir, "source");
  await fs.mkdir(f.options.packageRoot);
  await fs.writeFile(path.join(f.options.packageRoot, "package.json"), JSON.stringify({ name: "systematlas", version: "0.1.3" }));
  const service = await f.start();
  assert.equal(service.status().installation, "development");
  assert.equal(f.checks(), 0);
  await assert.rejects(service.update("0.3.2"), /not the offered/);
  assert.equal(f.commands.length, 0);
});

test("global and local updates install the exact offered version at the original prefix", async t => {
  for (const local of [false, true]) {
    const f = await fixture(t, local);
    const service = await f.start();
    await assert.rejects(service.update("9.0.0"), /not the offered/);
    await service.update("0.3.2");
    assert.equal(service.status().state, "installed");
    assert.equal(service.status().installedVersion, "0.3.2");
    assert.equal(service.status().available, false);
    assert.equal(f.commands.length, 1);
    const command = f.commands[0];
    assert.equal(command.includes("--global"), !local);
    assert.equal(command.includes("--save-dev"), local);
    assert.equal(await fs.realpath(command[command.indexOf("--prefix") + 1]),
      await fs.realpath(local ? f.owner : path.join(f.dir, "npm")));
    assert.ok(command.includes("systematlas@0.3.2"));
    assert.ok(command.includes("--registry=https://registry.npmjs.org/"));
    await assert.rejects(service.update("0.3.2"), /not the offered/);
    assert.equal(f.commands.length, 1);
  }
});

test("a global npm link stays a development checkout even with a symlink-preserving launcher", async t => {
  const f = await fixture(t);
  const sourceRoot = path.join(f.dir, "checkout");
  await fs.rename(f.options.packageRoot, sourceRoot);
  await fs.symlink(sourceRoot, f.options.packageRoot, "junction");
  const service = await f.start();
  assert.equal(service.status().installation, "development");
  assert.equal(service.status().available, false);
  assert.equal(f.checks(), 0);
  await assert.rejects(service.update("0.3.2"), /not the offered/);
});

test("installation failure is retryable; reported success requires the installed version", async t => {
  const f = await fixture(t);
  const install = f.options.runNpm;
  let denied = true;
  f.options.runNpm = async args => {
    if (args[0] === "prefix") return install(args);
    if (denied) throw new Error("permission denied");
    return install(args);
  };
  const service = await f.start();
  await assert.rejects(service.update("0.3.2"), /permission denied/);
  assert.equal(service.status().state, "failed");
  assert.equal(service.status().available, true);
  denied = false;
  await service.update("0.3.2");
  assert.equal(service.status().state, "installed");
  const unverified = await fixture(t);
  const prefix = unverified.options.runNpm;
  unverified.options.runNpm = async args => args[0] === "prefix" ? prefix(args) : "npm claims success";
  const other = await unverified.start();
  await assert.rejects(other.update("0.3.2"), /not installed/);
  assert.equal(other.status().state, "failed");
});

test("parallel install/skip actions cannot launch a second installation", async t => {
  const f = await fixture(t);
  const npm = f.options.runNpm;
  let finish!: () => void;
  let begun!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const started = new Promise<void>(resolve => { begun = resolve; });
  f.options.runNpm = async args => { if (args[0] === "install") { begun(); await pending; } return npm(args); };
  const service = await f.start();
  const first = service.update("0.3.2");
  await started;
  try {
    await assert.rejects(service.update("0.3.2"), /already running/);
    await assert.rejects(service.skip("0.3.2"), /already running/);
  } finally { finish(); }
  await first;
  const restarted = await f.start();
  assert.equal(restarted.status().available, false);
  assert.equal(f.commands.length, 1);
});

test("update HTTP endpoints reject cross-origin, wrong Host/token, and arbitrary versions", async t => {
  const f = await fixture(t);
  const service = await f.start();
  const server = http.createServer((req, res) => {
    const port = (server.address() as { port: number }).port;
    void handleUpdateApi(req, res, { service: Promise.resolve(service), token: "test-capability", hosts: [`127.0.0.1:${port}`] });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const request = (headers: Record<string, string> = {}, body: unknown = { version: "0.3.2", token: "test-capability" }) => fetch(`${base}/api/update/install`, {
    method: "POST", headers: { Origin: base, "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
  });
  const status = await fetch(`${base}/api/update`);
  assert.equal(status.headers.get("cache-control"), "no-store");
  assert.equal((await status.json() as { token: string }).token, "test-capability");
  assert.equal((await request({ Origin: "https://example.com" })).status, 403);
  const badHost = await new Promise<number | undefined>((resolve, reject) => {
                                                                              
    const req = http.request(`${base}/api/update/install`, { method: "POST", headers: {
      Host: "attacker.example", Origin: base, "Content-Type": "application/json",
    } }, res => { res.resume(); res.on("end", () => resolve(res.statusCode)); });
    req.on("error", reject);
    req.end(JSON.stringify({ version: "0.3.2", token: "test-capability" }));
  });
  assert.equal(badHost, 403);
  assert.equal((await request({ "Content-Type": "text/plain" })).status, 403);
  assert.equal((await request({}, { version: "0.3.2", token: "wrong" })).status, 403);
  assert.equal((await request({}, { version: "9.0.0", token: "test-capability" })).status, 400);
  assert.equal(f.commands.length, 0);
  assert.equal((await request()).status, 200);
  assert.equal(f.commands.length, 1);
});
