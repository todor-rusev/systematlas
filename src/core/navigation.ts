                                                                                  
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { STORE_DIRS } from "../brand";
import { Workspace } from "./workspace";
import { upgradeDoc } from "./flow-format";
import { docKind, validateDoc, type AnyDoc, type DocKind } from "./validate-doc";
import type { FlowDocument, FlowEdge } from "./types";

export type RelationKind = "subflow" | "sequence" | "twin";
export type Locator = { kind: "document" } | { kind: "node"; id: string; text: string } |
  { kind: "edge"; index: number; id?: string; from: string; to: string; type: FlowEdge["type"]; text?: string };
export interface DocumentLink { document: string; relation: RelationKind; source: Locator; target: string; targetKind?: DocKind; targetExists: boolean }
export interface SharedOccurrence { document: string; sharedId: string; object: Exclude<Locator, { kind: "document" }> }
export interface CatalogEntry { id: string; title: string; kind: DocKind; category: string }
export type NavigationQuery =
  | { kind: "shared"; id: string; objectKind?: "node" | "edge" }
  | { kind: "links"; document: string; direction?: "incoming" | "outgoing" | "both"; relations?: RelationKind[] };

export const digest = (text: string): string => createHash("sha256").update(text).digest("hex");
const key = (kind: string, id: string) => JSON.stringify([kind, id]);
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

interface RecordData { entry: CatalogEntry; links: DocumentLink[]; shared: SharedOccurrence[]; hash: string }

function indexDocument(doc: AnyDoc, category: string, hash: string): RecordData {
  const errors = validateDoc(doc, []).errors;
  if (errors.length) throw new Error(`Invalid document ${JSON.stringify(doc.id)}: ${errors[0].message}`);
  const links: DocumentLink[] = [], shared: SharedOccurrence[] = [];
  const link = (source: Locator, value: { subflow?: string; sequence?: string }) => {
    for (const relation of ["subflow", "sequence"] as const) {
      const target = value[relation];
      if (target) links.push({ document: doc.id, source, relation, target, targetExists: false });
    }
  };
  if (doc.twin) links.push({ document: doc.id, relation: "twin", source: { kind: "document" }, target: doc.twin, targetExists: false });
  if (docKind(doc) === "flow") {
    const flow = doc as FlowDocument;
    for (const node of flow.nodes) {
      const object: Locator = { kind: "node", id: node.id, text: node.text };
      link(object, node);
      if (node.shared) shared.push({ document: doc.id, sharedId: node.id, object });
    }
    flow.edges.forEach((edge, index) => {
      const object: Locator = { kind: "edge", index, from: edge.from, to: edge.to, type: edge.type,
        ...(edge.id ? { id: edge.id } : {}), ...(edge.text !== undefined ? { text: edge.text } : {}) };
      link(object, edge);
      if (edge.shared && edge.id) shared.push({ document: doc.id, sharedId: edge.id, object });
    });
  }
  return { entry: { id: doc.id, title: doc.title, kind: docKind(doc), category }, links, shared, hash };
}

export class NavigationIndex {
  readonly catalog: CatalogEntry[];
  readonly snapshot: string;
  private readonly documents = new Map<string, CatalogEntry>();
  private readonly incoming = new Map<string, DocumentLink[]>();
  private readonly outgoing = new Map<string, DocumentLink[]>();
  private readonly occurrences = new Map<string, SharedOccurrence[]>();

  constructor(records: RecordData[], inventoryHash = "") {
    records = [...records].sort((a, b) => compare(a.entry.id, b.entry.id));
    this.catalog = records.map(r => r.entry);
    for (const { entry } of records) {
      if (this.documents.has(entry.id)) throw new Error(`Duplicate document id ${JSON.stringify(entry.id)}`);
      this.documents.set(entry.id, entry);
    }
    this.snapshot = digest(JSON.stringify([inventoryHash, records.map(r => [r.entry, r.hash])]));
    const add = <T>(map: Map<string, T[]>, id: string, item: T) => {
      const bucket = map.get(id);
      if (bucket) bucket.push(item); else map.set(id, [item]);
    };
    for (const record of records) {
      for (const raw of record.links) {
        const target = this.documents.get(raw.target);
        const item = { ...raw, targetExists: !!target, ...(target ? { targetKind: target.kind } : {}) };
        add(this.incoming, item.target, item);
        add(this.outgoing, item.document, item);
      }
      for (const item of record.shared) add(this.occurrences, key(item.object.kind, item.sharedId), item);
    }
  }

  query(query: NavigationQuery): DocumentLink[] | SharedOccurrence[] {
    if (query.kind === "shared") {
      const kinds = query.objectKind ? [query.objectKind] : ["node", "edge"];
      return kinds.flatMap(kind => this.occurrences.get(key(kind, query.id)) ?? []);
    }
                                                                         
    const direction = query.direction ?? "both";
    const incoming = this.incoming.get(query.document) ?? [];
    const outgoing = this.outgoing.get(query.document) ?? [];
    const rows = direction === "incoming" ? incoming : direction === "outgoing" ? outgoing :
      [...outgoing, ...incoming.filter(row => row.document !== query.document)];
    return query.relations ? rows.filter(row => query.relations!.includes(row.relation)) : rows;
  }
}

