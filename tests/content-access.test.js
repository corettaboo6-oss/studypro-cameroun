import test from "node:test";
import assert from "node:assert/strict";
import { canAccessContent, hasActivePaidSubscription } from "../api/content-access.js";

const now = Date.parse("2026-11-11T12:00:00Z");
const sub = plan => ({ plan, status: "active", current_period_end: "2026-12-11T12:00:00Z" });
const lesson = { required_plan: "premium" };
const mockExam = { required_plan: "premium_plus" };

test("Premium unlocks detailed lessons", () => {
  assert.equal(canAccessContent(sub("premium"), lesson, now), true);
});
test("Premium Plus unlocks detailed lessons and mock exams", () => {
  assert.equal(canAccessContent(sub("premium_plus"), lesson, now), true);
  assert.equal(canAccessContent(sub("premium_plus"), mockExam, now), true);
});
test("Premium cannot unlock Premium Plus mock exams", () => {
  assert.equal(canAccessContent(sub("premium"), mockExam, now), false);
});
test("free, expired, cancelled and unknown plans are denied", () => {
  assert.equal(canAccessContent(sub("free"), lesson, now), false);
  assert.equal(canAccessContent({ ...sub("premium"), current_period_end: "2026-11-10T12:00:00Z" }, lesson, now), false);
  assert.equal(canAccessContent({ ...sub("premium"), status: "cancelled" }, lesson, now), false);
  assert.equal(canAccessContent(sub("staff"), lesson, now), false);
});
test("unknown or free content labels fail closed", () => {
  assert.equal(canAccessContent(sub("premium_plus"), { required_plan: "admin" }, now), false);
  assert.equal(canAccessContent(sub("premium_plus"), { required_plan: "free" }, now), false);
});
test("missing and invalid expiry are denied", () => {
  assert.equal(hasActivePaidSubscription({ plan: "premium", status: "active" }, now), false);
  assert.equal(hasActivePaidSubscription({ ...sub("premium"), current_period_end: "not-a-date" }, now), false);
});
