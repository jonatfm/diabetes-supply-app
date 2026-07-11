import assert from "node:assert/strict";
import test from "node:test";
import {
  canDeleteTrip,
  canTransitionTrip,
  isValidPackedUnitCount,
} from "../src/domain/tripLifecycle.ts";

test("a trip can only be deleted before it has ever started", () => {
  assert.equal(canDeleteTrip({ state: "PLANNED", startedAt: null }), true);
  assert.equal(canDeleteTrip({ state: "PACKED", startedAt: null }), true);
  assert.equal(canDeleteTrip({ state: "ACTIVE", startedAt: 100 }), false);
  assert.equal(canDeleteTrip({ state: "COMPLETE", startedAt: 100 }), false);
  assert.equal(canDeleteTrip({ state: "PLANNED", startedAt: 100 }), false);
});

test("the lifecycle only permits forward transitions and pre-start repacking", () => {
  assert.equal(canTransitionTrip({ state: "PLANNED", startedAt: null }, "PACKED"), true);
  assert.equal(canTransitionTrip({ state: "PACKED", startedAt: null }, "PLANNED"), true);
  assert.equal(canTransitionTrip({ state: "PACKED", startedAt: null }, "ACTIVE"), true);
  assert.equal(canTransitionTrip({ state: "ACTIVE", startedAt: 100 }, "COMPLETE"), true);
  assert.equal(canTransitionTrip({ state: "PLANNED", startedAt: null }, "ACTIVE"), false);
  assert.equal(canTransitionTrip({ state: "COMPLETE", startedAt: 100 }, "ACTIVE"), false);
  assert.equal(canTransitionTrip({ state: "PACKED", startedAt: 100 }, "PLANNED"), false);
});

test("packed allocations must contain positive whole units", () => {
  assert.equal(isValidPackedUnitCount(1), true);
  assert.equal(isValidPackedUnitCount(0), false);
  assert.equal(isValidPackedUnitCount(-1), false);
  assert.equal(isValidPackedUnitCount(1.5), false);
});
