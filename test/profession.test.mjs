import test from "node:test";
import assert from "node:assert/strict";

import profession from "../renderer/profession-core.js";

test("active foreground categories accumulate their matching profession", () => {
  let result = profession.applyActivity(null, "ide", 30, 0);
  assert.equal(result.professionId, "coder");
  assert.equal(result.state.careers.coder.seconds, 30);
  assert.equal(result.awardedXp, 0);

  result = profession.applyActivity(result.state, "terminal", 30, 0);
  assert.equal(result.state.careers.coder.seconds, 0);
  assert.equal(result.state.careers.coder.xp, 1);
  assert.equal(result.state.primaryId, "coder");
});

test("idle time and unknown apps do not grant career experience", () => {
  const idle = profession.applyActivity(null, "design", 30, 120);
  const unknown = profession.applyActivity(null, "other", 30, 0);

  assert.equal(idle.state.careers.creator.seconds, 0);
  assert.equal(unknown.professionId, "");
  assert.equal(unknown.state.stats.activeSeconds, 0);
});

test("levels and focus bonuses advance the most recent career", () => {
  const seeded = profession.normalizeState({ careers: { coder: { xp: 19, seconds: 30 } }, currentId: "coder" });
  const activity = profession.applyActivity(seeded, "ide", 30, 0);
  assert.equal(activity.state.careers.coder.xp, 20);
  assert.equal(activity.leveledUp, true);
  assert.equal(profession.levelForXp(20), 2);

  const focused = profession.applyFocusBonus(activity.state, 5);
  assert.equal(focused.professionId, "coder");
  assert.equal(focused.state.careers.coder.xp, 25);
  assert.equal(focused.state.stats.focusBonuses, 1);
});

test("every monitored app category maps to one stable profession", () => {
  assert.equal(profession.professionForCategory("ide"), "coder");
  assert.equal(profession.professionForCategory("terminal"), "coder");
  assert.equal(profession.professionForCategory("design"), "creator");
  assert.equal(profession.professionForCategory("office"), "coordinator");
  assert.equal(profession.professionForCategory("meeting"), "coordinator");
  assert.equal(profession.professionForCategory("browser"), "researcher");
  assert.equal(profession.professionForCategory("media"), "musician");
  assert.equal(profession.professionForCategory("game"), "adventurer");
  assert.equal(new Set(profession.DEFINITIONS.map((item) => item.id)).size, profession.DEFINITIONS.length);
});
