                                                                                     
                                                                                
               
import type { ValidationResult } from "../core/validate";

export function renderResult(r: ValidationResult): string {
  if (r.ok && r.warnings.length === 0 && r.hints.length === 0) return "✓ valid — no issues.";
  const header = !r.ok ? "✗ invalid:" : r.warnings.length ? "✓ valid (with warnings):" : "✓ valid (hints only — no action needed):";
  const lines: string[] = [header];
  for (const e of r.errors) lines.push(`  ERROR [${e.code}] ${e.message}${e.suggestion ? ` → ${e.suggestion}` : ""}`);
  for (const w of r.warnings) lines.push(`  WARN  [${w.code}] ${w.message}${w.suggestion ? ` (${w.suggestion})` : ""}`);
  for (const h of r.hints) lines.push(`  HINT  [${h.code}] ${h.message}${h.suggestion ? ` (${h.suggestion})` : ""}`);
  return lines.join("\n");
}
