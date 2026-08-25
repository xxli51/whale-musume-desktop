(function () {
  "use strict";

  var storage = window.WhaleStorage;
  var state = {
    idleSeconds: 0,
    activeSince: Date.now(),
    lastPostureAt: Date.now(),
    lastTickAt: 0
  };

  function value(key, fallback) {
    return storage.get(key, fallback);
  }
  function numberValue(key, fallback, min, max) {
    var out = Number(value(key, fallback));
    if (!Number.isFinite(out)) out = fallback;
    return Math.max(min, Math.min(max, out));
  }
  function save(key, next) {
    storage.set(key, next);
  }
  function dayKey(now) {
    var d = new Date(now || Date.now());
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }
  function minutesOfDay(text) {
    var match = /^(\d{1,2}):(\d{2})$/.exec(String(text || ""));
    if (!match) return null;
    var hour = Number(match[1]);
    var minute = Number(match[2]);
    return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
  }
  function quietActive(now) {
    if (value("quiet-mode", "0") === "1") return true;
    if (value("quiet-schedule", "0") !== "1") return false;
    var start = minutesOfDay(value("quiet-start", "22:00"));
    var end = minutesOfDay(value("quiet-end", "08:00"));
    if (start === null || end === null || start === end) return false;
    var d = new Date(now || Date.now());
    var current = d.getHours() * 60 + d.getMinutes();
    return start < end ? current >= start && current < end : current >= start || current < end;
  }
  function syncQuiet(now) {
    var active = quietActive(now);
    var next = active ? "1" : "0";
    if (storage.get("quiet-active", null) !== next) storage.set("quiet-active", next);
    document.body.toggleAttribute("data-whale-quiet", active);
    return active;
  }
  function remind(type, pose, line, force) {
    if (!force && quietActive(Date.now())) return false;
    var detail = { type: type, pose: pose, line: line, at: Date.now() };
    if (typeof window.DshWhaleMoeMood !== "function") {
      storage.set("pendingReminder", JSON.stringify(detail));
      return true;
    }
    window.dispatchEvent(new CustomEvent("whale-desktop-companion-reminder", { detail: detail }));
    return true;
  }
  function flushPendingReminder() {
    if (typeof window.DshWhaleMoeMood !== "function") return;
    var raw = storage.get("pendingReminder", null);
    if (!raw) return;
    try {
      var detail = JSON.parse(raw);
      storage.remove("pendingReminder");
      if (detail && detail.line) window.dispatchEvent(new CustomEvent("whale-desktop-companion-reminder", { detail: detail }));
    } catch (_error) { storage.remove("pendingReminder"); }
  }

  function loadPomodoro() {
    try {
      var parsed = JSON.parse(value("pomodoroState", "null"));
      if (parsed && typeof parsed === "object") return parsed;
    } catch (_error) { /* reset below */ }
    return { phase: "work", running: false, endAt: 0, remainingMs: numberValue("pomodoroWork", 25, 1, 180) * 60000, rounds: 0 };
  }
  function savePomodoro(next) {
    storage.set("pomodoroState", JSON.stringify(next));
    publishPomodoro(next);
  }
  function phaseMinutes(phase) {
    return numberValue(phase === "break" ? "pomodoroBreak" : "pomodoroWork", phase === "break" ? 5 : 25, 1, 180);
  }
  function normalizePomodoro(now) {
    var current = loadPomodoro();
    if (!current.running || !current.endAt || now < current.endAt) return current;
    if (current.phase === "work") {
      current = { phase: "break", running: false, endAt: 0, remainingMs: phaseMinutes("break") * 60000, rounds: (current.rounds || 0) + 1 };
      remind("pomodoro-work", "daily-stretch", "专注时间完成啦！起来伸个懒腰，休息一下吧⏱️", true);
    } else {
      current = { phase: "work", running: false, endAt: 0, remainingMs: phaseMinutes("work") * 60000, rounds: current.rounds || 0 };
      remind("pomodoro-break", "work-idea", "休息结束，下一轮专注准备好了吗？✨", true);
    }
    savePomodoro(current);
    return current;
  }
  function pomodoroRemaining(current, now) {
    return Math.max(0, current.running ? current.endAt - now : Number(current.remainingMs) || 0);
  }
  function publishPomodoro(current) {
    var now = Date.now();
    window.dispatchEvent(new CustomEvent("whale-companion-status", {
      detail: {
        pomodoro: {
          phase: current.phase,
          running: Boolean(current.running),
          remainingMs: pomodoroRemaining(current, now),
          rounds: current.rounds || 0
        },
        quiet: quietActive(now)
      }
    }));
  }
  function togglePomodoro() {
    var now = Date.now();
    var current = normalizePomodoro(now);
    if (current.running) {
      current.remainingMs = pomodoroRemaining(current, now);
      current.running = false;
      current.endAt = 0;
    } else {
      if (!current.remainingMs) current.remainingMs = phaseMinutes(current.phase) * 60000;
      current.running = true;
      current.endAt = now + current.remainingMs;
    }
    savePomodoro(current);
    scheduleTick(0);
  }
  function resetPomodoro() {
    savePomodoro({ phase: "work", running: false, endAt: 0, remainingMs: phaseMinutes("work") * 60000, rounds: 0 });
    scheduleTick(0);
  }

  function checkWellness(now) {
    if (value("reminders", "1") === "0") return;
    if (storage.get("lastWaterAt", null) === null) storage.set("lastWaterAt", now);

    var waterMinutes = numberValue("waterMinutes", 90, 15, 480);
    var lastWaterAt = Number(value("lastWaterAt", now));
    if (now - lastWaterAt >= waterMinutes * 60000) {
      if (remind("water", "daily-coffee", "该喝水啦～鲸鱼娘帮你看着杯子呢💧", false)) save("lastWaterAt", now);
    }

    var postureMinutes = numberValue("postureMinutes", 50, 10, 240);
    if (state.idleSeconds >= 120) {
      state.activeSince = now;
      state.lastPostureAt = now;
    } else if (now - state.lastPostureAt >= postureMinutes * 60000) {
      if (remind("posture", "daily-stretch", "坐得有点久啦，活动肩颈、看看远处吧🌿", false)) {
        state.lastPostureAt = now;
        state.activeSince = now;
      }
    }

    if (value("offwork-enabled", "1") === "1") {
      var target = minutesOfDay(value("offwork-time", "18:00"));
      var d = new Date(now);
      var current = d.getHours() * 60 + d.getMinutes();
      var today = dayKey(now);
      if (target !== null && current >= target && value("offwork-last", "") !== today) {
        if (remind("offwork", "work-celebrate", "到下班时间啦！今天也辛苦了，记得好好休息🎉", false)) save("offwork-last", today);
      }
    }
  }

  function tick() {
    var now = Date.now();
    syncQuiet(now);
    flushPendingReminder();
    var pomodoro = normalizePomodoro(now);
    publishPomodoro(pomodoro);
    if (!state.lastTickAt || now - state.lastTickAt >= 15000) {
      state.lastTickAt = now;
      checkWellness(now);
    }
    return pomodoro;
  }

  var tickTimer = null;
  function scheduleTick(delay) {
    if (tickTimer) window.clearTimeout(tickTimer);
    tickTimer = window.setTimeout(function () {
      tickTimer = null;
      var pomodoro = tick();
      var nextDelay = document.hidden ? 60000 : pomodoro && pomodoro.running ? 1000 : 15000;
      scheduleTick(nextDelay);
    }, Math.max(0, Number(delay) || 0));
  }

  window.WhaleCompanion = Object.freeze({
    togglePomodoro: togglePomodoro,
    resetPomodoro: resetPomodoro,
    markWater: function () { save("lastWaterAt", Date.now()); remind("water-done", "celebrate", "补水打卡完成！继续保持哦💧", false); },
    status: function () { var current = normalizePomodoro(Date.now()); return { pomodoro: { phase: current.phase, running: current.running, remainingMs: pomodoroRemaining(current, Date.now()), rounds: current.rounds || 0 }, quiet: quietActive(Date.now()) }; },
    sync: tick
  });

  window.addEventListener("whale-desktop-system-state", function (event) {
    var sample = event && event.detail ? event.detail : {};
    if (Number.isFinite(Number(sample.idleSeconds))) state.idleSeconds = Math.max(0, Number(sample.idleSeconds));
  });
  window.addEventListener("whale-moe-prefs-change", function () {
    syncQuiet(Date.now());
    scheduleTick(0);
  });
  document.addEventListener("visibilitychange", function () { scheduleTick(0); });
  document.addEventListener("DOMContentLoaded", function () { scheduleTick(0); }, { once: true });
})();
