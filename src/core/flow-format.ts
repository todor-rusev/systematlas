                                                                           
                                                                                 
                                                                                 
                                                                              
                                 

import { FLOW_VERSION, type FlowDocument } from "./types";

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

                                                                                                 
export function isLegacyFlow(raw: unknown): raw is Json {
  return isObject(raw) && raw.kind !== "sequence" && raw.version === "1";
}

                                                                                         
                                                                                  
export function pointsToMarkdown(points: unknown): unknown {
  if (!Array.isArray(points) || !points.every((p) => typeof p === "string")) return points;
  const items = points as string[];
  if (items.length === 1) return items[0];
  return items.map((point) => `- ${point.replace(/\r?\n/g, "\n  ")}`).join("\n");
}

                                                                             
function upgradeObject(object: unknown): unknown {
  if (!isObject(object)) return object;
  const upgraded: Json = {};
  for (const [key, value] of Object.entries(object)) {
    if (key === "label") upgraded.text = value;
    else if (key === "description") upgraded.details = pointsToMarkdown(value);
    else upgraded[key] = value;
  }
  return upgraded;
}

   
                                                                             
                                                                              
                                                         
   
export function upgradeFlow(raw: unknown): unknown {
  if (!isLegacyFlow(raw)) return raw;
  return {
    ...raw,
    version: FLOW_VERSION,
    nodes: Array.isArray(raw.nodes) ? raw.nodes.map(upgradeObject) : raw.nodes,
    edges: Array.isArray(raw.edges) ? raw.edges.map(upgradeObject) : raw.edges,
  };
}

                                                                                 
export function upgradeDoc<T>(raw: T): T {
  return upgradeFlow(raw) as T;
}

export type { FlowDocument };
