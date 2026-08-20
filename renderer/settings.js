(function () {
  "use strict";

  var PREFIX = "whale-moe:";
  var TOGGLES = [
    ["pet", "鲸鱼娘", true], ["chat", "台词气泡", true],
    ["particles", "粒子效果", true], ["game", "小游戏", true],
    ["keywords", "关键词感知", false], ["idle-nudge", "摸鱼提醒", true],
    ["night", "深夜模式", true], ["weatherFx", "天气特效", true]
  ];
  var POSES = ["abstract","achievement","afk","angry","balance-low","blush","bold","celebrate","cool-shades","curious","daily-coffee","daily-cooking","daily-done","daily-eat","daily-fishing","daily-gaming","daily-melt","daily-painting","daily-pajama","daily-picnic","daily-shower","daily-stretch","eat","failure","festival-christmas","festival-halloween","festival-mid-autumn","festival-spring","game-cheat","game-happy","game-lose","game-think","game-win","greet","idle-cute","levelup","meme-broke","meme-cry","meme-doge","meme-doubt","meme-heart","meme-kyun","meme-music","meme-no","meme-ojisan","meme-omg","meme-peace","meme-shock","meme-sike","meme-smile-pain","meme-smug","meme-wakuwaku","meme-worship","meme-yes","night","pick-up","react-belly","react-head","react-tail","running","sleep","star","success","sweep","tail-swing","teasing","thinking","tool","valentine","waiting","weather-cold","weather-rain-happy","weather-snow","weather-thunder","weather-umbrella","wink","work-boss","work-celebrate","work-deadline","work-debug","work-deploy","work-idea","work-meeting","work-pat","work-ram","work-review","work-slack-phone","work-slack","work-sleep"];
  var ACHIEVEMENTS = [
    ["first-pat","🫳","初次摸头"],["ten-pats","🖐️","摸头十连"],["hundred-pats","💯","摸头百连"],["first-feed","🍰","投喂成功"],["first-triple","🎉","三连击"],["thanks","💬","嘴甜"],
    ["lv5","⭐","五级"],["lv10","👑","十级"],["signin3","📅","常客"],["signin7","🗓️","一周之约"],["night-owl","🌙","深夜陪伴"],["comeback","👋","欢迎回来"],
    ["day1","💞","一日之缘"],["day7","💎","一周相伴"],["day30","🏛️","三十日契约"],["first-tool","🛠️","开工啦"],["tools-10","🔧","工具十连"],["tools-50","🏭","工具五十连"],["tools-100","🛰️","工具百连"],
    ["first-code","💻","代码初体验"],["code-20","📟","代码狂人"],["first-success","✅","旗开得胜"],["success-10","🏆","任务十连"],["first-failure","🩹","初次翻车"],["fail-10","🚑","翻车十连"],
    ["messages-100","💌","会话百条"],["messages-500","📚","消息五百条"],["keyword-master","🔍","关键词大师"],["night-work","🦉","深夜赶工"],["balance-low","🪙","余额告急"],
    ["game-first","🫧","初次开玩"],["game-win","👑","泡泡之王"],["game-combo10","🔥","连击达人"],["game-highscore","🏆","纪录刷新"],["quest-first","🎯","任务初体验"],["quest-all","🎟️","一日全勤"],["week-signin7","🏆","周常满勤"],
    ["bond-action","🌟","新动作解锁"],["bond-badge","🎖️","称号首解锁"]
  ];

  function value(key, fallback) {
    var out = localStorage.getItem(PREFIX + key);
    return out === null ? fallback : out;
  }

  function save(key, next) {
    localStorage.setItem(PREFIX + key, String(next));
    window.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: key, value: String(next) } }));
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
      if (!panel) return;
      panel.querySelectorAll("details.wm-card[open]").forEach(function (other) {
        if (other !== details) other.open = false;
      });
      requestAnimationFrame(function () {
        summary.scrollIntoView({ block: "nearest", behavior: "smooth" });
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

  function stat(icon, label, text) {
    var node = element("div", "wm-stat");
    node.appendChild(element("strong", "", icon + " " + text));
    node.appendChild(element("small", "", label));
    return node;
  }

  function renderStats(container) {
    var since = Number(value("companionSince", "0"));
    var days = since ? Math.max(0, Math.floor((Date.now() - since) / 86400000)) : 0;
    container.appendChild(stat("😊", "心情", value("mood", "70")));
    container.appendChild(stat("💗", "好感度", value("affinity", "0")));
    container.appendChild(stat("⭐", "等级", "Lv." + value("level", "1")));
    container.appendChild(stat("📅", "连续签到", value("signinStreak", "0") + " 天"));
    container.appendChild(stat("⏳", "陪伴", days + " 天"));
  }

  function renderSwitches(container) {
    TOGGLES.forEach(function (item) {
      var label = element("label", "wm-row wm-switch");
      var input = document.createElement("input");
      input.type = "checkbox";
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

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function renderDaily(container) {
    var raw = value("quests", "");
    var quests = null;
    try { quests = raw ? JSON.parse(raw) : null; } catch (_error) { quests = null; }
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
        renderPanel();
      });
      var right = element("div", "wm-quest-controls");
      right.appendChild(bar); right.appendChild(element("span", "wm-note", progress + "/" + def.target)); right.appendChild(claim);
      container.appendChild(row(def.desc, right));
    });
  }

  function renderWeek(container) {
    var week = null;
    try { week = JSON.parse(value("weekSignin", "null")); } catch (_error) { week = null; }
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
    container.appendChild(element("p", "wm-note", "点击下方任意动作可预览；全部现有动作资源均已列入。"));
    var poses = element("div", "wm-actions wm-pose-grid");
    POSES.forEach(function (pose) {
      var button = element("button", "", pose);
      button.title = pose;
      button.addEventListener("click", function () { if (window.DshWhaleMoeMood) window.DshWhaleMoeMood(pose, 5200, true); });
      poses.appendChild(button);
    });
    container.appendChild(poses);
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
    var panel = element("div"); panel.setAttribute("data-whale-desktop-settings", "true"); panel.hidden = !wasOpen;
    var head = element("div", "wm-settings-head");
    var title = element("div", "wm-settings-title");
    title.appendChild(element("span", "wm-settings-mark", "🐳"));
    var titleCopy = element("div"); titleCopy.appendChild(element("strong", "", "鲸鱼娘 · 设置")); titleCopy.appendChild(element("span", "wm-version", "Desktop v2.0.0")); title.appendChild(titleCopy); head.appendChild(title);
    var close = element("button", "wm-settings-close", "×"); close.title = "关闭设置"; close.setAttribute("aria-label", "关闭设置"); close.addEventListener("click", function () { panel.hidden = true; window.whaleDesktop.setMouseInteractive(false); }); head.appendChild(close); panel.appendChild(head);
    var rawSavedX = localStorage.getItem(PREFIX + "desktopSettingsX");
    var rawSavedY = localStorage.getItem(PREFIX + "desktopSettingsY");
    var savedX = rawSavedX === null ? NaN : Number(rawSavedX);
    var savedY = rawSavedY === null ? NaN : Number(rawSavedY);
    if (Number.isFinite(savedX) && Number.isFinite(savedY)) {
      panel.style.left = Math.max(8, Math.min(savedX, window.innerWidth - 320)) + "px";
      panel.style.top = Math.max(8, Math.min(savedY, window.innerHeight - 120)) + "px";
      panel.style.transform = "none";
    }
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
      localStorage.setItem(PREFIX + "desktopSettingsX", String(Math.round(parseFloat(panel.style.left))));
      localStorage.setItem(PREFIX + "desktopSettingsY", String(Math.round(parseFloat(panel.style.top))));
    }
    head.addEventListener("pointerup", finishPanelDrag);
    head.addEventListener("pointercancel", finishPanelDrag);
    var body = element("div", "wm-settings-body"); panel.appendChild(body);

    var overview = element("div", "wm-card wm-overview");
    var stats = element("div", "wm-stats"); renderStats(stats); overview.appendChild(stats);
    var titleInput = document.createElement("input"); titleInput.type = "text"; titleInput.maxLength = 8; titleInput.value = value("title", "主人"); titleInput.addEventListener("input", function () { save("title", titleInput.value); });
    overview.appendChild(row("如何称呼我", titleInput)); body.appendChild(overview);

    var enabledCount = TOGGLES.filter(function (item) { return value(item[0], item[2] ? "1" : "0") !== "0"; }).length;
    var companion = section("🎛️ 陪伴表现", true, enabledCount + "/" + TOGGLES.length + " 已启用"); var switches = element("div", "wm-switches"); renderSwitches(switches); companion[1].appendChild(switches); body.appendChild(companion[0]);
    var computerLinkOn = value("computer-link", "1") !== "0";
    var computerLink = section("🖥️ 电脑状态联动", false, computerLinkOn ? "已启用" : "已关闭"); renderComputerLink(computerLink[1]); body.appendChild(computerLink[0]);
    var weather = section("⛅ 天气", false, value("weatherCity", "") || "未设置"); renderWeather(weather[1]); body.appendChild(weather[0]);
    var daily = section("🎯 今日任务", false, "今日进度"); renderDaily(daily[1]); body.appendChild(daily[0]);
    var week = section("📅 本周签到", false, "签到记录"); renderWeek(week[1]); body.appendChild(week[0]);
    var badge = section("🎖️ 称号", false, value("badge", "") || "未佩戴"); renderBadge(badge[1]); body.appendChild(badge[0]);
    var actions = section("🎭 互动与全部动作", false, POSES.length + " 个动作"); renderActions(actions[1]); body.appendChild(actions[0]);
    var achievementCount = value("achievements", "").split(",").filter(Boolean).length;
    var achievements = section("🏅 成就墙", false, achievementCount + "/" + ACHIEVEMENTS.length + " 已解锁"); renderAchievements(achievements[1]); body.appendChild(achievements[0]);
    var reset = section("🗂️ 数据与重置", false, "位置与养成数据");
    var resetPosition = element("button", "", "重置到默认位置"); resetPosition.addEventListener("click", function () { localStorage.removeItem(PREFIX + "floatX"); localStorage.removeItem(PREFIX + "floatY"); save("float-reset", Date.now()); }); reset[1].appendChild(row("悬浮位置", resetPosition));
    var resetGrowth = element("button", "wm-danger", "重置养成"); resetGrowth.addEventListener("click", function () {
      if (!confirm("确定重置全部养成、任务、签到、成就和游戏记录吗？")) return;
      ["mood","affinity","satiety","lastSignin","signinStreak","achievements","companionSince","level","quests","weekSignin","badge","gameStats"].forEach(function (key) { localStorage.removeItem(PREFIX + key); });
      save("growth-reset", Date.now()); renderPanel();
    }); reset[1].appendChild(row("养成数据", resetGrowth)); body.appendChild(reset[0]);

    document.body.appendChild(panel);
    return panel;
  }

  function openSettings() {
    var panel = document.querySelector("[data-whale-desktop-settings]") || renderPanel();
    panel.hidden = false;
    window.whaleDesktop.setMouseInteractive(true);
  }

  document.addEventListener("DOMContentLoaded", renderPanel, { once: true });
  window.addEventListener("whale-desktop-open-settings", openSettings);
  window.addEventListener("whale-moe-prefs-change", function () {
    var panel = document.querySelector("[data-whale-desktop-settings]");
    if (panel && !panel.hidden) renderPanel();
  });
})();
