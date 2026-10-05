import { defineConfig } from "tsup";

                                                                                
                                                                                
                                                                           
                                                                            
export default defineConfig({
  entry: { cli: "src/cli/index.ts", mcp: "src/mcp/server.ts" },
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  splitting: false,
  shims: false,
});
