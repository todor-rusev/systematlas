                                                                                    
                                                                                        
                                                                                 
import { refractor } from "refractor";
import type { ElementContent, Root } from "hast";

export type CodeRun = { text: string; classes: string[] };

export type SyntaxRole =
  | "comment" | "keyword" | "string" | "number" | "func" | "type"
  | "property" | "tag" | "punctuation" | "deleted";

                                                                                      
const ROLE: Record<string, SyntaxRole> = {
  comment: "comment", prolog: "comment", doctype: "comment", cdata: "comment", shebang: "comment",
  keyword: "keyword", atrule: "keyword", important: "keyword", rule: "keyword", directive: "keyword",
  string: "string", char: "string", "attr-value": "string", "template-string": "string",
  url: "string", inserted: "string", regex: "string",
  number: "number", boolean: "number", constant: "number", symbol: "number", unit: "number",
  function: "func", "function-name": "func", method: "func",
  "class-name": "type", builtin: "type", namespace: "type", "type-annotation": "type",
  property: "property", "attr-name": "property", key: "property", variable: "property",
  parameter: "property", decorator: "property", annotation: "property",
  tag: "tag", selector: "tag",
  punctuation: "punctuation", operator: "punctuation",
  deleted: "deleted",
};

                                                                        
export function syntaxRole(classes: string[]): SyntaxRole | null {
  for (let i = classes.length - 1; i >= 0; i--) {
    const role = ROLE[classes[i]];
    if (role) return role;
  }
  return null;
}

                                                               
export const canHighlight = (language: string): boolean =>
  !!language && refractor.registered(language.toLowerCase());

                                                                               
                                                         
export function highlightCode(code: string, language: string): CodeRun[] {
  if (!canHighlight(language)) return [{ text: code, classes: [] }];
  const runs: CodeRun[] = [];
  const walk = (nodes: ElementContent[], classes: string[]) => {
    for (const node of nodes) {
      if (node.type === "text") {
        if (node.value) runs.push({ text: node.value, classes });
      } else if (node.type === "element") {
        const own = node.properties.className;
        const names = Array.isArray(own) ? own.map(String).filter((c) => c !== "token") : [];
        walk(node.children, names.length ? [...classes, ...names] : classes);
      }
    }
  };
  const tree: Root = refractor.highlight(code, language.toLowerCase());
  walk(tree.children as ElementContent[], []);
  return runs;
}
