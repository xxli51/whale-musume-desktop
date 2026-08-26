(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhaleLifeCore = api;
})(typeof window === "undefined" ? null : window, function () {
  "use strict";

  var VERSION = 1;
  var MAX_HISTORY = 40;
  var ACTIVITIES = Object.freeze([
    Object.freeze({
      id: "sleep",
      name: "好好睡觉",
      icon: "😴",
      pose: "sleep",
      minutes: 60,
      hours: [23, 0, 1, 2, 3, 4, 5, 6],
      effect: { mood: 3 }
    }),
    Object.freeze({
      id: "pajama",
      name: "换上睡衣",
      icon: "🌙",
      pose: "daily-pajama",
      minutes: 18,
      hours: [21, 22, 23],
      effect: { mood: 1 }
    }),
    Object.freeze({
      id: "meal",
      name: "认真吃饭",
      icon: "🍱",
      pose: "daily-eat",
      minutes: 12,
      hours: [],
      effect: { satiety: 8, mood: 1 }
    }),
    Object.freeze({
      id: "cook",
      name: "在小屋做饭",
      icon: "🍳",
      pose: "daily-cooking",
      minutes: 20,
      hours: [7, 8, 11, 12, 17, 18, 19],
      effect: { satiety: 4, mood: 1 }
    }),
    Object.freeze({
      id: "shower",
      name: "洗去疲惫",
      icon: "🫧",
      pose: "daily-shower",
      minutes: 14,
      hours: [19, 20, 21, 22],
      effect: { mood: 2 }
    }),
    Object.freeze({
      id: "stretch",
      name: "伸展身体",
      icon: "🌿",
      pose: "daily-stretch",
      minutes: 6,
      hours: [],
      effect: { mood: 1 }
    }),
    Object.freeze({
      id: "tidy",
      name: "整理小屋",
      icon: "🧹",
      pose: "sweep",
      minutes: 15,
      hours: [8, 9, 10, 14, 15, 16],
      effect: { mood: 1 }
    }),
    Object.freeze({
      id: "paint",
      name: "画一幅小画",
      icon: "🎨",
      pose: "daily-painting",
      minutes: 24,
      hours: [],
      effect: { mood: 2 }
    }),
    Object.freeze({
      id: "game",
      name: "偷偷玩一局",
      icon: "🎮",
      pose: "daily-gaming",
      minutes: 16,
      hours: [],
      effect: { mood: 2 }
    }),
    Object.freeze({
      id: "music",
      name: "听喜欢的音乐",
      icon: "🎵",
      pose: "meme-music",
      minutes: 18,
      hours: [],
      effect: { mood: 2 }
    }),
    Object.freeze({
      id: "research",
      name: "研究旅行收藏",
      icon: "🔎",
      pose: "curious",
      minutes: 22,
      hours: [],
      effect: { mood: 1 }
    }),
    Object.freeze({
      id: "code",
      name: "琢磨新点子",
      icon: "💻",
      pose: "work-debug",
      minutes: 25,
      hours: [],
      effect: { mood: 1 }
    }),
    Object.freeze({
      id: "journal",
      name: "写生活手账",
      icon: "📖",
      pose: "thinking",
      minutes: 16,
      hours: [20, 21, 22, 23],
      effect: { mood: 1 }
    }),
    Object.freeze({
      id: "stargaze",
      name: "看看今晚的星星",
      icon: "🔭",
      pose: "meme-wakuwaku",
      minutes: 20,
      hours: [20, 21, 22, 23, 0],
      effect: { mood: 2 }
    })
  ]);

  function finite(value, fallback) {
    var output = Number(value);
    return Number.isFinite(output) ? output : fallback;
  }

  function bounded(value, max) {
    return Math.max(0, Math.min(max, Math.floor(finite(value, 0))));
  }

  function cleanText(value, maxLength) {
    return String(value || "")
      .split("")
      .map(function (character) {
        var code = character.charCodeAt(0);
        return code < 32 || code === 127 ? " " : character;
      })
      .join("")
      .trim()
      .slice(0, maxLength);
  }

  function activity(id) {
    for (var index = 0; index < ACTIVITIES.length; index += 1)
      if (ACTIVITIES[index].id === id) return ACTIVITIES[index];
    return null;
  }

  function blankState() {
    return {
      version: VERSION,
      current: null,
      history: [],
      nextDecisionAt: 0,
      stats: { started: 0, completed: 0, byActivity: {} }
    };
  }

  function normalizeCurrent(input) {
    if (!input || typeof input !== "object" || !activity(input.activityId)) return null;
    return {
      activityId: input.activityId,
      startedAt: Math.max(0, finite(input.startedAt, 0)),
      endsAt: Math.max(0, finite(input.endsAt, 0)),
      reason: cleanText(input.reason, 180),
      seed: finite(input.seed, 1) >>> 0
    };
  }

  function normalizeHistory(input) {
    if (!Array.isArray(input)) return [];
    return input
      .slice(0, MAX_HISTORY)
      .map(function (entry) {
        if (!entry || typeof entry !== "object" || !activity(entry.activityId)) return null;
        return {
          activityId: entry.activityId,
          startedAt: Math.max(0, finite(entry.startedAt, 0)),
          completedAt: Math.max(0, finite(entry.completedAt, 0)),
          reason: cleanText(entry.reason, 180),
          outcome: cleanText(entry.outcome, 220),
          offline: Boolean(entry.offline)
        };
      })
      .filter(Boolean);
  }

  function normalizeState(input) {
    var source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    var state = blankState();
    state.current = normalizeCurrent(source.current);
    state.history = normalizeHistory(source.history);
    state.nextDecisionAt = Math.max(0, finite(source.nextDecisionAt, 0));
    var stats = source.stats && typeof source.stats === "object" ? source.stats : {};
    state.stats.started = bounded(stats.started, 1000000);
    state.stats.completed = Math.max(state.history.length, bounded(stats.completed, 1000000));
    var counts = stats.byActivity && typeof stats.byActivity === "object" ? stats.byActivity : {};
    ACTIVITIES.forEach(function (item) {
      var count = bounded(counts[item.id], 1000000);
      if (count) state.stats.byActivity[item.id] = count;
    });
    return state;
  }

  function normalizeContext(input) {
    var source = input && typeof input === "object" ? input : {};
    return {
      hour: Math.max(0, Math.min(23, Math.floor(finite(source.hour, 12)))),
      weather: cleanText(source.weather, 24) || "unknown",
      mood: Math.max(0, Math.min(100, finite(source.mood, 70))),
      satiety: Math.max(0, Math.min(100, finite(source.satiety, 80))),
      profession: cleanText(source.profession, 32),
      personality: cleanText(source.personality, 32) || "balanced",
      personalityScore: Math.max(-1000, Math.min(1000, finite(source.personalityScore, 0))),
      collectionFound: bounded(source.collectionFound, 10000),
      title: cleanText(source.title, 16) || "主人",
      petName: cleanText(source.petName, 16) || "鲸鱼娘",
      away: Boolean(source.away)
    };
  }

  function eligible(item, context) {
    if (item.hours.length && item.hours.indexOf(context.hour) === -1) return false;
    if (item.id === "meal" && context.satiety >= 78 && [7, 8, 11, 12, 13, 18, 19].indexOf(context.hour) === -1)
      return false;
    if (item.id === "research" && context.collectionFound === 0) return false;
    if (item.id === "stargaze" && ["rain", "drizzle", "thunder", "snow"].indexOf(context.weather) !== -1) return false;
    if (item.id === "sleep" && context.mood >= 85 && context.hour === 23) return false;
    return true;
  }

  function weight(item, context, recentIds) {
    var value = recentIds.indexOf(item.id) === -1 ? 2 : 0.35;
    if (item.id === "sleep" && (context.hour < 6 || context.hour >= 23)) value += 18;
    if (item.id === "pajama" && context.hour >= 21) value += 8;
    if (item.id === "meal") value += context.satiety < 35 ? 22 : context.satiety < 60 ? 10 : 2;
    if (item.id === "cook" && context.satiety < 65) value += 7;
    if (item.id === "shower" && context.hour >= 20) value += 7;
    if (item.id === "stretch" && context.mood < 55) value += 6;
    if (
      item.id === "tidy" &&
      ((context.personality === "diligence" && context.personalityScore >= 4) ||
        (context.personality === "adventure" && context.personalityScore <= -4))
    )
      value += 8;
    if (
      item.id === "paint" &&
      (context.profession === "creator" || (context.personality === "curiosity" && context.personalityScore >= 4))
    )
      value += 10;
    if (
      item.id === "game" &&
      (context.profession === "adventurer" ||
        context.mood < 50 ||
        (context.personality === "adventure" && context.personalityScore >= 4))
    )
      value += 9;
    if (
      item.id === "music" &&
      (context.profession === "musician" || (context.personality === "affection" && context.personalityScore >= 4))
    )
      value += 10;
    if (
      item.id === "research" &&
      (context.profession === "researcher" || (context.personality === "curiosity" && context.personalityScore >= 4))
    )
      value += 10;
    if (
      item.id === "code" &&
      (context.profession === "coder" || (context.personality === "diligence" && context.personalityScore >= 4))
    )
      value += 10;
    if (
      item.id === "journal" &&
      ((context.personality === "diligence" && context.personalityScore >= 4) ||
        (context.personality === "curiosity" && context.personalityScore <= -4))
    )
      value += 7;
    if (item.id === "stargaze" && ["clear", "cloudy", "wind"].indexOf(context.weather) !== -1) value += 8;
    if (
      ["rain", "drizzle", "thunder", "snow"].indexOf(context.weather) !== -1 &&
      ["paint", "game", "music", "research", "code", "journal"].indexOf(item.id) !== -1
    )
      value += 3;
    return Math.max(0.1, value);
  }

  function reasonFor(item, context) {
    if (item.id === "sleep") return "已经很晚了，身体比待办事项更需要休息";
    if (item.id === "meal" && context.satiety < 45) return "肚子已经在认真提醒我补充能量";
    if (item.id === "cook") return "想让小屋里多一点热腾腾的香气";
    if (item.id === "shower") return "想把今天积下来的疲惫洗干净";
    if (item.id === "pajama") return "夜色到了，准备把生活调成慢一点的速度";
    if (item.id === "research") return "旅行带回的收藏里，好像还藏着没读懂的故事";
    if (item.id === "stargaze") return "今晚的天空看起来值得多停留一会儿";
    if (item.id === "paint" && context.profession === "creator") return "最近积累的创作经验让我有点手痒";
    if (item.id === "music" && context.profession === "musician") return "音律鲸的耳朵捕捉到了一段喜欢的旋律";
    if (item.id === "code" && context.profession === "coder") return "程序鲸突然想到一个值得验证的小点子";
    if (item.id === "game" && context.profession === "adventurer") return "冒险鲸决定先去游戏世界活动一下尾巴";
    if (context.personality === "diligence" && context.personalityScore >= 4)
      return "认真勤勉的习惯让我想把眼前的小事做好";
    if (context.personality === "affection" && context.personalityScore >= 4)
      return "想一边做自己的事，一边安静陪在" + context.title + "身边";
    if (context.personality === "adventure" && context.personalityScore <= -4)
      return "眷恋小家的性格让我很享受待在熟悉房间里的时间";
    if (context.personality === "curiosity" && context.personalityScore >= 4)
      return "好奇心提醒我，普通的小事里也可能藏着新发现";
    if (["rain", "drizzle", "thunder", "snow"].indexOf(context.weather) !== -1)
      return "外面的天气适合留在小屋里慢慢生活";
    return "这是此刻最想做的一件小事";
  }

  function pickWeighted(items, weights, random) {
    var total = weights.reduce(function (sum, value) {
      return sum + value;
    }, 0);
    var cursor = Math.max(0, Math.min(0.999999, typeof random === "function" ? random() : Math.random())) * total;
    for (var index = 0; index < items.length; index += 1) {
      cursor -= weights[index];
      if (cursor <= 0) return items[index];
    }
    return items[items.length - 1];
  }

  function chooseActivity(input, contextInput, random) {
    var state = normalizeState(input);
    var context = normalizeContext(contextInput);
    var recentIds = state.history.slice(0, 2).map(function (entry) {
      return entry.activityId;
    });
    var candidates = ACTIVITIES.filter(function (item) {
      return eligible(item, context);
    });
    var weights = candidates.map(function (item) {
      return weight(item, context, recentIds);
    });
    return pickWeighted(candidates, weights, random);
  }

  function durationText(minutes) {
    return minutes >= 60 ? Math.floor(minutes / 60) + " 小时" : minutes + " 分钟";
  }

  function startActivity(input, contextInput, now, random, force) {
    var state = normalizeState(input);
    var context = normalizeContext(contextInput);
    var at = Math.max(0, finite(now, Date.now()));
    if (context.away) return { started: false, reason: "away", state: state };
    if (state.current) return { started: false, reason: "busy", state: state };
    if (!force && state.nextDecisionAt > at) return { started: false, reason: "cooldown", state: state };
    var selected = chooseActivity(state, context, random);
    if (!selected) return { started: false, reason: "no-activity", state: state };
    var reason = reasonFor(selected, context);
    state.current = {
      activityId: selected.id,
      startedAt: at,
      endsAt: at + selected.minutes * 60000,
      reason: reason,
      seed: Math.floor((typeof random === "function" ? random() : Math.random()) * 4294967296) >>> 0
    };
    state.stats.started += 1;
    return {
      started: true,
      state: state,
      activity: selected,
      line:
        selected.icon +
        " 我想去「" +
        selected.name +
        "」，大概 " +
        durationText(selected.minutes) +
        "。" +
        reason +
        "～"
    };
  }

  function outcomeFor(item) {
    var outcomes = {
      sleep: "睡得很安稳，醒来时尾巴都有精神了",
      pajama: "已经换好睡衣，把今天剩下的时间调成了柔软模式",
      meal: "肚子和心情都被好好照顾到了",
      cook: "小屋里留下了热腾腾的香气，成品也没有翻车",
      shower: "疲惫被水汽带走，整只鲸都清爽起来了",
      stretch: "肩膀、尾巴和思路一起舒展开了",
      tidy: "房间重新变得整整齐齐，收藏也摆回了喜欢的位置",
      paint: "画下了今天的一点颜色，歪掉的地方算独特风格",
      game: "痛快玩了一局，输赢都被留在游戏画面里了",
      music: "听完一段喜欢的旋律，尾巴还在偷偷打拍子",
      research: "又读懂了一点纪念品背后的旅行故事",
      code: "把突然冒出来的点子试了一遍，还真的有点收获",
      journal: "把今天的小事认真写进了生活手账",
      stargaze: "认出了一小片星空，也替明天留了一个愿望"
    };
    return outcomes[item.id] || "认真做完了想做的事";
  }

  function resolveActivity(input, now) {
    var state = normalizeState(input);
    var at = Math.max(0, finite(now, Date.now()));
    if (!state.current) return { resolved: false, reason: "idle", state: state };
    if (state.current.endsAt > at) return { resolved: false, reason: "not-ready", state: state };
    var current = state.current;
    var item = activity(current.activityId);
    var offline = at - current.endsAt >= 5 * 60000;
    var outcome = outcomeFor(item);
    var entry = {
      activityId: item.id,
      startedAt: current.startedAt,
      completedAt: current.endsAt,
      reason: current.reason,
      outcome: outcome,
      offline: offline
    };
    state.current = null;
    state.history.unshift(entry);
    state.history = state.history.slice(0, MAX_HISTORY);
    state.stats.completed += 1;
    state.stats.byActivity[item.id] = (state.stats.byActivity[item.id] || 0) + 1;
    var cooldownMinutes = 12 + (current.seed % 19);
    state.nextDecisionAt = Math.max(current.endsAt + cooldownMinutes * 60000, offline ? at + 5 * 60000 : 0);
    return {
      resolved: true,
      state: state,
      activity: item,
      entry: entry,
      effect: item.effect,
      line: item.icon + (offline ? " 你不在的时候，我已经「" : " 我「") + item.name + "」完成啦。" + outcome + "～"
    };
  }

  function interruptActivity(input, now, reason) {
    var state = normalizeState(input);
    if (!state.current) return { interrupted: false, state: state };
    var current = state.current;
    var item = activity(current.activityId);
    state.current = null;
    state.nextDecisionAt = Math.max(state.nextDecisionAt, Math.max(0, finite(now, Date.now())) + 5 * 60000);
    return {
      interrupted: true,
      state: state,
      activity: item,
      reason: cleanText(reason, 120) || "被更重要的事情打断"
    };
  }

  return Object.freeze({
    VERSION: VERSION,
    MAX_HISTORY: MAX_HISTORY,
    ACTIVITIES: ACTIVITIES,
    blankState: blankState,
    normalizeState: normalizeState,
    normalizeContext: normalizeContext,
    activity: activity,
    chooseActivity: chooseActivity,
    startActivity: startActivity,
    resolveActivity: resolveActivity,
    interruptActivity: interruptActivity
  });
});
