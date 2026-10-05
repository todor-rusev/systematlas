import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import os from "node:os";
import { pkgPath } from "./paths";
import { BRAND } from "../brand";

                                                                                
                                                                               
                                                       
                                                                              
                                                  
                                    
                                      
                                                                              
                                                                            
                              

export interface McpSchema {
  format: "json" | "toml";
                                                        
  key: string;
}

export interface McpSpec {
  command: string;
  args: string[];
                                                                                             
  env?: Record<string, string>;
}

                                                                               
                                                                            
                                          
const LOCAL_DEV = false;

const fwd = (p: string): string => p.replace(/\\/g, "/");
const reEscape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const home = (...segs: string[]): string => join(os.homedir(), ...segs);
const exists = (p: string): boolean => {
  try {
    return existsSync(p);
  } catch {
    return false;
  }
};

                                          
export function expandHome(p: string): string {
  return p.startsWith("~") ? resolve(os.homedir(), p.slice(1).replace(/^[\\/]/, "")) : resolve(p);
}

                                                 
function isInside(child: string, parent: string): boolean {
  const c = resolve(child);
  const p = resolve(parent);
  return c === p || c.startsWith(p.endsWith(sep) ? p : p + sep);
}

   
                                                                                   
                                                              
                                                                               
                                                                                 
                                                               
                                                                                   
                                                                             
                                                                            
   
export function mcpServerSpec(opts: { projectScoped: boolean }): McpSpec {
  const cmd: McpSpec = LOCAL_DEV
    ? { command: "node", args: [fwd(pkgPath("dist", "mcp.js"))] }
    : { command: "npx", args: ["-y", BRAND.mcpPackage] };
  return opts.projectScoped ? { ...cmd, env: { [BRAND.envScope]: "project" } } : cmd;
}

                                                                                    
                                                                                    
export function isProjectScoped(location: string, workspaceDir: string): boolean {
  return isInside(expandHome(location), resolve(workspaceDir));
}

export interface ResolveInput {
                                                                  
  callWorkspace?: string;
                                  
  envWorkspace?: string;
                                                                              
  argvWorkspace?: string;
                                                      
  scope?: string;
                       
  cwd: string;
}

export interface WorkspaceResolution {
                                                   
  root?: string;
                                                                      
  error?: string;
}

   
                                                                          
                                                                                       
                                                                                 
   
export function resolveWorkspaceRoot(i: ResolveInput): WorkspaceResolution {
  const explicit = [i.callWorkspace, i.envWorkspace, i.argvWorkspace].map((s) => s?.trim()).find(Boolean);
  if (explicit) return { root: expandHome(explicit) };
  if (i.scope === "project") return { root: resolve(i.cwd) };
  return {
    error:
      "No workspace set. Pass `workspace` = the absolute path of the project directory you are " +
      'documenting (e.g. "E:/code/my-project"). If you do not know it, ask the user where to save. ' +
      "Reuse the same path on every call.",
  };
}

const SERVER_NAME = BRAND.mcpName;

                                                                           
                                                                 
                                                                          
                                                                            
function claudeDesktopCandidates(): string[] {
  if (process.platform === "darwin") return [home("Library", "Application Support", "Claude", "claude_desktop_config.json")];
  if (process.platform !== "win32") return [home(".config", "Claude", "claude_desktop_config.json")];
  const out: string[] = [];
  const packages = home("AppData", "Local", "Packages");
  try {
    for (const d of readdirSync(packages)) {
      if (/^Claude/i.test(d)) out.push(join(packages, d, "LocalCache", "Roaming", "Claude", "claude_desktop_config.json"));
    }
  } catch {
                         
  }
  out.push(home("AppData", "Roaming", "Claude", "claude_desktop_config.json"));                     
  return out;
}

                                                                                
                                                     
function claudeDesktopPath(): string {
  const c = claudeDesktopCandidates();
  return c.find(exists) ?? c.find((p) => exists(dirname(p))) ?? c[c.length - 1];
}

                                                                               
                                                                                 
