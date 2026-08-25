import test from "node:test";
import assert from "node:assert/strict";

import monitorPolicy from "../runtime/computer-monitor-policy.cjs";

const { shouldRunComputerMonitor } = monitorPolicy;

test("computer monitor only runs while the opted-in companion is visible and active", () => {
  const active = {
    preferenceEnabled: true,
    overlayVisible: true,
    quietActive: false,
    systemPaused: false
  };

  assert.equal(shouldRunComputerMonitor(active), true);
  for (const blockedBy of ["preferenceEnabled", "overlayVisible", "quietActive", "systemPaused"]) {
    const next = { ...active };
    next[blockedBy] = blockedBy === "preferenceEnabled" || blockedBy === "overlayVisible" ? false : true;
    assert.equal(shouldRunComputerMonitor(next), false, `${blockedBy} should pause monitoring`);
  }
});

test("computer monitor policy defaults to stopped for incomplete state", () => {
  assert.equal(shouldRunComputerMonitor(), false);
  assert.equal(shouldRunComputerMonitor({ preferenceEnabled: true }), false);
  assert.equal(shouldRunComputerMonitor({ overlayVisible: true }), false);
});
