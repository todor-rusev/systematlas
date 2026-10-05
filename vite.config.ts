import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import browserslistToEsbuild from "browserslist-to-esbuild";

                                                                                  
                                                                            
const target = browserslistToEsbuild();

                   
                                                                   
                                                                                 
                                                                                 
                                                                               
export default defineConfig(({ mode }) => {
  const single = mode === "singlefile";
  return {
    plugins: [react(), ...(single ? [viteSingleFile()] : [])],
    build: single ? { target, outDir: "dist-renderer", emptyOutDir: true } : { target },
  };
});
