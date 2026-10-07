                                                                                        
                                                                                    
                                                                                   
                                                                                      
                                                                                    
                                                                   
                         
  
                                   
                                                           
                                                                              
                                                                                 
                                                                                      
  
                                         
                                                                                   
                                                                                  
                                                  
                                                                                
                                                                                 
import type { Actor, FlowDocument, FlowNode } from "./types";
import { normalizeLabel, sourceDefinition } from "./identity";

export interface NodeLoc {
  flowId: string;
  id: string;
  label: string;
}

   
                                                                                  
                                                 
                                                                                  
                                                
   
export type SplitEvidence = "same-definition" | "similar";

export interface SplitCandidate {
  a: NodeLoc;
  b: NodeLoc;
  evidence: SplitEvidence;
                                                                                     
  score: number;
                                                                                
  signals: string[];
                                                                                 
  admissible: boolean;
  message: string;
  suggestion: string;
}

                                                                                      
                                                                   
const WEIGHTS = { label: 0.45, owner: 0.2, topology: 0.25, idLeaf: 0.1 };
const THRESHOLD = 0.72;
                                                                                  
const SIMILAR_LABEL = 0.6;

interface Indexed {
  flowId: string;
  node: FlowNode;
  label: string;
  definition: string | null;
  owner: { id: string; name: string } | null;
                                                                                   
                                                                                   
  neighbors: Set<string>;
                                                                                         
  shown: { owner?: string; before: string[]; after: string[] };
}

function indexFlow(doc: FlowDocument): Indexed[] {
  const actors = new Map<string, Actor>(doc.actors.map((a) => [a.id, a]));
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const ownerOf = (n: FlowNode) => (n.owner ? { id: n.owner, name: normalizeLabel(actors.get(n.owner)?.label ?? "") } : null);
  const sig = (id: string) => normalizeLabel(byId.get(id)?.text ?? "?");
                                                           
  const into = new Map<string, string[]>();
  const outOf = new Map<string, string[]>();
  for (const e of doc.edges) {
    into.set(e.to, [...(into.get(e.to) ?? []), e.from]);
    outOf.set(e.from, [...(outOf.get(e.from) ?? []), e.to]);
  }
  return doc.nodes
    .filter((node) => node.type !== "terminal")
    .map((node) => {
      const ins = into.get(node.id) ?? [];
      const outs = outOf.get(node.id) ?? [];
      const owner = node.owner ? (actors.get(node.owner)?.label ?? node.owner) : undefined;
      return {
        flowId: doc.id,
        node,
        label: normalizeLabel(node.text),
        definition: sourceDefinition(node.source),
        owner: ownerOf(node),
        neighbors: new Set([...ins.map((id) => `in|${sig(id)}`), ...outs.map((id) => `out|${sig(id)}`)]),
        shown: { owner, before: ins.map((id) => byId.get(id)?.text ?? id), after: outs.map((id) => byId.get(id)?.text ?? id) },
      };
    });
}

                                                                                
                                                                                 
function portrait(x: Indexed): string {
  const parts = [`"${x.node.text}"`];
  if (x.shown.owner) parts.push(`by ${x.shown.owner}`);
  if (x.shown.before.length) parts.push(`after ${x.shown.before.map((l) => `"${l}"`).join(", ")}`);
  if (x.shown.after.length) parts.push(`before ${x.shown.after.map((l) => `"${l}"`).join(", ")}`);
  const said = x.node.details?.split(/\r?\n/).find((line) => line.trim())?.replace(/^\s*[-*]\s+/, "");
  const text = said ? `; "${said.length > 140 ? `${said.slice(0, 139)}…` : said}"` : "";
  return `${where(x)} is ${parts.join(", ")}${text}`;
}

                                                                                      

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

                                                                                   
function textSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

   
                                                                                    
                                                                                     
                                                                                   
                                                  
   
