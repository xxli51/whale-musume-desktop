import test from "node:test";
import assert from "node:assert/strict";
import dailyCore from "../renderer/daily-summary-core.js";

const profile = {
  petName: "小鲸",
  title: "船长",
  stage: "彼此信赖",
  personality: "认真勤勉",
  personalityId: "diligence",
  primaryCareer: "程序鲸"
};

function snapshot(overrides = {}) {
  return dailyCore.normalizeSnapshot({ mood: 70, satiety: 80, ...overrides });
}

test("a new daily journal starts from a baseline without inventing activity", () => {
  const result = dailyCore.sync({}, "2026-8-26", snapshot({ affinity: 20, activeSeconds: 600 }), profile, 1000);
  assert.equal(result.rolled, null);
  assert.equal(result.state.current.metrics.activeSeconds, 0);
  assert.equal(result.state.current.metrics.affinityGain, 0);
  assert.equal(dailyCore.report(result.state.current, true).activity, 0);
});

test("daily journal accumulates positive deltas from every life system", () => {
  let state = dailyCore.sync(
    {},
    "2026-8-26",
    snapshot({ affinity: 20, signals: { pat: 2 }, careerXp: { coder: 3 }, activeSeconds: 600, journeys: 1 }),
    profile,
    1000
  ).state;
  state = dailyCore.sync(
    state,
    "2026-8-26",
    snapshot({
      affinity: 31,
      signals: { pat: 5, feed: 1 },
      careerXp: { coder: 8 },
      activeSeconds: 1800,
      focusBonuses: 2,
      journeys: 2,
      collectionFound: 1,
      houseVisits: 2,
      gamePlays: 1,
      gameWins: 1,
      questsCompleted: 2
    }),
    profile,
    2000
  ).state;
  assert.deepEqual(state.current.metrics.signals, { pat: 3, feed: 1 });
  assert.equal(state.current.metrics.interactions, 4);
  assert.equal(state.current.metrics.activeSeconds, 1200);
  assert.equal(state.current.metrics.focusRounds, 2);
  assert.equal(state.current.metrics.journeys, 1);
  assert.equal(state.current.metrics.affinityGain, 11);
  assert.match(dailyCore.report(state.current, true).paragraphs.join(""), /程序鲸/);
});

test("counter resets never subtract earlier moments from the same day", () => {
  let state = dailyCore.sync({}, "2026-8-26", snapshot({ houseVisits: 5 }), profile, 1000).state;
  state = dailyCore.sync(state, "2026-8-26", snapshot({ houseVisits: 8 }), profile, 2000).state;
  state = dailyCore.sync(state, "2026-8-26", snapshot({ houseVisits: 1 }), profile, 3000).state;
  state = dailyCore.sync(state, "2026-8-26", snapshot({ houseVisits: 3 }), profile, 4000).state;
  assert.equal(state.current.metrics.houseVisits, 5);
});

test("crossing midnight seals the old page and keeps at most thirty days", () => {
  const first = new Date(2026, 7, 1).getTime();
  let state = dailyCore.sync({}, dailyCore.dayKey(first), snapshot(), profile, first).state;
  for (let offset = 1; offset < 35; offset += 1) {
    const now = first + offset * 86400000;
    state = dailyCore.sync(state, dailyCore.dayKey(now), snapshot(), profile, now).state;
  }
  assert.equal(state.current.date, "2026-9-4");
  assert.equal(state.history.length, 30);
  assert.ok(state.history[0].finalizedAt > 0);
  assert.equal(state.history.at(-1).date, "2026-8-5");
});

test("report voice reflects the personality saved with that day", () => {
  let state = dailyCore.sync({}, "2026-8-26", snapshot({ signals: { pat: 1 } }), profile, 1000).state;
  state = dailyCore.sync(
    state,
    "2026-8-26",
    snapshot({ signals: { pat: 5 }, gamePlays: 2, gameWins: 1 }),
    profile,
    2000
  ).state;
  const report = dailyCore.report(state.current, true);
  assert.equal(report.title, "黏在一起的温柔日常");
  assert.match(report.paragraphs.at(-1), /认真勤勉/);
  assert.ok(report.tags.includes("互动 ×4"));
});

test("autonomous home activities become part of the narrated day", () => {
  let state = dailyCore.sync(
    {},
    "2026-8-26",
    snapshot({ lifeCompleted: 2, lifeActivities: { tidy: 1, music: 1 } }),
    profile,
    1000
  ).state;
  state = dailyCore.sync(
    state,
    "2026-8-26",
    snapshot({ lifeCompleted: 5, lifeActivities: { tidy: 3, music: 2 } }),
    profile,
    2000
  ).state;
  const report = dailyCore.report(state.current, true);
  assert.equal(report.metrics.lifeCompleted, 3);
  assert.match(report.paragraphs.join(""), /整理小屋/);
  assert.ok(report.tags.includes("自主生活 ×3"));
});
