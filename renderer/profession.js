(function () {
  "use strict";

  var storage = window.WhaleStorage;
  var core = window.WhaleProfessionCore;
  if (!storage || !core) return;

  var state = loadState();
  var idleSeconds = 0;
  var lastSampleAt = 0;
  var lastPomodoroRounds = null;

  function loadState() {
    try {
      return core.normalizeState(JSON.parse(storage.get("professionState", "{}")));
    } catch (_error) {
      return core.blankState();
    }
  }

  function enabled() {
    return storage.get("profession-enabled", "1") !== "0";
  }

  function saveState(next, event) {
    state = core.normalizeState(next);
    storage.set("professionState", JSON.stringify(state));
    window.dispatchEvent(
      new CustomEvent("whale-profession-change", {
        detail: { state: state, enabled: enabled(), event: event || null }
      })
    );
  }

  function announceLevel(result) {
    if (!result.leveledUp) return;
    var def = core.definition(result.professionId);
    var level = core.levelForXp(result.state.careers[result.professionId].xp);
    window.dispatchEvent(
      new CustomEvent("whale-desktop-companion-reminder", {
        detail: {
          type: "profession-level",
          pose: "levelup",
          line: "职业升级啦！" + def.icon + def.name + "达到 Lv." + level + "，我越来越熟练了～",
          at: Date.now()
        }
      })
    );
  }

  function applyResult(result, event) {
    if (!result.professionId) return;
    saveState(result.state, event);
    announceLevel(result);
    var career = result.professionId ? result.state.careers[result.professionId] : null;
    var focusSignal = event && event.type === "focus";
    var professionMilestone = !focusSignal && career && result.awardedXp > 0 && career.xp % 10 < result.awardedXp;
    if (focusSignal || professionMilestone) {
      window.dispatchEvent(
        new CustomEvent("whale-personality-signal", {
          detail: {
            type: focusSignal ? "focus" : "profession",
            amount: focusSignal ? Math.max(1, Number(event.rounds) || 1) : 1,
            at: Date.now()
          }
        })
      );
    }
  }

  window.WhaleProfession = Object.freeze({
    status: function () {
      return { state: state, enabled: enabled() };
    }
  });

  window.addEventListener("whale-desktop-system-state", function (event) {
    var sample = event && event.detail ? event.detail : {};
    if (Number.isFinite(Number(sample.idleSeconds))) idleSeconds = Math.max(0, Number(sample.idleSeconds));
  });
  window.addEventListener("whale-desktop-computer-state", function (event) {
    var sample = event && event.detail ? event.detail : {};
    var at = Number(sample.at) || Date.now();
    var category = sample.foreground && sample.foreground.category;
    var elapsed = lastSampleAt ? Math.max(0, Math.min(30, (at - lastSampleAt) / 1000)) : 0;
    lastSampleAt = at;
    if (!enabled()) return;
    var result = core.applyActivity(state, category, elapsed, idleSeconds);
    if (result.professionId && elapsed > 0 && idleSeconds < 120)
      applyResult(result, { type: "activity", category: category });
  });
  window.addEventListener("whale-companion-status", function (event) {
    var status = event && event.detail ? event.detail : {};
    var rounds = status.pomodoro ? Math.max(0, Number(status.pomodoro.rounds) || 0) : 0;
    if (lastPomodoroRounds === null || rounds < lastPomodoroRounds) {
      lastPomodoroRounds = rounds;
      return;
    }
    if (enabled() && rounds > lastPomodoroRounds) {
      var result = core.applyFocusBonus(state, (rounds - lastPomodoroRounds) * 5);
      if (result.professionId) applyResult(result, { type: "focus", rounds: rounds - lastPomodoroRounds });
    }
    lastPomodoroRounds = rounds;
  });
  window.addEventListener("whale-moe-prefs-change", function (event) {
    if (event.detail && event.detail.key === "professionState") state = loadState();
  });
  document.addEventListener(
    "DOMContentLoaded",
    function () {
      window.dispatchEvent(
        new CustomEvent("whale-profession-change", { detail: { state: state, enabled: enabled(), event: null } })
      );
    },
    { once: true }
  );
})();
