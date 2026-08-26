(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhaleAdventureCore = api;
})(typeof window === "undefined" ? null : window, function () {
  "use strict";

  var VERSION = 1;
  var MAX_JOURNEYS = 24;
  var MAX_MEMORIES = 36;

  var ROUTES = Object.freeze({
    nearby: Object.freeze({ label: "附近散步", durationMs: 5 * 60000 }),
    outing: Object.freeze({ label: "短途旅行", durationMs: 30 * 60000 }),
    voyage: Object.freeze({ label: "远方探险", durationMs: 2 * 3600000 })
  });

  var ITEMS = Object.freeze({
    "blue-shell": Object.freeze({ name: "蓝潮贝壳", icon: "🐚", hint: "听说能留下海浪的声音" }),
    "rain-bead": Object.freeze({ name: "雨滴玻璃", icon: "💧", hint: "雨停后才会凝成的小珠子" }),
    "maple-leaf": Object.freeze({ name: "鲸尾枫叶", icon: "🍁", hint: "叶尖像一条小鲸鱼尾巴" }),
    "moon-feather": Object.freeze({ name: "月光羽毛", icon: "🪶", hint: "在夜色里泛着很淡的银光" }),
    "star-sand": Object.freeze({ name: "星砂瓶", icon: "✨", hint: "摇一摇就像把星空装进瓶里" }),
    "tiny-gear": Object.freeze({ name: "小小齿轮", icon: "⚙️", hint: "来自一台仍在工作的旧机器" }),
    "coffee-bean": Object.freeze({ name: "香气咖啡豆", icon: "☕", hint: "夜市摊主送给熟客的礼物" }),
    "cloud-ribbon": Object.freeze({ name: "云朵丝带", icon: "☁️", hint: "摸起来比想象中更轻" })
  });

  var LOCATIONS = Object.freeze([
    Object.freeze({
      id: "tide-shore",
      name: "潮汐海岸",
      icon: "🌊",
      items: ["blue-shell", "star-sand", "rain-bead"],
      traits: ["water", "open"]
    }),
    Object.freeze({
      id: "whisper-forest",
      name: "低语森林",
      icon: "🌲",
      items: ["maple-leaf", "moon-feather", "rain-bead"],
      traits: ["green", "quiet"]
    }),
    Object.freeze({
      id: "lantern-market",
      name: "灯火夜市",
      icon: "🏮",
      items: ["coffee-bean", "cloud-ribbon", "tiny-gear"],
      traits: ["night", "lively"]
    }),
    Object.freeze({
      id: "star-observatory",
      name: "鲸背观星台",
      icon: "🔭",
      items: ["star-sand", "moon-feather", "cloud-ribbon"],
      traits: ["night", "quiet"]
    }),
    Object.freeze({
      id: "clockwork-shop",
      name: "发条工房",
      icon: "🛠️",
      items: ["tiny-gear", "coffee-bean", "cloud-ribbon"],
      traits: ["work", "indoor"]
    }),
    Object.freeze({
      id: "cloud-harbor",
      name: "云上港口",
      icon: "⛵",
      items: ["cloud-ribbon", "blue-shell", "star-sand"],
      traits: ["open", "wind"]
    })
  ]);

  function blankState() {
    return {
      version: VERSION,
      current: null,
      journeys: [],
      collection: {},
      memory: { visited: {}, recentItems: [], recentSpeech: [], entries: [] },
      stats: { completed: 0, recalled: 0 }
    };
  }

  function finite(value, fallback) {
    var out = Number(value);
    return Number.isFinite(out) ? out : fallback;
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

  function normalizeState(input) {
    var next = blankState();
    var source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    var current = source.current;
    if (current && typeof current === "object" && ROUTES[current.route] && locationById(current.locationId)) {
      next.current = {
        id: cleanText(current.id, 64),
        route: current.route,
        locationId: current.locationId,
        departedAt: Math.max(0, finite(current.departedAt, 0)),
        returnsAt: Math.max(0, finite(current.returnsAt, 0)),
        seed: finite(current.seed, 1) >>> 0,
        purpose: cleanText(current.purpose, 160),
        context: normalizeContext(current.context)
      };
    }
    if (Array.isArray(source.journeys)) {
      next.journeys = source.journeys.slice(0, MAX_JOURNEYS).map(normalizeJourney).filter(Boolean);
    }
    if (source.collection && typeof source.collection === "object" && !Array.isArray(source.collection)) {
      Object.keys(ITEMS).forEach(function (id) {
        var count = Math.floor(finite(source.collection[id], 0));
        if (count > 0) next.collection[id] = Math.min(count, 9999);
      });
    }
    var memory = source.memory && typeof source.memory === "object" ? source.memory : {};
    if (memory.visited && typeof memory.visited === "object") {
      LOCATIONS.forEach(function (location) {
        var count = Math.floor(finite(memory.visited[location.id], 0));
        if (count > 0) next.memory.visited[location.id] = Math.min(count, 9999);
      });
    }
    if (Array.isArray(memory.recentItems)) {
      next.memory.recentItems = memory.recentItems
        .filter(function (id) {
          return Boolean(ITEMS[id]);
        })
        .slice(0, 5);
    }
    if (Array.isArray(memory.recentSpeech)) {
      next.memory.recentSpeech = memory.recentSpeech
        .map(function (line) {
          return cleanText(line, 500);
        })
        .filter(Boolean)
        .slice(0, 8);
    }
    if (Array.isArray(memory.entries)) {
      next.memory.entries = memory.entries.slice(0, MAX_MEMORIES).map(normalizeMemory).filter(Boolean);
    }
    var stats = source.stats && typeof source.stats === "object" ? source.stats : {};
    next.stats.completed = Math.max(next.journeys.length, Math.floor(finite(stats.completed, 0)));
    next.stats.recalled = Math.max(0, Math.floor(finite(stats.recalled, 0)));
    return next;
  }

  function normalizeContext(context) {
    var source = context && typeof context === "object" ? context : {};
    return {
      hour: Math.max(0, Math.min(23, Math.floor(finite(source.hour, 12)))),
      weather: cleanText(source.weather, 24) || "unknown",
      activity: cleanText(source.activity, 32) || "other",
      profession: cleanText(source.profession, 32),
      relationship: cleanText(source.relationship, 32) || "new",
      personality: cleanText(source.personality, 32),
      personalityScore: Math.max(-1000, Math.min(1000, Math.floor(finite(source.personalityScore, 0)))),
      city: cleanText(source.city, 48),
      title: cleanText(source.title, 16) || "主人",
      petName: cleanText(source.petName, 16) || "鲸鱼娘",
      focusRounds: Math.max(0, Math.min(9999, Math.floor(finite(source.focusRounds, 0))))
    };
  }

  function normalizeJourney(journey) {
    if (!journey || typeof journey !== "object" || !ITEMS[journey.itemId] || !locationById(journey.locationId))
      return null;
    return {
      id: cleanText(journey.id, 64),
      route: ROUTES[journey.route] ? journey.route : "nearby",
      locationId: journey.locationId,
      itemId: journey.itemId,
      returnedAt: Math.max(0, finite(journey.returnedAt, 0)),
      diary: cleanText(journey.diary, 1200),
      story: cleanText(journey.story, 600),
      firstFind: Boolean(journey.firstFind)
    };
  }

  function normalizeMemory(entry) {
    if (!entry || typeof entry !== "object") return null;
    return {
      at: Math.max(0, finite(entry.at, 0)),
      kind: cleanText(entry.kind, 32) || "journey",
      summary: cleanText(entry.summary, 240),
      locationId: locationById(entry.locationId) ? entry.locationId : "",
      itemId: ITEMS[entry.itemId] ? entry.itemId : ""
    };
  }

  function locationById(id) {
    for (var i = 0; i < LOCATIONS.length; i += 1) if (LOCATIONS[i].id === id) return LOCATIONS[i];
    return null;
  }

  function seededRandom(seed) {
    var value = seed >>> 0;
    return function () {
      value += 0x6d2b79f5;
      var out = value;
      out = Math.imul(out ^ (out >>> 15), out | 1);
      out ^= out + Math.imul(out ^ (out >>> 7), out | 61);
      return ((out ^ (out >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(list, random) {
    return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
  }

  function weightedLocation(context, random) {
    var weighted = [];
    LOCATIONS.forEach(function (location) {
      var weight = 2;
      if ((context.hour >= 19 || context.hour < 6) && location.traits.indexOf("night") !== -1) weight += 4;
      if (
        ["ide", "terminal", "design", "office"].indexOf(context.activity) !== -1 &&
        location.traits.indexOf("work") !== -1
      )
        weight += 4;
      if (
        ["rain", "drizzle", "thunder", "snow"].indexOf(context.weather) !== -1 &&
        location.traits.indexOf("indoor") !== -1
      )
        weight += 3;
      if (["clear", "cloudy", "wind"].indexOf(context.weather) !== -1 && location.traits.indexOf("open") !== -1)
        weight += 2;
      if (context.profession === "coder" && location.id === "clockwork-shop") weight += 5;
      if (context.profession === "creator" && ["whisper-forest", "cloud-harbor"].indexOf(location.id) !== -1)
        weight += 3;
      if (context.profession === "coordinator" && location.id === "lantern-market") weight += 4;
      if (context.profession === "researcher" && location.id === "star-observatory") weight += 5;
      if (context.profession === "musician" && location.id === "lantern-market") weight += 5;
      if (context.profession === "adventurer" && ["tide-shore", "cloud-harbor"].indexOf(location.id) !== -1)
        weight += 3;
      if (
        context.personality === "adventure" &&
        context.personalityScore >= 4 &&
        location.traits.indexOf("open") !== -1
      )
        weight += 4;
      if (
        context.personality === "adventure" &&
        context.personalityScore <= -4 &&
        location.traits.indexOf("indoor") !== -1
      )
        weight += 4;
      if (
        context.personality === "curiosity" &&
        context.personalityScore >= 4 &&
        ["star-observatory", "whisper-forest"].indexOf(location.id) !== -1
      )
        weight += 3;
      for (var i = 0; i < weight; i += 1) weighted.push(location);
    });
    return pick(weighted, random);
  }

  function chooseItem(location, state, random) {
    var recent = state.memory.recentItems || [];
    var pool = [];
    location.items.forEach(function (itemId) {
      var owned = finite(state.collection[itemId], 0);
      var weight = owned === 0 ? 5 : recent.indexOf(itemId) === -1 ? 3 : 1;
      for (var i = 0; i < weight; i += 1) pool.push(itemId);
    });
    return pick(pool, random);
  }

  function journeyPurpose(location, state, context, routeId) {
    var unseen = location.items.filter(function (itemId) {
      return !state.collection[itemId];
    });
    if (unseen.length) return "寻找收藏册里还没有的纪念品";
    if (["rain", "drizzle", "thunder", "snow"].indexOf(context.weather) !== -1)
      return "看看雨雪中的风景，顺便收集一点旅途故事";
    if (routeId === "nearby") return "散散步，看看附近今天有什么新鲜事";
    if (routeId === "voyage") return "探索没走过的地方，给我们的收藏添一点新故事";
    return "看看老地方有没有新的变化，再挑一份礼物带回来";
  }

  function durationText(durationMs) {
    if (durationMs >= 3600000 && durationMs % 3600000 === 0) return durationMs / 3600000 + " 小时";
    return Math.round(durationMs / 60000) + " 分钟";
  }

  function rememberSpeech(state, variants, random) {
    var recent = state.memory.recentSpeech || [];
    var available = variants.filter(function (line) {
      return recent.indexOf(line) === -1;
    });
    var line = pick(available.length ? available : variants, random);
    state.memory.recentSpeech.unshift(line);
    state.memory.recentSpeech = state.memory.recentSpeech.slice(0, 8);
    return line;
  }

  function departurePromise(context, random) {
    var variants = {
      forever: [
        "最想把故事第一个讲给你听～",
        "沿途看到好玩的，我都会替你多看一眼。",
        "放心，我认得回到你身边的路。",
        "我会把今天最好的一段风景留给你。"
      ],
      bonded: [
        "我会记得早点回来找你的～",
        "等我回来，我们再慢慢说话。",
        "我把想念装进口袋，很快就带回来。",
        "你在家等我，我就不会走丢。"
      ],
      trusted: [
        "等我回来把一路上的事都讲给你听～",
        "我会照顾好自己，也会准时回来。",
        "回来时给你一个有头有尾的旅行故事。",
        "如果遇见惊喜，我一定替你带一份。"
      ],
      new: ["回来给你讲故事～", "我先去看看，很快就回来。", "等我带一点远方的消息回来吧。", "小屋就暂时拜托你看守啦。"]
    };
    return pick(variants[context.relationship] || variants.new, random);
  }

  function departureLines(context, location, purpose, route, random) {
    var owner = context.title;
    var duration = durationText(route.durationMs);
    var promise = departurePromise(context, random);
    var routeLines = {
      nearby: [
        owner + "，我想去" + location.name + "转一小圈，顺便" + purpose + "。大约 " + duration + "后回来，" + promise,
        owner + "，附近的风好像在叫我。我去" + location.name + purpose + "，" + duration + "左右就回家，" + promise,
        owner +
          "，我出去散散步，目的地是" +
          location.name +
          "。这次想" +
          purpose +
          "，过 " +
          duration +
          "来接我回家吧，" +
          promise,
        owner + "，趁现在出门正合适，我去" + location.name + "看看。大约 " + duration + "后回来，" + promise
      ],
      outing: [
        owner +
          "，我收好行囊啦！这次去" +
          location.name +
          "，打算" +
          purpose +
          "。大约 " +
          duration +
          "后回来，" +
          promise,
        owner +
          "，今天想走远一点，到" +
          location.name +
          "完成一件小事：" +
          purpose +
          "。预计 " +
          duration +
          "后到家，" +
          promise,
        owner + "，下一站是" + location.name + "。我想" + purpose + "，路上来回大约要 " + duration + "，" + promise,
        owner + "，背包检查完毕，我要向" + location.name + "出发啦！大约 " + duration + "后回来，" + promise
      ],
      voyage: [
        owner + "，我要去远方的" + location.name + "探险，打算" + purpose + "。大约 " + duration + "后回来，" + promise,
        owner + "，这次的路会长一点，我想去" + location.name + purpose + "。预计 " + duration + "后回家，" + promise,
        owner + "，地图已经摊开啦，远方的" + location.name + "在等我。旅程约 " + duration + "，" + promise,
        owner + "，我要认真完成一次远方探险，目的地是" + location.name + "。大约 " + duration + "后回来，" + promise
      ]
    };
    return routeLines[route === ROUTES.nearby ? "nearby" : route === ROUTES.outing ? "outing" : "voyage"];
  }

  function startJourney(input, routeId, context, now, random) {
    var state = normalizeState(input);
    if (state.current) return { started: false, reason: "already-away", state: state };
    var route = ROUTES[routeId];
    if (!route) return { started: false, reason: "unknown-route", state: state };
    var at = Math.max(0, finite(now, Date.now()));
    var sourceRandom = typeof random === "function" ? random : Math.random;
    var seed = Math.floor(sourceRandom() * 4294967296) >>> 0;
    var normalizedContext = normalizeContext(context);
    var location = weightedLocation(normalizedContext, seededRandom(seed));
    var speechRandom = seededRandom(seed ^ 0x6d2b79f5);
    var purpose = journeyPurpose(location, state, normalizedContext, routeId);
    state.current = {
      id: at.toString(36) + "-" + seed.toString(36),
      route: routeId,
      locationId: location.id,
      departedAt: at,
      returnsAt: at + route.durationMs,
      seed: seed,
      purpose: purpose,
      context: normalizedContext
    };
    var line = rememberSpeech(
      state,
      departureLines(normalizedContext, location, purpose, route, speechRandom),
      speechRandom
    );
    return {
      started: true,
      state: state,
      journey: state.current,
      line: line
    };
  }

  function weatherDetail(context, random) {
    var variants = {
      rain: ["雨点一路敲着伞面", "途中忽然落起了细雨"],
      drizzle: ["细雨把路面洗得亮晶晶的", "毛毛雨像一层很轻的雾"],
      thunder: ["远处的雷声把我吓得尾巴一抖", "闪电把云边照得像银色"],
      snow: ["雪花落在袖口上，很快就化掉了", "一路都能听见踩雪的沙沙声"],
      wind: ["风差点把我的帽子借走", "今天的风推着云跑得飞快"],
      clear: ["天空亮得像刚擦过一样", "阳光把影子拉得长长的"],
      cloudy: ["云层软绵绵地铺满天空", "没有刺眼的太阳，正适合散步"]
    };
    return pick(variants[context.weather] || ["路上的天气很舒服", "沿途比想象中安静"], random);
  }

  function activityDetail(context, random) {
    var owner = context.title;
    var variants = {
      ide: ["想到" + owner + "还在和代码较劲，我也认真找起了礼物", owner + "专注工作的样子，让我也不想空手而归"],
      terminal: ["陪" + owner + "看久了黑色终端，出来看看颜色果然很好", "我把一路的发现记得像命令输出一样整齐"],
      design: ["一路上遇到的颜色，都想带回去给" + owner + "看看", "我挑礼物的时候，特意注意了它的形状和颜色"],
      office: [owner + "忙工作的时候，我也完成了自己的小任务", "我决定替埋在文档里的" + owner + "看看外面的风景"],
      game: ["这次探险没有存档点，不过我还是顺利通关啦", "我一路都在想，这里会不会藏着彩蛋"],
      music: ["路边的声音凑在一起，像一首没有名字的歌", "我跟着耳边的节拍走了很远"],
      meeting: [owner + "开会的时候，我尽量轻手轻脚地出发了", "希望" + owner + "结束会议时，也能收到一点好消息"]
    };
    if (context.focusRounds > 0 && random() < 0.45) {
      return owner + "已经完成了 " + context.focusRounds + " 轮专注，我也想认真完成这次旅行";
    }
    return pick(
      variants[context.activity] || [
        "想到" + owner + "还在等我，我就加快了脚步",
        "我把沿途的小事都好好记了下来，想讲给" + owner + "听"
      ],
      random
    );
  }

  function discoveryDetail(item, firstFind, random) {
    if (firstFind) {
      return pick(
        ["我第一次见到" + item.name + "，差点舍不得眨眼", "在一个不起眼的角落，我发现了从没见过的" + item.name],
        random
      );
    }
    return pick(
      ["我又遇见了" + item.name + "，这一枚也有自己的样子", "熟悉的" + item.name + "再次出现，好像在和我打招呼"],
      random
    );
  }

  function composeDiary(location, item, context, details, random) {
    var openings = [
      "今天去了" + location.name + "。",
      "这次的目的地是" + location.name + "。",
      "我沿着一条没走过的小路，到了" + location.name + "。"
    ];
    var closings = [
      "我把" + item.name + "带回来了，想和" + context.title + "一起收藏。",
      "回程时我一直护着" + item.name + "，现在终于可以交给" + context.title + "啦。",
      item.hint + "。我觉得它应该属于我们的收藏册。"
    ];
    return [
      pick(openings, random),
      details.weather + "。",
      details.activity + "。",
      details.discovery + "。",
      pick(closings, random)
    ].join("");
  }

  function returnLines(current, location, item, story) {
    var owner = current.context.title;
    var close = item.icon + item.name;
    var intimate = current.context.relationship === "forever" || current.context.relationship === "bonded";
    return [
      owner + "，我从" + location.name + "回来啦！" + story + "。我把" + close + "带回来了，已经放进我们的收藏册啦～",
      owner + "，我到家啦！这一路发生了不少事：" + story + "。还有，这是特意带回来的" + close + "。",
      owner + "，快来接住我的旅行故事～我去了" + location.name + "，" + story + "。最后还找到了" + close + "！",
      owner + "，门外的风景看完啦，我平安回来了。" + story + "。这份" + close + "想第一个给你看。",
      owner + "，你看，我没有空手回来！在" + location.name + "的时候，" + story + "。我们的收藏又多了" + close + "。",
      owner +
        "，回家的路一想到你就变短了。我从" +
        location.name +
        "带回了" +
        close +
        "，还有一长串故事：" +
        story +
        "。",
      intimate
        ? owner +
          "，我回来找你啦！在" +
          location.name +
          "看到的每一段风景，都想讲给你听。" +
          story +
          "。还带回了" +
          close +
          "～"
        : owner + "，旅行任务完成，我回来报到啦！目的地是" + location.name + "，" + story + "。纪念品是" + close + "。",
      owner +
        "，小屋的灯还亮着，真好。我从" +
        location.name +
        "平安到家，也把" +
        close +
        "和这段故事一起带回来了：" +
        story +
        "。"
    ];
  }

  function resolveJourney(input, now) {
    var state = normalizeState(input);
    if (!state.current) return { resolved: false, reason: "at-home", state: state };
    var at = Math.max(0, finite(now, Date.now()));
    if (at < state.current.returnsAt) return { resolved: false, reason: "not-ready", state: state };
    var current = state.current;
    var random = seededRandom(current.seed ^ 0x9e3779b9);
    var location = locationById(current.locationId);
    var itemId = chooseItem(location, state, random);
    var item = ITEMS[itemId];
    var firstFind = !state.collection[itemId];
    var details = {
      weather: weatherDetail(current.context, random),
      activity: activityDetail(current.context, random),
      discovery: discoveryDetail(item, firstFind, random)
    };
    var diary = composeDiary(location, item, current.context, details, random);
    var story = details.weather + "；" + details.activity + "；" + details.discovery;
    var journey = {
      id: current.id,
      route: current.route,
      locationId: location.id,
      itemId: itemId,
      returnedAt: at,
      diary: diary,
      story: story,
      firstFind: firstFind
    };
    state.current = null;
    state.collection[itemId] = (state.collection[itemId] || 0) + 1;
    state.journeys.unshift(journey);
    state.journeys = state.journeys.slice(0, MAX_JOURNEYS);
    state.memory.visited[location.id] = (state.memory.visited[location.id] || 0) + 1;
    state.memory.recentItems.unshift(itemId);
    state.memory.recentItems = state.memory.recentItems.slice(0, 5);
    state.memory.entries.unshift({
      at: at,
      kind: "journey",
      summary: "从" + location.name + "带回了" + item.name,
      locationId: location.id,
      itemId: itemId
    });
    state.memory.entries = state.memory.entries.slice(0, MAX_MEMORIES);
    state.stats.completed += 1;
    var line = rememberSpeech(state, returnLines(current, location, item, story), random);
    return {
      resolved: true,
      state: state,
      journey: journey,
      location: location,
      item: item,
      line: line
    };
  }

  function recallJourney(input, now) {
    var state = normalizeState(input);
    if (!state.current) return { recalled: false, reason: "at-home", state: state };
    var at = Math.max(0, finite(now, Date.now()));
    var current = state.current;
    if (at >= current.returnsAt) return { recalled: false, reason: "already-returned", state: state };
    var location = locationById(current.locationId);
    var duration = Math.max(1, current.returnsAt - current.departedAt);
    var progress = Math.max(0, Math.min(1, (at - current.departedAt) / duration));
    var owner = current.context.title;
    var random = seededRandom(current.seed ^ Math.floor(progress * 0xffffffff) ^ 0xa5a5a5a5);
    var variants;
    if (progress < 0.08) {
      variants = [
        owner + "，我听到你叫我就回头啦！还没走远，今天先陪你～",
        owner + "，刚走到门口就听见你啦，我这就转身回来。",
        owner + "，召回信号收到！行囊都还没捂热，我先回你身边。",
        owner + "，幸好还没走远。旅行可以改天，你现在找我更重要。",
        owner + "，我才刚出发就开始想家啦，你一叫我，我马上回来。",
        owner + "，听见啦听见啦！我就在附近，这就沿原路跑回来。"
      ];
    } else if (progress < 0.65) {
      variants = [
        owner + "，我听到召唤就从" + location.name + "附近赶回来啦！纪念品下次再找～",
        owner + "，你的声音追到" + location.name + "啦，我收好地图往家赶回来了。",
        owner + "，旅程走到一半收到召回，我已经平安回家。没看完的风景留给下次吧。",
        owner + "，我从" + location.name + "掉头回来啦。虽然没带纪念品，但把自己准时带回来了～",
        owner + "，召回收到！我把半途的小故事记好了，下次再从" + location.name + "继续。",
        owner + "，比起继续赶路，我更想先回来看看你。" + location.name + "会等我们的。"
      ];
    } else {
      variants = [
        owner + "，我刚在" + location.name + current.purpose + "，听见你叫我就赶回来啦！发现先留给下次～",
        owner + "，差一点就完成这趟旅程了，不过你的召唤优先。我从" + location.name + "回来啦。",
        owner + "，我已经走到" + location.name + "深处，收到消息就立刻返程。放心，我平安到家了。",
        owner + "，最后一段风景先不看啦，我从" + location.name + "赶回来了。下次再把结局补上。",
        owner + "，召回信号穿过好远才找到我，但我一听见就往家跑。" + location.name + "的故事先欠你半篇～",
        owner + "，纪念品还差一点就找到了，不过没关系，我已经从" + location.name + "回到你身边。"
      ];
    }
    var line = rememberSpeech(state, variants, random);
    state.current = null;
    state.stats.recalled += 1;
    state.memory.entries.unshift({
      at: at,
      kind: "recall",
      summary: "听到" + owner + "召唤，提前从" + location.name + "返回",
      locationId: location.id,
      itemId: ""
    });
    state.memory.entries = state.memory.entries.slice(0, MAX_MEMORIES);
    return { recalled: true, state: state, location: location, progress: progress, line: line };
  }

  function collectionProgress(input) {
    var state = normalizeState(input);
    var found = Object.keys(ITEMS).filter(function (id) {
      return Boolean(state.collection[id]);
    }).length;
    return { found: found, total: Object.keys(ITEMS).length };
  }

  function isAway(input, now, departureDelayMs) {
    var state = normalizeState(input);
    if (!state.current) return false;
    var at = Math.max(0, finite(now, Date.now()));
    var delay = Math.max(0, finite(departureDelayMs, 0));
    return at >= state.current.departedAt + delay && at < state.current.returnsAt;
  }

  return Object.freeze({
    VERSION: VERSION,
    ROUTES: ROUTES,
    ITEMS: ITEMS,
    LOCATIONS: LOCATIONS,
    blankState: blankState,
    normalizeState: normalizeState,
    startJourney: startJourney,
    resolveJourney: resolveJourney,
    recallJourney: recallJourney,
    collectionProgress: collectionProgress,
    isAway: isAway,
    locationById: locationById
  });
});
