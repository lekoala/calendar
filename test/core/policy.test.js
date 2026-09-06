import assert from "node:assert/strict";
import test from "node:test";
import { normalizePolicyDecision } from "../../src/core/policy.js";

test("true and non-answers allow", () => {
  assert.deepEqual(normalizePolicyDecision(true), { ok: true, reason: null });
  assert.deepEqual(normalizePolicyDecision(undefined), { ok: true, reason: null });
  assert.deepEqual(normalizePolicyDecision(null), { ok: true, reason: null });
  assert.deepEqual(normalizePolicyDecision(0), { ok: true, reason: null });
});

test("false refuses without a reason", () => {
  assert.deepEqual(normalizePolicyDecision(false), { ok: false, reason: null });
});

test("a reason string refuses with feedback", () => {
  assert.deepEqual(normalizePolicyDecision("Past"), { ok: false, reason: "Past" });
});

test("an empty string refuses without a meaningful reason", () => {
  assert.deepEqual(normalizePolicyDecision(""), { ok: false, reason: null });
});
