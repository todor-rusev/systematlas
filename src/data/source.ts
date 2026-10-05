                                                                                  
                                                         
                                                                      
                                                                     
                                                                   
                                                                
  
                                                                         
                                                                                  
import { type Doc, type DocKind, docKind } from "../model";
import { BRAND } from "../brand";
import txn from "../../examples/transaction-create.flow.json";
import txnSeq from "../../examples/transaction-create-seq.sequence.json";
import refund from "../../examples/refund.flow.json";
import paymentCharge from "../../examples/payment-charge.flow.json";
import chargeSequence from "../../examples/charge-sequence.sequence.json";
import checkoutSequence from "../../examples/checkout-sequence.sequence.json";
import visualStyle from "../../examples/visual-style.flow.json";
import visualCatalog from "../../examples/visual-catalog.flow.json";
import multilingual from "../../examples/multilingual.flow.json";
import { visualDemoDocs } from "./visual-demo";
import type { UpdateApiStatus } from "../core/update-types";

export interface UpdateApi {
  status(): Promise<UpdateApiStatus>;
  install(version: string, token: string): Promise<void>;
  skip(version: string, token: string): Promise<void>;
}

export interface DocMeta {
  id: string;
  title: string;
  kind: DocKind;
                                                                   
  category: string;
}

export interface ProjectInfo {
  name: string;
  root: string;
  documents: DocMeta[];
}

                                               
export interface LiveHandlers {
  onUpdate: (id: string, doc: Doc) => void;
  onError: (msg: string) => void;
                                                                                     
  onProjectChanged?: () => void;
                                                                                  
  onDocAdded?: (id: string, doc: Doc) => void;
}

                                   
export interface McpSchema {
  format: "json" | "toml";
  key: string;
}
export interface McpAgent {
  id: string;
  label: string;
  location: string;
  schema: McpSchema;
                                                    
  present: boolean;
                                                                
  writable: boolean;
                                                         
  configured: boolean;
                                                                              
  guiManaged: boolean;
}

export interface DirListing {
  path: string;
  parent: string | null;
  dirs: string[];
}
export interface McpStatus {
  configured: boolean;
  path?: string;
  agents: McpAgent[];
}
export interface McpSetupResult {
  status: "written" | "merged" | "already" | "conflict";
  path: string;
  snippet: string;
}
export interface BuildResult {
                                                            
  path: string;
                                          
  files: number;
}

                                                                        
export interface ProjectWrites {
  save(doc: Doc): Promise<void>;
  rename(id: string, title: string): Promise<void>;
  setCategory(id: string, category: string): Promise<void>;
  renameCategory(from: string, to: string): Promise<void>;
  remove(id: string): Promise<void>;
  openProject(path: string): Promise<ProjectInfo>;
  recents(): Promise<string[]>;
                                                                                    
  pickFolder(): Promise<string | null>;
                                                                                       
  listDir(path?: string): Promise<DirListing>;
                                                                          
  mcpStatus(): Promise<McpStatus>;
                                                                                       
  setupMcp(
    location: string,
    schema: McpSchema,
    dryRun?: boolean,
  ): Promise<McpSetupResult>;
                                                                                     
  build(): Promise<BuildResult>;
                                                                          
  reveal(target: string): Promise<void>;
}

export interface FlowSource {
                                                             
  project(): Promise<ProjectInfo>;
  list(): Promise<DocMeta[]>;
  read(id: string): Promise<Doc>;
                                                                                        
  readAll(): Promise<Doc[]>;
                                                              
  subscribe?(handlers: LiveHandlers): () => void;
                                     
  writes?: ProjectWrites;
                                                                                    
  updates?: UpdateApi;
}

                                                                            
                                                                                     
                                                                                     
type EmbeddedData = {
  flows: Record<string, Doc>;
  categories?: Record<string, string>;
};
function embeddedData(): EmbeddedData | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as Record<string, EmbeddedData | undefined>)[BRAND.globalVar];
}

