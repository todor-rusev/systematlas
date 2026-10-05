                                                                   
import type { FlowDocument } from "./types";
import type { SequenceDocument } from "./sequence-types";
import { validateFlow, type Issue, type ValidationResult } from "./validate";
import { validateSequence } from "./validate-sequence";

export type AnyDoc = FlowDocument | SequenceDocument;
export type DocKind = "flow" | "sequence";

export function docKind(d: AnyDoc): DocKind {
  return (d as SequenceDocument).kind === "sequence" ? "sequence" : "flow";
}

   
                                                                                   
                                                                                  
                                                                             
   
function validateTwin(doc: AnyDoc, allDocs: AnyDoc[]): { errors: Issue[]; warnings: Issue[] } {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const twin = doc.twin;
  if (!twin) return { errors, warnings };
  if (twin === doc.id) {
    errors.push({ code: "self-twin", severity: "error", message: `document "${doc.id}" lists itself as its twin` });
    return { errors, warnings };
  }
  const found = allDocs.find((d) => d.id === twin && d.id !== doc.id);
  if (!found) {
    warnings.push({
      code: "dangling-twin",
      severity: "warning",
      message: `twin "${twin}" is not in the workspace yet`,
      suggestion: `author "${twin}" (the other altitude of this scenario), or fix the twin id`,
    });
    return { errors, warnings };
  }
                                                                      
  if (found.twin && found.twin !== doc.id) {
    warnings.push({
      code: "conflicting-twin",
      severity: "warning",
      message: `twin "${twin}" points to "${found.twin}", not back to "${doc.id}"`,
      suggestion: `set the twin of "${twin}" to "${doc.id}" so the pairing is mutual`,
    });
  }
                                                                                          
  if (docKind(found) === docKind(doc)) {
    warnings.push({
      code: "same-kind-twin",
      severity: "warning",
      message: `twin "${twin}" is also a ${docKind(doc)} — twins usually pair a Flow with a Sequence (two altitudes of one scenario)`,
    });
  }
  return { errors, warnings };
}

   
                                                                          
                                                                                
                                                                                
                                                                                  
   
export function validateDoc(doc: AnyDoc, allDocs: AnyDoc[]): ValidationResult {
  const base =
    docKind(doc) === "sequence"
      ? validateSequence(doc as SequenceDocument)
      : validateFlow(doc as FlowDocument, {
          others: allDocs.filter((d) => docKind(d) === "flow" && d.id !== doc.id) as FlowDocument[],
          siblingIds: Array.from(new Set([doc.id, ...allDocs.map((d) => d.id)])),
        });
                                                                                  
                                                                       
  if (base.errors.some((e) => e.code.startsWith("schema/"))) return base;
  const twin = validateTwin(doc, allDocs);
  if (!twin.errors.length && !twin.warnings.length) return base;
  const errors = [...base.errors, ...twin.errors];
  return { ok: errors.length === 0, errors, warnings: [...base.warnings, ...twin.warnings], hints: base.hints };
}
