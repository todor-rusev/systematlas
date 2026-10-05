import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Background,
  BackgroundVariant,
  getNodesBounds,
  getViewportForBounds,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  useStore,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  docKind,
  type Actor,
  type DrillOrigin,
  type FlowDocument,
  type FlowEdge,
  type FlowNode,
  type NodeData,
  type NodeType,
  type SequenceCall,
  type SequenceDocument,
} from "./model";
import { buildActorColors, FLOW_LABEL, NEUTRAL, type ActorColors } from "./theme";
import { buildGraph, DIMS, edgeKey, FLOW_SPACING } from "./layout";
import { nodeTypes } from "./nodes";
import { edgeTypes } from "./edges";
import { SequenceCanvas, flattenCalls } from "./sequence/SequenceCanvas";
import { SEQ, seqWidth } from "./sequence/geometry";
import { reuseGroups } from "./sequence/reuse";
import { tokens } from "./tokens";
import { useFlowData } from "./data/useFlowData";
import type { McpStatus } from "./data/source";
import { BRAND } from "./brand";
import { TopBar, type Crumb } from "./shell/TopBar";
import { Sidebar } from "./shell/Sidebar";
import { OverviewBar } from "./shell/OverviewBar";
import { DetailPanel, type ActorView } from "./shell/DetailPanel";
import { copyText } from "./shell/clipboard";
import { ErrorBoundary } from "./shell/ErrorBoundary";
import { UpdateDialog } from "./shell/UpdateDialog";
import {
  IconArrowDiagonal,
  IconFitCorners,
  IconMinus,
  IconPanels,
  IconPlus,
} from "./shell/icons";
import type { VisualMode } from "./visual-geometry";
import { actorTone, actorBaseColors, DEFAULT_PRESET, VISUAL_PRESETS, type PresetName, type VisualTokens } from "./visual-tokens";

const VISUAL_MODE_KEY = "systematlas.flow-visual-mode";
function initialVisualMode(): VisualMode {
  try {
    return localStorage.getItem(VISUAL_MODE_KEY) === "classic"
      ? "classic"
      : "actors";
  } catch {
    return "actors";
  }
}

type Selection =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }
  | { kind: "call"; id: string }
  | { kind: "actor"; id: string }
  | null;

function FlowBackground({ classic, canvas }: { classic: boolean; canvas: VisualTokens["canvas"] }) {
  const zoom = useStore(state => state.transform[2]);
  if (classic) return <Background variant={BackgroundVariant.Lines} gap={tokens.grid} size={1} color={tokens.color.gridLine} />;
  if (canvas.grid === "none") return null;
                                                                              
                                                                            
  const stride = 2 ** Math.max(0, Math.ceil(Math.log2(0.5 / zoom)));
  return <Background variant={BackgroundVariant.Dots} gap={canvas.gridSize * stride} size={canvas.gridDotSize / zoom} offset={canvas.gridDotSize / (2 * zoom)} color={canvas.gridColor} />;
}

                                                                                   
                                                                             
function legendExtent(root: HTMLElement): { right: number; bottom: number } | null {
  const legend = root.querySelector<HTMLElement>(".ft-actor-legend");
  if (!legend) return null;
  let left = 0, top = 0;
  for (let el: HTMLElement | null = legend; el && el !== root; el = el.offsetParent as HTMLElement | null) {
    left += el.offsetLeft;
    top += el.offsetTop;
  }
  return { right: left + legend.offsetWidth, bottom: top + legend.offsetHeight };
}

                                                                                
                                                                                   
                                                                
function useFitScene() {
  const { getNodes, setViewport } = useReactFlow();
  const domNode = useStore(state => state.domNode);
  const width = useStore(state => state.width);
  const height = useStore(state => state.height);
  return useCallback((duration = 0) => {
    if (!width || !height) return;
    const bounds = getNodesBounds(getNodes());
    const frame = (left: number, top: number) => {
      const viewport = getViewportForBounds(bounds, width - left, height - top, 0.2, 1, 0.18);
      return { ...viewport, x: viewport.x + left, y: viewport.y + top };
    };
    const legend = domNode ? legendExtent(domNode) : null;
    let viewport = frame(0, 0);
    if (legend) {
      const gap = 12;
      const beside = frame(legend.right + gap, 0);
      const below = frame(0, legend.bottom + gap);
      viewport = beside.zoom >= below.zoom ? beside : below;
    }
    void setViewport(viewport, { duration });
  }, [domNode, width, height, getNodes, setViewport]);
}

                                                                                              
function InitialFlowFit({ fontsReady }: { fontsReady: boolean }) {
                                                                                    
                                                                                       
  const initialized = useNodesInitialized({ includeHiddenNodes: true });
  const { viewportInitialized } = useReactFlow();
  const width = useStore(state => state.width);
  const height = useStore(state => state.height);
  const fitScene = useFitScene();
                                                                                  
                                                                              
  const fitted = useRef(false);
  useEffect(() => {
    if (!fontsReady || !initialized || !viewportInitialized || !width || !height || fitted.current) return;
    fitted.current = true;
    fitScene();
  }, [fontsReady, initialized, viewportInitialized, width, height, fitScene]);
  return null;
}

