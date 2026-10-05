                                                                                  
                                                                               

import type { SequenceCall, SequenceDocument } from "../core/sequence-types";
import { laneX, SEQ, type SeqDims } from "./geometry";

export interface SeqRow {
  call: SequenceCall;
  depth: number;
  y: number;           
  yc: number;                       
  h: number;                                                          
                                                                              
  kind: "call" | "return";
                                                                                 
                                                                                        
  fromInset: number | null;
                                                                                 
                                                                    
  toInset: number | null;
}
export interface SeqSep {
  id: string;
  label: string;
  y: number;
}
export interface SeqAct {
  actorIdx: number;
  y1: number;
  y2: number;
                                                                                      
                                                                       
  inset: number;
}
export interface SeqLayout {
  rows: SeqRow[];
  seps: SeqSep[];
  acts: SeqAct[];
  width: number;
  height: number;
  actorIndex: Record<string, number>;
}

export function buildSequence(doc: SequenceDocument, dims: SeqDims): SeqLayout {
  const { laneGap, rowH } = dims;
  const actorIndex: Record<string, number> = {};
  doc.actors.forEach((a, i) => (actorIndex[a.id] = i));
  const phaseLabel: Record<string, string> = {};
  (doc.phases ?? []).forEach((p) => (phaseLabel[p.id] = p.label));

                                                                                  
                                                                                    
                                                                                        
  const returnH = Math.max(22, Math.round(rowH * 0.5));
  const hasReturn = (c: SequenceCall): boolean =>
    (!!c.returnType || !!c.returns?.length) && c.from != null && c.from !== c.to;

  const rows: SeqRow[] = [];
  const seps: SeqSep[] = [];
  const callYc: Record<string, number> = {};
  const returnYc: Record<string, number> = {};
                                                                                  
                                                                                    
                                                                                    
                                                                                    
                                             
  const openOnActor: Record<string, number> = {};
  const insetById: Record<string, number> = {};
  let y = SEQ.top;
  let prevPhase: string | undefined;
  let sepN = 0;

  const emit = (c: SequenceCall, depth: number, fromInset: number | null) => {
    if (c.phase && c.phase !== prevPhase) {
      seps.push({ id: `sep-${sepN++}`, label: phaseLabel[c.phase] ?? c.phase, y });
      y += SEQ.sepH;
    }
    prevPhase = c.phase;
    const hasChildren = !!c.children?.length;
                                                                                    
                                                                               
    const inset = openOnActor[c.to] ?? 0;
    const toInset = hasChildren ? inset : null;
    if (hasChildren) insetById[c.id] = inset;
    const yc = y + rowH * 0.55;
    callYc[c.id] = yc;
    rows.push({ call: c, depth, y, yc, h: rowH, kind: "call", fromInset, toInset });
    y += rowH;
    if (hasChildren) {
      openOnActor[c.to] = inset + 1;
                                                                                   
      c.children!.forEach((ch) => emit(ch, depth + 1, inset));
      openOnActor[c.to] = inset;
    }
    if (hasReturn(c)) {
      const ryc = y + returnH * 0.5;
      returnYc[c.id] = ryc;
      rows.push({ call: c, depth, y, yc: ryc, h: returnH, kind: "return", fromInset, toInset });
      y += returnH;
    }
  };
  doc.calls.forEach((c) => emit(c, 0, null));

                                                                                    
  const lastDescYc = (c: SequenceCall): number => {
    let last = callYc[c.id] ?? SEQ.top;
    const rec = (x: SequenceCall) => {
      last = Math.max(last, returnYc[x.id] ?? callYc[x.id] ?? last);
      x.children?.forEach(rec);
    };
    rec(c);
    return last;
  };
  const acts: SeqAct[] = [];
  rows.forEach((r) => {
    if (r.kind === "call" && r.call.children?.length) {
      acts.push({ actorIdx: actorIndex[r.call.to] ?? 0, y1: r.yc, y2: lastDescYc(r.call), inset: insetById[r.call.id] ?? 0 });
    }
  });

  const height = y + SEQ.botPad;
  const width = laneX(Math.max(0, doc.actors.length - 1), laneGap) + SEQ.left;
  return { rows, seps, acts, width, height, actorIndex };
}
