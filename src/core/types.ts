                                                                               
                                                                             
                                                              

import type { NodeIcon, NodeShape, EdgeStyle } from "./visual-vocabulary";
export type ActorKind = "human" | "system" | "service" | "infra";

export interface Actor {
  id: string;
  label: string;
  kind: ActorKind;
  color?: string;
}

export type NodeType = "terminal" | "step" | "decision" | "subflow" | "io";

export interface IoField {
  name: string;
  type?: string;
}

export interface SourceRef {
  file?: string;
  symbol?: string;
  line?: number;
}

export interface ExternalRef {
  label: string;
  url: string;
}

export interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
                                                                                     
  description: string[];
                                                                                
  shape?: NodeShape;
                                                                                
  icon?: NodeIcon;
  owner?: string;
  shared?: boolean;
  subflow?: string;
                                                                              
  sequence?: string;
  inputs?: IoField[];
  outputs?: IoField[];
  source?: SourceRef;
  refs?: ExternalRef[];
}

export type EdgeType = "flow" | "branch" | "return";

export interface FlowEdge {
  from: string;
  to: string;
  type: EdgeType;
  label?: string;
                                                                               
  style?: EdgeStyle;
                                                                                   
                                                                                
  id?: string;
                                                                                           
  description?: string[];
  inputs?: IoField[];
  outputs?: IoField[];
  source?: SourceRef;
  refs?: ExternalRef[];
                                                                                 
  shared?: boolean;
                                                                        
  subflow?: string;
                                                                             
  sequence?: string;
}

export type LayoutDir = "TB" | "LR";

export interface FlowDocument {
  version: string;
  id: string;
  title: string;
  layout?: LayoutDir;
                                                                                
  overview?: string[];
                                                                             
                                                                                   
  twin?: string;
  actors: Actor[];
  nodes: FlowNode[];
  edges: FlowEdge[];
}