const CHAR_EDIT = 0.85;
function labelSimilarity(a: string, b: string): number {
  const chars = textSimilarity(a, b);
  if (chars >= CHAR_EDIT || !a || !b) return chars;
  return jaccard(new Set(a.split(" ")), new Set(b.split(" ")));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

const idLeaf = (id: string) => id.split(/[._-]/).pop() ?? id;

                                                                                      
                                                                   
function ownerSimilarity(a: Indexed, b: Indexed): { value: number; signal?: string } {
  if (!a.owner || !b.owner) return { value: 0 };
  if (a.owner.name && a.owner.name === b.owner.name) return { value: 1, signal: "same participant" };
  if (a.owner.id === b.owner.id) return { value: 0.5, signal: `same owner id "${a.owner.id}", different participant names` };
  return { value: 0 };
}

function compare(a: Indexed, b: Indexed): { score: number; label: number; owner: number; signals: string[] } {
  const signals: string[] = [];
  const label = labelSimilarity(a.label, b.label);
  if (label === 1) signals.push("same text");
  else if (label >= SIMILAR_LABEL) signals.push(`similar text (${label.toFixed(2)})`);
  const owner = ownerSimilarity(a, b);
  if (owner.signal) signals.push(owner.signal);
  const topology = jaccard(a.neighbors, b.neighbors);
  if (topology > 0) signals.push(`shared neighbours (${topology.toFixed(2)})`);
  const leaf = textSimilarity(idLeaf(a.node.id), idLeaf(b.node.id));
  if (a.definition && b.definition) {
    signals.push(a.definition === b.definition ? `same source ${a.definition}` : `different sources (${a.definition} vs ${b.definition})`);
  }
  const score = WEIGHTS.label * label + WEIGHTS.owner * owner.value + WEIGHTS.topology * topology + WEIGHTS.idLeaf * leaf;
  return { score, label, owner: owner.value, signals };
}

                                                                                      

                                                                                     
                                                                                       
const linked = (a: Indexed, b: Indexed) => a.node.id === b.node.id && (a.node.shared === true || b.node.shared === true);
                                                                                       
const admissible = (a: Indexed, b: Indexed) => (a.node.owner ?? "-") === (b.node.owner ?? "-");

const where = (x: Indexed) => `"${x.node.id}" (flow ${x.flowId})`;
const loc = (x: Indexed): NodeLoc => ({ flowId: x.flowId, id: x.node.id, label: x.node.text });

function suggestionFor(evidence: SplitEvidence, ok: boolean): string {
  if (evidence === "same-definition") {
    return (
      "if both stand for the same operation in the same role, give them one id and set shared: true on both; " +
      "keep separate ids if the symbol names a whole class, the roles differ, or they are separate occurrences"
    );
  }
  return ok
    ? "if they are the same step, give them one id and set shared: true on both; if they are different things or separate occurrences, no action is needed"
    : "if they are the same step, first give both the same owner (one participant, one actor id — a shared id requires it), then one id and shared: true on both; otherwise no action is needed";
}

                                                                                      
                                                                                   
                                                                                       
                                                                                      
                                                                                
                                                                                       
                                                                                  
                                                                                     
                                                                                 
                                                                                

                                                         
const SHORTLIST = 25;
                                                            
const PER_NODE = 3;

                                                                                     
                                                                                       
function keysOf(label: string): string[] {
  const keys = new Set<string>();
  for (const w of label.split(" ")) {
    if (!w) continue;
    keys.add(w);
    if (w.length >= 5) keys.add(`<${w.slice(0, 4)}`).add(`${w.slice(-4)}>`);
  }
  return [...keys];
}

interface WorkspaceIndex {
  byKey: Map<string, Indexed[]>;
  byDefinition: Map<string, Indexed[]>;
  size: number;
}

function buildIndex(nodes: Indexed[]): WorkspaceIndex {
  const byKey = new Map<string, Indexed[]>();
  const byDefinition = new Map<string, Indexed[]>();
  for (const x of nodes) {
    for (const k of keysOf(x.label)) {
      const list = byKey.get(k);
      if (list) list.push(x);
      else byKey.set(k, [x]);
    }
    if (x.definition) byDefinition.set(x.definition, [...(byDefinition.get(x.definition) ?? []), x]);
  }
  return { byKey, byDefinition, size: nodes.length };
}

                                                                                         
function shortlist(a: Indexed, index: WorkspaceIndex): Array<[Indexed, number]> {
  const weight = new Map<Indexed, number>();
  const consider = (b: Indexed, w: number) => {
    if (b.node.type !== a.node.type || linked(a, b)) return;
    weight.set(b, (weight.get(b) ?? 0) + w);
  };
  for (const k of keysOf(a.label)) {
    const list = index.byKey.get(k);
    if (!list) continue;
    const rarity = Math.log(1 + index.size / list.length);
    for (const b of list) consider(b, rarity);
  }
  if (a.definition) for (const b of index.byDefinition.get(a.definition) ?? []) consider(b, Number.MAX_SAFE_INTEGER);
  return [...weight].sort((x, y) => y[1] - x[1]).slice(0, SHORTLIST);
}

   
                                                                                  
                                                                                     
                                                                                      
                                                                                   
                                                                                   
                                                                                    
                 
   
export function detectSplits(target: FlowDocument, others: FlowDocument[]): SplitCandidate[] {
  const own = indexFlow(target);
  const index = buildIndex(others.filter((d) => d.id !== target.id).flatMap(indexFlow));
  const rank = (c: SplitCandidate) => (c.evidence === "same-definition" ? 0 : 1);
  const out: Array<SplitCandidate & { weight: number }> = [];
  for (const a of own) {
                                                                                 
    const most = keysOf(a.label).length * Math.log(1 + index.size);
    const found: Array<SplitCandidate & { weight: number }> = [];
    for (const [b, rarity] of shortlist(a, index)) {
      const ok = admissible(a, b);
      const sameDefinition = !!a.definition && a.definition === b.definition;
      const { score, label, owner, signals } = compare(a, b);
                                                                                
                                                                            
      const sameParticipantStep = label >= SIMILAR_LABEL && owner > 0;
      const evidence: SplitEvidence | null =
        sameDefinition && ok ? "same-definition" : score >= THRESHOLD || sameParticipantStep ? "similar" : null;
      if (!evidence) continue;
      found.push({
        a: loc(a),
        b: loc(b),
        evidence,
        score: Math.round(score * 100) / 100,
        signals,
        admissible: ok,
        message:
          (evidence === "same-definition"
            ? `${where(a)} and ${where(b)} point to the same definition ${a.definition} and have the same type and owner — they may be one object under two ids`
            : `${where(a)} and ${where(b)} look alike: ${signals.join(", ")} — they may be one object under two ids`) +
          `. ${portrait(b)}`,
        suggestion: suggestionFor(evidence, ok),
        weight: score - WEIGHTS.label * label * (1 - Math.min(1, most > 0 ? rarity / most : 1)),
      });
    }
    found.sort((x, y) => rank(x) - rank(y) || y.weight - x.weight);
    out.push(...found.slice(0, PER_NODE));
  }
  return out.sort((x, y) => rank(x) - rank(y) || y.weight - x.weight).map(({ weight: _weight, ...c }) => c);
}
