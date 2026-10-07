import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Doc, docKind } from "../model";
import type { FlowDocument, SourceRef } from "../core/types";
import { getSource, type DocMeta, type McpStatus, type McpSetupResult, type McpSchema, type DirListing, type BuildResult, type UpdateApi, type SourceAction } from "./source";

                                                                                    
                                                                                   
                                                                                    
                                                                                       
                                                                                       
function pickDefaultId(metas: DocMeta[], parents: Map<string, string>, twins: Map<string, string>): string | null {
  if (!metas.length) return null;
  const byId = new Map(metas.map((m) => [m.id, m]));
  const isAttachedTwin = (m: DocMeta) => {
    if (m.kind !== "sequence" || parents.has(m.id)) return false;
    const partner = twins.get(m.id);
    return !!partner && byId.get(partner)?.kind === "flow";
  };
  const roots = metas.filter((m) => !parents.has(m.id) && !isAttachedTwin(m));
  const pool = (roots.length ? roots : metas).slice();
  pool.sort((a, b) => {
    const ga = a.category ? 1 : 0, gb = b.category ? 1 : 0;                   
    return ga - gb || (a.category ?? "").localeCompare(b.category ?? "") || (a.title || a.id).localeCompare(b.title || b.id);
  });
  return pool[0]?.id ?? null;
}

export interface FlowData {
  updates?: UpdateApi;
  flows: DocMeta[];
                                                                        
  projectName: string;
                                                                                   
  projectRoot: string;
                                                                
  canWrite: boolean;
                                                    
  recents: string[];
                                                                       
  trail: string[];
                                               
  activeId: string | null;
                                                                                    
  navigate: (id: string) => void;
                                                                        
  drillTo: (id: string) => void;
                                                                  
  goToDepth: (index: number) => void;
                                                  
