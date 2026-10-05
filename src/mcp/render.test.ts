import { test } from "node:test";
import assert from "node:assert/strict";
import { renderResult } from "./render";
import type { Issue, ValidationResult } from "../core/validate";

const issue = (code: string, severity: Issue["severity"], suggestion?: string): Issue => ({
  code,
  severity,
  message: `${code} message`,
  ...(suggestion ? { suggestion } : {}),
});
const result = (over: Partial<ValidationResult>): ValidationResult => ({ ok: true, errors: [], warnings: [], hints: [], ...over });

test("a clean result says so", () => {
  assert.equal(renderResult(result({})), "✓ valid — no issues.");
});

test("hints alone say that no action is needed", () => {
  const text = renderResult(result({ hints: [issue("similar-node", "hint", "no action needed")] }));
  assert.equal(text, "✓ valid (hints only — no action needed):\n  HINT  [similar-node] similar-node message (no action needed)");
});

test("warnings outrank hints in the header; every level keeps its own prefix, errors first", () => {
  const text = renderResult(
    result({
      ok: false,
      errors: [issue("shared-conflict", "error", "fix it")],
      warnings: [issue("possible-split", "warning")],
      hints: [issue("similar-node", "hint")],
    }),
  );
  assert.deepEqual(text.split("\n"), [
    "✗ invalid:",
    "  ERROR [shared-conflict] shared-conflict message → fix it",
    "  WARN  [possible-split] possible-split message",
    "  HINT  [similar-node] similar-node message",
  ]);
  assert.match(renderResult(result({ warnings: [issue("w", "warning")], hints: [issue("h", "hint")] })), /^✓ valid \(with warnings\):/);
});
