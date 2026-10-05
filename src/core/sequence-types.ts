                                                                                       
                                                                                
                                                                                   

import type { Actor, ExternalRef, IoField, SourceRef } from "./types";

export type { Actor, IoField, SourceRef, ExternalRef };

export interface SequencePhase {
  id: string;
  label: string;
}

                                                                              
                                                                                 
export interface SequenceCall {
  id: string;
  to: string;
  method: string;
  from?: string;
  phase?: string;
  description?: string[];
  params?: IoField[];
  returns?: IoField[];
  returnType?: string;
  request?: string;
  response?: string;
  source?: SourceRef;
  refs?: ExternalRef[];
  async?: boolean;
  children?: SequenceCall[];
}

export interface SequenceDocument {
  version: string;
  kind: "sequence";
  id: string;
  title: string;
                                                                                
  overview?: string[];
                                                                             
                                                                                   
  twin?: string;
  actors: Actor[];
  phases?: SequencePhase[];
  calls: SequenceCall[];
}
