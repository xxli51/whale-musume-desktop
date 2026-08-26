(function () {
  "use strict";

  var storage = window.WhaleStorage;
  var core = window.WhaleDailySummaryCore;
  if (!storage || !core) return;
  var state = loadState();
  var syncTimer = 0;

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function parse(key, fallback) {
    try {
      return JSON.parse(storage.get(key, JSON.stringify(fallback)));
    } catch (_error) {
      return fallback;
    }
  }

  function loadState() {
    return core.normalizeState(parse("dailySummaryState", {}));
  }

  function profile() {
    var relationship = window.WhaleRelationship && window.WhaleRelationship.status();
    var profession = window.WhaleProfession && window.WhaleProfession.status();
    var professionCore = window.WhaleProfessionCore;
    var primary =
      profession && profession.state && professionCore ? professionCore.definition(profession.state.primaryId) : null;
    return {
      petName: storage.get("petName", "鲸鱼娘").trim() || "鲸鱼娘",
      title: storage.get("title", "主人").trim() || "主人",
      stage: relationship && relationship.stage ? relationship.stage.name : "初次相伴",
      personality: relationship && relationship.personality ? relationship.personality.name : "正在成长",
      personalityId: relationship && relationship.personality ? relationship.personality.id : "balanced",
      primaryCareer: primary ? primary.name : "",
      primaryCareerIcon: primary ? primary.icon : ""
    };
  }

  function snapshot() {
    var relationship = parse("relationshipState", {});
    var profession = parse("professionState", {});
    var adventure = parse("adventureState", {});
    var house = parse("houseState", {});
    var life = parse("lifeState", {});
    var games = parse("gameStats", {});
    var quests = parse("quests", {});
    var careerXp = {};
    Object.keys((profession && profession.careers) || {}).forEach(function (id) {
      careerXp[id] = profession.careers[id] && profession.careers[id].xp;
    });
    var questPool = window.DshWhaleMoeCore ? window.DshWhaleMoeCore.QUEST_POOL : [];
    var questTargets = {};
    questPool.forEach(function (quest) {
      questTargets[quest.id] = quest.target;
    });
    var completed = 0;
    var claimed = 0;
    if (quests && quests.date === core.dayKey(Date.now()) && Array.isArray(quests.slots)) {
      quests.slots.forEach(function (slot) {
        if (slot.claimed) claimed += 1;
        if (slot.claimed || (questTargets[slot.id] && Number(slot.progress) >= questTargets[slot.id])) completed += 1;
      });
    }
    return core.normalizeSnapshot({
      affinity: storage.get("affinity", "0"),
      mood: storage.get("mood", "70"),
      satiety: storage.get("satiety", "80"),
      signals: relationship.counts,
      careerXp: careerXp,
      activeSeconds: profession.stats && profession.stats.activeSeconds,
      focusBonuses: profession.stats && profession.stats.focusBonuses,
      journeys: adventure.stats && adventure.stats.completed,
      recalls: adventure.stats && adventure.stats.recalled,
      collectionFound: Object.keys(adventure.collection || {}).length,
      houseVisits: house.visits,
      gamePlays: games.plays,
      gameWins: games.wins,
      questsCompleted: completed,
      questsClaimed: claimed,
      lifeCompleted: life.stats && life.stats.completed,
      lifeActivities: life.stats && life.stats.byActivity
    });
  }

  function announce(type, line) {
    window.dispatchEvent(
      new CustomEvent("whale-desktop-companion-reminder", {
        detail: { type: type, pose: "daily-pajama", line: line, at: Date.now() }
      })
    );
  }

  function saveState(next, rolled) {
    state = core.normalizeState(next);
    storage.set("dailySummaryState", JSON.stringify(state));
    window.dispatchEvent(
      new CustomEvent("whale-daily-summary-change", {
        detail: { state: state, rolled: rolled || null, report: core.report(state.current, true) }
      })
    );
  }

  function syncNow() {
    var now = Date.now();
    var result = core.sync(state, core.dayKey(now), snapshot(), profile(), now);
    if (
      result.state.current &&
      !result.state.current.eveningShown &&
      new Date(now).getHours() >= 21 &&
      core.totalActivity(result.state.current.metrics) > 0
    ) {
      result.state.current.eveningShown = true;
      announce("daily-summary-ready", "今天的生活手账已经写好啦，要一起翻翻今天发生的事吗？📖");
    }
    saveState(result.state, result.rolled);
    if (result.rolled) announce("daily-summary-rolled", "新的一天开始啦。昨天的生活总结已经好好收进手账里了～");
    refreshVisible();
    return state;
  }

  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, 250);
  }

  function rolloverTick() {
    if (!state.current || state.current.date !== core.dayKey(Date.now())) syncNow();
  }

  function displayDate(dateKey) {
    var parts = String(dateKey).split("-");
    return Number(parts[1]) + " 月 " + Number(parts[2]) + " 日";
  }

  function stat(icon, value, label) {
    var node = element("div", "wm-daily-stat");
    node.appendChild(element("strong", "", icon + " " + value));
    node.appendChild(element("small", "", label));
    return node;
  }

  function renderReport(entry, ongoing, expanded) {
    var report = core.report(entry, ongoing);
    var card = element("article", "wm-daily-report" + (expanded ? " featured" : ""));
    if (!report) return card;
    var heading = element("div", "wm-daily-report-head");
    var title = element("div");
    title.appendChild(element("span", "", ongoing ? "今天 · 仍在记录" : displayDate(report.date)));
    title.appendChild(element("strong", "", report.title));
    heading.appendChild(title);
    heading.appendChild(element("small", "", report.intro));
    card.appendChild(heading);
    if (expanded) {
      var stats = element("div", "wm-daily-stats");
      stats.appendChild(stat("🕰️", Math.floor(report.metrics.activeSeconds / 60) + " 分钟", "有效陪伴"));
      stats.appendChild(stat("💞", report.metrics.interactions, "亲密互动"));
      stats.appendChild(stat("🗺️", report.metrics.journeys, "旅行归来"));
      stats.appendChild(stat("💗", "+" + report.affinityGain, "好感收获"));
      card.appendChild(stats);
    }
    report.paragraphs.forEach(function (paragraph) {
      card.appendChild(element("p", "", paragraph));
    });
    if (report.tags.length) {
      var tags = element("div", "wm-daily-tags");
      report.tags.forEach(function (tag) {
        tags.appendChild(element("span", "", tag));
      });
      card.appendChild(tags);
    }
    if (!expanded) {
      card.tabIndex = 0;
      card.title = "点击展开或收起这一天";
      card.addEventListener("click", function () {
        card.classList.toggle("open");
      });
      card.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        card.classList.toggle("open");
      });
    }
    return card;
  }

  function renderDaily(modal) {
    modal.innerHTML = "";
    var panel = element("div", "wm-daily-panel");
    var head = element("div", "wm-daily-head");
    var heading = element("div");
    heading.appendChild(element("strong", "", "📖 每日生活手账"));
    heading.appendChild(element("span", "", "不是打卡报表，是我们共同生活留下的痕迹"));
    head.appendChild(heading);
    var close = element("button", "wm-daily-close", "×");
    close.title = "关闭生活手账";
    close.addEventListener("click", closeDaily);
    head.appendChild(close);
    panel.appendChild(head);
    if (state.current) panel.appendChild(renderReport(state.current, true, true));
    var historyTitle = element("div", "wm-daily-history-title");
    historyTitle.appendChild(element("strong", "", "过往日子"));
    historyTitle.appendChild(element("span", "", state.history.length + " / " + core.MAX_HISTORY + " 天"));
    panel.appendChild(historyTitle);
    if (!state.history.length) {
      panel.appendChild(
        element("div", "wm-daily-empty", "第一篇手账正在发生。明天再来时，今天就会成为一页可以翻看的回忆。")
      );
    } else {
      var history = element("div", "wm-daily-history");
      state.history.forEach(function (entry) {
        history.appendChild(renderReport(entry, false, false));
      });
      panel.appendChild(history);
    }
    modal.appendChild(panel);
  }

  function closeDaily() {
    var modal = document.querySelector("[data-whale-daily]");
    if (modal) modal.hidden = true;
    var house = document.querySelector("[data-whale-house]");
    var settings = document.querySelector("[data-whale-desktop-settings]");
    window.whaleDesktop.setMouseInteractive(Boolean((house && !house.hidden) || (settings && !settings.hidden)));
  }

  function openDaily() {
    syncNow();
    var modal = document.querySelector("[data-whale-daily]");
    if (!modal) {
      modal = element("div");
      modal.setAttribute("data-whale-daily", "true");
      modal.addEventListener("pointerdown", function (event) {
        if (event.target === modal) closeDaily();
      });
      document.body.appendChild(modal);
    }
    renderDaily(modal);
    modal.hidden = false;
    window.whaleDesktop.setMouseInteractive(true);
  }

  function refreshVisible() {
    var modal = document.querySelector("[data-whale-daily]");
    if (modal && !modal.hidden) renderDaily(modal);
  }

  window.WhaleDailySummary = Object.freeze({
    open: openDaily,
    close: closeDaily,
    sync: syncNow,
    status: function () {
      return { state: state, report: state.current ? core.report(state.current, true) : null };
    }
  });
  window.addEventListener("whale-desktop-open-daily", openDaily);
  ["whale-adventure-change", "whale-profession-change", "whale-relationship-change", "whale-life-change"].forEach(
    function (eventName) {
      window.addEventListener(eventName, scheduleSync);
    }
  );
  window.addEventListener("whale-moe-prefs-change", function (event) {
    var key = event && event.detail ? event.detail.key : "";
    if (key === "dailySummaryState") {
      state = loadState();
      refreshVisible();
      return;
    }
    if (
      [
        "affinity",
        "mood",
        "satiety",
        "quests",
        "gameStats",
        "houseState",
        "petName",
        "title",
        "adventureState",
        "professionState",
        "relationshipState",
        "lifeState"
      ].indexOf(key) !== -1
    )
      scheduleSync();
  });
  window.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeDaily();
  });
  document.addEventListener(
    "DOMContentLoaded",
    function () {
      syncNow();
      setInterval(rolloverTick, 60000);
    },
    { once: true }
  );
})();