function Legend({
  actors,
  colors,
  activeId,
  onSelect,
  modern = false,
}: {
  actors: Actor[];
  colors: ActorColors;
  activeId: string | null;
  onSelect: (id: string) => void;
  modern?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (actors.length === 0) return null;
  return (
    <div
      className="ft-actor-legend"
      style={{
        background: modern ? "#ffffff" : "#FFFDF8",
        border: `1px solid ${tokens.color.border}`,
        borderRadius: modern ? (collapsed ? 14 : 18) : 10,
        padding: collapsed ? "4px 5px 4px 7px" : "8px 8px 6px",
        boxShadow: "0 1px 3px rgba(0,0,0,.06)",
        fontSize: 12,
        display: "grid",
        gridTemplateColumns: "1fr auto",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          gridColumn: collapsed ? "1" : "1 / -1",
          alignSelf: "center",
          padding: collapsed ? "1px 2px" : "3px 4px",
          marginBottom: collapsed ? 0 : 6,
        }}
      >
        Actors{collapsed ? ` (${actors.length})` : ""}
      </div>
      {!collapsed ? (
        <div
          style={{
            gridColumn: "1 / -1",
            maxHeight: "min(50vh, 360px)",
            maxWidth: 320,
            overflowY: "auto",
          }}
        >
          {actors.map((a) => {
            const active = a.id === activeId;
            return (
              <button
                key={a.id}
                onClick={() => onSelect(a.id)}
                title={`Highlight all ${a.label} steps`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  width: "100%",
                  padding: "4px 6px",
                  border: "none",
                  borderRadius: 7,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 12,
                  textAlign: "left",
                  background: active ? `${colors[a.id]}22` : "transparent",
                  color: "#4a463d",
                  fontWeight: active ? 700 : 500,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: colors[a.id],
                    display: "inline-block",
                    flex: "0 0 auto",
                  }}
                />
                {a.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <button
        className="ft-quiet"
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand Actors" : "Minimize Actors"}
        title={collapsed ? "Expand Actors" : "Minimize Actors"}
        onClick={() => setCollapsed((v) => !v)}
        style={{
          gridColumn: 2,
          gridRow: collapsed ? 1 : 3,
          justifySelf: "end",
          alignSelf: "end",
          width: 18,
          height: 18,
          padding: 0,
          marginTop: collapsed ? 0 : 2,
          borderRadius: 6,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "flex",
            transform: collapsed ? "rotate(180deg)" : undefined,
          }}
        >
          <IconArrowDiagonal size={11} />
        </span>
      </button>
    </div>
  );
}

function ZoomControls({ panelsCollapsed, onTogglePanels }: {
  panelsCollapsed: boolean;
  onTogglePanels: () => void;
}) {
  const { zoomIn, zoomOut } = useReactFlow();
  const fitScene = useFitScene();
  const btn: React.CSSProperties = {
    width: 36,
    height: 34,
    borderBottom: `1px solid ${tokens.color.borderSoft}`,
  };
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#FFFFFF",
        border: `1px solid ${tokens.color.border}`,
        borderRadius: 10,
        boxShadow: "0 2px 8px rgba(74,60,30,0.06)",
        overflow: "hidden",
      }}
    >
      <button
        className="ft-zoombtn"
        style={btn}
        title="Zoom in"
        onClick={() => zoomIn({ duration: 200 })}
      >
        <IconPlus size={16} />
      </button>
      <button
        className="ft-zoombtn"
        style={btn}
        title="Zoom out"
        onClick={() => zoomOut({ duration: 200 })}
      >
        <IconMinus size={16} />
      </button>
      <button
        className="ft-zoombtn"
        style={btn}
        title="Fit to view"
        onClick={() => fitScene(300)}
      >
        <IconFitCorners size={15} />
      </button>
      <button
        className="ft-zoombtn"
        style={{ width: 36, height: 34 }}
        title={panelsCollapsed ? "Restore panels" : "Collapse all panels"}
        aria-label={panelsCollapsed ? "Restore panels" : "Collapse all panels"}
        aria-pressed={panelsCollapsed}
        onClick={onTogglePanels}
      >
        <IconPanels size={16} collapsed={panelsCollapsed} />
      </button>
    </div>
  );
}

function Banner({ text }: { text: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10,
        maxWidth: "70%",
        background: "#FBEAE7",
        border: "1px solid #E7B7AE",
        color: "#8C3B2B",
        borderRadius: 10,
        padding: "8px 14px",
        fontSize: 13,
        boxShadow: "0 2px 8px rgba(74,60,30,0.08)",
      }}
    >
      {text}
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: tokens.color.muted,
        fontSize: 14,
      }}
    >
      {text}
    </div>
  );
}

                                                                              
                                                                                 
                                                                               
                                             
