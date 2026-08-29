(function () {
  "use strict";

  var storage = window.WhaleStorage;
  var TOGGLES = window.WhaleSettingsData.TOGGLES;
  var POSE_GROUPS = window.WhaleSettingsData.POSE_GROUPS;
  var ACHIEVEMENTS = window.WhaleSettingsData.ACHIEVEMENTS;
  var desktopApi = window.whaleDesktop;
  var SETTINGS_THEMES = Object.freeze([
    ["a", "海盐玻璃", "清透柔和"],
    ["b", "深海控制台", "沉浸精致"],
    ["c", "奶油手账", "温暖可爱"],
    ["d", "极简原生", "克制高效"],
    ["e", "月光紫", "柔雾月光"],
    ["f", "暖阳橙", "暖橙蜜桃"],
    ["g", "樱花粉", "柔粉浪漫"]
  ]);
  var SETTINGS_THEME_DETAILS = Object.freeze({
    a: Object.freeze({ status: "空闲中", line: "心情很好，想和你一起发呆。", card: "dsh-whale-settings-peek.webp", navigation: "dsh-whale-state-idle-cute.webp" }),
    b: Object.freeze({ status: "专注中", line: "我会安静陪着你哦。", card: "dsh-whale-state-idle-cute.webp", navigation: "dsh-whale-state-idle-cute.webp" }),
    c: Object.freeze({ status: "开心", line: "哇～天气真好，一起摸鱼吧！", card: "dsh-whale-state-blush.webp", navigation: "dsh-whale-state-blush.webp" }),
    d: Object.freeze({ status: "空闲中", line: "随时等你哦。", card: "dsh-whale-state-waiting.webp", navigation: "dsh-whale-state-waiting.webp" }),
    e: Object.freeze({ status: "静候中", line: "月光落在海面上，我陪你安静待一会儿。", card: "dsh-whale-state-idle-cute.webp", navigation: "dsh-whale-settings-peek.webp" }),
    f: Object.freeze({ status: "开心", line: "阳光正好，一起出去走走吧！", card: "dsh-whale-state-daily-coffee.webp", navigation: "dsh-whale-state-daily-coffee.webp" }),
    g: Object.freeze({ status: "开心", line: "樱花开了，好想和你一起看。", card: "dsh-whale-state-blush.webp", navigation: "dsh-whale-state-blush.webp" })
  });

  function value(key, fallback) {
    return storage ? storage.get(key, fallback) : fallback;
  }

  function save(key, next) {
    storage.set(key, next);
  }

  function savedAccordionState() {
    try {
      var parsed = JSON.parse(value("settingsAccordionState", "{}"));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function settingsTheme() {
    var theme = value("settingsTheme", "b");
    return SETTINGS_THEMES.some(function (item) { return item[0] === theme; }) ? theme : "b";
  }

  function themeName(theme) {
    var match = SETTINGS_THEMES.find(function (item) { return item[0] === theme; });
    return match ? match[1] : SETTINGS_THEMES[1][1];
  }

  function applySettingsTheme(panel, theme) {
    var next = SETTINGS_THEMES.some(function (item) { return item[0] === theme; }) ? theme : "b";
    var details = SETTINGS_THEME_DETAILS[next];
    panel.setAttribute("data-settings-theme", next);
    panel.querySelectorAll("[data-settings-theme-option]").forEach(function (option) {
      var selected = option.getAttribute("data-settings-theme-option") === next;
      option.classList.toggle("selected", selected);
      option.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    panel.querySelectorAll("[data-theme-illustration]").forEach(function (image) {
      var role = image.getAttribute("data-theme-illustration");
      image.src = desktopApi.generated + (role === "navigation" ? details.navigation : details.card);
    });
    var status = panel.querySelector("[data-dashboard-status]");
    var line = panel.querySelector("[data-dashboard-line]");
    var themeMeta = panel.querySelector(".wm-appearance-theme .wm-summary-meta");
    if (status) status.textContent = "●  " + details.status;
    if (line) line.textContent = details.line;
    if (themeMeta) themeMeta.textContent = themeName(next);
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function section(title, open, meta) {
    var details = element("details", "wm-card");
    details.open = Boolean(open);
    var summary = element("summary");
    summary.appendChild(element("span", "wm-summary-title", title));
    if (meta) summary.appendChild(element("span", "wm-summary-meta", meta));
    details.appendChild(summary);
    var content = element("div", "wm-card-content");
    details.appendChild(content);
    details.addEventListener("toggle", function () {
      if (!details.open) return;
      var panel = details.closest("[data-whale-desktop-settings]");
      if (!panel || panel.hidden) return;
      requestAnimationFrame(function () {
        var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        summary.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
      });
    });
    return [details, content];
  }

  function row(label, control) {
    var wrap = element("div", "wm-row");
    wrap.appendChild(element("span", "", label));
    wrap.appendChild(control);
    return wrap;
  }

  function stat(icon, label, text, key) {
    var node = element("div", "wm-stat");
    if (key) node.setAttribute("data-stat", key);
    node.appendChild(element("strong", "", icon + " " + text));
    node.appendChild(element("small", "", label));
    return node;
  }

  function updateStats() {
    var panel = document.querySelector("[data-whale-desktop-settings]");
    if (!panel || panel.hidden) return;
    var updates = {
      mood: "😊 " + value("mood", "70"),
      affinity: "💗 " + value("affinity", "0"),
      satiety: "🍰 " + value("satiety", "80"),
      level: "⭐ Lv." + value("level", "1"),
      signinStreak: "📅 " + value("signinStreak", "0") + " 天"
    };
    var since = Number(value("companionSince", "0"));
    var days = since ? Math.max(0, Math.floor((Date.now() - since) / 86400000)) : 0;
    updates.companionDays = "⏳ " + days + " 天";
    for (var key in updates) {
      var node = panel.querySelector("[data-stat='" + key + "'] > strong");
      if (node) node.textContent = updates[key];
    }
    /* also refresh achievement count badge and daily quests if visible */
    var achievementCount = value("achievements", "").split(",").filter(Boolean).length;
    /* re-render daily quests section content if it was open */
    var dailyDetails = panel.querySelectorAll("details.wm-card");
    for (var i = 0; i < dailyDetails.length; i += 1) {
      var sum = dailyDetails[i].querySelector(".wm-summary-title");
      if (!sum) continue;
      if (sum.textContent === "🎯 今日任务" && dailyDetails[i].open) {
        var content = dailyDetails[i].querySelector(".wm-card-content");
        if (content) { content.innerHTML = ""; renderDaily(content); }
      }
      if (sum.textContent === "🏅 成就墙") {
        var meta = dailyDetails[i].querySelector(".wm-summary-meta");
        if (meta) meta.textContent = achievementCount + "/" + ACHIEVEMENTS.length + " 已解锁";
        if (dailyDetails[i].open) {
          var achContent = dailyDetails[i].querySelector(".wm-card-content");
          if (achContent) { achContent.innerHTML = ""; renderAchievements(achContent); }
        }
      }
      if (sum.textContent === "🎖️ 称号") {
        var badgeMeta = dailyDetails[i].querySelector(".wm-summary-meta");
        if (badgeMeta) badgeMeta.textContent = value("badge", "") || "未佩戴";
        if (dailyDetails[i].open) {
          var badgeContent = dailyDetails[i].querySelector(".wm-card-content");
          if (badgeContent) { badgeContent.innerHTML = ""; renderBadge(badgeContent); }
        }
      }
      if (sum.textContent === "📅 本周签到" && dailyDetails[i].open) {
        var weekContent = dailyDetails[i].querySelector(".wm-card-content");
        if (weekContent) { weekContent.innerHTML = ""; renderWeek(weekContent); }
      }
    }
  }

  function findSection(title) {
    var panel = document.querySelector("[data-whale-desktop-settings]");
    if (!panel) return null;
    var cards = panel.querySelectorAll("details.wm-card");
    for (var i = 0; i < cards.length; i += 1) {
      var heading = cards[i].querySelector(".wm-summary-title");
      if (heading && heading.textContent === title) return cards[i];
    }
    return null;
  }

  function updateSectionMeta(title, text) {
    var card = findSection(title);
    var meta = card && card.querySelector(".wm-summary-meta");
    if (meta) meta.textContent = text;
  }

  function refreshSection(title, renderer) {
    var card = findSection(title);
    if (!card) return;
    var content = card.querySelector(".wm-card-content");
    if (!content) return;
    content.innerHTML = "";
    renderer(content);
  }

  function updatePreferenceView(key) {
    if (key === "settingsTheme") {
      var themePanel = document.querySelector("[data-whale-desktop-settings]");
      if (themePanel) applySettingsTheme(themePanel, settingsTheme());
      return;
    }
    if (key === "growth" || key === "mood" || key === "affinity" || key === "satiety" || key === "level" || key === "signinStreak") {
      updateStats();
      return;
    }
    if (key === "quests") { refreshSection("🎯 今日任务", renderDaily); return; }
    if (key === "badge") {
      updateSectionMeta("🎖️ 称号", value("badge", "") || "未佩戴");
      return;
    }
    if (TOGGLES.some(function (item) { return item[0] === key; })) {
      document.querySelectorAll("[data-settings-toggle='" + key + "']").forEach(function (input) {
        input.checked = value(key, "1") !== "0";
      });
      var enabledCount = TOGGLES.filter(function (item) { return value(item[0], item[2] ? "1" : "0") !== "0"; }).length;
      updateSectionMeta("🎛️ 陪伴表现", enabledCount + "/" + TOGGLES.length + " 已启用");
      return;
    }
    if (key === "reminders") {
      updateSectionMeta("💧 健康与下班提醒", value("reminders", "1") === "0" ? "已关闭" : "已启用");
      return;
    }
    if (key === "quiet-mode" || key === "quiet-schedule" || key === "quiet-start" || key === "quiet-end" || key === "quiet-active") {
      updateSectionMeta("🔕 安静模式", value("quiet-active", "0") === "1" ? "已开启" : "可定时");
      return;
    }
    if (key === "displayScale") {
      updateSectionMeta("🖼️ 显示个性化", value("displayScale", "100") + "%");
      return;
    }
    if (key === "computer-link") {
      updateSectionMeta("🖥️ 电脑状态联动", value("computer-link", "1") === "0" ? "已关闭" : "已启用");
      return;
    }
    if (key === "adventureState" || key === "adventure-enabled") {
      refreshSection("🗺️ 旅行与收藏", renderAdventure);
      updateAdventureMeta();
      return;
    }
    if (key === "professionState" || key === "profession-enabled") {
      refreshSection("🧭 职业成长", renderProfession);
      updateProfessionMeta();
      return;
    }
    if (key === "relationshipState" || key === "relationship-enabled") {
      refreshSection("💞 关系与性格", renderRelationship);
      updateRelationshipMeta();
      return;
    }
    if (key === "houseState") {
      refreshSection("🏠 鲸鱼小屋", renderHouseEntry);
      updateHouseMeta();
      return;
    }
    if (key === "dailySummaryState") {
      refreshSection("📖 每日生活总结", renderDailySummaryEntry);
      updateDailySummaryMeta();
      return;
    }
    if (key === "lifeState" || key === "life-enabled") {
      refreshSection("🌿 自主生活", renderLife);
      updateLifeMeta();
      return;
    }
    if (key === "weatherCity") updateSectionMeta("⛅ 天气", value("weatherCity", "") || "未设置");
  }

  function renderSwitches(container) {
    TOGGLES.forEach(function (item) {
      var label = element("label", "wm-row wm-switch");
      var input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("data-settings-toggle", item[0]);
      input.checked = value(item[0], item[2] ? "1" : "0") !== "0";
      input.addEventListener("change", function () { save(item[0], input.checked ? "1" : "0"); });
      label.appendChild(input);
      label.appendChild(element("span", "", item[1]));
      container.appendChild(label);
    });
  }

  function renderWeather(container) {
    var city = document.createElement("input");
    city.type = "text"; city.maxLength = 24; city.placeholder = "如：上海（留空不联网）"; city.value = value("weatherCity", "");
    city.addEventListener("change", function () { save("weatherCity", city.value); });
    container.appendChild(row("天气城市", city));
    var key = document.createElement("input");
    key.type = "password"; key.maxLength = 128; key.placeholder = "Open-Meteo 免费无需 Key"; key.value = value("weatherKey", "");
    key.addEventListener("change", function () { save("weatherKey", key.value); });
    container.appendChild(row("API Key（选填）", key));
    var status = element("div", "wm-status", "特效仅在填写城市且天气数据有效时显示。");
    var test = element("button", "", "测试连接");
    test.addEventListener("click", function () {
      test.disabled = true; status.textContent = "⏳ 正在连接 Open-Meteo…";
      var request = window.DshWhaleMoeWeatherTest ? window.DshWhaleMoeWeatherTest(city.value, key.value) : Promise.reject(new Error("天气服务未就绪"));
      request.then(function (text) { status.textContent = text; }, function (error) { status.textContent = "❌ " + (error.message || "连接失败"); }).finally(function () { test.disabled = false; });
    });
    container.appendChild(row("天气服务", test));
    container.appendChild(status);
  }

  function renderComputerLink(container) {
    var label = element("label", "wm-row wm-switch");
    var input = document.createElement("input");
    input.type = "checkbox";
    input.checked = value("computer-link", "1") !== "0";
    input.addEventListener("change", function () {
      save("computer-link", input.checked ? "1" : "0");
    });
    label.appendChild(input);
    label.appendChild(element("span", "", "启用电脑状态联动"));
    container.appendChild(label);
    container.appendChild(element("p", "wm-note", "联动前台应用分类、CPU/内存、电池与电源、网络状态，并触发对应动作和台词。"));
    container.appendChild(element("p", "wm-note", "仅识别前台程序的进程名分类，不读取窗口标题、键盘输入、文件或网页内容。"));
  }

  function checkboxRow(container, key, labelText, fallback) {
    var label = element("label", "wm-row wm-switch");
    var input = document.createElement("input");
    input.type = "checkbox";
    input.checked = value(key, fallback ? "1" : "0") !== "0";
    input.addEventListener("change", function () { save(key, input.checked ? "1" : "0"); });
    label.appendChild(input);
    label.appendChild(element("span", "", labelText));
    container.appendChild(label);
    return input;
  }

  function numericInput(key, fallback, min, max, suffix) {
    var wrap = element("div", "wm-inline-control");
    var input = document.createElement("input");
    input.type = "number"; input.min = String(min); input.max = String(max); input.value = value(key, String(fallback));
    input.addEventListener("change", function () {
      var next = Math.max(min, Math.min(max, Number(input.value) || fallback));
      input.value = String(next); save(key, next);
    });
    wrap.appendChild(input);
    if (suffix) wrap.appendChild(element("span", "wm-note", suffix));
    return wrap;
  }

  function timeInput(key, fallback) {
    var input = document.createElement("input");
    input.type = "time"; input.value = value(key, fallback);
    input.addEventListener("change", function () { if (input.value) save(key, input.value); });
    return input;
  }

  function formatDuration(ms) {
    var seconds = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
    return String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
  }

  function updateCompanionStatus(status) {
    var panel = document.querySelector("[data-whale-desktop-settings]");
    if (!panel || panel.hidden) return;
    var pomodoro = status && status.pomodoro ? status.pomodoro : null;
    if (pomodoro) {
      var clock = document.querySelector("[data-pomodoro-clock]");
      var phase = document.querySelector("[data-pomodoro-phase]");
      var toggle = document.querySelector("[data-pomodoro-toggle]");
      if (clock) clock.textContent = formatDuration(pomodoro.remainingMs);
      if (phase) phase.textContent = pomodoro.phase === "break" ? "休息" : "专注";
      if (toggle) toggle.textContent = pomodoro.running ? "暂停" : "开始";
    }
    var quietStatus = document.querySelector("[data-quiet-status]");
    if (quietStatus && status && typeof status.quiet === "boolean") quietStatus.textContent = status.quiet ? "当前已静音" : "当前正常陪伴";
  }

  function renderPomodoro(container) {
    var display = element("div", "wm-pomodoro");
    var phase = element("span", "wm-pomodoro-phase", "专注"); phase.setAttribute("data-pomodoro-phase", "true");
    var clock = element("strong", "wm-pomodoro-clock", "25:00"); clock.setAttribute("data-pomodoro-clock", "true");
    display.appendChild(phase); display.appendChild(clock); container.appendChild(display);
    container.appendChild(row("专注时长", numericInput("pomodoroWork", 25, 1, 180, "分钟")));
    container.appendChild(row("休息时长", numericInput("pomodoroBreak", 5, 1, 60, "分钟")));
    var controls = element("div", "wm-button-row");
    var toggle = element("button", "wm-primary", "开始"); toggle.setAttribute("data-pomodoro-toggle", "true");
    toggle.addEventListener("click", function () { if (window.WhaleCompanion) window.WhaleCompanion.togglePomodoro(); });
    var reset = element("button", "", "重置"); reset.addEventListener("click", function () { if (window.WhaleCompanion) window.WhaleCompanion.resetPomodoro(); });
    controls.appendChild(toggle); controls.appendChild(reset); container.appendChild(controls);
    if (window.WhaleCompanion) updateCompanionStatus(window.WhaleCompanion.status());
  }

  function renderReminders(container) {
    checkboxRow(container, "reminders", "启用健康与下班提醒", true);
    container.appendChild(row("久坐提醒", numericInput("postureMinutes", 50, 10, 240, "分钟连续使用")));
    container.appendChild(row("喝水提醒", numericInput("waterMinutes", 90, 15, 480, "分钟一次")));
    var drank = element("button", "", "我刚喝水了"); drank.addEventListener("click", function () { if (window.WhaleCompanion) window.WhaleCompanion.markWater(); });
    container.appendChild(row("补水打卡", drank));
    checkboxRow(container, "offwork-enabled", "启用下班提醒", true);
    container.appendChild(row("下班时间", timeInput("offwork-time", "18:00")));
    container.appendChild(element("p", "wm-note", "检测到连续 2 分钟未操作会重置久坐计时；提醒不会读取键盘内容。"));
  }

  function renderQuiet(container) {
    checkboxRow(container, "quiet-mode", "立即开启安静模式", false);
    checkboxRow(container, "quiet-schedule", "按时段自动安静", false);
    container.appendChild(row("开始时间", timeInput("quiet-start", "22:00")));
    container.appendChild(row("结束时间", timeInput("quiet-end", "08:00")));
    var status = element("div", "wm-status", "当前正常陪伴"); status.setAttribute("data-quiet-status", "true"); container.appendChild(status);
    container.appendChild(element("p", "wm-note", "安静时暂停随机动作、闲聊、电脑状态及健康提醒；番茄钟结束仍会提示。"));
  }

  function adventureStatus() {
    if (window.WhaleAdventure) return window.WhaleAdventure.status();
    var core = window.WhaleAdventureCore;
    var parsed = {};
    try {
      parsed = JSON.parse(value("adventureState", "{}"));
    } catch (_error) {}
    var state = core ? core.normalizeState(parsed) : { current: null, journeys: [], collection: {} };
    return {
      state: state,
      progress: core ? core.collectionProgress(state) : { found: 0, total: 0 },
      enabled: value("adventure-enabled", "1") !== "0"
    };
  }

  function adventureMeta(status) {
    var current = status && status.state ? status.state.current : null;
    if (current && window.WhaleAdventureCore) {
      var location = window.WhaleAdventureCore.locationById(current.locationId);
      return "旅行中 · " + (location ? location.name : "远方");
    }
    var progress = status && status.progress ? status.progress : { found: 0, total: 0 };
    return progress.found + "/" + progress.total + " 已收藏";
  }

  function updateAdventureMeta(status) {
    updateSectionMeta("🗺️ 旅行与收藏", adventureMeta(status || adventureStatus()));
  }

  function formatReturnTime(timestamp) {
    var date = new Date(Number(timestamp) || 0);
    return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
  }

  function professionStatus() {
    if (window.WhaleProfession) return window.WhaleProfession.status();
    var core = window.WhaleProfessionCore;
    var parsed = {};
    try { parsed = JSON.parse(value("professionState", "{}")); } catch (_error) {}
    return { state: core ? core.normalizeState(parsed) : null, enabled: value("profession-enabled", "1") !== "0" };
  }

  function professionMeta(status) {
    var core = window.WhaleProfessionCore;
    var state = status && status.state;
    var primary = core && state ? core.definition(state.primaryId) : null;
    if (!status || status.enabled === false) return "已暂停";
    return primary ? primary.icon + " " + primary.name : "尚未形成倾向";
  }

  function updateProfessionMeta(status) {
    updateSectionMeta("🧭 职业成长", professionMeta(status || professionStatus()));
  }

  function renderProfession(container) {
    var core = window.WhaleProfessionCore;
    var status = professionStatus();
    checkboxRow(container, "profession-enabled", "根据前台应用分类积累职业经验", true);
    if (!core || !status.state) {
      container.appendChild(element("p", "wm-note", "职业系统正在加载。"));
      return;
    }
    var grid = element("div", "wm-professions");
    core.DEFINITIONS.forEach(function (def) {
      var career = status.state.careers[def.id];
      var progress = core.levelProgress(career.xp);
      var card = element("div", "wm-profession" + (status.state.primaryId === def.id ? " primary" : ""));
      card.appendChild(element("strong", "", def.icon + " " + def.name));
      card.appendChild(element("span", "", "Lv." + progress.level + " · " + career.xp + " 经验"));
      var bar = element("div", "wm-quest-progress");
      var fill = element("i");
      fill.style.width = progress.maxed ? "100%" : Math.round(progress.current / Math.max(1, progress.target) * 100) + "%";
      bar.appendChild(fill); card.appendChild(bar);
      card.appendChild(element("small", "", def.note + (career.seconds ? " · 本分钟 " + career.seconds + " 秒" : "")));
      grid.appendChild(card);
    });
    container.appendChild(grid);
    container.appendChild(element("p", "wm-note", "每累计 1 分钟有效使用获得 1 经验；连续空闲 2 分钟后暂停。完成番茄钟会给最近活动的职业增加 5 经验。仅使用进程分类，不读取窗口标题、文件或输入内容。主职业会影响旅行地点倾向。"));
  }

  function relationshipStatus() {
    if (window.WhaleRelationship) return window.WhaleRelationship.status();
    var core = window.WhaleRelationshipCore;
    var parsed = {};
    try { parsed = JSON.parse(value("relationshipState", "{}")); } catch (_error) {}
    var since = Number(value("companionSince", "0"));
    var days = since ? Math.max(0, Math.floor((Date.now() - since) / 86400000)) : 0;
    var state = core ? core.normalizeState(parsed) : null;
    return { state: state, stage: core ? core.relationshipStage(Number(value("affinity", "0")), days) : null, personality: core && state ? core.personality(state) : null, enabled: value("relationship-enabled", "1") !== "0", companionDays: days };
  }

  function relationshipMeta(status) {
    if (!status || status.enabled === false) return "性格成长已暂停";
    if (!status.stage) return "正在认识彼此";
    return status.stage.icon + " " + status.stage.name;
  }

  function updateRelationshipMeta(status) {
    updateSectionMeta("💞 关系与性格", relationshipMeta(status || relationshipStatus()));
  }

  function renderRelationship(container) {
    var core = window.WhaleRelationshipCore;
    var status = relationshipStatus();
    checkboxRow(container, "relationship-enabled", "让共同经历塑造性格", true);
    if (!core || !status.state || !status.stage) {
      container.appendChild(element("p", "wm-note", "关系系统正在加载。"));
      return;
    }
    var hero = element("div", "wm-relationship-hero");
    hero.appendChild(element("strong", "", status.stage.icon + " " + status.stage.name));
    hero.appendChild(element("span", "", status.stage.note));
    hero.appendChild(element("small", "", "主性格：" + status.personality.icon + " " + status.personality.name + " · 好感度 " + value("affinity", "0") + " · 陪伴 " + status.companionDays + " 天"));
    container.appendChild(hero);
    var stageIndex = core.STAGES.findIndex(function (stage) { return stage.id === status.stage.id; });
    var nextStage = core.STAGES[stageIndex + 1];
    container.appendChild(element("p", "wm-note", nextStage ? "下一阶段「" + nextStage.name + "」需要好感度 " + nextStage.minAffinity + " 且陪伴 " + nextStage.minDays + " 天。" : "已经抵达当前最高关系阶段。"));
    var traits = element("div", "wm-traits");
    core.TRAITS.forEach(function (trait) {
      var score = status.state.scores[trait.id] || 0;
      var card = element("div", "wm-trait");
      card.appendChild(element("strong", "", trait.icon + " " + (score >= 0 ? trait.positive : trait.negative)));
      card.appendChild(element("span", "", (score > 0 ? "+" : "") + score));
      var meter = element("div", "wm-trait-meter");
      var fill = element("i"); fill.style.width = Math.min(100, Math.abs(score) * 5) + "%"; fill.className = score < 0 ? "negative" : ""; meter.appendChild(fill); card.appendChild(meter);
      traits.appendChild(card);
    });
    container.appendChild(traits);
    if (status.state.memories.length) {
      var head = element("div", "wm-pose-group-head");
      head.appendChild(element("span", "wm-pose-group-title", "性格形成记录"));
      head.appendChild(element("span", "wm-pose-group-count", "最近 " + Math.min(5, status.state.memories.length) + " 条"));
      container.appendChild(head);
      status.state.memories.slice(0, 5).forEach(function (memory) {
        container.appendChild(row(memory.text, element("span", "wm-note", new Date(memory.at).toLocaleDateString("zh-CN"))));
      });
    }
    container.appendChild(element("p", "wm-note", "关系阶段由好感度和真实陪伴天数共同决定；性格由旅行、召回、工作专注和日常互动逐渐形成，并会影响旅行地点与亲密台词。"));
  }

  function houseStatus() {
    if (window.WhaleHouse) return window.WhaleHouse.status();
    return { unlocked: 4, total: window.WhaleHouseCore ? window.WhaleHouseCore.FURNITURE.length : 4, state: { visits: 0 } };
  }

  function houseMeta(status) {
    var current = status || houseStatus();
    return current.unlocked + "/" + current.total + " 件家具";
  }

  function updateHouseMeta(status) {
    updateSectionMeta("🏠 鲸鱼小屋", houseMeta(status));
  }

  function renderHouseEntry(container) {
    var status = houseStatus();
    var open = element("button", "wm-primary", "进入鲸鱼小屋");
    open.addEventListener("click", function () { if (window.WhaleHouse) window.WhaleHouse.open(); });
    container.appendChild(row("独立房间", open));
    container.appendChild(row("家具解锁", element("span", "wm-note", status.unlocked + " / " + status.total)));
    container.appendChild(row("累计来访", element("span", "wm-note", (status.state && status.state.visits || 0) + " 次")));
    container.appendChild(element("p", "wm-note", "旅行纪念品会自动摆上展示架；职业等级、关系阶段、旅行次数和收藏进度会解锁新家具。小屋也可以直接从系统托盘进入。"));
  }

  function dailySummaryStatus() {
    if (window.WhaleDailySummary) return window.WhaleDailySummary.status();
    var core = window.WhaleDailySummaryCore;
    var parsed = {};
    try { parsed = JSON.parse(value("dailySummaryState", "{}")); } catch (_error) {}
    var state = core ? core.normalizeState(parsed) : { current: null, history: [] };
    return { state: state, report: core && state.current ? core.report(state.current, true) : null };
  }

  function dailySummaryMeta(status) {
    var current = status || dailySummaryStatus();
    var report = current.report;
    return report ? report.title : "今天正在发生";
  }

  function updateDailySummaryMeta(status) {
    updateSectionMeta("📖 每日生活总结", dailySummaryMeta(status));
  }

  function renderDailySummaryEntry(container) {
    var status = dailySummaryStatus();
    var open = element("button", "wm-primary", "翻开生活手账");
    open.addEventListener("click", function () {
      if (window.WhaleDailySummary) window.WhaleDailySummary.open();
    });
    container.appendChild(row("今日记录", open));
    if (status.report) {
      container.appendChild(row("今日主题", element("span", "wm-note", status.report.title)));
      container.appendChild(row("已记录", element("span", "wm-note", status.report.activity + " 个生活片段")));
    }
    container.appendChild(row("过往手账", element("span", "wm-note", ((status.state && status.state.history) || []).length + " 天")));
    container.appendChild(element("p", "wm-note", "自动汇总真实互动、专注工作、职业成长、旅行收藏、自主生活、小游戏、任务和小屋来访；跨天后封存，最多保留最近 30 天。"));
  }

  function lifeStatus() {
    var status = window.WhaleLife ? window.WhaleLife.status() : null;
    var core = window.WhaleLifeCore;
    var state;
    if (status) {
      state = status.state;
    } else {
      var parsed = {};
      try { parsed = JSON.parse(value("lifeState", "{}")); } catch (_error) {}
      state = core ? core.normalizeState(parsed) : { current: null, history: [], stats: { completed: 0 } };
    }
    var enabled = status ? status.enabled : value("life-enabled", "1") !== "0";
    /* an activity whose end time has passed must not keep showing "正在…" */
    if (state && state.current && Number(state.current.endsAt) <= Date.now()) {
      state = Object.assign({}, state, { current: null });
    }
    return { state: state, enabled: enabled, activity: state.current && core ? core.activity(state.current.activityId) : null };
  }

  function lifeMeta(status) {
    var current = status || lifeStatus();
    if (!current.enabled) return "已暂停";
    return current.activity ? current.activity.icon + " " + current.activity.name : "等待自己的生活灵感";
  }

  function updateLifeMeta(status) {
    updateSectionMeta("🌿 自主生活", lifeMeta(status));
  }

  function renderLife(container) {
    var status = lifeStatus();
    var core = window.WhaleLifeCore;
    checkboxRow(container, "life-enabled", "让鲸鱼在空闲时自主安排生活", true);
    if (!core) {
      container.appendChild(element("p", "wm-note", "自主生活系统正在加载。"));
      return;
    }
    if (status.activity && status.state.current) {
      var hero = element("div", "wm-relationship-hero");
      hero.appendChild(element("strong", "", status.activity.icon + " 正在" + status.activity.name));
      hero.appendChild(element("span", "", status.state.current.reason));
      hero.appendChild(element("small", "", "预计 " + new Date(status.state.current.endsAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) + " 完成"));
      container.appendChild(hero);
    } else {
      container.appendChild(element("div", "wm-status", status.enabled ? "现在没有安排，用户持续空闲 2 分钟后她会自己决定。" : "自主生活已暂停。"));
    }
    var consider = element("button", "wm-primary", status.activity ? "正在生活中" : "看看她现在想做什么");
    consider.disabled = !status.enabled || Boolean(status.activity);
    consider.addEventListener("click", function () {
      if (window.WhaleLife) window.WhaleLife.consider(true);
    });
    container.appendChild(row("自然安排", consider));
    container.appendChild(row("累计完成", element("span", "wm-note", ((status.state && status.state.stats && status.state.stats.completed) || 0) + " 件生活小事")));
    if (status.state && status.state.history && status.state.history.length) {
      var head = element("div", "wm-pose-group-head");
      head.appendChild(element("span", "wm-pose-group-title", "最近生活轨迹"));
      head.appendChild(element("span", "wm-pose-group-count", "最近 " + Math.min(5, status.state.history.length) + " 条"));
      container.appendChild(head);
      status.state.history.slice(0, 5).forEach(function (entry) {
        var activity = core.activity(entry.activityId);
        container.appendChild(row((activity ? activity.icon + " " + activity.name : "生活小事"), element("span", "wm-note", entry.outcome)));
      });
    }
    container.appendChild(element("p", "wm-note", "选择由时间、天气、心情、饱食度、职业、性格、收藏和最近活动共同决定。旅行会中断当前安排；活动结束会带来少量心情或饱食恢复，并写入每日生活总结。"));
  }

  function renderAdventure(container) {
    var core = window.WhaleAdventureCore;
    var status = adventureStatus();
    var state = status.state;
    checkboxRow(container, "adventure-enabled", "启用自主旅行与回归提醒", true);

    if (!core) {
      container.appendChild(element("p", "wm-note", "旅行系统正在加载。"));
      return;
    }

    if (state.current) {
      var currentLocation = core.locationById(state.current.locationId);
      var travelStatus = element("div", "wm-adventure-away");
      travelStatus.appendChild(
        element("strong", "", currentLocation ? currentLocation.icon + " " + currentLocation.name : "🗺️ 旅行中")
      );
      travelStatus.appendChild(
        element(
          "span",
          "wm-note",
          (state.current.purpose ? "正在" + state.current.purpose + "；" : "") +
            "预计 " +
            formatReturnTime(state.current.returnsAt) +
            " 回来；应用关闭期间也会计算时间。"
        )
      );
      container.appendChild(travelStatus);
    } else {
      var routes = element("div", "wm-adventure-routes");
      Object.keys(core.ROUTES).forEach(function (routeId) {
        var route = core.ROUTES[routeId];
        var button = element("button", routeId === "nearby" ? "wm-primary" : "", route.label);
        button.disabled = !status.enabled;
        button.title =
          route.durationMs < 3600000
            ? Math.round(route.durationMs / 60000) + " 分钟"
            : Math.round(route.durationMs / 3600000) + " 小时";
        button.addEventListener("click", function () {
          if (!window.WhaleAdventure) return;
          window.WhaleAdventure.depart(routeId);
          refreshSection("🗺️ 旅行与收藏", renderAdventure);
          updateAdventureMeta();
        });
        routes.appendChild(button);
      });
      container.appendChild(routes);
      container.appendChild(
        element("p", "wm-note", "目的地会参考时间、天气和最近使用的软件分类；未收藏物品更容易被发现。出发动作结束后，角色会离开桌面，可从系统托盘打开本页面。")
      );
    }

    var collectionTitle = element("div", "wm-pose-group-head");
    collectionTitle.appendChild(element("span", "wm-pose-group-title", "纪念品收藏"));
    collectionTitle.appendChild(
      element("span", "wm-pose-group-count", status.progress.found + " / " + status.progress.total)
    );
    container.appendChild(collectionTitle);
    var collection = element("div", "wm-collection");
    Object.keys(core.ITEMS).forEach(function (itemId) {
      var item = core.ITEMS[itemId];
      var count = Number(state.collection[itemId]) || 0;
      var card = element("div", "wm-collectible" + (count ? "" : " locked"));
      card.title = count ? item.hint : "尚未发现";
      card.appendChild(element("strong", "", count ? item.icon : "？"));
      card.appendChild(element("span", "", count ? item.name : "未发现"));
      card.appendChild(element("small", "", count ? "× " + count : "等待旅途"));
      collection.appendChild(card);
    });
    container.appendChild(collection);

    if (state.journeys.length) {
      var diaryTitle = element("div", "wm-pose-group-head");
      diaryTitle.appendChild(element("span", "wm-pose-group-title", "最近旅行日记"));
      diaryTitle.appendChild(element("span", "wm-pose-group-count", state.stats.completed + " 次旅行"));
      container.appendChild(diaryTitle);
      state.journeys.slice(0, 3).forEach(function (journey) {
        var location = core.locationById(journey.locationId);
        var item = core.ITEMS[journey.itemId];
        var diary = element("article", "wm-diary");
        diary.appendChild(
          element(
            "strong",
            "",
            (location ? location.icon + " " + location.name : "旅行") +
              " · " +
              (item ? item.icon + item.name : "纪念品")
          )
        );
        diary.appendChild(element("p", "", journey.diary));
        diary.appendChild(
          element(
            "small",
            "",
            new Date(journey.returnedAt).toLocaleString("zh-CN", {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            })
          )
        );
        container.appendChild(diary);
      });
    }
  }

  function renderDisplay(container) {
    var scale = document.createElement("input");
    scale.type = "range"; scale.min = "60"; scale.max = "160"; scale.step = "5"; scale.value = value("displayScale", "100");
    var scaleWrap = element("div", "wm-range-control"); var scaleOut = element("span", "", scale.value + "%"); scaleWrap.appendChild(scale); scaleWrap.appendChild(scaleOut);
    scale.addEventListener("input", function () { scaleOut.textContent = scale.value + "%"; });
    scale.addEventListener("change", function () { save("displayScale", scale.value); });
    container.appendChild(row("角色大小", scaleWrap));
    var opacity = document.createElement("input");
    opacity.type = "range"; opacity.min = "30"; opacity.max = "100"; opacity.step = "5"; opacity.value = value("displayOpacity", "100");
    var opacityWrap = element("div", "wm-range-control"); var opacityOut = element("span", "", opacity.value + "%"); opacityWrap.appendChild(opacity); opacityWrap.appendChild(opacityOut);
    opacity.addEventListener("input", function () { opacityOut.textContent = opacity.value + "%"; });
    opacity.addEventListener("change", function () { save("displayOpacity", opacity.value); });
    container.appendChild(row("角色透明度", opacityWrap));
    checkboxRow(container, "positionLocked", "锁定角色位置", false);
    container.appendChild(element("p", "wm-note", "缩放后会自动限制在可见桌面范围内；锁定后仍可通过托盘恢复位置。"));
  }

  function renderThemePicker(container, panel) {
    var heading = element("div", "wm-theme-heading");
    heading.appendChild(element("strong", "", "界面主题"));
    heading.appendChild(element("span", "", "当前：" + themeName(settingsTheme())));
    container.appendChild(heading);
    var picker = element("div", "wm-theme-picker");
    SETTINGS_THEMES.forEach(function (theme) {
      var option = element("button", "wm-theme-option wm-theme-option-" + theme[0]);
      option.type = "button";
      option.setAttribute("data-settings-theme-option", theme[0]);
      option.setAttribute("aria-label", theme[1] + "主题");
      var preview = element("span", "wm-theme-preview");
      preview.appendChild(element("i", ""));
      preview.appendChild(element("i", ""));
      preview.appendChild(element("i", ""));
      option.appendChild(preview);
      option.appendChild(element("strong", "", theme[0].toUpperCase() + " · " + theme[1]));
      option.appendChild(element("small", "", theme[2]));
      option.addEventListener("click", function () {
        applySettingsTheme(panel, theme[0]);
        heading.lastChild.textContent = "当前：" + theme[1];
        save("settingsTheme", theme[0]);
      });
      picker.appendChild(option);
    });
    container.appendChild(picker);
    applySettingsTheme(panel, settingsTheme());
  }

  function dashboardSwitch(label, note, checked, onChange) {
    var control = element("label", "wm-dashboard-switch");
    var copy = element("span", "");
    copy.appendChild(element("strong", "", label));
    copy.appendChild(element("small", "", note));
    var input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(checked);
    input.addEventListener("change", function () { onChange(input.checked); });
    control.appendChild(copy);
    control.appendChild(input);
    return input;
  }

  function dashboardCard(title, className) {
    var card = element("section", "wm-dashboard-card " + (className || ""));
    card.appendChild(element("strong", "wm-dashboard-card-title", title));
    return card;
  }

  function renderGeneralDashboard(container) {
    var dashboard = element("div", "wm-general-dashboard");

    var companionCard = dashboardCard("伴随状态", "wm-dashboard-companion");
    var status = element("span", "wm-dashboard-status", "●  空闲中");
    status.setAttribute("data-dashboard-status", "true");
    companionCard.appendChild(status);
    var statusLine = element("p", "", "心情很好，想和你一起发呆。");
    statusLine.setAttribute("data-dashboard-line", "true");
    companionCard.appendChild(statusLine);
    var mascot = document.createElement("img");
    mascot.setAttribute("data-theme-illustration", "card");
    mascot.alt = value("petName", "鲸鱼娘");
    companionCard.appendChild(mascot);
    dashboard.appendChild(companionCard);

    var desktopCard = dashboardCard("桌面行为", "wm-dashboard-desktop");
    var launchInput = dashboardSwitch("开机启动", "随系统启动鲸鱼娘", false, function (enabled) {
      desktopApi.setLaunchAtLogin(enabled);
    });
    desktopCard.appendChild(launchInput.closest("label"));
    var topInput = dashboardSwitch("始终置顶", "保持在其他窗口之上", value("always-on-top", "1") !== "0", function (enabled) {
      save("always-on-top", enabled ? "1" : "0");
      desktopApi.setAlwaysOnTop(enabled);
    });
    desktopCard.appendChild(topInput.closest("label"));
    desktopApi.getDesktopSettings().then(function (state) {
      if (!state) return;
      launchInput.checked = Boolean(state.launchAtLogin);
      topInput.checked = Boolean(state.alwaysOnTop);
    });
    dashboard.appendChild(desktopCard);

    var frequencyCard = dashboardCard("互动频率", "wm-dashboard-frequency");
    frequencyCard.appendChild(element("p", "", "调整小鲸主动互动的频率"));
    var frequency = document.createElement("input");
    frequency.type = "range";
    frequency.min = "0";
    frequency.max = "2";
    frequency.step = "1";
    frequency.value = value("interactionFrequency", "1");
    frequency.addEventListener("change", function () { save("interactionFrequency", frequency.value); });
    frequencyCard.appendChild(frequency);
    var frequencyLabels = element("div", "wm-dashboard-range-labels");
    ["安静", "适中", "活跃"].forEach(function (label) { frequencyLabels.appendChild(element("span", "", label)); });
    frequencyCard.appendChild(frequencyLabels);
    dashboard.appendChild(frequencyCard);

    var powerCard = dashboardCard("节能模式", "wm-dashboard-power");
    var powerInput = dashboardSwitch("降低动画和特效", "减少资源占用", value("power-saving", "0") === "1", function (enabled) {
      save("power-saving", enabled ? "1" : "0");
    });
    powerCard.appendChild(powerInput.closest("label"));
    dashboard.appendChild(powerCard);

    var since = Number(value("companionSince", "0"));
    var days = since ? Math.max(0, Math.floor((Date.now() - since) / 86400000)) : 0;
    var statsCard = dashboardCard("今日数据", "wm-dashboard-growth");
    var todayMetrics = element("div", "wm-stats");
    todayMetrics.appendChild(stat("😊", "心情", value("mood", "70"), "mood"));
    todayMetrics.appendChild(stat("💗", "好感度", value("affinity", "0"), "affinity"));
    todayMetrics.appendChild(stat("🍰", "饱食度", value("satiety", "80"), "satiety"));
    todayMetrics.appendChild(stat("⭐", "等级", "Lv." + value("level", "1"), "level"));
    todayMetrics.appendChild(stat("📅", "连续签到", value("signinStreak", "0") + " 天", "signinStreak"));
    todayMetrics.appendChild(stat("⏳", "陪伴", days + " 天", "companionDays"));
    statsCard.appendChild(todayMetrics);
    container.appendChild(statsCard);

    var versionCard = dashboardCard("版本信息", "wm-dashboard-version");
    versionCard.appendChild(element("span", "wm-dashboard-version-label", "当前版本"));
    versionCard.appendChild(element("strong", "wm-dashboard-version-number", "2.4.0"));
    versionCard.appendChild(element("span", "wm-dashboard-version-ok", "已是最新版本  ✓"));
    dashboard.appendChild(versionCard);

    container.appendChild(dashboard);
  }

  function exportSave() {
    var payload = storage.exportPayload();
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a"); link.href = url; link.download = "WhaleMusume-save-" + todayKey() + ".json"; link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importSave(file) {
    if (!file || file.size > 1024 * 1024) { alert("存档文件无效或超过 1 MB。"); return; }
    file.text().then(function (text) {
      var payload = JSON.parse(text);
      if (!confirm("导入会覆盖存档中包含的设置和养成数据，确定继续吗？")) return;
      storage.importPayload(payload);
      location.reload();
    }).catch(function (error) { alert("导入失败：" + (error.message || "文件损坏")); });
  }

  function renderDataTools(container) {
    var buttons = element("div", "wm-button-row");
    var exportButton = element("button", "wm-primary", "导出存档"); exportButton.addEventListener("click", exportSave);
    var importButton = element("button", "", "导入存档");
    var picker = document.createElement("input"); picker.type = "file"; picker.accept = "application/json,.json"; picker.hidden = true;
    importButton.addEventListener("click", function () { picker.value = ""; picker.click(); });
    picker.addEventListener("change", function () { importSave(picker.files && picker.files[0]); });
    buttons.appendChild(exportButton); buttons.appendChild(importButton); buttons.appendChild(picker); container.appendChild(buttons);
    container.appendChild(element("p", "wm-note", "导出包含养成与偏好设置，但不会包含天气 API Key。导入前会校验文件格式。"));
  }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function renderDaily(container) {
    var raw = value("quests", "");
    var quests = null;
    try { quests = raw ? JSON.parse(raw) : null; } catch (_error) {}
    var pool = window.DshWhaleMoeCore ? window.DshWhaleMoeCore.QUEST_POOL : [];
    var slots = quests && quests.date === todayKey() && Array.isArray(quests.slots) ? quests.slots : [];
    if (!slots.length) {
      container.appendChild(element("div", "wm-note", "今日任务加载中，鲸鱼娘初始化后会自动生成。"));
      return;
    }
    slots.forEach(function (slot) {
      var def = pool.find(function (item) { return item.id === slot.id; }) || { desc: slot.id, target: 1 };
      var progress = Math.min(slot.progress || 0, def.target);
      var bar = element("div", "wm-quest-progress");
      var fill = element("i"); fill.style.width = Math.round(progress / def.target * 100) + "%"; bar.appendChild(fill);
      var claim = element("button", "", slot.claimed ? "✅ 已领" : "领取");
      claim.disabled = slot.claimed || progress < def.target;
      claim.addEventListener("click", function () {
        if (window.__dshWhaleMoeClaimQuest) window.__dshWhaleMoeClaimQuest(slot.id);
        refreshSection("🎯 今日任务", renderDaily);
      });
      var right = element("div", "wm-quest-controls");
      right.appendChild(bar); right.appendChild(element("span", "wm-note", progress + "/" + def.target)); right.appendChild(claim);
      container.appendChild(row(def.desc, right));
    });
  }

  function renderWeek(container) {
    var week = null;
    try { week = JSON.parse(value("weekSignin", "null")); } catch (_error) {}
    var days = week && Array.isArray(week.days) ? week.days.length : 0;
    var grid = element("div", "wm-actions"); grid.style.gridTemplateColumns = "repeat(7, 1fr)";
    ["一","二","三","四","五","六","日"].forEach(function (label, index) {
      grid.appendChild(element("div", "wm-stat", (index < days ? "✓ " : "○ ") + label));
    });
    container.appendChild(grid);
    container.appendChild(element("p", "wm-note", "本周已签到 " + days + " / 7 天；集满 1、3、7 天有里程碑奖励。"));
  }

  function renderBadge(container) {
    var level = Number(value("level", "1")) || 1;
    var badges = window.DshWhaleMoeCore && window.DshWhaleMoeCore.BOND ? window.DshWhaleMoeCore.BOND.badges : [];
    var unlocked = badges.filter(function (badge) { return level >= badge.minLevel; });
    if (!unlocked.length) {
      container.appendChild(element("div", "wm-note", "未解锁（好感度 Lv5 解锁首个称号）。"));
      return;
    }
    var select = document.createElement("select");
    var empty = document.createElement("option"); empty.value = ""; empty.textContent = "（不使用称号）"; select.appendChild(empty);
    unlocked.forEach(function (badge) { var option = document.createElement("option"); option.value = badge.id; option.textContent = badge.name; select.appendChild(option); });
    select.value = value("badge", "");
    select.addEventListener("change", function () {
      if (window.__dshWhaleMoeApplyBadge) window.__dshWhaleMoeApplyBadge(select.value); else save("badge", select.value);
    });
    container.appendChild(row("当前称号", select));
  }

  function renderActions(container) {
    var quick = [["feed","🍰 投喂"],["poke","💢 戳一下"],["praise","✨ 夸夸"],["bubble-game","🫧 戳泡泡"],["catch-game","🧺 接点心"]];
    var quickWrap = element("div", "wm-actions");
    quick.forEach(function (item) {
      var button = element("button", "", item[1]);
      button.addEventListener("click", function () { if (window.__dshWhaleMoeDesktopAction) window.__dshWhaleMoeDesktopAction(item[0]); });
      quickWrap.appendChild(button);
    });
    container.appendChild(quickWrap);
    container.appendChild(element("p", "wm-note", "点击下方任意动作可预览；全部现有动作资源均已列入，按触发方式分类。"));
    POSE_GROUPS.forEach(function (group) {
      var head = element("div", "wm-pose-group-head");
      head.appendChild(element("span", "wm-pose-group-title", group.title));
      head.appendChild(element("span", "wm-pose-group-count", group.poses.length + " 个"));
      container.appendChild(head);
      if (group.note) container.appendChild(element("p", "wm-note", group.note));
      var poses = element("div", "wm-actions wm-pose-grid");
      group.poses.forEach(function (pose) {
        var button = element("button", "", pose);
        button.title = pose;
        button.addEventListener("click", function () { if (window.DshWhaleMoeMood) window.DshWhaleMoeMood(pose, 5200, true); });
        poses.appendChild(button);
      });
      container.appendChild(poses);
    });
  }

  function renderAchievements(container) {
    var ids = value("achievements", "").split(",").filter(Boolean);
    var grid = element("div", "wm-achievements");
    ACHIEVEMENTS.forEach(function (achievement) {
      var unlocked = ids.indexOf(achievement[0]) !== -1;
      var node = element("div", "wm-achievement" + (unlocked ? "" : " locked"));
      node.appendChild(element("strong", "", achievement[1]));
      node.appendChild(element("small", "", achievement[2]));
      grid.appendChild(node);
    });
    container.appendChild(element("p", "wm-note", "已解锁 " + ids.length + " / " + ACHIEVEMENTS.length));
    container.appendChild(grid);
  }

  function renderPanel() {
    var old = document.querySelector("[data-whale-desktop-settings]");
    var wasOpen = old && !old.hidden;
    if (old) old.remove();
    var panel = element("div"); panel.setAttribute("data-whale-desktop-settings", "true"); panel.setAttribute("data-settings-theme", settingsTheme()); panel.hidden = !wasOpen;
    var ambience = element("div", "wm-settings-ambience");
    ambience.setAttribute("aria-hidden", "true");
    ambience.appendChild(element("i", "wm-settings-orb wm-settings-orb-one"));
    ambience.appendChild(element("i", "wm-settings-orb wm-settings-orb-two"));
    panel.appendChild(ambience);
    var head = element("div", "wm-settings-head");
    var title = element("div", "wm-settings-title");
    title.appendChild(element("span", "wm-settings-mark", "🐳"));
    var titleCopy = element("div", "wm-settings-title-copy");
    titleCopy.appendChild(element("span", "wm-settings-eyebrow", "WHALE COMPANION / CONTROL CENTER"));
    var panelTitle = element("strong", "", (value("petName", "鲸鱼娘").trim() || "鲸鱼娘") + " · 设置");
    panelTitle.setAttribute("data-whale-pet-name", "true");
    titleCopy.appendChild(panelTitle);
    titleCopy.appendChild(element("span", "wm-version", "Desktop v2.4.0"));
    title.appendChild(titleCopy);
    head.appendChild(title);
    var headActions = element("div", "wm-settings-head-actions");
    var syncState = element("span", "wm-settings-sync-state", "本地配置已同步");
    syncState.setAttribute("role", "status");
    headActions.appendChild(syncState);
    var close = element("button", "wm-settings-close", "×"); close.title = "关闭设置"; close.setAttribute("aria-label", "关闭设置"); close.addEventListener("click", function () { panel.hidden = true; window.whaleDesktop.setMouseInteractive(false); window.whaleDesktop.setSettingsVisible(false); }); headActions.appendChild(close); head.appendChild(headActions); panel.appendChild(head);
    var availableWidth = Math.max(680, window.innerWidth - 32);
    var availableHeight = Math.max(430, window.innerHeight - 32);
    var savedWidth = Number(storage.get("desktopSettingsWidth", "1140"));
    var savedHeight = Number(storage.get("desktopSettingsHeight", "720"));
    if ((savedWidth === 900 && savedHeight === 580) || (savedWidth === 1055 && savedHeight === 645)) {
      savedWidth = 1140;
      savedHeight = 720;
    }
    var panelWidth = Math.max(680, Math.min(Number.isFinite(savedWidth) ? savedWidth : 1140, availableWidth));
    var panelHeight = Math.max(430, Math.min(Number.isFinite(savedHeight) ? savedHeight : 720, availableHeight));
    panel.style.width = Math.round(panelWidth) + "px";
    panel.style.height = Math.round(panelHeight) + "px";
    var rawSavedX = storage.get("desktopSettingsX", null);
    var rawSavedY = storage.get("desktopSettingsY", null);
    var savedX = rawSavedX === null ? NaN : Number(rawSavedX);
    var savedY = rawSavedY === null ? NaN : Number(rawSavedY);
    if (Number.isFinite(savedX) && Number.isFinite(savedY)) {
      panel.style.left = Math.max(8, Math.min(savedX, window.innerWidth - panelWidth - 8)) + "px";
      panel.style.top = Math.max(8, Math.min(savedY, window.innerHeight - panelHeight - 8)) + "px";
      panel.style.transform = "none";
    }
    panel.addEventListener("pointerdown", function (event) {
      var rect = panel.getBoundingClientRect();
      if (event.clientX < rect.right - 20 || event.clientY < rect.bottom - 20) return;
      panel.style.left = Math.round(rect.left) + "px";
      panel.style.top = Math.round(rect.top) + "px";
      panel.style.transform = "none";
    }, true);
    var panelDrag = null;
    head.addEventListener("pointerdown", function (event) {
      if (event.button !== 0 || (event.target.closest && event.target.closest("button"))) return;
      var rect = panel.getBoundingClientRect();
      panel.style.left = rect.left + "px";
      panel.style.top = rect.top + "px";
      panel.style.transform = "none";
      panelDrag = { pointerId: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
      head.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    head.addEventListener("pointermove", function (event) {
      if (!panelDrag || panelDrag.pointerId !== event.pointerId) return;
      var rect = panel.getBoundingClientRect();
      var left = Math.max(8, Math.min(event.clientX - panelDrag.dx, window.innerWidth - rect.width - 8));
      var top = Math.max(8, Math.min(event.clientY - panelDrag.dy, window.innerHeight - rect.height - 8));
      panel.style.left = Math.round(left) + "px";
      panel.style.top = Math.round(top) + "px";
    });
    function finishPanelDrag(event) {
      if (!panelDrag || panelDrag.pointerId !== event.pointerId) return;
      panelDrag = null;
      if (head.hasPointerCapture(event.pointerId)) head.releasePointerCapture(event.pointerId);
      storage.set("desktopSettingsX", Math.round(parseFloat(panel.style.left)));
      storage.set("desktopSettingsY", Math.round(parseFloat(panel.style.top)));
    }
    head.addEventListener("pointerup", finishPanelDrag);
    head.addEventListener("pointercancel", finishPanelDrag);
    var body = element("div", "wm-settings-body"); panel.appendChild(body);
    var nav = element("nav", "wm-settings-nav");
    nav.setAttribute("aria-label", "设置分类");
    var navBrand = element("div", "wm-settings-nav-brand");
    var navBrandMark = element("span", "wm-settings-nav-brand-mark", "W");
    navBrandMark.setAttribute("aria-hidden", "true");
    var navBrandCopy = element("span", "wm-settings-nav-brand-copy");
    navBrandCopy.appendChild(element("strong", "", "鲸鱼控制台"));
    navBrandCopy.appendChild(element("small", "", "PERSONAL COMPANION"));
    navBrand.appendChild(navBrandMark);
    navBrand.appendChild(navBrandCopy);
    nav.appendChild(navBrand);
    var searchWrap = element("label", "wm-settings-search");
    searchWrap.appendChild(element("span", "", "⌕"));
    var searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.placeholder = "搜索设置分类";
    searchInput.autocomplete = "off";
    searchInput.setAttribute("aria-label", "搜索设置分类");
    searchWrap.appendChild(searchInput);
    var searchShortcut = element("kbd", "", "Ctrl F");
    searchWrap.appendChild(searchShortcut);
    nav.appendChild(searchWrap);
    var navLabel = element("div", "wm-settings-nav-label");
    navLabel.appendChild(element("span", "", "设置分类"));
    navLabel.appendChild(element("small", "", "07"));
    nav.appendChild(navLabel);
    var content = element("div", "wm-settings-content");
    var pageDefinitions = [
      ["general", "⌂", "通用", "常用设置"],
      ["companion", "♡", "互动", "陪伴与关系"],
      ["appearance", "◉", "外观", "主题与动作"],
      ["reminders", "♧", "提醒", "专注与健康"],
      ["sound", "♫", "音量", "声音与安静"],
      ["display", "▣", "显示", "桌面与天气"],
      ["about", "ⓘ", "关于", "成长与数据"]
    ];
    var pages = {};
    var navButtons = [];
    var accordionMemory = savedAccordionState();
    var accordionReady = false;
    var accordionChanging = false;
    function accordionCards(pageId) {
      return pages[pageId] ? Array.from(pages[pageId].querySelectorAll("details.wm-card")) : [];
    }
    function preferredAccordionCard(pageId, cards) {
      var remembered = accordionMemory[pageId];
      return cards.find(function (card) {
        return card.getAttribute("data-settings-section") === remembered;
      }) || cards[0] || null;
    }
    function restoreAccordionForPage(pageId) {
      if (!accordionReady || pageId === "general") return;
      var cards = accordionCards(pageId);
      if (!cards.length || cards.some(function (card) { return card.open; })) return;
      var preferred = preferredAccordionCard(pageId, cards);
      if (preferred) preferred.open = true;
    }
    function activateSettingsPage(pageId) {
      nav.querySelectorAll("[data-settings-page-target]").forEach(function (button) {
        var selected = button.getAttribute("data-settings-page-target") === pageId;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-current", selected ? "page" : "false");
      });
      content.querySelectorAll("[data-settings-page]").forEach(function (page) {
        var selected = page.getAttribute("data-settings-page") === pageId;
        page.hidden = !selected;
        if (selected) restoreAccordionForPage(pageId);
      });
      content.scrollTop = 0;
    }
    pageDefinitions.forEach(function (definition, index) {
      var button = element("button", "wm-settings-nav-item");
      button.type = "button";
      button.setAttribute("data-settings-page-target", definition[0]);
      button.setAttribute("data-settings-search-text", (definition[2] + " " + definition[3]).toLowerCase());
      button.appendChild(element("span", "wm-settings-nav-icon", definition[1]));
      var copy = element("span", "wm-settings-nav-copy");
      copy.appendChild(element("strong", "", definition[2]));
      copy.appendChild(element("small", "", definition[3]));
      button.appendChild(copy);
      button.addEventListener("click", function () { activateSettingsPage(definition[0]); });
      nav.appendChild(button);
      navButtons.push(button);
      var page = element("section", "wm-settings-page");
      page.setAttribute("data-settings-page", definition[0]);
      page.hidden = definition[0] !== "general";
      var pageHeader = element("header", "wm-settings-page-header");
      pageHeader.appendChild(element("span", "wm-settings-page-index", "CONTROL / 0" + (index + 1)));
      var pageHeading = element("div", "wm-settings-page-heading");
      pageHeading.appendChild(element("h2", "wm-settings-page-title", definition[0] === "general" ? "通用设置" : definition[2]));
      pageHeading.appendChild(element("p", "wm-settings-page-note", definition[3]));
      pageHeader.appendChild(pageHeading);
      var pageSignal = element("span", "wm-settings-page-signal", "ONLINE");
      pageSignal.setAttribute("aria-hidden", "true");
      pageHeader.appendChild(pageSignal);
      page.appendChild(pageHeader);
      pages[definition[0]] = page;
      content.appendChild(page);
    });
    var searchEmpty = element("p", "wm-settings-search-empty", "没有匹配的分类");
    searchEmpty.hidden = true;
    nav.appendChild(searchEmpty);
    function updateNavSearch() {
      var query = searchInput.value.trim().toLowerCase();
      var visibleCount = 0;
      navButtons.forEach(function (button) {
        var page = pages[button.getAttribute("data-settings-page-target")];
        var searchText = button.getAttribute("data-settings-search-text") + " " + (page ? page.textContent.toLowerCase() : "");
        var visible = !query || searchText.indexOf(query) !== -1;
        button.hidden = !visible;
        if (visible) visibleCount += 1;
      });
      searchEmpty.hidden = visibleCount !== 0;
    }
    searchInput.addEventListener("input", updateNavSearch);
    searchInput.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        searchInput.value = "";
        updateNavSearch();
        searchInput.blur();
        return;
      }
      if (event.key !== "Enter") return;
      var firstVisible = navButtons.find(function (button) { return !button.hidden; });
      if (firstVisible) {
        firstVisible.click();
        var query = searchInput.value.trim().toLowerCase();
        var pageId = firstVisible.getAttribute("data-settings-page-target");
        var matchingCard = accordionCards(pageId).find(function (card) {
          return !query || card.textContent.toLowerCase().indexOf(query) !== -1;
        });
        if (matchingCard) {
          matchingCard.open = true;
          matchingCard.classList.remove("wm-accordion-search-hit");
          requestAnimationFrame(function () { matchingCard.classList.add("wm-accordion-search-hit"); });
          window.setTimeout(function () { matchingCard.classList.remove("wm-accordion-search-hit"); }, 1200);
        }
      }
    });
    panel.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (!event.target.closest || !event.target.closest(".wm-settings-nav-item")) return;
      var visibleButtons = navButtons.filter(function (button) { return !button.hidden; });
      var currentIndex = visibleButtons.indexOf(document.activeElement);
      var direction = event.key === "ArrowDown" ? 1 : -1;
      var nextIndex = (currentIndex + direction + visibleButtons.length) % visibleButtons.length;
      if (visibleButtons[nextIndex]) {
        event.preventDefault();
        visibleButtons[nextIndex].focus();
      }
    });
    var navMascot = document.createElement("img");
    navMascot.className = "wm-settings-nav-mascot";
    navMascot.setAttribute("data-theme-illustration", "navigation");
    navMascot.alt = "";
    nav.appendChild(navMascot);
    var navFooter = element("div", "wm-settings-nav-footer");
    navFooter.appendChild(element("span", "", "●"));
    navFooter.appendChild(element("small", "", "所有系统运行正常"));
    nav.appendChild(navFooter);
    body.appendChild(nav);
    body.appendChild(content);
    activateSettingsPage("general");
    desktopApi.setAlwaysOnTop(value("always-on-top", "1") !== "0");

    renderGeneralDashboard(pages.general);
    applySettingsTheme(panel, settingsTheme());

    var appearanceTheme = section("🎨 界面主题与称呼", true, themeName(settingsTheme()));
    appearanceTheme[0].classList.add("wm-appearance-theme");
    renderThemePicker(appearanceTheme[1], panel);
    var titleInput = document.createElement("input"); titleInput.type = "text"; titleInput.maxLength = 8; titleInput.value = value("title", "主人"); titleInput.addEventListener("input", function () { save("title", titleInput.value); });
    appearanceTheme[1].appendChild(row("如何称呼我", titleInput));
    var petNameInput = document.createElement("input"); petNameInput.type = "text"; petNameInput.maxLength = 8; petNameInput.placeholder = "鲸鱼娘"; petNameInput.value = value("petName", "鲸鱼娘"); petNameInput.addEventListener("input", function () {
      save("petName", petNameInput.value);
      panelTitle.textContent = (petNameInput.value.trim() || "鲸鱼娘") + " · 设置";
    });
    appearanceTheme[1].appendChild(row("如何称呼桌宠", petNameInput)); pages.appearance.appendChild(appearanceTheme[0]);
    /* 外观页的主题选择需要在挂载到面板后再次应用，否则初始「当前主题」不会被默认选中 */
    applySettingsTheme(panel, settingsTheme());

    var enabledCount = TOGGLES.filter(function (item) { return value(item[0], item[2] ? "1" : "0") !== "0"; }).length;
    var companion = section("🎛️ 陪伴表现", true, enabledCount + "/" + TOGGLES.length + " 已启用"); var switches = element("div", "wm-switches"); renderSwitches(switches); companion[1].appendChild(switches); pages.companion.appendChild(companion[0]);
    var pomodoro = section("⏱️ 番茄钟", true, "专注与休息"); renderPomodoro(pomodoro[1]); pages.reminders.appendChild(pomodoro[0]);
    var reminders = section("💧 健康与下班提醒", true, value("reminders", "1") === "0" ? "已关闭" : "已启用"); renderReminders(reminders[1]); pages.reminders.appendChild(reminders[0]);
    var quiet = section("🔕 安静模式", true, value("quiet-mode", "0") === "1" ? "已开启" : "可定时"); renderQuiet(quiet[1]); pages.sound.appendChild(quiet[0]);
    var display = section("🖼️ 显示个性化", true, value("displayScale", "100") + "%"); renderDisplay(display[1]); pages.display.appendChild(display[0]);
    var computerLinkOn = value("computer-link", "1") !== "0";
    var computerLink = section("🖥️ 电脑状态联动", true, computerLinkOn ? "已启用" : "已关闭"); renderComputerLink(computerLink[1]); pages.display.appendChild(computerLink[0]);
    var weather = section("⛅ 天气", true, value("weatherCity", "") || "未设置"); renderWeather(weather[1]); pages.display.appendChild(weather[0]);
    var adventureStatusValue = adventureStatus();
    var adventure = section("🗺️ 旅行与收藏", true, adventureMeta(adventureStatusValue)); renderAdventure(adventure[1]); pages.about.appendChild(adventure[0]);
    var professionStatusValue = professionStatus();
    var profession = section("🧭 职业成长", true, professionMeta(professionStatusValue)); renderProfession(profession[1]); pages.about.appendChild(profession[0]);
    var relationshipStatusValue = relationshipStatus();
    var relationship = section("💞 关系与性格", true, relationshipMeta(relationshipStatusValue)); renderRelationship(relationship[1]); pages.companion.appendChild(relationship[0]);
    var houseStatusValue = houseStatus();
    var house = section("🏠 鲸鱼小屋", true, houseMeta(houseStatusValue)); renderHouseEntry(house[1]); pages.about.appendChild(house[0]);
    var lifeStatusValue = lifeStatus();
    var life = section("🌿 自主生活", true, lifeMeta(lifeStatusValue)); renderLife(life[1]); pages.companion.appendChild(life[0]);
    var dailySummaryStatusValue = dailySummaryStatus();
    var dailySummary = section("📖 每日生活总结", true, dailySummaryMeta(dailySummaryStatusValue)); renderDailySummaryEntry(dailySummary[1]); pages.about.appendChild(dailySummary[0]);
    var daily = section("🎯 今日任务", true, "今日进度"); renderDaily(daily[1]); pages.reminders.appendChild(daily[0]);
    var week = section("📅 本周签到", true, "签到记录"); renderWeek(week[1]); pages.reminders.appendChild(week[0]);
    var badge = section("🎖️ 称号", true, value("badge", "") || "未佩戴"); renderBadge(badge[1]); pages.about.appendChild(badge[0]);
    var poseCount = 0;
    for (var pg = 0; pg < POSE_GROUPS.length; pg += 1) poseCount += POSE_GROUPS[pg].poses.length;
    var actions = section("🎭 互动与全部动作", false, poseCount + " 个动作"); renderActions(actions[1]); pages.appearance.appendChild(actions[0]);
    var achievementCount = value("achievements", "").split(",").filter(Boolean).length;
    var achievements = section("🏅 成就墙", true, achievementCount + "/" + ACHIEVEMENTS.length + " 已解锁"); renderAchievements(achievements[1]); pages.about.appendChild(achievements[0]);
    var reset = section("🗂️ 数据与重置", true, "位置与养成数据");
    renderDataTools(reset[1]);
    var resetPosition = element("button", "", "重置到默认位置"); resetPosition.addEventListener("click", function () { storage.remove("floatX"); storage.remove("floatY"); save("float-reset", Date.now()); }); reset[1].appendChild(row("悬浮位置", resetPosition));
    var resetGrowth = element("button", "wm-danger", "重置养成"); resetGrowth.addEventListener("click", function () {
      if (!confirm("确定重置全部养成、任务、签到、成就和游戏记录吗？")) return;
      storage.removeMany(["mood","affinity","satiety","lastSignin","signinStreak","achievements","companionSince","level","quests","weekSignin","badge","gameStats","adventureState","professionState","relationshipState","houseState","dailySummaryState","lifeState"]);
      save("growth-reset", Date.now()); updateStats();
      refreshSection("🗺️ 旅行与收藏", renderAdventure);
      updateAdventureMeta();
      refreshSection("🧭 职业成长", renderProfession);
      updateProfessionMeta();
      refreshSection("💞 关系与性格", renderRelationship);
      updateRelationshipMeta();
      refreshSection("🏠 鲸鱼小屋", renderHouseEntry);
      updateHouseMeta();
      refreshSection("📖 每日生活总结", renderDailySummaryEntry);
      updateDailySummaryMeta();
      refreshSection("🌿 自主生活", renderLife);
      updateLifeMeta();
      refreshSection("🎯 今日任务", renderDaily);
      refreshSection("📅 本周签到", renderWeek);
      refreshSection("🎖️ 称号", renderBadge);
      refreshSection("🏅 成就墙", renderAchievements);
    }); reset[1].appendChild(row("养成数据", resetGrowth)); pages.about.appendChild(reset[0]);

    Object.keys(pages).forEach(function (pageId) {
      if (pageId === "general") return;
      var cards = accordionCards(pageId);
      cards.forEach(function (card) {
        var heading = card.querySelector(".wm-summary-title");
        card.setAttribute("data-settings-section", heading ? heading.textContent : "");
        card.open = false;
      });
      var preferred = preferredAccordionCard(pageId, cards);
      if (preferred) preferred.open = true;
      cards.forEach(function (card) {
        card.addEventListener("toggle", function () {
          if (accordionChanging || !card.open) return;
          accordionChanging = true;
          cards.forEach(function (other) {
            if (other !== card) other.open = false;
          });
          accordionChanging = false;
          accordionMemory[pageId] = card.getAttribute("data-settings-section");
          save("settingsAccordionState", JSON.stringify(accordionMemory));
        });
      });
    });
    accordionReady = true;

    var resizeHint = element("span", "wm-settings-resize-hint");
    resizeHint.setAttribute("aria-hidden", "true");
    panel.appendChild(resizeHint);
    document.body.appendChild(panel);
    if (typeof ResizeObserver === "function") {
      var resizeTimer = 0;
      panel._wmResizeObserver = new ResizeObserver(function () {
        if (panel.hidden) return;
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(function () {
          var rect = panel.getBoundingClientRect();
          if (rect.width >= 680 && rect.height >= 430) {
            storage.set("desktopSettingsWidth", Math.round(rect.width));
            storage.set("desktopSettingsHeight", Math.round(rect.height));
          }
        }, 120);
      });
      panel._wmResizeObserver.observe(panel);
    }
    return panel;
  }

  function openSettings() {
    var panel = document.querySelector("[data-whale-desktop-settings]") || renderPanel();
    panel.hidden = false;
    window.whaleDesktop.setSettingsVisible(true);
    updateStats();
    refreshSection("🌿 自主生活", renderLife); updateLifeMeta();
    refreshSection("🗺️ 旅行与收藏", renderAdventure); updateAdventureMeta();
    refreshSection("🧭 职业成长", renderProfession); updateProfessionMeta();
    refreshSection("💞 关系与性格", renderRelationship); updateRelationshipMeta();
    refreshSection("🏠 鲸鱼小屋", renderHouseEntry); updateHouseMeta();
    refreshSection("📖 每日生活总结", renderDailySummaryEntry); updateDailySummaryMeta();
    refreshSection("🎯 今日任务", renderDaily);
    refreshSection("🎖️ 称号", renderBadge);
    updateSectionMeta("🎖️ 称号", value("badge", "") || "未佩戴");
    refreshSection("📅 本周签到", renderWeek);
    refreshSection("🏅 成就墙", renderAchievements);
    window.whaleDesktop.setMouseInteractive(true);
  }

  document.addEventListener("DOMContentLoaded", renderPanel, { once: true });
  window.addEventListener("whale-moe-core-ready", function () {
    var panel = document.querySelector("[data-whale-desktop-settings]");
    if (!panel) return;
    refreshSection("🎯 今日任务", renderDaily);
    refreshSection("🎖️ 称号", renderBadge);
  });
  window.addEventListener("whale-desktop-open-settings", openSettings);
  window.addEventListener("whale-moe-prefs-change", function (event) {
    var panel = document.querySelector("[data-whale-desktop-settings]");
    if (!panel || panel.hidden) return;
    var key = event && event.detail && event.detail.key ? event.detail.key : "";
    updatePreferenceView(key);
  });
  window.addEventListener("whale-companion-status", function (event) { updateCompanionStatus(event.detail || {}); });
  window.addEventListener("whale-adventure-change", function (event) {
    var panel = document.querySelector("[data-whale-desktop-settings]");
    if (!panel || panel.hidden) return;
    refreshSection("🗺️ 旅行与收藏", renderAdventure);
    updateAdventureMeta(event.detail || null);
    updateHouseMeta();
  });
  window.addEventListener("whale-profession-change", function (event) {
    var panel = document.querySelector("[data-whale-desktop-settings]");
    if (!panel || panel.hidden) return;
    refreshSection("🧭 职业成长", renderProfession);
    updateProfessionMeta(event.detail || null);
    updateHouseMeta();
  });
  window.addEventListener("whale-relationship-change", function (event) {
    var panel = document.querySelector("[data-whale-desktop-settings]");
    if (!panel || panel.hidden) return;
    refreshSection("💞 关系与性格", renderRelationship);
    updateRelationshipMeta(event.detail || null);
    updateHouseMeta();
  });
  window.addEventListener("whale-daily-summary-change", function (event) {
    var panel = document.querySelector("[data-whale-desktop-settings]");
    if (!panel || panel.hidden) return;
    refreshSection("📖 每日生活总结", renderDailySummaryEntry);
    updateDailySummaryMeta(event.detail || null);
  });
  window.addEventListener("whale-life-change", function (event) {
    var panel = document.querySelector("[data-whale-desktop-settings]");
    if (!panel || panel.hidden) return;
    refreshSection("🌿 自主生活", renderLife);
    updateLifeMeta(event.detail || null);
  });
})();
