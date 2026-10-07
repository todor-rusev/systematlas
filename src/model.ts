                                                                              
                                                                         
import raw from "../examples/transaction-create.flow.json";

export type {
  Actor,
  ActorKind,
  NodeType,
  FlowNode,
  IoField,
  SourceRef,
  ExternalRef,
  EdgeType,
  FlowEdge,
  LayoutDir,
  FlowDocument,
} from "./core/types";
import type { FlowDocument } from "./core/types";
import type { SequenceDocument } from "./core/sequence-types";
import type { NodeIcon, NodeShape } from "./core/visual-vocabulary";
import type { VisualGeometry, VisualMode } from "./visual-geometry";
import type { PresetName } from "./visual-tokens";

export type {
  SequenceDocument,
  SequenceCall,
  SequencePhase,
} from "./core/sequence-types";

                                                                               
                                                     
export type Doc = FlowDocument | SequenceDocument;
export type DocKind = "flow" | "sequence";
export function docKind(d: Doc): DocKind {
  return (d as SequenceDocument).kind === "sequence" ? "sequence" : "flow";
}

                                                                                  
export interface NodeData {
                                         
  text: string;
  color: string;
  owner?: string;
  shared?: boolean;
  visualMode?: VisualMode;
  visualPreset?: PresetName;
  shape?: NodeShape;
  icon?: NodeIcon;
  geometry?: VisualGeometry;
                                                                               
                                                                                    
  decisionSize?: number;
                                                                                  
                                                                                
  drillTarget?: string;
  drillKind?: "flow" | "sequence";
  canDrill?: boolean;
  onDrill?: DrillHandler;
  [key: string]: unknown;
}

                                                                               
                                                                              
export type DrillOrigin = { kind: "node" | "edge"; id: string };
export type DrillHandler = (target: string, origin?: DrillOrigin) => void;

export const exampleFlow = raw as unknown as FlowDocument;
