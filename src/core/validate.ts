import { readFileSync } from "node:fs";
import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { FlowDocument } from "./types";
import { detectSplits } from "./split";
import { normalizeLabel, sourceDefinition } from "./identity";
import { pkgPath } from "./paths";

   
                                                                                 
                                                                           
   
export interface Issue {
  code: string;
  severity: "error" | "warning" | "hint";
  message: string;
  path?: string;
  suggestion?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
  hints: Issue[];
}

export interface ValidateOptions {
                                                                  
  others?: FlowDocument[];
                                                                                 
                                                                    
  siblingIds?: string[];
}

                                                                             
const MAX_SPLIT_SIGNALS = 10;

const schema = JSON.parse(readFileSync(pkgPath("schema", "flow.schema.json"), "utf8"));

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema: ValidateFunction = ajv.compile(schema);

function schemaIssue(e: ErrorObject): Issue {
  const path = e.instancePath || "/";
  const extra =
    e.keyword === "additionalProperties" ? ` (${(e.params as { additionalProperty?: string }).additionalProperty})` : "";
  return { code: `schema/${e.keyword}`, severity: "error", message: `${path} ${e.message}${extra}` };
}

   
                                                                             
                                                                        
                                                                                     
                                                            
   
export function validateFlow(model: unknown, opts: ValidateOptions = {}): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const hints: Issue[] = [];
  const others = opts.others ?? [];

                                
  if (!validateSchema(model)) {
    for (const e of validateSchema.errors ?? []) errors.push(schemaIssue(e));
    return { ok: false, errors, warnings, hints };
  }
  const doc = model as FlowDocument;

                   
  const nodeIds = new Set<string>();
  for (const n of doc.nodes) {
    if (nodeIds.has(n.id)) {
      errors.push({ code: "dup-node-id", severity: "error", message: `duplicate node id "${n.id}"`, path: `nodes` });
    }
    nodeIds.add(n.id);
  }
  const actorIds = new Set<string>();
  for (const a of doc.actors) {
    if (actorIds.has(a.id)) {
      errors.push({ code: "dup-actor-id", severity: "error", message: `duplicate actor id "${a.id}"`, path: `actors` });
    }
    actorIds.add(a.id);
  }
                                                                                  
                                                                                  
  const objectIds = new Set<string>(nodeIds);
  for (const e of doc.edges) {
    if (!e.id) continue;
    if (objectIds.has(e.id)) {
      errors.push({ code: "dup-object-id", severity: "error", message: `edge id "${e.id}" collides with another node/edge id`, path: `edges` });
    }
    objectIds.add(e.id);
  }

                              
  for (const n of doc.nodes) {
    if (n.owner && !actorIds.has(n.owner)) {
      errors.push({
        code: "dangling-owner",
        severity: "error",
        message: `node "${n.id}" references undeclared owner "${n.owner}"`,
        suggestion: `add an actor with id "${n.owner}" to actors[], or fix the owner`,
      });
    }
  }
  for (const e of doc.edges) {
    if (!nodeIds.has(e.from)) {
      errors.push({ code: "dangling-edge", severity: "error", message: `edge from "${e.from}" → "${e.to}" has unknown source "${e.from}"` });
    }
    if (!nodeIds.has(e.to)) {
      errors.push({ code: "dangling-edge", severity: "error", message: `edge from "${e.from}" → "${e.to}" has unknown target "${e.to}"` });
    }
  }

                                                                               
                                                                                
  const workspaceIds = new Set<string>(opts.siblingIds ?? [doc.id, ...others.map((d) => d.id)]);
  for (const n of doc.nodes) {
    if (n.type === "subflow" && n.subflow && !workspaceIds.has(n.subflow)) {
      warnings.push({
        code: "dangling-subflow",
        severity: "warning",
        message: `subflow node "${n.id}" drills into "${n.subflow}", which is not in the workspace yet`,
      });
    }
  }
  for (const e of doc.edges) {
    if (e.subflow && !workspaceIds.has(e.subflow)) {
      warnings.push({
        code: "dangling-subflow",
        severity: "warning",
        message: `edge "${e.from}" → "${e.to}" drills into "${e.subflow}", which is not in the workspace yet`,
      });
    }
  }
                                                                     
  for (const n of doc.nodes) {
    if (n.sequence && !workspaceIds.has(n.sequence)) {
      warnings.push({
        code: "dangling-sequence",
        severity: "warning",
        message: `node "${n.id}" drills into sequence "${n.sequence}", which is not in the workspace yet`,
      });
    }
  }
  for (const e of doc.edges) {
    if (e.sequence && !workspaceIds.has(e.sequence)) {
      warnings.push({
        code: "dangling-sequence",
        severity: "warning",
        message: `edge "${e.from}" → "${e.to}" drills into sequence "${e.sequence}", which is not in the workspace yet`,
      });
    }
  }

                                                   
                                                                               
                                                                                 
                                                                                  
                                                                               
                                                                                 
                                                             
                                                                           
                                                                      
  type Occ = { flowId: string; kind: string; owner?: string; label?: string; definition: string | null };
  const sharedById = new Map<string, Occ[]>();
  const collectShared = (d: FlowDocument) => {
    const add = (id: string, occ: Occ) => sharedById.set(id, [...(sharedById.get(id) ?? []), occ]);
    for (const n of d.nodes) {
      if (n.shared) add(n.id, { flowId: d.id, kind: `node/${n.type}`, owner: n.owner, label: n.text, definition: sourceDefinition(n.source) });
    }
    for (const e of d.edges) {
      if (e.shared && e.id) add(e.id, { flowId: d.id, kind: `edge/${e.type}`, label: e.text, definition: sourceDefinition(e.source) });
    }
  };
  collectShared(doc);
  const ownShared = new Set(sharedById.keys());
  others.forEach(collectShared);
  for (const id of ownShared) {
    const occ = sharedById.get(id) ?? [];
    const kinds = new Set(occ.map((o) => o.kind));
    const owners = new Set(occ.map((o) => o.owner ?? "-"));
    if (kinds.size > 1 || owners.size > 1) {
      const where = occ.map((o) => `${o.flowId}(${o.kind}/${o.owner ?? "-"})`).join(" vs ");
      errors.push({
        code: "shared-conflict",
        severity: "error",
        message: `shared id "${id}" is inconsistent across flows: ${where} — one id, conflicting nature`,
        suggestion: "make the shared object identical everywhere, or give the differing ones distinct ids",
      });
      continue;
    }
    const labels = new Set(occ.map((o) => normalizeLabel(o.label ?? "")).filter(Boolean));
    const definitions = new Set(occ.map((o) => o.definition).filter(Boolean));
    if (labels.size > 1 || definitions.size > 1) {
      const where = occ
        .map((o) => `${o.flowId}(${o.label ? `"${o.label}"` : "no text"}${o.definition ? `, ${o.definition}` : ""})`)
        .join(" vs ");
      warnings.push({
        code: "shared-divergence",
        severity: "warning",
        message: `shared id "${id}" is one object, but its ${labels.size > 1 ? "text" : "source"}${labels.size > 1 && definitions.size > 1 ? " and source" : ""} differ across flows: ${where}`,
        suggestion: "if it is the same object, align its text and source; if these are different things, give them distinct ids",
      });
    }
  }
                                                                                 
                                                                                   
                                                                                     
  const sharedOnlyHere = new Map<string, string[]>();
  for (const d of others) {
    if (d.id === doc.id) continue;
    for (const o of [...d.nodes, ...d.edges.filter((e) => e.id)] as Array<{ id?: string; shared?: boolean }>) {
      if (o.id && !o.shared && ownShared.has(o.id)) sharedOnlyHere.set(o.id, [...(sharedOnlyHere.get(o.id) ?? []), d.id]);
    }
  }
  for (const [id, flows] of sharedOnlyHere) {
    warnings.push({
      code: "shared-one-sided",
      severity: "warning",
      message: `"${id}" is shared here, but in ${flows.map((f) => `flow ${f}`).join(", ")} the object with this id is not shared — they are not linked`,
      suggestion: `if it is the same object, set shared: true on "${id}" there too; if not, give this one another id`,
    });
  }

                                                                               
                                                                             
  const incoming = new Set(doc.edges.map((e) => e.to));
  const outgoing = new Set(doc.edges.map((e) => e.from));
  const hasStart = doc.nodes.some((n) => n.type === "terminal" && !incoming.has(n.id));
  const hasDone = doc.nodes.some((n) => n.type === "terminal" && !outgoing.has(n.id));
  if (!hasStart) {
    warnings.push({
      code: "no-start-terminal",
      severity: "warning",
      message: "flow has no Start terminal (a terminal node with no incoming edges)",
      suggestion: "add a terminal node marking the entry point",
    });
  }
  if (!hasDone) {
    warnings.push({
      code: "no-done-terminal",
      severity: "warning",
      message: "flow has no Done terminal (a terminal node with no outgoing edges)",
      suggestion: "add a terminal node marking the exit point",
    });
  }

                                                                              
                                                                               
                                                                          
  if (doc.actors.length >= 1) {
    const ownable = doc.nodes.filter((n) => n.type !== "terminal");
    const unowned = ownable.filter((n) => !n.owner);
    if (ownable.length > 0 && unowned.length > 0) {
      const ids = unowned.slice(0, 6).map((n) => `"${n.id}"`).join(", ");
      const more = unowned.length > 6 ? `, …(+${unowned.length - 6} more)` : "";
      const all = unowned.length === ownable.length;
      warnings.push({
        code: "nodes-without-owner",
        severity: "warning",
        message: all
          ? `${doc.actors.length} actor(s) declared but no node has an owner — the diagram cannot be color-coded by actor`
          : `${unowned.length} of ${ownable.length} nodes have no owner: ${ids}${more}`,
        suggestion: `set "owner" to an actor id (one of: ${doc.actors.map((a) => a.id).join(", ")}) so each node is colored by who performs it`,
      });
    }
  }

                                                                                  
                                                                                  
                                                                                  
                                                                              
                                                                                 
                                 
  const splits = detectSplits(doc, others);
  for (const s of splits.slice(0, MAX_SPLIT_SIGNALS)) {
    const issue = { message: s.message, suggestion: s.suggestion };
    if (s.evidence === "same-definition") warnings.push({ code: "possible-split", severity: "warning", ...issue });
    else hints.push({ code: "similar-node", severity: "hint", ...issue });
  }
  if (splits.length > MAX_SPLIT_SIGNALS) {
    hints.push({
      code: "more-similar-nodes",
      severity: "hint",
      message: `${splits.length - MAX_SPLIT_SIGNALS} more look-alike pairs not shown — the strongest are listed above`,
      suggestion: "no action needed; steps repeated across many flows are often a template rather than one object",
    });
  }

  return { ok: errors.length === 0, errors, warnings, hints };
}
