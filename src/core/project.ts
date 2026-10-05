import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import type { ValidationResult } from "./validate";
import { type AnyDoc, docKind, validateDoc } from "./validate-doc";
import { Workspace } from "./workspace";
import { withWriteLock, writeFileAtomic } from "./write-lock";
import { BRAND, STORE_DIRS } from "../brand";

const MANIFEST = path.join(BRAND.storeDir, "project.json");                            
const WRITE_LOCK = path.join(BRAND.storeDir, ".write.lock");
const FLOW = ".flow.json";
const SEQUENCE = ".sequence.json";

   
                                                                                  
                                                                                 
                                                        
   
export function revisionOf(stored: string): string {
  return createHash("sha256").update(stored).digest("hex").slice(0, 16);
}

                                                                                    
export class RevisionConflictError extends Error {
  constructor(
    public readonly id: string,
    public readonly expected: string,
                                                  
    public readonly current: string | null,
  ) {
    super(
      current === null
        ? `"${id}" no longer exists (expected revision ${expected})`
        : `"${id}" changed since revision ${expected} (now ${current})`,
    );
  }
}

const serialize = (doc: AnyDoc) => JSON.stringify(doc, null, 2) + "\n";

export interface ManifestEntry {
  id: string;
                                                                                        
  path: string;
                                                                        
  category?: string;
}
export interface Manifest {
  version: string;
  name?: string;
  documents: ManifestEntry[];
}

export interface ProjectEntry {
  id: string;
  kind: "flow" | "sequence";
  title: string;
  category: string;                  
}

const suffixFor = (doc: AnyDoc): string => (docKind(doc) === "sequence" ? SEQUENCE : FLOW);

   
                                                                                     
                                                                                   
                                                                                    
                                                                            
   
export class Project {
  constructor(public readonly root: string) {}

  private manifestFile(): string {
    return path.join(this.root, MANIFEST);
  }

  async loadManifest(): Promise<Manifest | null> {
                                                                                
                                                         
    for (const dir of STORE_DIRS) {
      try {
        const m = JSON.parse(await fs.readFile(path.join(this.root, dir, "project.json"), "utf8")) as Manifest;
        if (Array.isArray(m?.documents)) return m;
      } catch {
                      
      }
    }
    return null;
  }

                                                    
  private async saveManifest(m: Manifest): Promise<void> {
    await writeFileAtomic(this.manifestFile(), JSON.stringify(m, null, 2) + "\n");
  }

                                                                               
  private locked<T>(work: () => Promise<T>): Promise<T> {
    return withWriteLock(path.join(this.root, WRITE_LOCK), work);
  }

                                                                                     
  private async resolvePath(id: string, m?: Manifest | null): Promise<string | null> {
    const man = m !== undefined ? m : await this.loadManifest();
    const entry = man?.documents.find((d) => d.id === id);
    if (entry) return path.resolve(this.root, entry.path);
                                                                      
    for (const base of [...STORE_DIRS.map((d) => path.join(this.root, d)), this.root]) {
      for (const sfx of [FLOW, SEQUENCE]) {
        const file = path.join(base, id + sfx);
        try {
          await fs.access(file);
          return file;
        } catch {
                    
        }
      }
    }
    return null;
  }

  private async readFile(file: string): Promise<AnyDoc> {
    return JSON.parse(await fs.readFile(file, "utf8")) as AnyDoc;
  }

  async read(id: string): Promise<AnyDoc> {
    return (await this.readWithRevision(id)).doc;
  }

                                                               
  async readWithRevision(id: string): Promise<{ doc: AnyDoc; revision: string }> {
    const file = await this.resolvePath(id);
    if (!file) throw new Error(`No document "${id}" in project`);
    const stored = await fs.readFile(file, "utf8");
    return { doc: JSON.parse(stored) as AnyDoc, revision: revisionOf(stored) };
  }

                                                           
  async readAll(): Promise<AnyDoc[]> {
    const m = await this.loadManifest();
    if (!m) return new Workspace(this.root).readAll();
    const out: AnyDoc[] = [];
    for (const e of m.documents) {
      try {
        out.push(await this.readFile(path.resolve(this.root, e.path)));
      } catch {
                  
      }
    }
    return out;
  }

                                                               
  async entries(): Promise<ProjectEntry[]> {
    const m = await this.loadManifest();
    if (!m) {
      const docs = await new Workspace(this.root).readAll();
      return docs.map((d) => ({ id: d.id, kind: docKind(d), title: d.title, category: "" }));
    }
    const out: ProjectEntry[] = [];
    for (const e of m.documents) {
      try {
        const doc = await this.readFile(path.resolve(this.root, e.path));
        out.push({ id: doc.id, kind: docKind(doc), title: doc.title, category: e.category ?? "" });
      } catch {
                          
      }
    }
    return out;
  }