function EmptyState({
  mcp,
  projectRoot,
}: {
  mcp: McpStatus | null;
  projectRoot: string;
}) {
  const [copied, setCopied] = useState(false);
  const wrap = (children: ReactNode) => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 480,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {children}
      </div>
    </div>
  );
  const title = (t: string) => (
    <div style={{ fontSize: 16, fontWeight: 700, color: tokens.color.text }}>
      {t}
    </div>
  );
  const body = (t: ReactNode) => (
    <div style={{ fontSize: 13, color: tokens.color.muted, lineHeight: 1.55 }}>
      {t}
    </div>
  );

                                                            
  if (!mcp)
    return wrap(
      <>
        {title("No documents yet")}
        {body(
          `This is a static export — open the project with ${BRAND.cli} serve to author documents.`,
        )}
      </>,
    );

  const agents = mcp.agents ?? [];
  const desktop = agents.find((a) => a.id === "claude-desktop");
  const projectConfigured = mcp.configured;
  const anyConfigured = projectConfigured || agents.some((a) => a.configured);

                                            
  if (!anyConfigured) {
    return desktop?.present
      ? wrap(
          <>
            {title("Claude Desktop detected — connect it to start")}
            {body(
              <>
                It's installed but not wired to this project yet. Open{" "}
                <b>Connect agent (MCP)</b> in the sidebar to add it (or another
                agent). {BRAND.display} documents are authored by your AI agent.
              </>,
            )}
          </>,
        )
      : wrap(
          <>
            {title("Connect an agent to start")}
            {body(
              <>
                {BRAND.display} documents are authored by an AI agent over MCP.
                Open <b>Connect agent (MCP)</b> in the sidebar to wire one up.
              </>,
            )}
          </>,
        );
  }

                                                                                 
  const desktopOnly = !projectConfigured && !!desktop?.configured;
  const prompt = `Use ${BRAND.display} to draw a Flow (and a Sequence where the exact calls matter) of how [the part you want to understand] works, and save it in ${projectRoot ? `this project (${projectRoot})` : "this project"}.`;
  return wrap(
    <>
      {desktopOnly
        ? body(
            <>
              <span style={{ color: "#3d7c52" }}>
                ✓ Connected via Claude Desktop.
              </span>{" "}
              Need another agent? Use <b>Connect agent (MCP)</b>.
            </>,
          )
        : null}
      {title("No documents yet")}
      {body("Ask your agent to author one — for example:")}
      <pre
        style={{
          textAlign: "left",
          background: tokens.color.field,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: 8,
          padding: "10px 12px",
          fontSize: 12,
          fontFamily: tokens.font.mono,
          whiteSpace: "pre-wrap",
          margin: 0,
          color: tokens.color.text,
          userSelect: "text",
          cursor: "text",
        }}
      >
        {prompt}
      </pre>
      <button
        className="ft-recent"
        style={{ justifyContent: "center" }}
        onClick={async () => {
          const ok = await copyText(prompt);
          if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
      >
        {copied ? "Copied ✓" : "Copy prompt"}
      </button>
      {body(
        <>
          Tip: ask for a <b>Flow</b> (high-level map) or a <b>Sequence</b>{" "}
          (exact call-by-call trace). The agent saves it under{" "}
          <code>{BRAND.storeDir}/</code> and it appears here automatically.
        </>,
      )}
    </>,
  );
}

                                                                              
                                                                              
                                       
const ZOOM_MS = 215;
const easeIn = (t: number) => t * t * t;                            
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);                            

type Pt = { x: number; y: number };

                                                                                
                                                                             
function tweenViewport(
  inst: ReactFlowInstance,
  rect: DOMRect,
  cx: number,
  cy: number,
  targetZoom: number,
  ease: (t: number) => number,
  onDone: () => void,
) {
  const v0 = inst.getViewport();
  const tx = rect.width / 2 - cx * targetZoom;
  const ty = rect.height / 2 - cy * targetZoom;
  const t0 = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / ZOOM_MS);
    const e = ease(p);
    inst.setViewport({
      x: v0.x + (tx - v0.x) * e,
      y: v0.y + (ty - v0.y) * e,
      zoom: v0.zoom + (targetZoom - v0.zoom) * e,
    });
    if (p < 1) requestAnimationFrame(step);
    else onDone();
  };
  requestAnimationFrame(step);
}

