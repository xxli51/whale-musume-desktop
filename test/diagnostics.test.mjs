import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import diagnosticsApi from "../runtime/diagnostics.cjs";

test("diagnostics writes structured local JSON lines and rotates safely", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "whale-diagnostics-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const fixedNow = new Date("2026-08-25T12:00:00.000Z").getTime();
  const diagnostics = diagnosticsApi.createDiagnostics({ directory, maxBytes: 1024, now: () => fixedNow });

  const entry = diagnostics.info("test-event", { value: 42 });
  assert.equal(entry.at, "2026-08-25T12:00:00.000Z");
  assert.equal(entry.level, "info");
  assert.deepEqual(entry.details, { value: 42 });

  const firstLine = fs.readFileSync(diagnostics.filePath, "utf8").trim();
  assert.deepEqual(JSON.parse(firstLine), entry);

  for (let i = 0; i < 30; i += 1) diagnostics.warn("large-entry", { text: "x".repeat(100) });
  assert.equal(fs.existsSync(diagnostics.filePath + ".1"), true);
});

test("diagnostics serializes errors and circular values without throwing", () => {
  const error = new Error("boom");
  assert.equal(diagnosticsApi.safeDetails(error).message, "boom");
  const circular = {};
  circular.self = circular;
  assert.doesNotThrow(() => diagnosticsApi.safeDetails(circular));
});