  rename: (id: string, title: string) => Promise<void>;
  setCategory: (id: string, category: string) => Promise<void>;
  renameCategory: (from: string, to: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  openProject: (path: string) => Promise<void>;
                                                                            
  pickFolder: () => Promise<string | null>;
                                                                           
  listDir: (path?: string) => Promise<DirListing>;
                                                                                   
  parents: Record<string, string>;
                                                                                   
                                                                       
  twins: Record<string, string>;
                                                           
  mcp: McpStatus | null;
  setupMcp: (location: string, schema: McpSchema, dryRun?: boolean) => Promise<McpSetupResult>;
                                                                            
  build: () => Promise<BuildResult>;
                                                                  
  reveal: (target: string) => Promise<void>;
                                                                                                                 
  openSource?: (source: SourceRef, how: SourceAction) => Promise<"done" | "executable">;
  doc: Doc | null;
  error: string | null;
                                                         
  live: boolean;
}

                                                                                        
export function useFlowData(): FlowData {
  const source = useMemo(() => getSource(), []);
  const [flows, setFlows] = useState<DocMeta[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [projectRoot, setProjectRoot] = useState<string>("");
  const [recents, setRecents] = useState<string[]>([]);
                                                                           
                                                                               
  const [trail, setTrail] = useState<string[]>([]);
  const activeId = trail.length ? trail[trail.length - 1] : null;
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState<string | null>(null);

                                                                             
                                                                                    
                                                                           
  const parentsRef = useRef<Map<string, string>>(new Map());
                                                                                  
  const [parents, setParents] = useState<Record<string, string>>({});
                                                                                  
  const [twins, setTwins] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    source
      .readAll()
      .then((docs) => {
        if (!alive) return;
        const ids = new Set(docs.map((d) => d.id));
        const m = new Map<string, string>();
        const tw = new Map<string, string>();
        for (const d of docs) {
                                                                                    
          const t = d.twin;
          if (t && t !== d.id && ids.has(t)) {
            if (!tw.has(d.id)) tw.set(d.id, t);
            if (!tw.has(t)) tw.set(t, d.id);
          }
          if (docKind(d) !== "flow") continue;
          const f = d as FlowDocument;
          for (const n of f.nodes) {
            if (n.type === "subflow" && n.subflow && !m.has(n.subflow)) m.set(n.subflow, f.id);
            if (n.sequence && !m.has(n.sequence)) m.set(n.sequence, f.id);
          }
          for (const e of f.edges) {
            if (e.subflow && !m.has(e.subflow)) m.set(e.subflow, f.id);
            if (e.sequence && !m.has(e.sequence)) m.set(e.sequence, f.id);
          }
        }
        parentsRef.current = m;
        setParents(Object.fromEntries(m));
        setTwins(Object.fromEntries(tw));
                                                                               
                                                                                   
                                                              
        if (autoSelectedRef.current) {
          const top = pickDefaultId(flowsRef.current, m, tw);
          if (top) setTrail(pathTo(top));
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [source, flows.length]);

                                                                 
  const pathTo = (id: string): string[] => {
    const path = [id];
    const seen = new Set([id]);
    let p = parentsRef.current.get(id);
    while (p && !seen.has(p)) {
      path.unshift(p);
      seen.add(p);
      p = parentsRef.current.get(p);
    }
    return path;
  };

                                                                                       
  const navigate = useCallback((id: string) => {
    autoSelectedRef.current = false;
    setTrail(pathTo(id));
  }, []);
  const drillTo = useCallback((id: string) => {
    autoSelectedRef.current = false;
    setTrail((t) => (t[t.length - 1] === id ? t : [...t, id]));
  }, []);
  const goToDepth = useCallback((index: number) => {
    autoSelectedRef.current = false;
    setTrail((t) => t.slice(0, index + 1));
  }, []);

                                                                             
                                                          
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeId;
                                                                                    
  const flowsRef = useRef<DocMeta[]>(flows);
  flowsRef.current = flows;
                                                                                  
                                                                               
                                              
  const autoSelectedRef = useRef(true);

                                                                               
                                                                  
  const applyProject = useCallback((name: string, root: string, docs: DocMeta[]) => {
    setProjectName(name);
    setProjectRoot(root);
    setFlows(docs);
    setError(null);
    const ids = new Set(docs.map((d) => d.id));
    setTrail((t) => {
      const trimmed = t.filter((id) => ids.has(id));
      if (trimmed.length) return trimmed.length === t.length ? t : trimmed;
      return docs[0] ? [docs[0].id] : [];
    });
  }, []);

                             
  useEffect(() => {
    let alive = true;
    source
      .project()
      .then((p) => alive && applyProject(p.name, p.root, p.documents))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [source, applyProject]);

                          
  const refreshRecents = useCallback(() => {
    source.writes?.recents().then(setRecents).catch(() => undefined);
  }, [source]);
  useEffect(refreshRecents, [refreshRecents]);

                                        
  const [mcp, setMcp] = useState<McpStatus | null>(null);
  const refreshMcp = useCallback(() => {
    source.writes?.mcpStatus().then(setMcp).catch(() => undefined);
  }, [source]);
  useEffect(refreshMcp, [refreshMcp]);
  const setupMcp = useCallback(
    async (location: string, schema: McpSchema, dryRun?: boolean) => {
      const r = await (source.writes?.setupMcp(location, schema, dryRun) ?? Promise.reject(new Error("not available")));
      if (!dryRun) refreshMcp();
      return r;
    },
    [source, refreshMcp],
  );
  const build = useCallback(
    () => source.writes?.build() ?? Promise.reject(new Error("not available")),
    [source],
  );
  const reveal = useCallback(
    (target: string) => source.writes?.reveal(target) ?? Promise.resolve(),
    [source],
  );

                                              
  useEffect(() => {
    if (!activeId) {
      setDoc(null);
      return;
    }
    let alive = true;
    setError(null);
    source
      .read(activeId)
      .then((d) => alive && setDoc(d))
      .catch((e) => {
        if (alive) {
          setError(String(e));
          setDoc(null);
        }
      });
    return () => {
      alive = false;
    };
  }, [source, activeId]);

                                                                                
                                                                                
  useEffect(() => {
    if (!source.subscribe) return;
    return source.subscribe({
      onUpdate: (id, d) => {
        if (id === activeRef.current) setDoc(d);
        const meta: DocMeta = { id, title: d.title, kind: docKind(d), category: "" };
        setFlows((fs) =>
          fs.some((f) => f.id === id)
            ? fs.map((f) => (f.id === id ? { ...meta, category: f.category } : f))
            : [...fs, meta],
        );
        setError(null);
      },
      onError: (msg) => setError(msg),
      onProjectChanged: () => {
        source
          .project()
          .then((p) => applyProject(p.name, p.root, p.documents))
          .catch((e) => setError(String(e)));
      },
                                                                                   
                                                                                
      onDocAdded: (id, d) => {
                                                                                    
                                                                                          
        autoSelectedRef.current = false;
        setDoc(d);
        setError(null);
        source
          .project()
          .then((p) => applyProject(p.name, p.root, p.documents))
          .catch(() => undefined)
          .finally(() => setTrail((t) => (t[t.length - 1] === id ? t : [id])));
      },
    });
  }, [source, applyProject]);

                                                                                   
  const rename = useCallback(
    (id: string, title: string) => source.writes?.rename(id, title) ?? Promise.resolve(),
    [source],
  );
  const setCategory = useCallback(
    (id: string, category: string) => source.writes?.setCategory(id, category) ?? Promise.resolve(),
    [source],
  );
  const renameCategory = useCallback(
    (from: string, to: string) => source.writes?.renameCategory(from, to) ?? Promise.resolve(),
    [source],
  );
  const pickFolder = useCallback(
    () => source.writes?.pickFolder() ?? Promise.resolve(null),
    [source],
  );
  const listDir = useCallback(
    (path?: string) => source.writes?.listDir(path) ?? Promise.reject(new Error("not available")),
    [source],
  );
  const remove = useCallback(
    (id: string) => source.writes?.remove(id) ?? Promise.resolve(),
    [source],
  );
  const openProject = useCallback(
    async (path: string) => {
      if (!source.writes) return;
      const p = await source.writes.openProject(path);
      setTrail([]);                                     
      applyProject(p.name, p.root, p.documents);
      refreshRecents();
      refreshMcp();
    },
    [source, applyProject, refreshRecents, refreshMcp],
  );

  return {
    updates: source.updates,
    flows,
    projectName,
    projectRoot,
    canWrite: !!source.writes,
    recents,
    trail,
    activeId,
    navigate,
    drillTo,
    goToDepth,
    rename,
    setCategory,
    renameCategory,
    remove,
    openProject,
    pickFolder,
    listDir,
    parents,
    twins,
    mcp,
    setupMcp,
    build,
    reveal,
    openSource: source.openSource ? (ref: SourceRef, how: SourceAction) => source.openSource!(ref, how) : undefined,
    doc,
    error,
    live: !!source.subscribe,
  };
}
