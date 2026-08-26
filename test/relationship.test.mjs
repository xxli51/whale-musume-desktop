import test from "node:test";
import assert from "node:assert/strict";

import relationship from "../renderer/relationship-core.js";

test("relationship stages require both affection and real companion days", () => {
  assert.equal(relationship.relationshipStage(1000, 0).id, "new");
  assert.equal(relationship.relationshipStage(49, 10).id, "new");
  assert.equal(relationship.relationshipStage(50, 1).id, "familiar");
  assert.equal(relationship.relationshipStage(500, 7).id, "bonded");
  assert.equal(relationship.relationshipStage(1000, 30).id, "forever");
});

test("shared events create explainable personality scores and memories", () => {
  let state = relationship.applySignal(null, "depart", 2, 1000).state;
  state = relationship.applySignal(state, "returned", 1, 2000).state;
  state = relationship.applySignal(state, "first-find", 1, 3000).state;
  state = relationship.applySignal(state, "focus", 1, 4000).state;

  assert.equal(state.scores.adventure, 4);
  assert.equal(state.scores.curiosity, 6);
  assert.equal(state.scores.diligence, 3);
  assert.equal(state.counts.depart, 2);
  assert.equal(state.memories[0].type, "focus");
  assert.equal(relationship.personality(state).name, "好奇探索");
});

test("recalls and affectionate interactions can form a homebody personality", () => {
  let state = relationship.applySignal(null, "recall", 3, 1000).state;
  state = relationship.applySignal(state, "feed", 2, 2000).state;
  state = relationship.applySignal(state, "praise", 1, 3000).state;

  assert.equal(state.scores.adventure, -6);
  assert.equal(state.scores.affection, 9);
  assert.equal(relationship.personality(state).name, "亲昵黏人");
  assert.equal(state.memories.length, 3, "amount changes strength without duplicating one real event");
});

test("unknown personality signals are ignored safely", () => {
  const result = relationship.applySignal(null, "invented", 100, Date.now());
  assert.equal(result.applied, false);
  assert.deepEqual(result.state.scores, { adventure: 0, diligence: 0, affection: 0, curiosity: 0 });
});
