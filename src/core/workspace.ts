import { promises as fs } from "node:fs";
import path from "node:path";
import type { ValidationResult } from "./validate";
import { type AnyDoc, type DocKind, docKind, validateDoc } from "./validate-doc";
import { STORE_DIRS } from "../brand";
import { upgradeDoc } from "./flow-format";

const FLOW = ".flow.json";
const SEQUENCE = ".sequence.json";

export type WorkspaceDoc = AnyDoc;
export { docKind };
export type { DocKind };

export interface DocRef {
  id: string;
  kind: DocKind;
                                                                                             
  rel: string;
}

                                                                               
export class Workspace {
  constructor(public readonly dir: string) {}

  private suffix(kind: DocKind): string {
    return kind === "sequence" ? SEQUENCE : FLOW;
  }

                                                                                
                                                                        
  async list(): Promise<DocRef[]> {
    const seen = new Map<string, DocRef>();
                                                                                    
    for (const base of [...STORE_DIRS, "."]) {
      const abs = base === "." ? this.dir : path.join(this.dir, base);
      let entries: string[];
      try {
        entries = await fs.readdir(abs);
      } catch {
        continue;
      }
      for (const f of entries) {
        let kind: DocKind | null = null;
        let id = "";
        if (f.endsWith(SEQUENCE)) {
          kind = "sequence";
          id = f.slice(0, -SEQUENCE.length);
        } else if (f.endsWith(FLOW)) {
          kind = "flow";
          id = f.slice(0, -FLOW.length);
        }
        if (kind && !seen.has(id)) seen.set(id, { id, kind, rel: base === "." ? f : `${base}/${f}` });
      }
    }
    return [...seen.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

                                                                                  
                                                          
  private async resolve(id: string): Promise<{ file: string; kind: DocKind } | null> {
    for (const base of [...STORE_DIRS.map((d) => path.join(this.dir, d)), this.dir]) {
      for (const kind of ["flow", "sequence"] as DocKind[]) {
        const file = path.join(base, id + this.suffix(kind));
        try {
          await fs.access(file);
          return { file, kind };
        } catch {
                        
        }
      }
    }
    return null;
  }

  async exists(id: string): Promise<boolean> {
    return (await this.resolve(id)) !== null;
  }

                                                                                        
  async read(id: string): Promise<WorkspaceDoc> {
    const r = await this.resolve(id);
    if (!r) throw new Error(`No document "${id}" in workspace`);
    return upgradeDoc(JSON.parse(await fs.readFile(r.file, "utf8")) as WorkspaceDoc);
  }

                                                                      
  async readAll(): Promise<WorkspaceDoc[]> {
    const refs = await this.list();
    const docs: WorkspaceDoc[] = [];
    for (const ref of refs) {
      try {
        docs.push(await this.read(ref.id));
      } catch {
                              
      }
    }
    return docs;
  }

                                                                                 
  async write(doc: WorkspaceDoc): Promise<string> {
    await fs.mkdir(this.dir, { recursive: true });
    const dest = path.join(this.dir, doc.id + this.suffix(docKind(doc)));
    await fs.writeFile(dest, JSON.stringify(doc, null, 2) + "\n", "utf8");
    return dest;
  }

                                                                                      
  async validate(doc: WorkspaceDoc): Promise<ValidationResult> {
    return validateDoc(doc, await this.readAll());
  }
}
