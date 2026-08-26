(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhaleHouseCore = api;
})(typeof window === "undefined" ? null : window, function () {
  "use strict";

  var VERSION = 1;
  var SLOTS = Object.freeze(["desk", "wall", "floor", "decor"]);
  var FURNITURE = Object.freeze([
    Object.freeze({
      id: "wood-desk",
      slot: "desk",
      name: "暖木书桌",
      icon: "🪵",
      note: "小屋最初的工作角",
      unlock: "base"
    }),
    Object.freeze({
      id: "book-shelf",
      slot: "wall",
      name: "故事书架",
      icon: "📚",
      note: "用来收藏共同经历",
      unlock: "base"
    }),
    Object.freeze({
      id: "cloud-rug",
      slot: "floor",
      name: "云朵地毯",
      icon: "☁️",
      note: "踩上去软绵绵的",
      unlock: "base"
    }),
    Object.freeze({
      id: "moon-lamp",
      slot: "decor",
      name: "月亮夜灯",
      icon: "🌙",
      note: "深夜也留一盏灯",
      unlock: "base"
    }),
    Object.freeze({
      id: "code-desk",
      slot: "desk",
      name: "代码工作台",
      icon: "💻",
      note: "程序鲸 Lv.2 解锁",
      unlock: "profession",
      profession: "coder",
      level: 2
    }),
    Object.freeze({
      id: "paint-easel",
      slot: "desk",
      name: "彩虹画架",
      icon: "🎨",
      note: "创作鲸 Lv.2 解锁",
      unlock: "profession",
      profession: "creator",
      level: 2
    }),
    Object.freeze({
      id: "tidy-board",
      slot: "wall",
      name: "事务计划板",
      icon: "📋",
      note: "事务鲸 Lv.2 解锁",
      unlock: "profession",
      profession: "coordinator",
      level: 2
    }),
    Object.freeze({
      id: "star-scope",
      slot: "decor",
      name: "鲸背望远镜",
      icon: "🔭",
      note: "探索鲸 Lv.2 解锁",
      unlock: "profession",
      profession: "researcher",
      level: 2
    }),
    Object.freeze({
      id: "music-box",
      slot: "decor",
      name: "潮声音乐盒",
      icon: "🎵",
      note: "音律鲸 Lv.2 解锁",
      unlock: "profession",
      profession: "musician",
      level: 2
    }),
    Object.freeze({
      id: "game-console",
      slot: "desk",
      name: "迷你游戏机",
      icon: "🎮",
      note: "冒险鲸 Lv.2 解锁",
      unlock: "profession",
      profession: "adventurer",
      level: 2
    }),
    Object.freeze({
      id: "heart-cushion",
      slot: "floor",
      name: "默契抱枕",
      icon: "💞",
      note: "彼此信赖后解锁",
      unlock: "relationship",
      stage: "trusted"
    }),
    Object.freeze({
      id: "travel-trunk",
      slot: "floor",
      name: "旅行宝箱",
      icon: "🧳",
      note: "完成 3 次旅行解锁",
      unlock: "journeys",
      count: 3
    }),
    Object.freeze({
      id: "shell-mobile",
      slot: "wall",
      name: "纪念品挂饰",
      icon: "🐚",
      note: "发现 3 种纪念品解锁",
      unlock: "collection",
      count: 3
    })
  ]);
  var STAGE_ORDER = Object.freeze(["new", "familiar", "trusted", "bonded", "forever"]);
  var DEFAULT_SLOTS = Object.freeze({ desk: "wood-desk", wall: "book-shelf", floor: "cloud-rug", decor: "moon-lamp" });

  function furnitureById(id) {
    for (var i = 0; i < FURNITURE.length; i += 1) if (FURNITURE[i].id === id) return FURNITURE[i];
    return null;
  }

  function blankState() {
    return {
      version: VERSION,
      slots: {
        desk: DEFAULT_SLOTS.desk,
        wall: DEFAULT_SLOTS.wall,
        floor: DEFAULT_SLOTS.floor,
        decor: DEFAULT_SLOTS.decor
      },
      visits: 0,
      lastOpenedAt: 0
    };
  }

  function normalizeState(input) {
    var next = blankState();
    var source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    var slots = source.slots && typeof source.slots === "object" ? source.slots : {};
    SLOTS.forEach(function (slot) {
      var furniture = furnitureById(slots[slot]);
      if (furniture && furniture.slot === slot) next.slots[slot] = furniture.id;
    });
    next.visits = Math.max(0, Math.min(1000000, Math.floor(Number(source.visits) || 0)));
    next.lastOpenedAt = Math.max(0, Number(source.lastOpenedAt) || 0);
    return next;
  }

  function professionLevel(context, id) {
    return (context && context.professions && Number(context.professions[id])) || 1;
  }

  function isUnlocked(furniture, context) {
    if (!furniture) return false;
    if (furniture.unlock === "base") return true;
    if (furniture.unlock === "profession") return professionLevel(context, furniture.profession) >= furniture.level;
    if (furniture.unlock === "relationship") {
      return STAGE_ORDER.indexOf((context && context.relationship) || "new") >= STAGE_ORDER.indexOf(furniture.stage);
    }
    if (furniture.unlock === "journeys") return Number((context && context.journeys) || 0) >= furniture.count;
    if (furniture.unlock === "collection") return Number((context && context.collectionFound) || 0) >= furniture.count;
    return false;
  }

  function unlockedFurniture(context, slot) {
    return FURNITURE.filter(function (item) {
      return (!slot || item.slot === slot) && isUnlocked(item, context);
    });
  }

  function selectFurniture(input, slot, furnitureId, context) {
    var state = normalizeState(input);
    var furniture = furnitureById(furnitureId);
    if (SLOTS.indexOf(slot) === -1 || !furniture || furniture.slot !== slot)
      return { changed: false, reason: "invalid-slot", state: state };
    if (!isUnlocked(furniture, context)) return { changed: false, reason: "locked", state: state };
    state.slots[slot] = furniture.id;
    return { changed: true, state: state, furniture: furniture };
  }

  function resolvedSlots(input, context) {
    var state = normalizeState(input);
    var result = {};
    SLOTS.forEach(function (slot) {
      var selected = furnitureById(state.slots[slot]);
      result[slot] = isUnlocked(selected, context) ? selected : furnitureById(DEFAULT_SLOTS[slot]);
    });
    return result;
  }

  return Object.freeze({
    VERSION: VERSION,
    SLOTS: SLOTS,
    FURNITURE: FURNITURE,
    DEFAULT_SLOTS: DEFAULT_SLOTS,
    blankState: blankState,
    normalizeState: normalizeState,
    furnitureById: furnitureById,
    isUnlocked: isUnlocked,
    unlockedFurniture: unlockedFurniture,
    selectFurniture: selectFurniture,
    resolvedSlots: resolvedSlots
  });
});
