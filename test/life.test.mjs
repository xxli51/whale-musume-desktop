import test from "node:test";
import assert from "node:assert/strict";
import lifeCore from "../renderer/life-core.js";

const baseContext = {
  hour: 12,
  weather: "clear",
  mood: 70,
  satiety: 80,
  profession: "",
  personality: "balanced",
  personalityScore: 0,
  collectionFound: 0,
  title: "主人",
  petName: "鲸鱼娘",
  away: false
};

test("late night and low satiety create explainable life choices", () => {
  const sleep = lifeCore.chooseActivity({}, { ...baseContext, hour: 2 }, () => 0);
  const meal = lifeCore.chooseActivity({}, { ...baseContext, hour: 12, satiety: 20 }, () => 0);
  assert.equal(sleep.id, "sleep");
  assert.equal(meal.id, "meal");

  const started = lifeCore.startActivity({}, { ...baseContext, satiety: 20 }, 1000, () => 0, false);
  assert.equal(started.started, true);
  assert.equal(started.activity.id, "meal");
  assert.match(started.line, /肚子/);
  assert.equal(started.state.current.endsAt, 1000 + 12 * 60000);
});

test("travel and decision cooldown prevent conflicting autonomous activities", () => {
  assert.equal(lifeCore.startActivity({}, { ...baseContext, away: true }, 1000, () => 0, false).reason, "away");
  const cooling = lifeCore.normalizeState({ nextDecisionAt: 5000 });
  assert.equal(lifeCore.startActivity(cooling, baseContext, 4000, () => 0, false).reason, "cooldown");
  assert.equal(lifeCore.startActivity(cooling, baseContext, 4000, () => 0, true).started, true);
});

test("activities resolve after their real deadline and support offline completion", () => {
  const started = lifeCore.startActivity({}, { ...baseContext, satiety: 20 }, 1000, () => 0, false);
  assert.equal(lifeCore.resolveActivity(started.state, started.state.current.endsAt - 1).resolved, false);

  const finishedAt = started.state.current.endsAt + 10 * 60000;
  const resolved = lifeCore.resolveActivity(started.state, finishedAt);
  assert.equal(resolved.resolved, true);
  assert.equal(resolved.entry.offline, true);
  assert.equal(resolved.effect.satiety, 8);
  assert.equal(resolved.state.stats.completed, 1);
  assert.equal(resolved.state.stats.byActivity.meal, 1);
  assert.match(resolved.line, /你不在的时候/);
  assert.ok(resolved.state.nextDecisionAt >= finishedAt + 5 * 60000);
});

test("departing for a journey interrupts home life without granting completion", () => {
  const started = lifeCore.startActivity({}, baseContext, 1000, () => 0.5, true);
  const interrupted = lifeCore.interruptActivity(started.state, 2000, "准备出门旅行");
  assert.equal(interrupted.interrupted, true);
  assert.equal(interrupted.state.current, null);
  assert.equal(interrupted.state.stats.completed, 0);
  assert.equal(interrupted.state.history.length, 0);
  assert.match(interrupted.reason, /旅行/);
});

test("imported life history is bounded and unknown activities are discarded", () => {
  const history = Array.from({ length: 55 }, (_, index) => ({
    activityId: index === 0 ? "unknown" : "tidy",
    startedAt: index,
    completedAt: index + 1,
    outcome: "完成"
  }));
  const state = lifeCore.normalizeState({
    history,
    stats: { completed: -3, byActivity: { tidy: 99999999, unknown: 3 } }
  });
  assert.equal(state.history.length, 39);
  assert.equal(state.stats.byActivity.tidy, 1000000);
  assert.equal(state.stats.byActivity.unknown, undefined);
});
