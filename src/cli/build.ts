import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { Project } from "../core/project";
import type { AnyDoc as WorkspaceDoc } from "../core/validate-doc";
import { readTemplate } from "./template";
import { BRAND } from "../brand";

const SUFFIX_RE = /\.(flow|sequence)\.json$/;

export interface BuildOptions {
  target?: string;                                                                               
  out?: string;
  minify: boolean;
                                                                                 
                                                                                
  split?: boolean;
}

                                                                        
                                                                                
                                                                      
function emit(dest: string, template: string, flows: Record<string, WorkspaceDoc>, minify: boolean, categories?: Record<string, string>): void {
                                                                                        
                                                                                        
                                                                                    
                                                                    
  const payload = categories && Object.keys(categories).length ? { flows, categories } : { flows };
                                                                              
  const json = JSON.stringify(payload, null, minify ? undefined : 2).replace(/</g, "\\u003c");
  const script = `<script>window.${BRAND.globalVar}=${json}</script>`;
  const html = template.replace("</head>", `${script}\n</head>`);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, html, "utf8");
  console.log(`Built ${dest}`);
}

                                                                                   
                                                                                        
export async function buildWorkspaceHtml(dir: string, outDir: string, minify = false): Promise<{ path: string; files: number }> {
  const template = readTemplate();
  const project = new Project(dir);
  const docs = await project.readAll();
  if (docs.length === 0) throw new Error("No *.flow.json / *.sequence.json documents to build.");
  const flows = Object.fromEntries(docs.map((d) => [d.id, d]));
                                                                                          
  const entries = await project.entries();
  const categories = Object.fromEntries(entries.filter((e) => e.category).map((e) => [e.id, e.category]));
  const dest = path.join(outDir, "index.html");
  emit(dest, template, flows, minify, categories);
  return { path: dest, files: docs.length };
}

export async function runBuild(opts: BuildOptions): Promise<void> {
  const template = readTemplate();

  if (opts.target && SUFFIX_RE.test(opts.target)) {
    const doc = JSON.parse(readFileSync(opts.target, "utf8")) as WorkspaceDoc;
    const dest = opts.out ? path.join(opts.out, `${doc.id}.html`) : path.join(path.dirname(path.resolve(opts.target)), `${doc.id}.html`);
    emit(dest, template, { [doc.id]: doc }, opts.minify);
    return;
  }

  const dir = path.resolve(opts.target ?? process.cwd());
  const docs = await new Project(dir).readAll();
  if (docs.length === 0) {
    console.error(`No *.flow.json / *.sequence.json files found in ${dir}`);
    process.exit(1);
  }
  const outDir = opts.out ?? path.join(dir, "dist");

  if (opts.split) {
                                                                                  
    for (const doc of docs) emit(path.join(outDir, `${doc.id}.html`), template, { [doc.id]: doc }, opts.minify);
    return;
  }

                                                                              
  await buildWorkspaceHtml(dir, outDir, opts.minify);
}
