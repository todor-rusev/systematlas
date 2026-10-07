import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveProjectFile, runsWhenOpened } from "./open-source";

test("a source file opens only when it exists inside the project", async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "sa-src-"));
  const root = path.join(base, "project");
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.writeFile(path.join(root, "src", "pay.ts"), "export {};\n");
  await fs.writeFile(path.join(base, "secret.txt"), "x");
  try {
    assert.equal(await resolveProjectFile(root, "src/pay.ts"), await fs.realpath(path.join(root, "src", "pay.ts")));
    assert.equal(await resolveProjectFile(root, path.join(root, "src", "pay.ts")), await fs.realpath(path.join(root, "src", "pay.ts")));
    await assert.rejects(resolveProjectFile(root, "../secret.txt"), /outside the project/);
    await assert.rejects(resolveProjectFile(root, path.join(base, "secret.txt")), /outside the project/);
    await assert.rejects(resolveProjectFile(root, "src/missing.ts"), /not found/);
    await assert.rejects(resolveProjectFile(root, "src"), /not a file/);
    await assert.rejects(resolveProjectFile(root, "."), /outside the project/);
  } finally {
    await fs.rm(base, { recursive: true, force: true });
  }
});

test("on Windows a file the OS would run is recognised by PATHEXT and the launcher types", async () => {
  const pathext = ".COM;.EXE;.BAT;.CMD;.VBS;.JS";
  for (const file of ["C:/repo/setup.bat", "C:/repo/RUN.CMD", "C:/repo/tool.exe", "C:/repo/a.js", "C:/repo/go.lnk", "C:/repo/fix.reg", "C:/repo/x.ps1"])
    assert.equal(await runsWhenOpened(file, "win32", pathext), true, file);
  for (const file of ["C:/repo/pay.ts", "C:/repo/notes.md", "C:/repo/data.json", "C:/repo/Makefile"])
    assert.equal(await runsWhenOpened(file, "win32", pathext), false, file);
                                                                      
  assert.equal(await runsWhenOpened("C:/repo/a.py", "win32", `${pathext};.PY`), true);
                                                       
  assert.equal(await runsWhenOpened("C:/repo/a.vbe", "win32", ""), true);
});

test("elsewhere a file the OS would run is recognised by its executable bit and the launcher types", { skip: process.platform === "win32" && "the executable bit does not exist on Windows" }, async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "sa-exec-"));
  try {
    const script = path.join(base, "deploy.sh"), text = path.join(base, "pay.ts");
    await fs.writeFile(script, "#!/bin/sh\n");
    await fs.writeFile(text, "export {};\n");
    await fs.chmod(script, 0o755);
    await fs.chmod(text, 0o644);
    assert.equal(await runsWhenOpened(script, "linux"), true);
    assert.equal(await runsWhenOpened(text, "linux"), false);
    assert.equal(await runsWhenOpened(path.join(base, "app.desktop"), "linux"), true);
    assert.equal(await runsWhenOpened(path.join(base, "go.command"), "darwin"), true);
  } finally {
    await fs.rm(base, { recursive: true, force: true });
  }
});
