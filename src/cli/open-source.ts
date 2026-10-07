                                                                                    
                                                                                     
                                                                                       
                                                                                      
import { spawn } from "node:child_process";
import { constants, promises as fs } from "node:fs";
import path from "node:path";

                                                                                       
                                                                               
export async function resolveProjectFile(root: string, file: string): Promise<string> {
  const realRoot = await fs.realpath(root);
  let real: string;
  try {
    real = await fs.realpath(path.resolve(realRoot, file));
  } catch {
    throw new Error(`Source file not found in the project: ${file}`);
  }
  const relative = path.relative(realRoot, real);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Source file is outside the project: ${file}`);
  if (!(await fs.stat(real)).isFile()) throw new Error(`Source is not a file: ${file}`);
  return real;
}

                                                         
const DEFAULT_PATHEXT = ".COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC";
                                                                                         
                                                                                
const LAUNCHERS: Record<string, string[]> = {
  win32: [".lnk", ".url", ".pif", ".scr", ".msi", ".msp", ".hta", ".cpl", ".reg", ".application", ".appref-ms", ".jar", ".ps1", ".scf"],
  darwin: [".command", ".tool", ".terminal", ".workflow", ".jar"],
  linux: [".desktop", ".jar"],
};

                                                                                     
                                                                            
export async function runsWhenOpened(file: string, platform: NodeJS.Platform = process.platform, pathext = process.env.PATHEXT): Promise<boolean> {
  const ext = path.extname(file).toLowerCase();
  const launchers = LAUNCHERS[platform] ?? LAUNCHERS.linux;
  if (launchers.includes(ext)) return true;
  if (platform === "win32") return (pathext || DEFAULT_PATHEXT).toLowerCase().split(";").includes(ext);
  try {
    await fs.access(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export class ExecutableSourceError extends Error {
  constructor(file: string) {
    super(`${file} would run, not open: reveal it in the folder instead`);
  }
}

                                                                                                      
function openWithOs(target: string): void {
  const [command, args] =
    process.platform === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", target]]
    : process.platform === "darwin" ? ["open", [target]]
    : ["xdg-open", [target]];
  spawn(command, args, { detached: true, stdio: "ignore", shell: false }).unref();
}

                                                                                      
export function revealInOs(target: string): void {
  const t = path.resolve(target);
  try {
    if (process.platform === "win32") spawn("explorer", [`/select,${t}`], { detached: true, stdio: "ignore" }).unref();
    else if (process.platform === "darwin") spawn("open", ["-R", t], { detached: true, stdio: "ignore" }).unref();
    else spawn("xdg-open", [path.dirname(t)], { detached: true, stdio: "ignore" }).unref();
  } catch {
                     
  }
}

                                                                                   
export async function openSource(root: string, file: string, how: "open" | "reveal"): Promise<void> {
  const real = await resolveProjectFile(root, file);
  if (how === "reveal") return revealInOs(real);
  if (await runsWhenOpened(real)) throw new ExecutableSourceError(file);
  openWithOs(real);
}
