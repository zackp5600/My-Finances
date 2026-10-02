import { test } from "node:test";
import assert from "node:assert/strict";
import { monthsToGoal, formatGoalDuration } from "../app/components/goal-projection.mjs";

test("goal timing uses monthly compounding and end-of-month contributions", () => {
  assert.equal(monthsToGoal(1000, 2000, 0, 0.12), 70);
  assert.equal(monthsToGoal(0, 1200, 100, 0), 12);
  assert.equal(monthsToGoal(1000, 2200, 100, 0.12), 11);
});

test("goal timing handles reached, impossible, and invalid cases", () => {
  assert.equal(monthsToGoal(5000, 4000, 0, 0.04), 0);
  assert.equal(monthsToGoal(0, 1000, 0, 0.08), null);
  assert.equal(monthsToGoal(0, 2000, 1, 0), null);
  assert.equal(monthsToGoal(-1, 1000, 100, 0.04), null);
  assert.equal(formatGoalDuration(13), "1 year, 1 month");
});
