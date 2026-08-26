(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhaleDailySummaryCore = api;
})(typeof window === "undefined" ? null : window, function () {
  "use strict";

  var VERSION = 1;
  var MAX_HISTORY = 30;
  var SIGNAL_NAMES = Object.freeze({
    depart: "出门旅行",
    returned: "旅行归来",
    "first-find": "发现新收藏",
    recall: "提前回家",
    profession: "一起工作",
    focus: "一起专注",
    feed: "投喂点心",
    praise: "收获夸奖",
    pat: "摸摸头",
    belly: "戳肚子",
    tail: "摸尾巴",
    poke: "突然戳戳"
  });
  var CAREER_NAMES = Object.freeze({
    coder: "程序鲸",
    creator: "创作鲸",
    coordinator: "事务鲸",
    researcher: "探索鲸",
    musician: "音律鲸",
    adventurer: "冒险鲸"
  });
  var LIFE_NAMES = Object.freeze({
    sleep: "睡觉",
    pajama: "换睡衣",
    meal: "吃饭",
    cook: "做饭",
    shower: "洗澡",
    stretch: "伸展",
    tidy: "整理小屋",
    paint: "画画",
    game: "自己玩游戏",
    music: "听音乐",
    research: "研究收藏",
    code: "琢磨点子",
    journal: "写生活手账",
    stargaze: "看星星"
  });

  function finite(value, fallback) {
    var out = Number(value);
    return Number.isFinite(out) ? out : fallback;
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

  function dayKey(now) {
    var date = new Date(finite(now, Date.now()));
    return date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
  }

  function blankSnapshot() {
    return {
      affinity: 0,
      mood: 70,
      satiety: 80,
      signals: {},
      careerXp: {},
      lifeActivities: {},
      activeSeconds: 0,
      focusBonuses: 0,
      journeys: 0,
      recalls: 0,
      collectionFound: 0,
      houseVisits: 0,
      gamePlays: 0,
      gameWins: 0,
      questsCompleted: 0,
      questsClaimed: 0,
      lifeCompleted: 0
    };
  }

  function normalizeMap(input, allowed) {
    var source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    var output = {};
    Object.keys(source).forEach(function (key) {
      if (allowed && allowed.indexOf(key) === -1) return;
      var value = bounded(source[key], 1000000000);
      if (value) output[key] = value;
    });
    return output;
  }

  function normalizeSnapshot(input) {
    var source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    var next = blankSnapshot();
    next.affinity = bounded(source.affinity, 10000000);
    next.mood = Math.min(100, bounded(source.mood, 100));
    next.satiety = Math.min(100, bounded(source.satiety, 100));
    next.signals = normalizeMap(source.signals, Object.keys(SIGNAL_NAMES));
    next.careerXp = normalizeMap(source.careerXp, Object.keys(CAREER_NAMES));
    next.lifeActivities = normalizeMap(source.lifeActivities, Object.keys(LIFE_NAMES));
    [
      "activeSeconds",
      "focusBonuses",
      "journeys",
      "recalls",
      "collectionFound",
      "houseVisits",
      "gamePlays",
      "gameWins",
      "questsCompleted",
      "questsClaimed",
      "lifeCompleted"
    ].forEach(function (key) {
      next[key] = bounded(source[key], 1000000000);
    });
    return next;
  }

  function blankMetrics() {
    return {
      affinityGain: 0,
      interactions: 0,
      signals: {},
      careerXp: {},
      lifeActivities: {},
      activeSeconds: 0,
      focusRounds: 0,
      journeys: 0,
      recalls: 0,
      newCollectibles: 0,
      houseVisits: 0,
      gamePlays: 0,
      gameWins: 0,
      questsCompleted: 0,
      questsClaimed: 0,
      lifeCompleted: 0
    };
  }

  function normalizeMetrics(input) {
    var source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    var next = blankMetrics();
    next.signals = normalizeMap(source.signals, Object.keys(SIGNAL_NAMES));
    next.careerXp = normalizeMap(source.careerXp, Object.keys(CAREER_NAMES));
    next.lifeActivities = normalizeMap(source.lifeActivities, Object.keys(LIFE_NAMES));
    [
      "affinityGain",
      "interactions",
      "activeSeconds",
      "focusRounds",
      "journeys",
      "recalls",
      "newCollectibles",
      "houseVisits",
      "gamePlays",
      "gameWins",
      "questsCompleted",
      "questsClaimed",
      "lifeCompleted"
    ].forEach(function (key) {
      next[key] = bounded(source[key], 1000000000);
    });
    return next;
  }

  function normalizeProfile(input) {
    var source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    return {
      petName: cleanText(source.petName, 16) || "鲸鱼娘",
      title: cleanText(source.title, 16) || "主人",
      stage: cleanText(source.stage, 32) || "初次相伴",
      personality: cleanText(source.personality, 32) || "正在成长",
      personalityId: cleanText(source.personalityId, 32) || "balanced",
      primaryCareer: cleanText(source.primaryCareer, 32),
      primaryCareerIcon: cleanText(source.primaryCareerIcon, 8)
    };
  }

  function normalizeEntry(input) {
    if (!input || typeof input !== "object" || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(String(input.date || ""))) return null;
    return {
      date: String(input.date),
      startedAt: Math.max(0, finite(input.startedAt, 0)),
      updatedAt: Math.max(0, finite(input.updatedAt, 0)),
      finalizedAt: Math.max(0, finite(input.finalizedAt, 0)),
      eveningShown: Boolean(input.eveningShown),
      checkpoint: normalizeSnapshot(input.checkpoint),
      start: normalizeSnapshot(input.start),
      end: normalizeSnapshot(input.end),
      metrics: normalizeMetrics(input.metrics),
      profile: normalizeProfile(input.profile)
    };
  }

  function blankState() {
    return { version: VERSION, current: null, history: [] };
  }

  function normalizeState(input) {
    var source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    var next = blankState();
    next.current = normalizeEntry(source.current);
    if (Array.isArray(source.history)) {
      next.history = source.history.map(normalizeEntry).filter(Boolean).slice(0, MAX_HISTORY);
    }
    return next;
  }

  function createEntry(date, snapshot, profile, now) {
    var clean = normalizeSnapshot(snapshot);
    return {
      date: date,
      startedAt: Math.max(0, finite(now, Date.now())),
      updatedAt: Math.max(0, finite(now, Date.now())),
      finalizedAt: 0,
      eveningShown: false,
      checkpoint: clean,
      start: clean,
      end: clean,
      metrics: blankMetrics(),
      profile: normalizeProfile(profile)
    };
  }

  function positiveDelta(current, previous) {
    return Math.max(0, bounded(current, 1000000000) - bounded(previous, 1000000000));
  }

  function addMapDeltas(target, current, previous) {
    Object.keys(current).forEach(function (key) {
      var delta = positiveDelta(current[key], previous[key]);
      if (delta) target[key] = bounded((target[key] || 0) + delta, 1000000000);
    });
  }

  function updateEntry(entry, snapshot, profile, now) {
    var current = normalizeSnapshot(snapshot);
    var previous = entry.checkpoint;
    var metrics = entry.metrics;
    metrics.affinityGain += positiveDelta(current.affinity, previous.affinity);
    metrics.activeSeconds += positiveDelta(current.activeSeconds, previous.activeSeconds);
    metrics.focusRounds += positiveDelta(current.focusBonuses, previous.focusBonuses);
    metrics.journeys += positiveDelta(current.journeys, previous.journeys);
    metrics.recalls += positiveDelta(current.recalls, previous.recalls);
    metrics.newCollectibles += positiveDelta(current.collectionFound, previous.collectionFound);
    metrics.houseVisits += positiveDelta(current.houseVisits, previous.houseVisits);
    metrics.gamePlays += positiveDelta(current.gamePlays, previous.gamePlays);
    metrics.gameWins += positiveDelta(current.gameWins, previous.gameWins);
    metrics.questsCompleted += positiveDelta(current.questsCompleted, previous.questsCompleted);
    metrics.questsClaimed += positiveDelta(current.questsClaimed, previous.questsClaimed);
    metrics.lifeCompleted += positiveDelta(current.lifeCompleted, previous.lifeCompleted);
    addMapDeltas(metrics.signals, current.signals, previous.signals);
    addMapDeltas(metrics.careerXp, current.careerXp, previous.careerXp);
    addMapDeltas(metrics.lifeActivities, current.lifeActivities, previous.lifeActivities);
    metrics.interactions = ["feed", "praise", "pat", "belly", "tail", "poke"].reduce(function (total, key) {
      return total + (metrics.signals[key] || 0);
    }, 0);
    entry.checkpoint = current;
    entry.end = current;
    entry.metrics = normalizeMetrics(metrics);
    entry.profile = normalizeProfile(profile || entry.profile);
    entry.updatedAt = Math.max(entry.updatedAt, finite(now, Date.now()));
    return entry;
  }

  function sync(input, date, snapshot, profile, now) {
    var state = normalizeState(input);
    var key = date || dayKey(now);
    if (!state.current) {
      state.current = createEntry(key, snapshot, profile, now);
      return { state: state, rolled: null };
    }
    if (state.current.date !== key) {
      state.current.finalizedAt = Math.max(state.current.updatedAt, finite(now, Date.now()));
      var rolled = state.current;
      state.history.unshift(rolled);
      state.history = state.history.slice(0, MAX_HISTORY);
      state.current = createEntry(key, snapshot, profile, now);
      return { state: state, rolled: rolled };
    }
    state.current = updateEntry(state.current, snapshot, profile, now);
    return { state: state, rolled: null };
  }

  function dominantKey(map) {
    var best = "";
    Object.keys(map || {}).forEach(function (key) {
      if (!best || map[key] > map[best]) best = key;
    });
    return best;
  }

  function totalActivity(metrics) {
    var value = normalizeMetrics(metrics);
    return (
      value.interactions +
      value.focusRounds +
      value.journeys +
      value.houseVisits +
      value.gamePlays +
      value.questsCompleted +
      value.lifeCompleted +
      Math.floor(value.activeSeconds / 300)
    );
  }

  function formatMinutes(seconds) {
    var minutes = Math.floor(bounded(seconds, 1000000000) / 60);
    if (minutes < 60) return minutes + " 分钟";
    var hours = Math.floor(minutes / 60);
    var rest = minutes % 60;
    return hours + " 小时" + (rest ? " " + rest + " 分钟" : "");
  }

  function report(input, ongoing) {
    var entry = normalizeEntry(input);
    if (!entry) return null;
    var metrics = entry.metrics;
    var profile = entry.profile;
    var paragraphs = [];
    var tags = [];
    var activeMinutes = Math.floor(metrics.activeSeconds / 60);
    var dominantCareer = dominantKey(metrics.careerXp);
    var dominantLife = dominantKey(metrics.lifeActivities);
    var interactionSignals = {};
    ["feed", "praise", "pat", "belly", "tail", "poke"].forEach(function (key) {
      if (metrics.signals[key]) interactionSignals[key] = metrics.signals[key];
    });
    var dominantSignal = dominantKey(interactionSignals);
    var title = "安安静静的一天";

    if (metrics.journeys) title = "把远方的故事带回了家";
    else if (activeMinutes >= 60 || metrics.focusRounds >= 2) title = "认真陪伴、一起成长的一天";
    else if (metrics.interactions >= 3) title = "黏在一起的温柔日常";
    else if (metrics.gamePlays) title = "一起玩闹、留下笑声的一天";
    else if (metrics.lifeCompleted >= 2) title = "把自己的小日子过得很好";

    if (activeMinutes > 0) {
      var careerName = CAREER_NAMES[dominantCareer] || profile.primaryCareer || "陪伴工作";
      paragraphs.push(
        "今天陪" +
          profile.title +
          "认真忙了 " +
          formatMinutes(metrics.activeSeconds) +
          "，最明显的成长来自「" +
          careerName +
          "」。"
      );
      tags.push("专注 " + formatMinutes(metrics.activeSeconds));
    }
    if (metrics.focusRounds) {
      paragraphs.push("我们一起完成了 " + metrics.focusRounds + " 轮番茄专注，每一轮都让今天更踏实一点。");
      tags.push("番茄钟 ×" + metrics.focusRounds);
    }
    if (metrics.journeys) {
      var travelLine = "我完成了 " + metrics.journeys + " 次旅行";
      if (metrics.newCollectibles) travelLine += "，还发现了 " + metrics.newCollectibles + " 种新收藏";
      if (metrics.recalls) travelLine += "；其中有 " + metrics.recalls + " 次听见你的召唤提前回家";
      paragraphs.push(travelLine + "。远方不再只是地图上的名字啦。");
      tags.push("旅行 ×" + metrics.journeys);
    }
    if (metrics.interactions) {
      paragraphs.push(
        "我们有过 " +
          metrics.interactions +
          " 次亲密互动，今天最常发生的是「" +
          (SIGNAL_NAMES[dominantSignal] || "互相陪伴") +
          "」。"
      );
      tags.push("互动 ×" + metrics.interactions);
    }
    if (metrics.gamePlays) {
      paragraphs.push(
        "还一起玩了 " +
          metrics.gamePlays +
          " 局小游戏" +
          (metrics.gameWins ? "，赢下了 " + metrics.gameWins + " 局" : "") +
          "，房间里热闹了不少。"
      );
      tags.push("游戏 ×" + metrics.gamePlays);
    }
    if (metrics.questsCompleted || metrics.houseVisits) {
      var pieces = [];
      if (metrics.questsCompleted) pieces.push("完成 " + metrics.questsCompleted + " 项今日任务");
      if (metrics.houseVisits) pieces.push("回小屋看了 " + metrics.houseVisits + " 次");
      paragraphs.push("生活里的小事也没有落下：" + pieces.join("，") + "。");
    }
    if (metrics.lifeCompleted) {
      paragraphs.push(
        "我也自己安排并完成了 " +
          metrics.lifeCompleted +
          " 件生活小事，最常做的是「" +
          (LIFE_NAMES[dominantLife] || "照顾自己") +
          "」。不是等着被点击时，我也在好好生活。"
      );
      tags.push("自主生活 ×" + metrics.lifeCompleted);
    }
    if (!paragraphs.length) {
      paragraphs.push("今天暂时没有很多热闹的记录。能安静待在同一个桌面上，也是一种陪伴。");
      tags.push("慢慢生活");
    }
    var endings = {
      adventure: "带着「" + profile.personality + "」的心情，我已经开始期待明天会通往哪里。",
      diligence: "「" + profile.personality + "」的我把这些小小进度都收好了，明天也会继续陪你。",
      affection: "变得越来越「" + profile.personality + "」的我，最喜欢积累只有我们知道的日常啦。",
      curiosity: "怀着「" + profile.personality + "」的心情，今天又多认识世界一点。",
      balanced: "我还在从每一天里慢慢长成独一无二的自己。"
    };
    paragraphs.push(endings[profile.personalityId] || endings.balanced);
    return {
      date: entry.date,
      ongoing: Boolean(ongoing),
      title: title,
      intro: profile.petName + " · " + profile.stage + " · " + profile.personality,
      paragraphs: paragraphs,
      tags: tags.slice(0, 4),
      activity: totalActivity(metrics),
      metrics: metrics,
      moodStart: entry.start.mood,
      moodEnd: entry.end.mood,
      affinityGain: metrics.affinityGain
    };
  }

  return Object.freeze({
    VERSION: VERSION,
    MAX_HISTORY: MAX_HISTORY,
    SIGNAL_NAMES: SIGNAL_NAMES,
    CAREER_NAMES: CAREER_NAMES,
    LIFE_NAMES: LIFE_NAMES,
    blankState: blankState,
    blankSnapshot: blankSnapshot,
    normalizeSnapshot: normalizeSnapshot,
    normalizeState: normalizeState,
    dayKey: dayKey,
    sync: sync,
    report: report,
    totalActivity: totalActivity
  });
});
