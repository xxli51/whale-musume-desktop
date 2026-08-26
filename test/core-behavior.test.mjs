import test from "node:test";
import assert from "node:assert/strict";

import core from "../assets/whale-moe-core.js";

test("state machine follows priority and idle boundaries", () => {
  const now = 500_000;
  const previous = { state: "idle", since: 0, lastSpeechAt: 0, streak: 0, lineCount: 0 };

  assert.equal(core.computeState(previous, { error: true, tool: true }, now).state, "failure");
  assert.equal(core.computeState(previous, { tool: true, thinking: true }, now).state, "tool");
  assert.equal(core.computeState(previous, { thinking: true, waiting: true }, now).state, "thinking");
  assert.equal(core.computeState(previous, { waiting: true }, now).state, "waiting");
  assert.equal(core.computeState(previous, { lastInteraction: now - core.AFK_MS }, now).state, "afk");
  assert.equal(core.computeState(previous, { petDisabled: true }, now).state, "hidden");
});

test("bubble game spawns, scores and penalizes deterministic items", () => {
  const randomValues = [0, 0.2];
  const initial = core.gameNewState(1_000);
  const tick = core.gameTick(initial, 1_500, () => randomValues.shift());

  assert.deepEqual(tick.events, [{ kind: "spawn", cell: 0, bubble: "star" }]);
  assert.equal(initial.board[0], null, "gameTick must not mutate the previous board");

  const star = core.gamePop(tick.state, 0, 1_600);
  assert.equal(star.hit, true);
  assert.equal(star.kind, "star");
  assert.equal(star.delta, core.GAME.STAR_SCORE + 2);
  assert.equal(star.state.combo, 1);

  const board = star.state.board.slice();
  board[1] = { kind: "bomb", bornAt: 1_600 };
  const bomb = core.gamePop({ ...star.state, board, combo: 3 }, 1, 1_700);
  assert.equal(bomb.delta, core.GAME.BOMB_SCORE);
  assert.equal(bomb.state.combo, 0);
});

test("catch game clamps movement and resolves a caught snack", () => {
  const initial = core.catchNewState(0);
  assert.equal(core.catchMove(initial, -1).basketX, 0.02);
  assert.equal(core.catchMove(initial, 2).basketX, 0.98);

  const ready = {
    ...initial,
    items: [{ x: 0.5, y: 0.86, kind: "cake", resolved: false }],
    nextSpawnAt: 99_999
  };
  const tick = core.catchTick(ready, 200, () => 0.5);
  assert.equal(tick.events[0].kind, "caught");
  assert.equal(tick.events[0].item, "cake");
  assert.equal(tick.state.caught, 1);
  assert.equal(tick.state.score, core.CATCH.CAKE_SCORE + 2);
  assert.equal(ready.items[0].resolved, false, "catchTick must not mutate previous items");
});

test("growth clamps values and reduces rewards for overfeeding", () => {
  const hungry = core.computeGrowth({ satiety: 5 }, { type: "feed" }, 0, 0);
  const full = core.computeGrowth({ satiety: 95 }, { type: "feed" }, 0, 0);
  const decayed = core.computeGrowth({ satiety: 2 }, { type: "tick", deltaMin: 1_000 }, 0, 0);

  assert.equal(hungry.growth.satiety, 35);
  assert.equal(full.growth.satiety, 100);
  assert.ok(full.deltas.affinity < hungry.deltas.affinity);
  assert.equal(decayed.growth.satiety, 0);
});

test("daily quests progress and only claim completed work", () => {
  const now = new Date(2026, 7, 25, 12).getTime();
  const quests = core.refreshQuests(null, now, () => 0);
  const signin = quests.slots.find((slot) => slot.id === "signin-1");
  assert.ok(signin);

  const premature = core.claimQuest(quests, signin.id, now);
  assert.equal(premature.claimed, false);

  const progressed = core.computeQuests(quests, { metric: "signin", amount: 1 }, now);
  assert.ok(progressed.completed.includes(signin.id));
  const claimed = core.claimQuest(progressed.quests, signin.id, now);
  assert.equal(claimed.claimed, true);
  assert.equal(claimed.reward.affinity, 6);
});

test("weekly signin milestones are awarded once", () => {
  const now = new Date(2026, 7, 25, 12).getTime();
  const first = core.computeWeekSignin(null, "2026-8-25", now);
  assert.equal(first.milestoneHit, "1");

  const duplicate = core.computeWeekSignin(first.weekSignin, "2026-8-25", now);
  assert.equal(duplicate.weekSignin.days.length, 1);
  assert.equal(duplicate.milestoneHit, null);

  const second = core.computeWeekSignin(duplicate.weekSignin, "2026-8-26", now);
  const third = core.computeWeekSignin(second.weekSignin, "2026-8-27", now);
  assert.equal(third.milestoneHit, "3");
});

test("weather and hit-zone decisions are deterministic", () => {
  assert.equal(core.weatherText(95).kind, "thunder");
  assert.equal(core.weatherFx(95, 20, 0).mode, "flash");
  assert.equal(core.weatherFx(0, 39, 0).kind, "hot");
  assert.equal(core.weatherFx(0, -10, 0).kind, "cold");
  assert.equal(core.weatherFx(0, 20, 70).kind, "wind");
  assert.equal(core.weatherFx(999, 20, 0), null);

  assert.equal(core.hitZone(0.5, 0.1, "full"), "head");
  assert.equal(core.hitZone(0.5, 0.6, "full"), "belly");
  assert.equal(core.hitZone(0.5, 0.9, "full"), "tail");
});

test("pointer throws use recent velocity, cap speed and bounce inside bounds", () => {
  const slow = core.pointerThrowVelocity([
    { x: 10, y: 10, at: 0 },
    { x: 12, y: 10, at: 100 }
  ]);
  assert.deepEqual(slow, { vx: 0, vy: 0, speed: 0 });

  const fast = core.pointerThrowVelocity([
    { x: 0, y: 0, at: 0 },
    { x: 400, y: 0, at: 100 }
  ]);
  assert.equal(fast.speed, 1.85);
  assert.equal(fast.vx, 1.85);

  const bounced = core.pointerThrowStep({ x: 95, y: 50, vx: 1, vy: 0 }, { minX: 0, minY: 0, maxX: 100, maxY: 100 }, 16);
  assert.equal(bounced.x, 100);
  assert.equal(bounced.hitX, true);
  assert.ok(bounced.vx < 0);
  assert.equal(bounced.hitY, false);
});
