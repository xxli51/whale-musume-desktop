(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhaleRelationshipCore = api;
})(typeof window === "undefined" ? null : window, function () {
  "use strict";

  var VERSION = 1;
  var STAGES = Object.freeze([
    Object.freeze({ id: "new", name: "初次相伴", icon: "🌱", minAffinity: 0, minDays: 0, note: "还在慢慢认识彼此" }),
    Object.freeze({
      id: "familiar",
      name: "逐渐熟悉",
      icon: "🌿",
      minAffinity: 50,
      minDays: 1,
      note: "已经记住了你的习惯"
    }),
    Object.freeze({
      id: "trusted",
      name: "彼此信赖",
      icon: "💙",
      minAffinity: 200,
      minDays: 3,
      note: "愿意把旅途故事都讲给你听"
    }),
    Object.freeze({
      id: "bonded",
      name: "默契伙伴",
      icon: "💞",
      minAffinity: 500,
      minDays: 7,
      note: "不用多说也能明白彼此"
    }),
    Object.freeze({
      id: "forever",
      name: "最重要的伙伴",
      icon: "🐋",
      minAffinity: 1000,
      minDays: 30,
      note: "共同经历已经成为珍贵记忆"
    })
  ]);
  var TRAITS = Object.freeze([
    Object.freeze({ id: "adventure", positive: "勇于冒险", negative: "眷恋小家", icon: "🧭" }),
    Object.freeze({ id: "diligence", positive: "认真勤勉", negative: "悠闲随性", icon: "📚" }),
    Object.freeze({ id: "affection", positive: "亲昵黏人", negative: "小小傲娇", icon: "💗" }),
    Object.freeze({ id: "curiosity", positive: "好奇探索", negative: "谨慎稳重", icon: "✨" })
  ]);
  var SIGNALS = Object.freeze({
    depart: Object.freeze({ adventure: 1, curiosity: 1, memory: "主动踏上了一次旅程" }),
    returned: Object.freeze({ adventure: 2, curiosity: 1, memory: "完成旅行并带回了故事" }),
    "first-find": Object.freeze({ curiosity: 3, memory: "发现了一件从未见过的纪念品" }),
    recall: Object.freeze({ adventure: -2, affection: 1, memory: "听到召唤后提前赶回家" }),
    profession: Object.freeze({ diligence: 1, memory: "陪主人认真工作了一段时间" }),
    focus: Object.freeze({ diligence: 3, memory: "一起完成了一轮专注" }),
    feed: Object.freeze({ affection: 2, memory: "被主人投喂了小点心" }),
    praise: Object.freeze({ affection: 2, memory: "收到了主人的夸奖" }),
    pat: Object.freeze({ affection: 1, memory: "被主人温柔地摸了摸头" }),
    belly: Object.freeze({ affection: 1, curiosity: 1, memory: "和主人玩了一次戳肚子互动" }),
    tail: Object.freeze({ affection: 1, memory: "把尾巴放心交给主人摸了摸" }),
    poke: Object.freeze({ affection: -1, memory: "被主人突然戳了一下" })
  });

  function finite(value, fallback) {
    var out = Number(value);
    return Number.isFinite(out) ? out : fallback;
  }

  function blankState() {
    return {
      version: VERSION,
      stageId: "new",
      scores: { adventure: 0, diligence: 0, affection: 0, curiosity: 0 },
      counts: {},
      memories: []
    };
  }

  function stageById(id) {
    for (var i = 0; i < STAGES.length; i += 1) if (STAGES[i].id === id) return STAGES[i];
    return STAGES[0];
  }

  function normalizeState(input) {
    var next = blankState();
    var source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    next.stageId = stageById(source.stageId).id;
    var scores = source.scores && typeof source.scores === "object" ? source.scores : {};
    TRAITS.forEach(function (trait) {
      next.scores[trait.id] = Math.max(-1000, Math.min(1000, Math.floor(finite(scores[trait.id], 0))));
    });
    var counts = source.counts && typeof source.counts === "object" ? source.counts : {};
    Object.keys(SIGNALS).forEach(function (id) {
      var count = Math.floor(finite(counts[id], 0));
      if (count > 0) next.counts[id] = Math.min(1000000, count);
    });
    if (Array.isArray(source.memories)) {
      next.memories = source.memories
        .slice(0, 30)
        .map(function (entry) {
          return {
            at: Math.max(0, finite(entry && entry.at, 0)),
            type: String((entry && entry.type) || "").slice(0, 32),
            text: String((entry && entry.text) || "").slice(0, 160)
          };
        })
        .filter(function (entry) {
          return Boolean(entry.type && SIGNALS[entry.type]);
        });
    }
    return next;
  }

  function relationshipStage(affinity, companionDays) {
    var value = Math.max(0, finite(affinity, 0));
    var days = Math.max(0, finite(companionDays, 0));
    var result = STAGES[0];
    for (var i = 1; i < STAGES.length; i += 1) {
      if (value >= STAGES[i].minAffinity && days >= STAGES[i].minDays) result = STAGES[i];
    }
    return result;
  }

  function applySignal(input, type, amount, now) {
    var state = normalizeState(input);
    var signal = SIGNALS[type];
    if (!signal) return { applied: false, state: state };
    var multiplier = Math.max(1, Math.min(20, Math.floor(finite(amount, 1))));
    TRAITS.forEach(function (trait) {
      if (!signal[trait.id]) return;
      state.scores[trait.id] = Math.max(-1000, Math.min(1000, state.scores[trait.id] + signal[trait.id] * multiplier));
    });
    state.counts[type] = (state.counts[type] || 0) + multiplier;
    state.memories.unshift({ at: Math.max(0, finite(now, Date.now())), type: type, text: signal.memory });
    state.memories = state.memories.slice(0, 30);
    return { applied: true, state: state, signal: signal };
  }

  function personality(input) {
    var state = normalizeState(input);
    var best = null;
    TRAITS.forEach(function (trait) {
      var score = state.scores[trait.id];
      var strength = Math.abs(score);
      if (!best || strength > best.strength) {
        best = {
          id: trait.id,
          name: score >= 0 ? trait.positive : trait.negative,
          icon: trait.icon,
          score: score,
          strength: strength
        };
      }
    });
    if (!best || best.strength < 4) return { id: "balanced", name: "正在成长", icon: "🌱", score: 0, strength: 0 };
    return best;
  }

  return Object.freeze({
    VERSION: VERSION,
    STAGES: STAGES,
    TRAITS: TRAITS,
    SIGNALS: SIGNALS,
    blankState: blankState,
    normalizeState: normalizeState,
    stageById: stageById,
    relationshipStage: relationshipStage,
    applySignal: applySignal,
    personality: personality
  });
});
