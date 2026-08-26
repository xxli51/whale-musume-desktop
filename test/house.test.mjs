import test from "node:test";
import assert from "node:assert/strict";

import house from "../renderer/house-core.js";

const baseContext = {
  professions: { coder: 1, creator: 1, coordinator: 1, researcher: 1, musician: 1, adventurer: 1 },
  relationship: "new",
  journeys: 0,
  collectionFound: 0
};

test("a new room starts with one valid item in every fixed slot", () => {
  const state = house.blankState();
  assert.deepEqual(Object.keys(state.slots).sort(), house.SLOTS.slice().sort());
  for (const slot of house.SLOTS) {
    const furniture = house.furnitureById(state.slots[slot]);
    assert.equal(furniture.slot, slot);
    assert.equal(house.isUnlocked(furniture, baseContext), true);
  }
  assert.equal(house.unlockedFurniture(baseContext).length, 4);
});

test("career, relationship, travel and collection progress unlock furniture", () => {
  const context = {
    professions: { ...baseContext.professions, coder: 2, researcher: 2 },
    relationship: "trusted",
    journeys: 3,
    collectionFound: 3
  };
  for (const furnitureId of ["code-desk", "star-scope", "heart-cushion", "travel-trunk", "shell-mobile"]) {
    assert.equal(house.isUnlocked(house.furnitureById(furnitureId), context), true, furnitureId);
  }
});

test("locked furniture cannot be selected and reset progress falls back safely", () => {
  const locked = house.selectFurniture(null, "desk", "code-desk", baseContext);
  assert.equal(locked.changed, false);
  assert.equal(locked.reason, "locked");

  const unlockedContext = { ...baseContext, professions: { ...baseContext.professions, coder: 2 } };
  const selected = house.selectFurniture(null, "desk", "code-desk", unlockedContext);
  assert.equal(selected.changed, true);
  assert.equal(selected.state.slots.desk, "code-desk");

  const resolved = house.resolvedSlots(selected.state, baseContext);
  assert.equal(resolved.desk.id, "wood-desk");
});

test("room imports discard invalid slots and bound visit counters", () => {
  const state = house.normalizeState({
    slots: { desk: "moon-lamp", wall: "invented" },
    visits: 99999999,
    lastOpenedAt: -20
  });
  assert.equal(state.slots.desk, "wood-desk");
  assert.equal(state.slots.wall, "book-shelf");
  assert.equal(state.visits, 1000000);
  assert.equal(state.lastOpenedAt, 0);
});