export function navigationIndex(docs: AnyDoc[]): NavigationIndex {
  return new NavigationIndex(docs.map(doc => indexDocument(doc, "", digest(JSON.stringify(doc)))));
}

interface FileRef { id: string; file: string; category: string }
interface Inventory { refs: FileRef[]; hash: string }
interface CachedFile { stamp: string; data: RecordData }
interface CachedRoot { files: Map<string, CachedFile>; index?: NavigationIndex; signature?: string }

async function discover(root: string): Promise<Inventory> {
  for (const dir of STORE_DIRS) {
    let body: string;
    try { body = await fs.readFile(path.join(root, dir, "project.json"), "utf8"); }
    catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") continue; throw e; }
    const manifest = JSON.parse(body);
    if (!Array.isArray(manifest.documents)) throw new Error("Invalid project manifest: documents must be an array");
    const seen = new Set<string>();
    const refs: FileRef[] = manifest.documents.map((entry: { id: string; path: string; category?: string }) => {
      if (typeof entry.id !== "string" || typeof entry.path !== "string" ||
        (entry.category !== undefined && typeof entry.category !== "string") || seen.has(entry.id)) {
        throw new Error("Invalid project manifest: duplicate id or invalid entry");
      }
      seen.add(entry.id);
      return { id: entry.id, file: path.resolve(root, entry.path), category: entry.category ?? "" };
    });
    return { refs, hash: digest(body) };
  }
  const refs = (await new Workspace(root).list()).map(ref => ({ id: ref.id, file: path.resolve(root, ref.rel), category: "" }));
  return { refs, hash: digest(JSON.stringify(refs)) };
}

async function boundedMap<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(16, items.length) }, async () => {
    while (next < items.length) { const index = next++; results[index] = await fn(items[index]); }
  }));
  return results;
}

async function stamp(file: string): Promise<string> {
  const s = await fs.stat(file, { bigint: true });
  return [s.size, s.mtimeNs, s.ctimeNs, s.ino].join(":");
}

                                                                               
                                                                                  
                                                                                
export class ProjectNavigation {
  private readonly roots = new Map<string, CachedRoot>();
  private readonly loading = new Map<string, Promise<NavigationIndex>>();

  async load(root: string): Promise<NavigationIndex> {
    root = path.resolve(root);
    const running = this.loading.get(root);
    if (running) return running;
    const work = this.refresh(root);
    this.loading.set(root, work);
    try { return await work; } finally { this.loading.delete(root); }
  }

  private async refresh(root: string): Promise<NavigationIndex> {
    if (!(await fs.stat(root)).isDirectory()) throw new Error("Workspace must be an existing project directory");
    let cache = this.roots.get(root);
    if (!cache) cache = { files: new Map() };
    this.roots.delete(root);
    this.roots.set(root, cache);
    if (this.roots.size > 2) this.roots.delete(this.roots.keys().next().value!);
    const inventory = await discover(root);
    const initial = await boundedMap(inventory.refs, async ref => ({ ref, stamp: await stamp(ref.file) }));
    const signature = digest(JSON.stringify([inventory.hash, initial]));
    const records = await boundedMap(initial, async ({ ref, stamp: before }) => {
      const previous = cache!.files.get(ref.file);
      if (previous?.stamp === before && previous.data.entry.id === ref.id && previous.data.entry.category === ref.category) return previous.data;
      const body = await fs.readFile(ref.file, "utf8");
      const doc = upgradeDoc(JSON.parse(body) as AnyDoc);
      if (doc.id !== ref.id) throw new Error(`Document id differs from its project locator ${JSON.stringify(ref.id)}`);
      const data = indexDocument(doc, ref.category, digest(body));
      if (await stamp(ref.file) !== before) throw new Error("Workspace changed during reading; retry the query");
      cache!.files.set(ref.file, { stamp: before, data });
      return data;
    });
    const finalInventory = await discover(root);
    const finalStamps = await boundedMap(finalInventory.refs, async ref => ({ ref, stamp: await stamp(ref.file) }));
    if (digest(JSON.stringify([finalInventory.hash, finalStamps])) !== signature) throw new Error("Workspace changed during reading; retry the query");
    const livePaths = new Set(inventory.refs.map(ref => ref.file));
    for (const file of cache.files.keys()) if (!livePaths.has(file)) cache.files.delete(file);
    if (cache.signature !== signature || !cache.index) {
      cache.index = new NavigationIndex(records, inventory.hash);
      cache.signature = signature;
    }
    return cache.index;
  }
}