function metaOf(docs: Doc[], categories?: Record<string, string>): DocMeta[] {
  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    kind: docKind(d),
    category: categories?.[d.id] ?? "",
  }));
}

                                                                                  
function readOnlySource(
  flows: Record<string, Doc>,
  name: string,
  categories?: Record<string, string>,
): FlowSource {
  const docs = () => Object.values(flows);
  return {
    async project() {
      return { name, root: "", documents: metaOf(docs(), categories) };
    },
    async list() {
      return metaOf(docs(), categories);
    },
    async read(id) {
      const doc = flows[id];
      if (!doc) throw new Error(`No embedded document "${id}"`);
      return doc;
    },
    async readAll() {
      return docs();
    },
  };
}

                                                                                  
function devSource(): FlowSource {
  const docs = [
    txn,
    txnSeq,
    refund,
    paymentCharge,
    chargeSequence,
    checkoutSequence,
    visualStyle,
    visualCatalog,
    multilingual,
    ...visualDemoDocs,
  ] as unknown as Doc[];
  const flows: Record<string, Doc> = {};
  for (const d of docs) flows[d.id] = d;
  return readOnlySource(flows, "Examples");
}

                                                                                  
function serveSource(): FlowSource {
  const getJson = async <T>(url: string): Promise<T> => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url} ${r.status}`);
    return (await r.json()) as T;
  };
  const send = async (
    url: string,
    method: string,
    body?: unknown,
  ): Promise<void> => {
    const r = await fetch(url, {
      method,
      headers:
        body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      const err = await r.json().catch(() => null);
      throw new Error(
        (err as { error?: string })?.error ?? `${url} ${r.status}`,
      );
    }
  };
  return {
    updates: {
      status: () => getJson<UpdateApiStatus>("/api/update"),
      install: (version, token) => send("/api/update/install", "POST", { version, token }),
      skip: (version, token) => send("/api/update/skip", "POST", { version, token }),
    },
    project() {
      return getJson<ProjectInfo>("/api/project");
    },
    async list() {
      return (await getJson<ProjectInfo>("/api/project")).documents;
    },
    read(id) {
      return getJson<Doc>(`/api/flow/${encodeURIComponent(id)}`);
    },
    async readAll() {
      const { documents } = await getJson<ProjectInfo>("/api/project");
      return Promise.all(
        documents.map((m) =>
          getJson<Doc>(`/api/flow/${encodeURIComponent(m.id)}`),
        ),
      );
    },
    subscribe({ onUpdate, onError, onProjectChanged, onDocAdded }) {
      const es = new EventSource("/api/events");
      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as
            | { type: "flow-updated"; id: string; doc: Doc }
            | { type: "doc-added"; id: string; doc: Doc }
            | { type: "project-changed" }
            | { type: "error"; message: string };
          if (msg.type === "flow-updated") onUpdate(msg.id, msg.doc);
          else if (msg.type === "doc-added") onDocAdded?.(msg.id, msg.doc);
          else if (msg.type === "project-changed") onProjectChanged?.();
          else if (msg.type === "error") onError(msg.message);
        } catch {
                                      
        }
      };
      return () => es.close();
    },
    writes: {
      save(doc) {
        return send(`/api/doc/${encodeURIComponent(doc.id)}`, "PUT", doc);
      },
      rename(id, title) {
        return send(`/api/doc/${encodeURIComponent(id)}/rename`, "POST", {
          title,
        });
      },
      setCategory(id, category) {
        return send(`/api/doc/${encodeURIComponent(id)}/category`, "POST", {
          category,
        });
      },
      renameCategory(from, to) {
        return send("/api/category/rename", "POST", { from, to });
      },
      remove(id) {
        return send(`/api/doc/${encodeURIComponent(id)}`, "DELETE");
      },
      async openProject(path) {
        const r = await fetch("/api/open-project", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        });
        const data = await r.json().catch(() => null);
        if (!r.ok)
          throw new Error(
            (data as { error?: string })?.error ?? `open-project ${r.status}`,
          );
        return data as ProjectInfo;
      },
      recents() {
        return getJson<string[]>("/api/recents");
      },
      async pickFolder() {
        const r = await fetch("/api/pick-folder", { method: "POST" });
        if (!r.ok) return null;
        return ((await r.json()) as { path: string | null }).path;
      },
      listDir(path) {
        return getJson<DirListing>(
          `/api/list-dir${path ? `?path=${encodeURIComponent(path)}` : ""}`,
        );
      },
      mcpStatus() {
        return getJson<McpStatus>("/api/mcp-status");
      },
      async setupMcp(location, schema, dryRun) {
        const r = await fetch("/api/setup-mcp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ location, schema, dryRun }),
        });
        const data = await r.json().catch(() => null);
        if (!r.ok)
          throw new Error(
            (data as { error?: string })?.error ?? `setup-mcp ${r.status}`,
          );
        return data as McpSetupResult;
      },
      async build() {
        const r = await fetch("/api/build", { method: "POST" });
        const data = await r.json().catch(() => null);
        if (!r.ok)
          throw new Error(
            (data as { error?: string })?.error ?? `build ${r.status}`,
          );
        return data as BuildResult;
      },
      reveal(target) {
        return send("/api/reveal", "POST", { path: target });
      },
    },
  };
}

export function getSource(): FlowSource {
  const data = embeddedData();
  if (data) {
    return readOnlySource(data.flows, BRAND.display, data.categories);
  }
  if (import.meta.env.DEV) return devSource();
  return serveSource();
}
