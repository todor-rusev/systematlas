import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import tseslint from "typescript-eslint";
import css from "@eslint/css";
import baselineJs from "eslint-plugin-baseline-js";
import reactHooks from "eslint-plugin-react-hooks";

                                                                                      
                                                                                  
                                                                                                
                                                                                                     

const root = import.meta.dirname;

                                                                                  
                                                                                   
function rendererFiles(entry) {
  const options = { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, allowJs: true };
  const seen = new Set(), pending = [path.join(root, entry)];
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (file.endsWith(".css")) continue;
    for (const { fileName } of ts.preProcessFile(readFileSync(file, "utf8"), true, true).importedFiles) {
      if (!fileName.startsWith(".")) continue;
      const asset = path.resolve(path.dirname(file), fileName);
      const resolved = ts.resolveModuleName(fileName, file, options, ts.sys).resolvedModule?.resolvedFileName;
      if (resolved && !resolved.endsWith(".d.ts")) pending.push(path.normalize(resolved));
      else if (asset.endsWith(".css") && existsSync(asset)) pending.push(asset);
    }
  }
  return [...seen].map(file => path.relative(root, file).split(path.sep).join("/"));
}

const renderer = rendererFiles("src/main.tsx");

export default [
  {
    ignores: ["dist/**", "dist-renderer/**", "docs/**", "demo/**", "artifacts/**", "node_modules/**"],
  },
  {
    files: renderer.filter(file => !file.endsWith(".css")),
    languageOptions: {
      parser: tseslint.parser,
                                                                                             
      parserOptions: { projectService: true, tsconfigRootDir: root },
    },
    linterOptions: { reportUnusedDisableDirectives: "off" },
                                                                                                      
    plugins: { "baseline-js": baselineJs, "react-hooks": reactHooks },
    rules: {
      "baseline-js/use-baseline": ["error", {
        available: "widely",
        includeWebApis: { preset: "type-aware" },
        includeJsBuiltins: { preset: "type-aware" },
        ignoreFeatures: [
                                                                                          
                                                                         
          "async-clipboard",
                                                                                          
          "execcommand",
                                                                                                
          "functions-caller-arguments",
        ],
      }],
    },
  },
  {
    files: renderer.filter(file => file.endsWith(".css")),
    language: "css/css",
    plugins: { css },
    rules: {
      "css/use-baseline": ["error", {
        available: "widely",
                                                                                         
        allowSelectors: ["selection"],
      }],
    },
  },
];
