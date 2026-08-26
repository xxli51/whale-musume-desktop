import test from "node:test";
import assert from "node:assert/strict";

import storageApi from "../renderer/storage.js";
import settingsData from "../renderer/settings-data.js";

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
    this.failOnceFor = null;
  }
  get length() {
    return this.values.size;
  }
  key(index) {
    return [...this.values.keys()][index] ?? null;
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    if (this.failOnceFor === key) {
      this.failOnceFor = null;
      throw new Error("quota exceeded");
    }
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

test("storage repairs invalid values and emits validated changes", () => {
  const raw = new MemoryStorage({ "whale-moe:mood": "not-a-number" });
  const changes = [];
  const storage = storageApi.createStore(raw, (key, value) => changes.push([key, value]));

  assert.equal(storage.get("mood", "70"), "70");
  assert.equal(raw.getItem("whale-moe:mood"), null);
  assert.deepEqual(changes, [["mood", null]]);
  assert.throws(() => storage.set("displayScale", 999), /无效的存储字段/);
});

test("save export uses version 2 and keeps the weather key private", () => {
  const raw = new MemoryStorage({
    "whale-moe:mood": "80",
    "whale-moe:pet": "1",
    "whale-moe:petName": "小鲸",
    "whale-moe:weatherKey": "keep-local",
    unrelated: "ignored"
  });
  const payload = storageApi.createStore(raw).exportPayload(new Date(2026, 7, 25).getTime());

  assert.equal(payload.version, 2);
  assert.equal(payload.data["whale-moe:mood"], "80");
  assert.equal(payload.data["whale-moe:pet"], "1");
  assert.equal(payload.data["whale-moe:petName"], "小鲸");
  assert.equal(payload.data["whale-moe:weatherKey"], undefined);
  assert.equal(payload.data.unrelated, undefined);
});

test("save import accepts version 1, rejects unknown fields and rolls back partial writes", () => {
  const raw = new MemoryStorage({ "whale-moe:mood": "70", "whale-moe:affinity": "10" });
  const storage = storageApi.createStore(raw);
  const legacy = {
    format: "whale-musume-save",
    version: 1,
    data: { "whale-moe:mood": "90", "whale-moe:affinity": "20" }
  };

  assert.equal(storage.importPayload(legacy), 2);
  assert.equal(storage.get("mood", "0"), "90");
  assert.throws(
    () =>
      storage.importPayload({
        format: "whale-musume-save",
        version: 2,
        data: { "whale-moe:unknown": "value" }
      }),
    /存档字段无效/
  );

  raw.failOnceFor = "whale-moe:affinity";
  assert.throws(
    () =>
      storage.importPayload({
        format: "whale-musume-save",
        version: 2,
        data: { "whale-moe:mood": "40", "whale-moe:affinity": "30" }
      }),
    /quota exceeded/
  );
  assert.equal(storage.get("mood", "0"), "90");
  assert.equal(storage.get("affinity", "0"), "20");
});

test("settings catalog stays modular, complete and unique", () => {
  const poses = settingsData.POSE_GROUPS.flatMap((group) => group.poses);
  assert.equal(poses.length, 89);
  assert.equal(new Set(poses).size, poses.length);
  assert.ok(settingsData.TOGGLES.some((item) => item[0] === "auto-walk"));
  assert.deepEqual(
    settingsData.TOGGLES.find((item) => item[0] === "window-perch"),
    ["window-perch", "最大化窗口栖息", false]
  );
  assert.equal(new Set(settingsData.ACHIEVEMENTS.map((item) => item[0])).size, settingsData.ACHIEVEMENTS.length);
});
