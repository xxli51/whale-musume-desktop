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

test("adventure state is validated and included in portable saves", () => {
  const raw = new MemoryStorage();
  const storage = storageApi.createStore(raw);
  storage.set("adventure-enabled", "1");
  storage.set("adventureState", JSON.stringify({ version: 1, collection: { "blue-shell": 1 } }));

  const payload = storage.exportPayload(new Date(2026, 7, 26).getTime());
  assert.equal(payload.data["whale-moe:adventure-enabled"], "1");
  assert.match(payload.data["whale-moe:adventureState"], /blue-shell/);
  assert.throws(() => storage.set("adventureState", "not-json"), /无效的存储字段/);
});

test("profession progress is a validated portable save field", () => {
  const raw = new MemoryStorage();
  const storage = storageApi.createStore(raw);
  storage.set("profession-enabled", "1");
  storage.set("professionState", JSON.stringify({ version: 1, careers: { coder: { xp: 20 } } }));
  const payload = storage.exportPayload();

  assert.equal(payload.data["whale-moe:profession-enabled"], "1");
  assert.match(payload.data["whale-moe:professionState"], /coder/);
});

test("relationship memories and personality scores are portable", () => {
  const raw = new MemoryStorage();
  const storage = storageApi.createStore(raw);
  storage.set("relationship-enabled", "1");
  storage.set("relationshipState", JSON.stringify({ version: 1, stageId: "familiar", scores: { affection: 8 } }));
  const payload = storage.exportPayload();

  assert.equal(payload.data["whale-moe:relationship-enabled"], "1");
  assert.match(payload.data["whale-moe:relationshipState"], /affection/);
});

test("whale house selections are included in validated saves", () => {
  const raw = new MemoryStorage();
  const storage = storageApi.createStore(raw);
  storage.set("houseState", JSON.stringify({ version: 1, slots: { desk: "wood-desk" }, visits: 2 }));
  const payload = storage.exportPayload();
  assert.match(payload.data["whale-moe:houseState"], /wood-desk/);
});

test("daily life journal history is included in validated saves", () => {
  const raw = new MemoryStorage();
  const storage = storageApi.createStore(raw);
  storage.set("dailySummaryState", JSON.stringify({ version: 1, current: { date: "2026-8-26" }, history: [] }));
  const payload = storage.exportPayload();
  assert.match(payload.data["whale-moe:dailySummaryState"], /2026-8-26/);
});

test("autonomous life state and preference are portable", () => {
  const raw = new MemoryStorage();
  const storage = storageApi.createStore(raw);
  storage.set("life-enabled", "1");
  storage.set("lifeState", JSON.stringify({ version: 1, stats: { completed: 2, byActivity: { tidy: 2 } } }));
  const payload = storage.exportPayload();
  assert.equal(payload.data["whale-moe:life-enabled"], "1");
  assert.match(payload.data["whale-moe:lifeState"], /tidy/);
});
