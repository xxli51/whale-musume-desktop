import test from "node:test";
import assert from "node:assert/strict";

import adventure from "../renderer/adventure-core.js";

const context = {
  hour: 22,
  weather: "rain",
  activity: "ide",
  city: "上海",
  title: "队长",
  petName: "小鲸",
  focusRounds: 3
};

test("journeys start from context and only resolve after their return time", () => {
  const now = new Date(2026, 7, 26, 22).getTime();
  const started = adventure.startJourney(null, "nearby", context, now, () => 0.25);

  assert.equal(started.started, true);
  assert.equal(started.journey.context.title, "队长");
  assert.equal(started.journey.returnsAt, now + adventure.ROUTES.nearby.durationMs);
  assert.ok(adventure.locationById(started.journey.locationId));
  assert.match(started.line, /队长/);
  assert.match(started.line, /5 分钟/);

  const early = adventure.resolveJourney(started.state, started.journey.returnsAt - 1);
  assert.equal(early.resolved, false);
  assert.equal(early.reason, "not-ready");

  const returned = adventure.resolveJourney(started.state, started.journey.returnsAt);
  assert.equal(returned.resolved, true);
  assert.equal(returned.state.current, null);
  assert.equal(returned.state.stats.completed, 1);
  assert.equal(returned.state.journeys.length, 1);
  assert.equal(returned.state.collection[returned.item.name], undefined, "collections use stable item ids");
  assert.equal(returned.state.collection[returned.journey.itemId], 1);
  assert.match(returned.journey.diary, /队长/);
  assert.match(returned.line, /队长/);
  assert.match(returned.line, new RegExp(returned.item.name));
  assert.ok(returned.journey.story.length > 20);
});

test("the same seed and context produce the same remembered journey", () => {
  const now = 123_456_789;
  const first = adventure.startJourney(adventure.blankState(), "outing", context, now, () => 0.123456);
  const second = adventure.startJourney(adventure.blankState(), "outing", context, now, () => 0.123456);
  const firstResult = adventure.resolveJourney(first.state, first.journey.returnsAt);
  const secondResult = adventure.resolveJourney(second.state, second.journey.returnsAt);

  assert.deepEqual(firstResult.journey, secondResult.journey);
  assert.equal(firstResult.state.memory.entries[0].summary, secondResult.state.memory.entries[0].summary);
});

test("normalization bounds imported memories and rejects unknown collectibles", () => {
  const dirty = {
    collection: { "blue-shell": 4, invented: 999, "star-sand": -2 },
    memory: {
      recentItems: ["invented", "blue-shell"],
      entries: Array.from({ length: 60 }, (_, index) => ({ at: index, summary: `memory ${index}` }))
    },
    stats: { completed: -20 }
  };
  const normalized = adventure.normalizeState(dirty);

  assert.deepEqual(normalized.collection, { "blue-shell": 4 });
  assert.deepEqual(normalized.memory.recentItems, ["blue-shell"]);
  assert.equal(normalized.memory.entries.length, 36);
  assert.equal(normalized.stats.completed, 0);
  assert.deepEqual(adventure.collectionProgress(normalized), { found: 1, total: 8 });
});

test("an active journey cannot be overwritten by another departure", () => {
  const first = adventure.startJourney(null, "voyage", context, 1000, () => 0.5);
  const duplicate = adventure.startJourney(first.state, "nearby", context, 2000, () => 0.1);

  assert.equal(duplicate.started, false);
  assert.equal(duplicate.reason, "already-away");
  assert.equal(duplicate.state.current.id, first.state.current.id);
});

test("travel speech remembers recent lines and avoids an immediate repeat", () => {
  const first = adventure.startJourney(null, "nearby", context, 10_000, () => 0.25);
  const recalled = adventure.recallJourney(first.state, 10_001);
  const second = adventure.startJourney(recalled.state, "nearby", context, 20_000, () => 0.25);

  assert.notEqual(second.line, first.line);
  assert.ok(second.state.memory.recentSpeech.includes(second.line));
  assert.ok(second.state.memory.recentSpeech.length <= 8);
});

test("the mascot leaves after its departure pose and returns at the persisted deadline", () => {
  const started = adventure.startJourney(null, "nearby", context, 10_000, () => 0.4);

  assert.equal(adventure.isAway(started.state, 12_199, 2200), false, "departure pose remains visible briefly");
  assert.equal(adventure.isAway(started.state, 12_200, 2200), true);
  assert.equal(adventure.isAway(started.state, started.journey.returnsAt - 1, 2200), true);
  assert.equal(adventure.isAway(started.state, started.journey.returnsAt, 2200), false);
});

test("early recall has its own greeting and grants no journey reward", () => {
  const started = adventure.startJourney(null, "outing", context, 10_000, () => 0.6);
  const recalled = adventure.recallJourney(started.state, 10_000 + 10 * 60000);

  assert.equal(recalled.recalled, true);
  assert.equal(recalled.state.current, null);
  assert.equal(recalled.state.stats.recalled, 1);
  assert.equal(recalled.state.stats.completed, 0);
  assert.deepEqual(recalled.state.collection, {});
  assert.equal(recalled.state.memory.entries[0].kind, "recall");
  assert.match(recalled.line, /队长/);
  assert.match(recalled.line, /回来|回家|返程/);

  const atDeadline = adventure.recallJourney(started.state, started.journey.returnsAt);
  assert.equal(atDeadline.recalled, false);
  assert.equal(atDeadline.reason, "already-returned", "a completed trip must use normal return settlement");
});

test("high relationship stages change departure and return expression", () => {
  const bondedContext = { ...context, relationship: "forever", personality: "adventure", personalityScore: 8 };
  const started = adventure.startJourney(null, "nearby", bondedContext, 10_000, () => 0.2);
  assert.match(started.line, /队长/);

  const returned = adventure.resolveJourney(started.state, started.journey.returnsAt);
  assert.match(returned.line, /队长/);
});
