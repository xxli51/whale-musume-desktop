(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhaleProfessionCore = api;
})(typeof window === "undefined" ? null : window, function () {
  "use strict";

  var VERSION = 1;
  var LEVEL_XP = Object.freeze([0, 20, 60, 150, 320, 600, 1000, 1600, 2400, 3500]);
  var DEFINITIONS = Object.freeze([
    Object.freeze({ id: "coder", name: "程序鲸", icon: "💻", categories: ["ide", "terminal"], note: "IDE 与终端" }),
    Object.freeze({ id: "creator", name: "创作鲸", icon: "🎨", categories: ["design"], note: "设计与创作工具" }),
    Object.freeze({
      id: "coordinator",
      name: "事务鲸",
      icon: "📋",
      categories: ["office", "meeting"],
      note: "办公与会议"
    }),
    Object.freeze({ id: "researcher", name: "探索鲸", icon: "🔎", categories: ["browser"], note: "浏览与资料探索" }),
    Object.freeze({ id: "musician", name: "音律鲸", icon: "🎵", categories: ["media"], note: "音乐与媒体" }),
    Object.freeze({ id: "adventurer", name: "冒险鲸", icon: "🎮", categories: ["game"], note: "游戏与冒险" })
  ]);

  function definition(id) {
    for (var i = 0; i < DEFINITIONS.length; i += 1) if (DEFINITIONS[i].id === id) return DEFINITIONS[i];
    return null;
  }

  function blankState() {
    var careers = {};
    DEFINITIONS.forEach(function (item) {
      careers[item.id] = { xp: 0, seconds: 0 };
    });
    return {
      version: VERSION,
      careers: careers,
      primaryId: "",
      currentId: "",
      stats: { activeSeconds: 0, focusBonuses: 0 }
    };
  }

  function finite(value, fallback) {
    var out = Number(value);
    return Number.isFinite(out) ? out : fallback;
  }

  function normalizeState(input) {
    var next = blankState();
    var source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    var careers = source.careers && typeof source.careers === "object" ? source.careers : {};
    DEFINITIONS.forEach(function (item) {
      var career = careers[item.id] && typeof careers[item.id] === "object" ? careers[item.id] : {};
      next.careers[item.id] = {
        xp: Math.max(0, Math.min(1000000, Math.floor(finite(career.xp, 0)))),
        seconds: Math.max(0, Math.min(59, Math.floor(finite(career.seconds, 0))))
      };
    });
    next.currentId = definition(source.currentId) ? source.currentId : "";
    var stats = source.stats && typeof source.stats === "object" ? source.stats : {};
    next.stats.activeSeconds = Math.max(0, Math.min(1000000000, Math.floor(finite(stats.activeSeconds, 0))));
    next.stats.focusBonuses = Math.max(0, Math.min(1000000, Math.floor(finite(stats.focusBonuses, 0))));
    next.primaryId = primaryProfession(next);
    return next;
  }

  function professionForCategory(category) {
    for (var i = 0; i < DEFINITIONS.length; i += 1) {
      if (DEFINITIONS[i].categories.indexOf(String(category || "")) !== -1) return DEFINITIONS[i].id;
    }
    return "";
  }

  function levelForXp(xp) {
    var value = Math.max(0, Math.floor(finite(xp, 0)));
    var level = 1;
    for (var i = 1; i < LEVEL_XP.length; i += 1) if (value >= LEVEL_XP[i]) level = i + 1;
    return level;
  }

  function levelProgress(xp) {
    var value = Math.max(0, Math.floor(finite(xp, 0)));
    var level = levelForXp(value);
    var start = LEVEL_XP[Math.min(level - 1, LEVEL_XP.length - 1)];
    var end = level >= LEVEL_XP.length ? start : LEVEL_XP[level];
    return { level: level, current: value - start, target: Math.max(0, end - start), maxed: level >= LEVEL_XP.length };
  }

  function primaryProfession(input) {
    var state = input && input.careers ? input : blankState();
    var best = "";
    var bestXp = 0;
    DEFINITIONS.forEach(function (item) {
      var xp = state.careers[item.id] ? finite(state.careers[item.id].xp, 0) : 0;
      if (xp > bestXp) {
        best = item.id;
        bestXp = xp;
      }
    });
    return best;
  }

  function applyActivity(input, category, elapsedSeconds, idleSeconds) {
    var state = normalizeState(input);
    var id = professionForCategory(category);
    var elapsed = Math.max(0, Math.min(30, finite(elapsedSeconds, 0)));
    if (!id || elapsed <= 0 || finite(idleSeconds, 0) >= 120)
      return { state: state, awardedXp: 0, leveledUp: false, professionId: id };
    var career = state.careers[id];
    var previousLevel = levelForXp(career.xp);
    var totalSeconds = career.seconds + elapsed;
    var awardedXp = Math.floor(totalSeconds / 60);
    career.seconds = Math.floor(totalSeconds % 60);
    career.xp += awardedXp;
    state.currentId = id;
    state.stats.activeSeconds += Math.floor(elapsed);
    state.primaryId = primaryProfession(state);
    return { state: state, awardedXp: awardedXp, leveledUp: levelForXp(career.xp) > previousLevel, professionId: id };
  }

  function applyFocusBonus(input, amount) {
    var state = normalizeState(input);
    var id = state.currentId || state.primaryId;
    var bonus = Math.max(0, Math.min(100, Math.floor(finite(amount, 0))));
    if (!id || !bonus) return { state: state, awardedXp: 0, leveledUp: false, professionId: "" };
    var career = state.careers[id];
    var previousLevel = levelForXp(career.xp);
    career.xp += bonus;
    state.stats.focusBonuses += 1;
    state.primaryId = primaryProfession(state);
    return { state: state, awardedXp: bonus, leveledUp: levelForXp(career.xp) > previousLevel, professionId: id };
  }

  return Object.freeze({
    VERSION: VERSION,
    LEVEL_XP: LEVEL_XP,
    DEFINITIONS: DEFINITIONS,
    blankState: blankState,
    normalizeState: normalizeState,
    definition: definition,
    professionForCategory: professionForCategory,
    levelForXp: levelForXp,
    levelProgress: levelProgress,
    primaryProfession: primaryProfession,
    applyActivity: applyActivity,
    applyFocusBonus: applyFocusBonus
  });
});