export default function App() {
  const {
    flows,
    projectName,
    projectRoot,
    canWrite,
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
    doc,
    error,
    updates,
  } = useFlowData();
  const [selection, setSelection] = useState<Selection>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState<number>(tokens.size.panel);
  const [sidebarWidth, setSidebarWidth] = useState<number>(tokens.size.sidebar);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [panelsHidden, setPanelsHidden] = useState(false);
  const savedPanels = useRef<{ sidebar: boolean; details: boolean; overview: boolean } | null>(null);
  const togglePanels = () => {
    if (sidebarOpen || panelOpen || overviewOpen) {
      savedPanels.current = { sidebar: sidebarOpen, details: panelOpen, overview: overviewOpen };
      setSidebarOpen(false);
      setPanelOpen(false);
      setOverviewOpen(false);
      setPanelsHidden(true);
    } else {
      const previous = savedPanels.current ?? { sidebar: true, details: true, overview: !!doc?.overview };
      setSidebarOpen(previous.sidebar);
      setPanelOpen(previous.details);
      setOverviewOpen(previous.overview);
      savedPanels.current = null;
      setPanelsHidden(false);
    }
  };
                                                                                 
  const leaveHiddenPanels = () => {
    savedPanels.current = null;
    setPanelsHidden(false);
  };
  const [overviewHeight, setOverviewHeight] = useState<number>(132);
                                                                 
  const [seqLaneGap, setSeqLaneGap] = useState<number>(SEQ.laneGap);
  const [seqRowH, setSeqRowH] = useState<number>(SEQ.rowH);
                                                                     
  const [flowGap, setFlowGap] = useState<number>(FLOW_SPACING.default);
  const [visualMode, setVisualMode] = useState<VisualMode>(initialVisualMode);
  const [visualPreset, setVisualPreset] = useState<PresetName>(DEFAULT_PRESET);
  const preset = VISUAL_PRESETS[visualPreset];
  const [fontRevision, setFontRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    Promise.all([
      document.fonts?.ready,
      document.fonts?.load('500 13px "Inter Variable"'),
    ]).then(() => {
      if (alive) setFontRevision((v) => v + 1);
    }).catch(() => {
                                                                                        
      if (alive) setFontRevision((v) => v + 1);
    });
    return () => {
      alive = false;
    };
  }, []);
  const measureText = useMemo(() => {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return undefined;
    const label = visualMode === "classic" ? FLOW_LABEL : preset.label;
    ctx.font = `${label.weight} ${label.size}px ${label.family}`;
    return (text: string) => ctx.measureText(text).width;
  }, [fontRevision, preset, visualMode]);
  const changeVisualMode = (mode: VisualMode) => {
    setVisualMode(mode);
    try {
      localStorage.setItem(VISUAL_MODE_KEY, mode);
    } catch {
                                             
    }
  };
                                                                      
  const seqAreaRef = useRef<HTMLElement>(null);

                                                                                          
  const kind = doc ? docKind(doc) : null;
  const flowDoc = kind === "flow" ? (doc as FlowDocument) : null;
  const seqDoc = kind === "sequence" ? (doc as SequenceDocument) : null;

                                                                           
                                                                          
  const autoFitLane = useCallback((): number => {
    const n = seqDoc?.actors.length ?? 0;
    const w = (seqAreaRef.current?.clientWidth ?? 0) - SEQ.railW;
    if (n < 2 || w <= 0) return SEQ.laneGap;
    const fit = (w - SEQ.left * 2) / (n - 1);
    return Math.min(SEQ.maxLaneGap, Math.max(SEQ.minLaneGap, fit));
  }, [seqDoc]);
                                                                                 
                                                                                   
                                                               
  const userSizedRef = useRef(false);
  useEffect(() => {
    userSizedRef.current = false;                                   
  }, [activeId]);
  useEffect(() => {
    const el = seqAreaRef.current;
    if (!el || !seqDoc) return;
    const fit = () => {
      if (!userSizedRef.current) setSeqLaneGap(autoFitLane());
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [seqDoc, autoFitLane]);
  const resetSeqSize = useCallback(() => {
    userSizedRef.current = false;
    setSeqLaneGap(autoFitLane());
    setSeqRowH(SEQ.rowH);
  }, [autoFitLane]);
  const seqControls = seqDoc
    ? {
        laneGap: seqLaneGap,
        rowH: seqRowH,
        width: seqWidth(seqDoc.actors.length, seqLaneGap),
        bounds: {
          lane: [SEQ.minLaneGap, SEQ.maxLaneGap] as [number, number],
          row: [SEQ.minRowH, SEQ.maxRowH] as [number, number],
        },
        onLaneGap: (v: number) => {
          userSizedRef.current = true;
          setSeqLaneGap(v);
        },
        onRowH: setSeqRowH,
        onReset: resetSeqSize,
      }
    : undefined;
  const flowControls = flowDoc
    ? {
        gap: flowGap,
        bounds: [FLOW_SPACING.min, FLOW_SPACING.max] as [number, number],
        onGap: setFlowGap,
        onReset: () => setFlowGap(FLOW_SPACING.default),
      }
    : undefined;

                                                                             
                                                                                     
  const rf = useRef<ReactFlowInstance | null>(null);
                                                                           
  const canvasRef = useRef<HTMLDivElement>(null);
                                                                                  
                                                                             
  const lastTap = useRef<{ key: string; t: number }>({ key: "", t: 0 });
                                                                              
                                                                                    
  const navDir = useRef<"down" | "up" | "jump">("jump");

                                                                               
                                            
  const startResize = useCallback(
    (e: ReactPointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = panelWidth;
      const onMove = (ev: PointerEvent) => {
        setPanelWidth(
          Math.min(640, Math.max(280, startW + (startX - ev.clientX))),
        );
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [panelWidth],
  );
                                                                  
  const startSidebarResize = useCallback(
    (e: ReactPointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = sidebarWidth;
      const onMove = (ev: PointerEvent) => {
        setSidebarWidth(
          Math.min(480, Math.max(200, startW + (ev.clientX - startX))),
        );
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [sidebarWidth],
  );

  const overview = doc?.overview;

                                              
  useEffect(() => setSelection(null), [activeId]);
                                                                                       
  useEffect(() => {
    if (kind !== "flow") rf.current = null;
  }, [kind, activeId]);
                                                                              
                                                                                   
  const ovDocRef = useRef<string | null>(null);
  useEffect(() => {
    if (doc && activeId !== ovDocRef.current) {
      ovDocRef.current = activeId;
      if (!panelsHidden) setOverviewOpen(!!doc.overview);
    }
  }, [doc, activeId, panelsHidden]);
                                                                                  
  const startOverviewResize = useCallback(
    (e: ReactPointerEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = overviewHeight;
      const onMove = (ev: PointerEvent) =>
        setOverviewHeight(
          Math.min(420, Math.max(64, startH + (startY - ev.clientY))),
        );
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [overviewHeight],
  );

                                                                          
  const objectCenter = useCallback(
    (origin: DrillOrigin): Pt | null => {
      const inst = rf.current;
      if (!inst || !flowDoc) return null;
      const nodeCenter = (id: string): Pt | null => {
        const n = inst.getNode(id);
        if (!n) return null;
                                                                                     
        const dim = (n.data as NodeData).geometry ??
          DIMS[(n.type as NodeType) ?? "step"] ?? { w: 0, h: 0 };
        return { x: n.position.x + dim.w / 2, y: n.position.y + dim.h / 2 };
      };
      if (origin.kind === "node") return nodeCenter(origin.id);
      const fe = flowDoc.edges.find((e, i) => edgeKey(e, i) === origin.id);
      if (!fe) return null;
      const a = nodeCenter(fe.from);
      const b = nodeCenter(fe.to);
      if (!a || !b) return null;
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    },
    [flowDoc],
  );

                                                                               
  const sceneCenter = useCallback((): Pt | null => {
    const inst = rf.current;
    if (!inst) return null;
    const ns = inst.getNodes();
    if (!ns.length) return null;
    const b = getNodesBounds(ns);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }, []);

                                                                           
                                                                          
  const dive = useCallback((center: Pt | null, fn: () => void) => {
    const inst = rf.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!inst || !rect || !center) return fn();
    tweenViewport(
      inst,
      rect,
      center.x,
      center.y,
      Math.min(4, inst.getZoom() * 3.3),
      easeIn,
      fn,
    );
  }, []);
  const surface = useCallback(
    (fn: () => void) => {
      const inst = rf.current;
      const rect = canvasRef.current?.getBoundingClientRect();
      const c = sceneCenter();
      if (!inst || !rect || !c) return fn();
      tweenViewport(
        inst,
        rect,
        c.x,
        c.y,
        Math.max(0.08, inst.getZoom() * 0.27),
        easeOut,
        fn,
      );
    },
    [sceneCenter],
  );

                                                                                 
  const flowsSet = useMemo(() => new Set(flows.map((f) => f.id)), [flows]);
  const onDrill = useCallback(
    (target: string, origin?: DrillOrigin) => {
      if (!flowsSet.has(target)) return;
      navDir.current = "down";
      dive(origin ? objectCenter(origin) : null, () => drillTo(target));
    },
    [flowsSet, drillTo, dive, objectCenter],
  );
                                                                                      
  const onCrumb = useCallback(
    (i: number) => {
      navDir.current = "up";
      surface(() => goToDepth(i));
    },
    [goToDepth, surface],
  );
                                                      
  const onSidebarSelect = useCallback(
    (id: string) => {
      navDir.current = "jump";
      navigate(id);
    },
    [navigate],
  );

                                                                            
                                                
  const trailMeta: Crumb[] = useMemo(() => {
    const titleOf = (id: string) => flows.find((f) => f.id === id)?.title ?? id;
    return trail.map((id, i) => ({
      id,
      title: i === trail.length - 1 && doc ? doc.title : titleOf(id),
    }));
  }, [trail, flows, doc]);

                                                                                    
  const colors = useMemo(
    () =>
      doc
        ? flowDoc && visualMode === "actors"
          ? actorBaseColors(doc.actors)
          : buildActorColors(doc.actors, "classic")
        : {},
    [doc, flowDoc, visualMode],
  );
  const legendColors = useMemo(() => Object.fromEntries(
    Object.entries(colors).map(([id, color]) => [id, visualMode === "actors" ? actorTone(color, preset).outline : color]),
  ), [colors, visualMode, preset]);
  const actorsById = useMemo(
    () =>
      doc
        ? (Object.fromEntries(doc.actors.map((a) => [a.id, a])) as Record<
            string,
            Actor
          >)
        : {},
    [doc],
  );
  const base = useMemo(
    () =>
      flowDoc
        ? buildGraph(
            flowDoc,
            colors,
            { onDrill, flowsSet, visualMode, visualPreset, measureText },
            flowGap,
          )
        : { nodes: [], edges: [] },
    [flowDoc, colors, onDrill, flowsSet, flowGap, visualMode, visualPreset, measureText],
  );

                                                                                   
  const selectedIds = useMemo(() => {
    if (!selection || !flowDoc) return new Set<string>();
    if (selection.kind === "node") return new Set([selection.id]);
    if (selection.kind === "actor")
      return new Set(
        flowDoc.nodes.filter((n) => n.owner === selection.id).map((n) => n.id),
      );
    return new Set<string>();
  }, [selection, flowDoc]);

  const nodes: Node[] = useMemo(
    () => base.nodes.map((n) => ({ ...n, selected: selectedIds.has(n.id) })),
    [base.nodes, selectedIds],
  );

                                                                               
                                                                                      
                                                                                      
                                                                                         
  const edges: Edge[] = useMemo(
    () =>
      base.edges.map((e) => ({
        ...e,
        selected: selection?.kind === "edge" && selection.id === e.id,
        data: { ...e.data, onSelect: () => tapEdge(e.id, e.source, e.target) },
      })),
                                                                                                                  
    [base.edges, selection],
  );

                                                                           
  const edgesById = useMemo(() => {
    const m = new Map<string, FlowEdge>();
    flowDoc?.edges.forEach((e, i) => m.set(edgeKey(e, i), e));
    return m;
  }, [flowDoc]);

  const selectedNode: FlowNode | null =
    selection?.kind === "node"
      ? (flowDoc?.nodes.find((n) => n.id === selection.id) ?? null)
      : null;
  const selectedEdge: FlowEdge | null =
    selection?.kind === "edge" ? (edgesById.get(selection.id) ?? null) : null;
                                                                                  
  const flatCalls = useMemo(
    () => (seqDoc ? flattenCalls(seqDoc.calls) : []),
    [seqDoc],
  );
  const callById = useMemo(
    () => new Map(flatCalls.map((c) => [c.id, c])),
    [flatCalls],
  );
  const parentById = useMemo(() => {
    const m = new Map<string, string>();
    const walk = (cs: SequenceCall[], parent: string | null) =>
      cs.forEach((c) => {
        if (parent) m.set(c.id, parent);
        if (c.children?.length) walk(c.children, c.id);
      });
    if (seqDoc) walk(seqDoc.calls, null);
    return m;
  }, [seqDoc]);
                                                                                     
  const reuseGroupOf = useMemo(() => reuseGroups(flatCalls), [flatCalls]);
  const reuseCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const [id, ids] of reuseGroupOf)
      if (ids.length > 1) m.set(id, ids.length);
    return m;
  }, [reuseGroupOf]);

  const selectedCall: SequenceCall | null = useMemo(
    () =>
      selection?.kind === "call" ? (callById.get(selection.id) ?? null) : null,
    [selection, callById],
  );
                                                                    
  const callerId = selectedCall
    ? (parentById.get(selectedCall.id) ?? null)
    : null;
  const calleeIds = useMemo(
    () => new Set((selectedCall?.children ?? []).map((c) => c.id)),
    [selectedCall],
  );
                                                                               
  const occIndex = useMemo(() => {
    const m = new Map<string, number>();
    if (selectedCall) {
      const ids = reuseGroupOf.get(selectedCall.id) ?? [];
      if (ids.length > 1) ids.forEach((id, i) => m.set(id, i + 1));
    }
    return m;
  }, [selectedCall, reuseGroupOf]);

                                                                                
  const [scrollNonce, setScrollNonce] = useState(0);
  const navTargetRef = useRef<string | null>(null);
  const navigateCall = useCallback((id: string) => {
    navTargetRef.current = id;
    setScrollNonce((n) => n + 1);
    setSelection({ kind: "call", id });
  }, []);
  const callPeers = useMemo(
    () =>
      selectedCall
        ? {
            caller: callerId ? (callById.get(callerId) ?? null) : null,
            callees: selectedCall.children ?? [],
            occurrences: [...occIndex.entries()]
              .sort((a, b) => a[1] - b[1])
              .map(([id, index]) => ({
                id,
                index,
                call: callById.get(id) ?? null,
              })),
          }
        : null,
    [selectedCall, callerId, callById, occIndex],
  );

  const owner = selectedNode?.owner
    ? actorsById[selectedNode.owner]
    : undefined;

                                                                                            
  const drillTarget =
    (selectedNode?.type === "subflow" ? selectedNode.subflow : undefined) ??
    selectedNode?.sequence ??
    selectedEdge?.subflow ??
    selectedEdge?.sequence;
  const canDrill = !!drillTarget && flowsSet.has(drillTarget);

  const selectedActor: ActorView | null = useMemo(() => {
    if (selection?.kind !== "actor" || !flowDoc) return null;
    const a = actorsById[selection.id];
    if (!a) return null;
    return {
      id: a.id,
      label: a.label,
      kind: a.kind,
      color: colors[a.id],
      count: flowDoc.nodes.filter((n) => n.owner === a.id).length,
      total: flowDoc.nodes.length,
    };
  }, [selection, flowDoc, actorsById, colors]);

  const toggleActor = (id: string) =>
    setSelection((cur) =>
      cur?.kind === "actor" && cur.id === id ? null : { kind: "actor", id },
    );

                                                                               
                           
  const fitToNodes = (ids: string[]) =>
    rf.current?.fitView({
      nodes: ids.map((id) => ({ id })),
      duration: 400,
      maxZoom: 1.9,
      padding: 0.6,
    });
  const onNodeDouble = (id: string) => {
    const fn = flowDoc?.nodes.find((n) => n.id === id);
    const target =
      (fn?.type === "subflow" ? fn.subflow : undefined) ?? fn?.sequence;
    if (target && flowsSet.has(target)) onDrill(target, { kind: "node", id });
    else fitToNodes([id]);
  };
  const onEdgeDouble = (rendererId: string, source: string, target: string) => {
    const fe = flowDoc?.edges.find((e, i) => edgeKey(e, i) === rendererId);
    const t = fe?.subflow ?? fe?.sequence;
    if (t && flowsSet.has(t)) onDrill(t, { kind: "edge", id: rendererId });
    else fitToNodes([source, target]);
  };
                                                                              
                                                 
  const DOUBLE_MS = 350;
  const isDoubleTap = (key: string): boolean => {
    const now = performance.now();
    if (lastTap.current.key === key && now - lastTap.current.t < DOUBLE_MS) {
      lastTap.current = { key: "", t: 0 };
      return true;
    }
    lastTap.current = { key, t: now };
    return false;
  };
                                                                                               
  const toggleSelection = (kind: "node" | "edge" | "call", id: string) =>
    setSelection((cur) =>
      cur?.kind === kind && cur.id === id ? null : { kind, id },
    );
  const tapNode = (id: string) => {
    if (isDoubleTap("node:" + id)) onNodeDouble(id);
    else toggleSelection("node", id);
  };
  const tapEdge = (id: string, source: string, target: string) => {
    if (isDoubleTap("edge:" + id)) onEdgeDouble(id, source, target);
    else toggleSelection("edge", id);
  };
  const tapCall = (id: string) => toggleSelection("call", id);

                                                                                  
                                                                    
  const activeTwinId = activeId ? twins[activeId] : undefined;
  const twinKind = activeTwinId
    ? flows.find((f) => f.id === activeTwinId)?.kind
    : undefined;
  const twinToggle =
    activeTwinId && twinKind && twinKind !== kind
      ? { onSwitch: () => navigate(activeTwinId) }
      : undefined;

  return (
    <>
      <UpdateDialog api={updates} />
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          background: tokens.color.canvas,
          overflow: "hidden",
        }}
      >
        <TopBar
          trail={trailMeta}
          onCrumb={onCrumb}
          tab={kind === "sequence" ? "sequence" : "flow"}
          twin={twinToggle}
          seq={seqControls}
          flow={flowControls}
          visual={{ mode: visualMode, preset: visualPreset, onChange: changeVisualMode, onPreset: setVisualPreset }}
        />

        <div style={{ flex: "1 1 auto", display: "flex", minHeight: 0 }}>
          <Sidebar
            flows={flows}
            activeFlow={activeId ?? ""}
            projectName={projectName}
            canWrite={canWrite}
            recents={recents}
            open={sidebarOpen}
            onToggle={() => { leaveHiddenPanels(); setSidebarOpen((v) => !v); }}
            onSelectFlow={onSidebarSelect}
            onRename={rename}
            onSetCategory={setCategory}
            onRenameCategory={renameCategory}
            onDelete={remove}
            onOpenProject={openProject}
            onPickFolder={pickFolder}
            onListDir={listDir}
            parents={parents}
            twins={twins}
            mcp={mcp}
            onSetupMcp={setupMcp}
            onBuild={build}
            width={sidebarWidth}
            onResizeStart={startSidebarResize}
          />

          <main
            ref={seqAreaRef}
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{ flex: "1 1 auto", position: "relative", minHeight: 0 }}
            >
              {error ? <Banner text={error} /> : null}
              {!error && !activeId ? (
                flows.length ? (
                  <Placeholder text="Select a document from the sidebar." />
                ) : (
                  <EmptyState mcp={mcp} projectRoot={projectRoot} />
                )
              ) : null}
              {!error && activeId && !doc ? (
                <Placeholder text="Loading…" />
              ) : null}
              {                                                                      
                                                                               
                                                                                 
                                                                                    }
              {doc ? (
                <div
                  ref={canvasRef}
                                                                                    
                                                                                                 
                  key={doc.id}
                  className={
                    navDir.current === "up" ? "ft-canvas-out" : "ft-canvas-in"
                  }
                  style={{ position: "absolute", inset: 0 }}
                >
                  <ErrorBoundary>
                    {seqDoc ? (
                      <SequenceCanvas
                        doc={seqDoc}
                        laneGap={seqLaneGap}
                        rowH={seqRowH}
                        selectedId={
                          selection?.kind === "call" ? selection.id : null
                        }
                        reuseCount={reuseCount}
                        occIndex={occIndex}
                        callerId={callerId}
                        calleeIds={calleeIds}
                        scrollToId={navTargetRef.current}
                        scrollNonce={scrollNonce}
                        onSelectCall={tapCall}
                        onNavigate={navigateCall}
                        onPaneClick={() => setSelection(null)}
                      />
                    ) : (
                      <ReactFlowProvider>
                        <ReactFlow
                          style={
                            visualMode === "actors"
                              ? { background: preset.canvas.background }
                              : undefined
                          }
                          nodes={nodes}
                          edges={edges}
                          nodeTypes={nodeTypes}
                          edgeTypes={edgeTypes}
                          minZoom={0.2}
                          maxZoom={4}
                          zoomOnScroll
                          zoomOnDoubleClick={false}
                          nodesDraggable={false}
                          nodesConnectable={false}
                          proOptions={{ hideAttribution: true }}
                          onInit={(inst) => (rf.current = inst)}
                          onNodeClick={(_, node) => tapNode(node.id)}
                          onEdgeClick={(_, edge) =>
                            tapEdge(edge.id, edge.source, edge.target)
                          }
                          onPaneClick={() => setSelection(null)}
                        >
                          <InitialFlowFit fontsReady={fontRevision > 0} />
                          <FlowBackground classic={visualMode === "classic"} canvas={preset.canvas} />
                          <MiniMap
                            pannable
                            zoomable
                            nodeColor={(n) =>
                              (n.data as NodeData)?.color ?? NEUTRAL
                            }
                            nodeStrokeColor={(n) =>
                              (n.data as NodeData)?.color ?? NEUTRAL
                            }
                            nodeStrokeWidth={3}
                            nodeBorderRadius={3}
                            maskColor="rgba(74,66,48,0.12)"
                            maskStrokeColor="rgba(94,84,168,0.5)"
                            maskStrokeWidth={2}
                            style={{
                              width: 96,
                              height: 72,
                              background:
                                visualMode === "actors" ? preset.canvas.background : "#FCFAF4",
                            }}
                          />
                          <Panel position="bottom-left">
                            <ZoomControls
                              panelsCollapsed={!(sidebarOpen || panelOpen || overviewOpen)}
                              onTogglePanels={togglePanels}
                            />
                          </Panel>
                          <Panel position="top-left">
                            <Legend
                              modern={visualMode === "actors"}
                              actors={flowDoc?.actors ?? []}
                              colors={legendColors}
                              activeId={
                                selection?.kind === "actor" ? selection.id : null
                              }
                              onSelect={toggleActor}
                            />
                          </Panel>
                        </ReactFlow>
                      </ReactFlowProvider>
                    )}
                  </ErrorBoundary>
                </div>
              ) : null}
            </div>
            <OverviewBar
              overview={overview}
              open={overviewOpen}
              height={overviewHeight}
              onToggle={() => { leaveHiddenPanels(); setOverviewOpen((v) => !v); }}
              onResizeStart={startOverviewResize}
            />
          </main>

          <DetailPanel
            node={selectedNode}
            edge={selectedEdge}
            call={selectedCall}
            callActors={seqDoc ? actorsById : undefined}
            callPeers={callPeers}
            onNavigateCall={navigateCall}
            ownerLabel={owner?.label}
            ownerColor={
              selectedNode?.owner ? colors[selectedNode.owner] : undefined
            }
            actor={selectedActor}
            open={panelOpen}
            onToggle={() => { leaveHiddenPanels(); setPanelOpen((v) => !v); }}
            onDeselect={() => setSelection(null)}
            canDrill={canDrill}
            onDrill={(t) =>
              onDrill(
                t,
                selection?.kind === "node" || selection?.kind === "edge"
                  ? { kind: selection.kind, id: selection.id }
                  : undefined,
              )
            }
            width={panelWidth}
            onResizeStart={startResize}
          />
        </div>
      </div>
    </>
  );
}
