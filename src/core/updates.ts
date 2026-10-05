import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { valid, gt, prerelease } from "semver";
import { BRAND } from "../brand";
import { withWriteLock, writeFileAtomic } from "./write-lock";
import type { UpdateStatus } from "./update-types";

const exec = promisify(execFile);
export const UPDATE_INTERVAL = 24 * 60 * 60 * 1000;
const REGISTRY = "https://registry.npmjs.org/";

interface Preference {
  checkedAt: number;
  latestVersion: string | null;
  skippedVersion: string | null;
}
interface Installation {
  kind: UpdateStatus["installation"];
  prefix?: string;
  devDependency?: boolean;
}
export interface UpdateOptions {
  packageRoot: string;
  stateDir: string;
  now?: () => number;
  fetchLatest?: () => Promise<string>;
  runNpm?: (args: string[]) => Promise<string>;
}

function release(version: unknown): version is string {
  return typeof version === "string" && valid(version) === version && !prerelease(version);
}

async function readJson(file: string): Promise<Record<string, unknown>> {
  const data = JSON.parse(await fs.readFile(file, "utf8"));
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new SyntaxError("Expected a JSON object");
  return data;
}

                                                                                   
export async function runNpm(args: string[]): Promise<string> {
  const nodeDir = path.dirname(process.execPath);
  const dirs = [nodeDir, ...(process.env.PATH ?? "").split(path.delimiter)];
  const candidates = [
    process.env.npm_execpath,
    ...dirs.flatMap(dir => [
      path.join(dir, "node_modules/npm/bin/npm-cli.js"),
      path.resolve(dir, "../lib/node_modules/npm/bin/npm-cli.js"),
    ]),
  ];
  for (const file of candidates) {
    if (!file || path.basename(file) !== "npm-cli.js") continue;
    try {
      await fs.access(file);
    } catch { continue; }
    try {
      const env = { ...process.env };
                                                                           
                                                                            
                                                                                
      if (env.npm_lifecycle_event) delete env.npm_config_allow_scripts;
      const prefixAt = args.indexOf("--prefix");
      const { stdout } = await exec(process.execPath, [file, ...args], {
        windowsHide: true, timeout: 5 * 60 * 1000, maxBuffer: 2 * 1024 * 1024,
        cwd: prefixAt >= 0 ? args[prefixAt + 1] : os.homedir(), env,
      });
      return stdout.trim();
    } catch (cause) {
      throw Object.assign(new Error("npm could not install the update. Check installation permissions and your network connection, then try again."), { cause });
    }
  }
  throw new Error("npm was not found. Install Node.js with npm, then try again.");
}