function claudeDesktopPresent(): boolean {
  if (process.platform === "win32") {
    try {
      if (readdirSync(home("AppData", "Local", "Packages")).some((d) => /^Claude/i.test(d))) return true;
    } catch {
                
    }
  }
  return claudeDesktopCandidates().some((p) => exists(p) || exists(dirname(p)));
}

interface AgentDef {
  id: string;
  label: string;
  schema: McpSchema;
  writable: boolean;                                                        
  location: (projectDir: string) => string;                                          
  detect: (projectDir: string) => boolean;                                              
                                                                            
                                                                               
  guiManaged?: boolean;
}

const JSON_MCP: McpSchema = { format: "json", key: "mcpServers" };

const REGISTRY: AgentDef[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    schema: JSON_MCP,
    writable: true,
    location: (d) => `${fwd(resolve(d))}/.mcp.json`,
    detect: (d) => exists(join(d, ".mcp.json")) || exists(home(".claude.json")) || exists(home(".claude")),
  },
  {
    id: "cursor",
    label: "Cursor",
    schema: JSON_MCP,
    writable: true,
    location: (d) => `${fwd(resolve(d))}/.cursor/mcp.json`,
    detect: (d) => exists(join(d, ".cursor")) || exists(home(".cursor")),
  },
  {
    id: "windsurf",
    label: "Windsurf",
    schema: JSON_MCP,
    writable: true,
    location: () => "~/.codeium/windsurf/mcp_config.json",
    detect: () => exists(home(".codeium", "windsurf")),
  },
  {
    id: "antigravity",
    label: "Antigravity",
    schema: JSON_MCP,                                                                     
    writable: true,
    location: () => "~/.gemini/antigravity/mcp_config.json",
    detect: () => exists(home(".gemini", "antigravity")),
  },
  {
    id: "vscode",
    label: "VS Code",
    schema: { format: "json", key: "servers" },
    writable: true,
    location: (d) => `${fwd(resolve(d))}/.vscode/mcp.json`,
    detect: (d) => exists(join(d, ".vscode")),
  },
  {
    id: "codex",
    label: "Codex",
    schema: { format: "toml", key: "mcp_servers" },
    writable: true,
    location: () => "~/.codex/config.toml",
    detect: () => exists(home(".codex")),
  },
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    schema: JSON_MCP,
    writable: true,                                                                       
    location: () => fwd(claudeDesktopPath()),
    detect: () => claudeDesktopPresent(),
    guiManaged: true,                                                            
  },
  {
    id: "zed",
    label: "Zed",
    schema: { format: "json", key: "context_servers" },
    writable: true,                                                                  
    location: () => (process.platform === "win32" ? fwd(home("AppData", "Roaming", "Zed", "settings.json")) : "~/.config/zed/settings.json"),
    detect: () => exists(home(".config", "zed")) || exists(home("AppData", "Roaming", "Zed")) || exists(home(".zed")),
  },
];

                                                       
export interface AgentInfo {
  id: string;
  label: string;
  location: string;
  schema: McpSchema;
  present: boolean;
  writable: boolean;
                                                         
  configured: boolean;
                                                                              
  guiManaged: boolean;
}

                                                                                  
                                                                                
export function detectAgents(projectDir: string): AgentInfo[] {
  return REGISTRY.map((a) => {
    const location = a.location(projectDir);
    const configured = isFlowTraceConfigured(expandHome(location), a.schema);
    return { id: a.id, label: a.label, location, schema: a.schema, present: a.detect(projectDir), writable: a.writable, configured, guiManaged: !!a.guiManaged };
  });
}

                                                                                 

