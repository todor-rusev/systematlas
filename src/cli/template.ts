import { readFileSync } from "node:fs";
import { pkgPath } from "../core/paths";

                                                                              
                                                                            
export function readTemplate(): string {
  try {
    return readFileSync(pkgPath("dist-renderer", "index.html"), "utf8");
  } catch {
    throw new Error("Renderer bundle not found (dist-renderer/index.html). Run: npm run build:renderer");
  }
}
