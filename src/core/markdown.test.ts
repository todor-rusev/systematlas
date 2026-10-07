import { test } from "node:test";
import assert from "node:assert/strict";
import { hasMarkup, inlineRuns, parseBlocks, parseInline, plainText, safeHref } from "./markdown";

test("inline: code, strong, links, bare URLs and line breaks", () => {
  assert.deepEqual(parseInline("Retry `POST /charges` **3 times**"), [
    { kind: "text", text: "Retry " },
    { kind: "code", text: "POST /charges" },
    { kind: "text", text: " " },
    { kind: "strong", children: [{ kind: "text", text: "3 times" }] },
  ]);
  assert.deepEqual(parseInline("See [docs](https://example.com/a)\nnext"), [
    { kind: "text", text: "See " },
    { kind: "link", href: "https://example.com/a", children: [{ kind: "text", text: "docs" }] },
    { kind: "break" },
    { kind: "text", text: "next" },
  ]);
  assert.deepEqual(parseInline("at https://example.com/x."), [
    { kind: "text", text: "at " },
    { kind: "link", href: "https://example.com/x", children: [{ kind: "text", text: "https://example.com/x" }] },
    { kind: "text", text: "." },
  ]);
});

test("inline: anything outside the subset stays literal, including unsafe links", () => {
  for (const source of ["snake_case_name", "a * b * c", "<b>bold</b>", "unclosed `tick", "**open"]) {
    assert.equal(plainText(source), source, source);
    assert.equal(hasMarkup(source), false, source);
  }
  assert.deepEqual(parseInline("[x](javascript:alert(1))"), [{ kind: "text", text: "[x](javascript:alert(1))" }]);
  assert.equal(safeHref("javascript:alert(1)"), null);
  assert.equal(safeHref("mailto:a@b.c"), "mailto:a@b.c");
});

test("blocks: paragraphs, lists with continuation lines, fenced code", () => {
  const blocks = parseBlocks("First paragraph\nstill first.\n\n- one\n  continued\n- two\n\n1. a\n2. b\n\n```ts\nconst x = `y`;\n```");
  assert.deepEqual(blocks.map((b) => b.kind), ["paragraph", "list", "list", "code"]);
  assert.equal(plainText("First paragraph\nstill first."), "First paragraph\nstill first.");
  const bullets = blocks[1] as Extract<(typeof blocks)[number], { kind: "list" }>;
  assert.equal(bullets.ordered, false);
  assert.equal(bullets.items.length, 2);
  assert.deepEqual(bullets.items[0], [{ kind: "text", text: "one" }, { kind: "break" }, { kind: "text", text: "continued" }]);
  assert.equal((blocks[2] as { ordered: boolean }).ordered, true);
  assert.deepEqual(blocks[3], { kind: "code", language: "ts", text: "const x = `y`;" });
});

test("runs mark code for width estimates", () => {
  assert.deepEqual(inlineRuns("call `f()` now"), [
    { text: "call ", code: false },
    { text: "f()", code: true },
    { text: " now", code: false },
  ]);
});