async function fetchLatest(): Promise<string> {
  const response = await fetch(`${REGISTRY}${BRAND.key}/latest`, {
    signal: AbortSignal.timeout(6000), headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Registry returned ${response.status}`);
  const metadata = await response.json() as { name?: unknown; version?: unknown };
  if (metadata.name !== BRAND.key || !release(metadata.version))
    throw new Error("Registry did not return a stable SystemAtlas release.");
  return metadata.version;
}

async function installation(root: string, npm: (args: string[]) => Promise<string>): Promise<Installation> {
                                                                            
                                                                                   
  if (path.basename(root) !== BRAND.key || path.basename(path.dirname(root)) !== "node_modules")
    return { kind: "development" };
  const prefix = await npm(["prefix", "--global"]);
  const globalRoot = path.join(prefix, process.platform === "win32" ? "" : "lib", "node_modules", BRAND.key);
  const realGlobalRoot = await fs.realpath(globalRoot).catch(() => globalRoot);
  const normalize = (file: string) => process.platform === "win32" ? path.resolve(file).toLowerCase() : path.resolve(file);
  if (normalize(realGlobalRoot) === normalize(root)) return { kind: "global", prefix };
  const owner = path.dirname(path.dirname(root));
  try {
    const pkg = await readJson(path.join(owner, "package.json"));
    const deps = pkg.dependencies as Record<string, unknown> | undefined;
    const dev = pkg.devDependencies as Record<string, unknown> | undefined;
    if (typeof deps?.[BRAND.key] === "string" || typeof dev?.[BRAND.key] === "string")
      return { kind: "local", prefix: owner, devDependency: !deps?.[BRAND.key] && !!dev?.[BRAND.key] };
  } catch {                                             }
  return { kind: "development" };
}

                                                                                     
export class UpdateService {
  private readonly stateFile: string;
  private readonly lockFile: string;
  private readonly now: () => number;
  private readonly latest: () => Promise<string>;
  private readonly npm: (args: string[]) => Promise<string>;
  private checked?: Promise<void>;
  private preferences: Preference = { checkedAt: 0, latestVersion: null, skippedVersion: null };
  private state: UpdateStatus["state"] = "idle";
  private error?: string;
  private installedVersion?: string;

  private constructor(private readonly options: UpdateOptions,
    private readonly currentVersion: string, private readonly install: Installation) {
    this.stateFile = path.join(options.stateDir, "updates.json");
    this.lockFile = path.join(options.stateDir, ".updates.lock");
    this.now = options.now ?? Date.now;
    this.latest = options.fetchLatest ?? fetchLatest;
    this.npm = options.runNpm ?? runNpm;
  }

  static async create(options: UpdateOptions): Promise<UpdateService> {
    options = { ...options, packageRoot: await fs.realpath(options.packageRoot) };
    const pkg = await readJson(path.join(options.packageRoot, "package.json"));
    if (pkg.name !== BRAND.key || typeof pkg.version !== "string" || !valid(pkg.version))
      throw new Error("Cannot read the installed SystemAtlas version.");
    const install = await installation(options.packageRoot, options.runNpm ?? runNpm);
    return new UpdateService(options, pkg.version, install);
  }

  private async read(): Promise<Preference> {
    try {
      const data = await readJson(this.stateFile);
      return {
        checkedAt: typeof data.checkedAt === "number" && Number.isFinite(data.checkedAt) ? data.checkedAt : 0,
        latestVersion: release(data.latestVersion) ? data.latestVersion : null,
        skippedVersion: release(data.skippedVersion) ? data.skippedVersion : null,
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT" || e instanceof SyntaxError)
        return { checkedAt: 0, latestVersion: null, skippedVersion: null };
      throw e;
    }
  }

  private async write(): Promise<void> {
    await writeFileAtomic(this.stateFile, JSON.stringify(this.preferences, null, 2) + "\n");
  }

  check(): Promise<void> {
    return this.checked ??= this.checkOnce();
  }

  private async checkOnce(): Promise<void> {
    if (this.install.kind === "development") return;
    try {
      await withWriteLock(this.lockFile, async () => {
        this.preferences = await this.read();
        const now = this.now();
        const age = now - this.preferences.checkedAt;
        if (this.preferences.checkedAt > 0 && age >= 0 && age < UPDATE_INTERVAL) return;
                                                                                 
        this.preferences.checkedAt = now;
        await this.write();
        try {
          const version = await this.latest();
          if (!release(version)) throw new Error("Invalid stable release version.");
          this.preferences.latestVersion = version;
          await this.write();
        } catch {                                                            }
      });
    } catch {                                                            }
  }

  status(): UpdateStatus {
    const latestVersion = this.preferences.latestVersion;
    return {
      currentVersion: this.currentVersion, latestVersion, installation: this.install.kind,
      available: this.install.kind !== "development" && !!latestVersion &&
        gt(latestVersion, this.currentVersion) && latestVersion !== this.preferences.skippedVersion && this.state !== "installed",
      state: this.state, ...(this.error ? { error: this.error } : {}),
      ...(this.installedVersion ? { installedVersion: this.installedVersion } : {}),
    };
  }

                                                                                 
  async refreshStatus(): Promise<UpdateStatus> {
    if (this.install.kind !== "development") {
      try { this.preferences = await this.read(); } catch {                                     }
    }
    return this.status();
  }

  private offered(version: string): void {
    if (!release(version) || version !== this.status().latestVersion || !this.status().available)
      throw new Error("This version is not the offered update. Restart SystemAtlas to check again.");
  }

  async skip(version: string): Promise<void> {
    await this.refreshStatus();
    this.offered(version);
    if (this.state === "installing") throw new Error("An update is already running.");
    await withWriteLock(this.lockFile, async () => {
      this.preferences = await this.read();
      this.preferences.skippedVersion = version;
      await this.write();
    });
  }

  async update(version: string): Promise<void> {
    await this.refreshStatus();
    this.offered(version);
    if (this.state === "installing") throw new Error("An update is already running.");
    this.state = "installing";
    this.error = undefined;
    try {
      await withWriteLock(path.join(this.options.stateDir, ".update-install.lock"), async () => {
        const pkg = await readJson(path.join(this.options.packageRoot, "package.json"));
        if (typeof pkg.version === "string" && valid(pkg.version) && !gt(version, pkg.version))
          throw new Error("The installation has already changed. Restart SystemAtlas before updating.");
        const args = ["install", "--prefix", this.install.prefix!, `${BRAND.key}@${version}`,
          `--registry=${REGISTRY}`, "--no-audit", "--no-fund"];
        if (this.install.kind === "global") args.push("--global");
        else if (this.install.devDependency) args.push("--save-dev");
        await this.npm(args);
        const installed = await readJson(path.join(this.options.packageRoot, "package.json"));
        if (installed.version !== version) throw new Error("npm finished, but the requested version was not installed.");
      }, 0);
      this.installedVersion = version;
      this.state = "installed";
    } catch (e) {
      this.state = "failed";
      this.error = e instanceof Error ? e.message : String(e);
      throw e;
    }
  }
}