  async validate(doc: AnyDoc): Promise<ValidationResult> {
    return validateDoc(doc, await this.readAll());
  }

                                                                                       
  private async ensureManifest(): Promise<Manifest> {
    const existing = await this.loadManifest();
    if (existing) return existing;
    const refs = await new Workspace(this.root).list();
    return { version: "1", documents: refs.map((r) => ({ id: r.id, path: r.rel })) };
  }

                                                                           
                                                                                 
                                                                                
                                                                               
     
                                                                                   
                                                                                   
                                                                                 
                                                                     
     
  async write(doc: AnyDoc, opts?: { category?: string; expectRevision?: string }): Promise<{ file: string; revision: string }> {
    return this.locked(async () => {
      const m = (await this.loadManifest()) ?? (await this.ensureManifest());
      return this.writeInto(m, doc, opts?.category, opts?.expectRevision);
    });
  }

  private async writeInto(m: Manifest, doc: AnyDoc, category?: string, expectRevision?: string): Promise<{ file: string; revision: string }> {
    let entry = m.documents.find((d) => d.id === doc.id);
    if (expectRevision !== undefined) {
      const at = entry ? path.resolve(this.root, entry.path) : await this.resolvePath(doc.id, m);
      const current = at ? await fs.readFile(at, "utf8").then(revisionOf, () => null) : null;
      if (current !== expectRevision) throw new RevisionConflictError(doc.id, expectRevision, current);
    }
    if (!entry) {
                                                                               
      entry = { id: doc.id, path: `${BRAND.storeDir}/${doc.id}${suffixFor(doc)}`, category };
      m.documents.push(entry);
    } else if (category !== undefined) {
      entry.category = category;
    }
    const file = path.resolve(this.root, entry.path);
    const stored = serialize(doc);
    await writeFileAtomic(file, stored);
    await this.saveManifest(m);
    return { file, revision: revisionOf(stored) };
  }

  async setCategory(id: string, category: string): Promise<void> {
    await this.locked(async () => {
      const m = await this.ensureManifest();
      const entry = m.documents.find((d) => d.id === id);
      if (!entry) throw new Error(`No document "${id}" in project`);
      entry.category = category;
      await this.saveManifest(m);
    });
  }

                                                                        
                                                     
  async renameCategory(from: string, to: string): Promise<void> {
    await this.locked(async () => {
      const m = await this.ensureManifest();
      const rewrite = (c: string): string => {
        if (c !== from && !c.startsWith(from + "/")) return c;
        const suffix = c === from ? "" : c.slice(from.length + 1);
        return [to, suffix].filter(Boolean).join("/");
      };
      for (const e of m.documents) e.category = rewrite(e.category ?? "");
      await this.saveManifest(m);
    });
  }

                                                                                    
                                                                                  
  async rename(id: string, title: string): Promise<void> {
    await this.locked(async () => {
      const { doc } = await this.readWithRevision(id);
      (doc as { title: string }).title = title;
      const m = (await this.loadManifest()) ?? (await this.ensureManifest());
      await this.writeInto(m, doc);
    });
  }

  async remove(id: string): Promise<void> {
    await this.locked(async () => {
      const file = await this.resolvePath(id);
      if (file) {
        try {
          await fs.unlink(file);
        } catch {
                            
        }
      }
      const m = await this.loadManifest();
      if (m) {
        m.documents = m.documents.filter((d) => d.id !== id);
        await this.saveManifest(m);
      }
    });
  }
}
