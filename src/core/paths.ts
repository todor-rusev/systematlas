import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

                                                                                
                                                                                   
                                                                              
                                                                               
let cached: string | null = null;
function pkgRoot(): string {
  if (cached) return cached;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "package.json"))) {
      cached = dir;
      return dir;
    }
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  cached = dir;
  return dir;
}

                                                                                                      
export function pkgPath(...segments: string[]): string {
  return join(pkgRoot(), ...segments);
}
