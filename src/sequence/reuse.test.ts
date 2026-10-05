import { test } from "node:test";
import assert from "node:assert/strict";
import { reuseGroups } from "./reuse";
import type { SequenceCall } from "../core/sequence-types";

const call = (id: string, to: string, method: string, source?: SequenceCall["source"]): SequenceCall => ({
  id,
  to,
  method,
  ...(source ? { source } : {}),
});
const groupOf = (calls: SequenceCall[], id: string) => reuseGroups(calls).get(id);

test("the same message to the same participant from two places is one group", () => {
  const calls = [call("a", "db", "Database.query"), call("b", "db", "Database.query")];
  assert.deepEqual(groupOf(calls, "a"), ["a", "b"]);
  assert.deepEqual(groupOf(calls, "b"), ["a", "b"]);
});

test("the whole label counts: text in parentheses can carry meaning", () => {
  const calls = [call("a", "board", "Review (legal)"), call("b", "board", "Review (budget)")];
  assert.deepEqual(groupOf(calls, "a"), ["a"]);
  assert.deepEqual(groupOf(calls, "b"), ["b"]);
});

test("a call without a definition joins the single known definition of its label", () => {
  const calls = [call("a", "db", "save", { file: "order.ts", symbol: "Order.save" }), call("b", "db", "save")];
  assert.deepEqual(groupOf(calls, "b"), ["a", "b"]);
});

test("two definitions of one label split the group; an unknown call bridges neither", () => {
  const calls = [
    call("a", "db", "save", { file: "order.ts", symbol: "Order.save" }),
    call("b", "db", "save"),
    call("c", "db", "save", { file: "audit.ts", symbol: "Audit.save" }),
    call("d", "db", "save", { file: "order.ts", symbol: "Order.save", line: 99 }),
  ];
  assert.deepEqual(groupOf(calls, "a"), ["a", "d"]);                                      
  assert.deepEqual(groupOf(calls, "b"), ["b"]);
  assert.deepEqual(groupOf(calls, "c"), ["c"]);
});

test("an empty or partial source is no definition: it neither groups nor splits", () => {
  const calls = [
    call("a", "api", "debit", {}),
    call("b", "api", "credit", {}),
    call("c", "api", "refund", { file: "payment.ts" }),
    call("d", "api", "charge", { file: "payment.ts" }),
  ];
  for (const id of ["a", "b", "c", "d"]) assert.deepEqual(groupOf(calls, id), [id]);
});

test("one symbol naming a class does not merge different labels", () => {
  const ref = { file: "payment.ts", symbol: "PaymentService" };
  const calls = [call("a", "api", "debit", ref), call("b", "api", "credit", ref)];
  assert.deepEqual(groupOf(calls, "a"), ["a"]);
  assert.deepEqual(groupOf(calls, "b"), ["b"]);
});

test("the same label to two participants is two groups", () => {
  const calls = [call("a", "orders", "save"), call("b", "audit", "save")];
  assert.deepEqual(groupOf(calls, "a"), ["a"]);
  assert.deepEqual(groupOf(calls, "b"), ["b"]);
});

test("Windows and POSIX paths of one file are one definition", () => {
  const calls = [
    call("a", "db", "save", { file: "src\\order.ts", symbol: "Order.save" }),
    call("b", "db", "save", { file: "src/order.ts", symbol: "Order.save" }),
    call("c", "db", "save", { file: "src/audit.ts", symbol: "Audit.save" }),
  ];
  assert.deepEqual(groupOf(calls, "a"), ["a", "b"]);
});
