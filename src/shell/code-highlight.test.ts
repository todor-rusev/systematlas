import assert from "node:assert/strict";
import { test } from "node:test";
import { tokens } from "../tokens";
import { canHighlight, highlightCode, syntaxRole } from "./code-highlight";

const join = (code: string, language: string) => highlightCode(code, language).map((r) => r.text).join("");
const roleOf = (code: string, language: string, text: string) =>
  syntaxRole(highlightCode(code, language).find((r) => r.text === text)?.classes ?? []);

test("highlighting never changes the code text", () => {
  const samples: [string, string][] = [
    ['const total = await charge("eur", 12.5); // cents', "ts"],
    ['{ "amount": 1250, "ok": true, "tags": null }', "json"],
    ["SELECT id FROM orders WHERE status = 'paid';", "sql"],
    ["def refund(order):\n    return order.total  # full", "python"],
    ["curl -X POST https://api.example.com/charges \\\n  -d amount=1250", "bash"],
  ];
  for (const [code, language] of samples) assert.equal(join(code, language), code, language);
});

test("tokens get the role of their Prism class", () => {
  const ts = 'const total = await charge("eur", 12.5); // cents';
  assert.equal(roleOf(ts, "ts", "const"), "keyword");
  assert.equal(roleOf(ts, "ts", "charge"), "func");
  assert.equal(roleOf(ts, "ts", '"eur"'), "string");
  assert.equal(roleOf(ts, "ts", "12.5"), "number");
  assert.equal(roleOf(ts, "ts", "// cents"), "comment");
  assert.equal(roleOf('{ "amount": 1250 }', "json", '"amount"'), "property");
});

test("common fence names and aliases are known; others stay plain", () => {
  for (const name of ["ts", "typescript", "js", "json", "py", "sh", "bash", "sql", "yaml", "yml", "go", "java", "csharp", "rust", "diff", "html"])
    assert.ok(canHighlight(name), name);
  assert.ok(canHighlight("TS"), "case-insensitive");
  assert.deepEqual(highlightCode("a < b", "no-such-lang"), [{ text: "a < b", classes: [] }]);
  assert.deepEqual(highlightCode("a < b", ""), [{ text: "a < b", classes: [] }]);
});

test("the innermost class with a role wins", () => {
  assert.equal(syntaxRole(["template-string", "punctuation"]), "punctuation");
  assert.equal(syntaxRole(["string", "unknown-class"]), "string");
  assert.equal(syntaxRole(["unknown-class"]), null);
});

                                      
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("every syntax colour keeps AA contrast on the code block background", () => {
  for (const [role, colour] of Object.entries(tokens.syntax))
    assert.ok(contrast(colour, tokens.color.field) >= 4.5, `${role} ${contrast(colour, tokens.color.field).toFixed(2)}`);
});
