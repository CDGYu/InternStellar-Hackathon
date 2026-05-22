import { strict as assert } from "node:assert";

import { classifyBindResult, normalizeEmail, type BindResult } from "../lib/account/binding";

let passed = 0;
let failed = 0;
function check(label: string, fn: () => void) {
  try { fn(); console.log(`  ok   ${label}`); passed++; }
  catch (e) { console.log(`  FAIL ${label}\n       ${e instanceof Error ? e.message : e}`); failed++; }
}

/** Narrow a BindResult to its failure branch and return the reason. */
function reason(r: BindResult): string {
  if (r.ok) throw new Error("expected a failed BindResult but got ok=true");
  return r.reason;
}

console.log("lib/account/binding — pure helpers");

check("normalizeEmail trims + lowercases", () => {
  assert.equal(normalizeEmail("  Foo@Bar.COM "), "foo@bar.com");
});

check("classify: target not found", () => {
  assert.equal(reason(classifyBindResult({ target: null, expectedRole: "family", actingId: "a" })), "not_found");
});
check("classify: wrong role", () => {
  assert.equal(
    reason(classifyBindResult({ target: { id: "t", role: "store", sponsor_ofw_id: null }, expectedRole: "family", actingId: "a" })),
    "wrong_role",
  );
});
check("classify: self link rejected", () => {
  assert.equal(
    reason(classifyBindResult({ target: { id: "a", role: "family", sponsor_ofw_id: null }, expectedRole: "family", actingId: "a" })),
    "self_link",
  );
});
check("classify: family already sponsored by another OFW", () => {
  assert.equal(
    reason(classifyBindResult({ target: { id: "t", role: "family", sponsor_ofw_id: "other" }, expectedRole: "family", actingId: "a", conflictField: "sponsor_ofw_id" })),
    "already_bound",
  );
});
check("classify: ok when valid", () => {
  const r = classifyBindResult({ target: { id: "t", role: "family", sponsor_ofw_id: null }, expectedRole: "family", actingId: "a" });
  assert.equal(r.ok, true);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