function renderToml(schema: McpSchema, spec: McpSpec): string {
  const args = spec.args.map((a) => `'${a}'`).join(", ");
  let out = `[${schema.key}.${SERVER_NAME}]\ncommand = '${spec.command}'\nargs = [${args}]`;
  if (spec.env && Object.keys(spec.env).length) {
    const env = Object.entries(spec.env).map(([k, v]) => `${k} = '${v}'`).join(", ");
    out += `\nenv = { ${env} }`;
  }
  return out;
}

                                                                           
export function snippetFor(schema: McpSchema, spec: McpSpec): string {
  if (schema.format === "toml") return renderToml(schema, spec);
  return JSON.stringify({ [schema.key]: { [SERVER_NAME]: spec } }, null, 2);
}

function renderFull(schema: McpSchema, spec: McpSpec): string {
  return snippetFor(schema, spec) + "\n";
}

function appendBlock(content: string, block: string): string {
  const trimmedRight = content.replace(/\s*$/, "");
  return (trimmedRight ? `${trimmedRight}\n\n` : "") + block + "\n";
}

                                                                                    
export function hasFlowTrace(content: string, schema: McpSchema): boolean {
  if (schema.format === "toml") return new RegExp(`^\\s*\\[${reEscape(schema.key)}\\.${reEscape(SERVER_NAME)}\\]\\s*(?:#.*)?$`, "m").test(content);
  try {
    const obj = JSON.parse(content) as Record<string, Record<string, unknown> | undefined>;
    return !!obj[schema.key] && Object.prototype.hasOwnProperty.call(obj[schema.key], SERVER_NAME);
  } catch {
    return new RegExp(`"${SERVER_NAME}"\\s*:`).test(content);
  }
}

                                                                            
                                                                                   
                                                                                       
function isFlowTraceConfigured(absLocation: string, schema: McpSchema): boolean {
  try {
    return hasFlowTrace(readFileSync(absLocation, "utf8"), schema);
  } catch {
    return false;
  }
}

export type SetupStatus = "written" | "merged" | "already" | "conflict";
export interface SetupResult {
  status: SetupStatus;
  path: string;
  snippet: string;
}

export interface SetupInput {
  location: string;
  schema: McpSchema;
  workspaceDir: string;
                                                                                  
  dryRun?: boolean;
}

   
                                                                
                                                      
                                                          
                                                            
   
export function setupMcp(input: SetupInput): SetupResult {
  const path = expandHome(input.location);
                                                                           
                                                                                    
  const projectScoped = isProjectScoped(input.location, input.workspaceDir);
  const spec = mcpServerSpec({ projectScoped });
  const snippet = snippetFor(input.schema, spec);

  if (input.dryRun) return { status: "conflict", path, snippet };

  if (!exists(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, renderFull(input.schema, spec), "utf8");
    return { status: "written", path, snippet };
  }

  const content = readFileSync(path, "utf8");
  if (hasFlowTrace(content, input.schema)) return { status: "already", path, snippet };

  if (input.schema.format === "json") {
    let obj: Record<string, Record<string, unknown>>;
    try {
      obj = JSON.parse(content);
    } catch {
      return { status: "conflict", path, snippet };
    }
    obj[input.schema.key] = { ...(obj[input.schema.key] ?? {}), [SERVER_NAME]: spec };
    writeFileSync(path, JSON.stringify(obj, null, 2) + "\n", "utf8");
    return { status: "merged", path, snippet };
  }

  writeFileSync(path, appendBlock(content, snippet), "utf8");
  return { status: "merged", path, snippet };
}

                                                                                           
export function detectConfigured(projectDir: string): { configured: boolean; path?: string } {
  const candidates: Array<{ p: string; s: McpSchema }> = [
    { p: resolve(projectDir, ".mcp.json"), s: JSON_MCP },
    { p: resolve(projectDir, ".cursor", "mcp.json"), s: JSON_MCP },
    { p: resolve(projectDir, ".vscode", "mcp.json"), s: { format: "json", key: "servers" } },
  ];
  for (const c of candidates) {
    try {
      if (existsSync(c.p) && hasFlowTrace(readFileSync(c.p, "utf8"), c.s)) return { configured: true, path: c.p };
    } catch {
                
    }
  }
  return { configured: false };
}
