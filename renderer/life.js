(function () {
  "use strict";

  var storage = window.WhaleStorage;
  var core = window.WhaleLifeCore;
  if (!storage || !core) return;
  var state = loadState();
  var idleSeconds = 0;
  var timer = 0;

  function loadState() {
    try {
      return core.normalizeState(JSON.parse(storage.get("lifeState", "{}")));
    } catch (_error) {
      return core.blankState();
    }
  }

  function enabled() {
    return storage.get("life-enabled", "1") !== "0";
  }

  function weatherKind() {
    var weather = window.__dshWhaleMoeWeather;
    if (!weather || !weather.current || !window.DshWhaleMoeCore) return "unknown";
    var result = window.DshWhaleMoeCore.weatherText(weather.current.code);
    return result && result.kind ? result.kind : "unknown";
  }

  function context() {
    var adventure = window.WhaleAdventure && window.WhaleAdventure.status();
    var profession = window.WhaleProfession && window.WhaleProfession.status();
    var relationship = window.WhaleRelationship && window.WhaleRelationship.status();
    var personality = relationship && relationship.personality;
    return {
      hour: new Date().getHours(),
      weather: weatherKind(),
      mood: Number(storage.get("mood", "70")),
      satiety: Number(storage.get("satiety", "80")),
      profession: profession && profession.state ? profession.state.primaryId : "",
      personality: personality ? personality.id : "balanced",
      personalityScore: personality ? personality.score : 0,
      collectionFound:
        adventure && adventure.progress
          ? adventure.progress.found
          : Object.keys((adventure && adventure.state && adventure.state.collection) || {}).length,
      title: storage.get("title", "主人"),
      petName: storage.get("petName", "鲸鱼娘"),
      away: Boolean(adventure && adventure.state && adventure.state.current)
    };
  }

  function announce(type, pose, line) {
    if (!line || document.hidden || storage.get("quiet-active", "0") === "1") return;
    var detail = { type: type, pose: pose, line: line, at: Date.now() };
    if (typeof window.DshWhaleMoeMood !== "function") {
      storage.set("pendingReminder", JSON.stringify(detail));
      return;
    }
    window.dispatchEvent(new CustomEvent("whale-desktop-companion-reminder", { detail: detail }));
  }

  function saveState(next, event) {
    state = core.normalizeState(next);
    storage.set("lifeState", JSON.stringify(state));
    publish(event);
  }

  function publish(event) {
    var current = state.current;
    window.dispatchEvent(
      new CustomEvent("whale-life-change", {
        detail: {
          state: state,
          enabled: enabled(),
          activity: current ? core.activity(current.activityId) : null,
          event: event || null,
          at: Date.now()
        }
      })
    );
  }

  function applyEffect(effect) {
    if (!effect) return;
    if (effect.mood) {
      storage.set("mood", Math.min(100, Number(storage.get("mood", "70")) + Number(effect.mood)));
    }
    if (effect.satiety) {
      storage.set("satiety", Math.min(100, Number(storage.get("satiety", "80")) + Number(effect.satiety)));
    }
  }

  function resolve(now, notify) {
    var result = core.resolveActivity(state, now || Date.now());
    if (!result.resolved) return result;
    applyEffect(result.effect);
    saveState(result.state, { type: "completed", entry: result.entry });
    if (notify !== false) announce("life-completed", result.activity.pose, result.line);
    return result;
  }

  function schedule() {
    if (timer) window.clearTimeout(timer);
    timer = 0;
    if (document.hidden) return;
    var delay = 60000;
    if (state.current) delay = Math.max(250, Math.min(delay, state.current.endsAt - Date.now() + 50));
    else if (state.nextDecisionAt > Date.now())
      delay = Math.max(1000, Math.min(delay, state.nextDecisionAt - Date.now() + 50));
    timer = window.setTimeout(function () {
      timer = 0;
      consider(false);
    }, delay);
  }

  function consider(force) {
    var now = Date.now();
    resolve(now, true);
    var roomContext = context();
    if (!enabled() || state.current || roomContext.away || document.hidden || (!force && idleSeconds < 120)) {
      schedule();
      return { started: false, state: state };
    }
    var result = core.startActivity(state, roomContext, now, Math.random, Boolean(force));
    if (result.started) {
      saveState(result.state, { type: "started", activityId: result.activity.id });
      announce("life-started", result.activity.pose, result.line);
    }
    schedule();
    return result;
  }

  function interruptForTravel() {
    var completed = resolve(Date.now(), false);
    if (completed.resolved) {
      schedule();
      return;
    }
    var result = core.interruptActivity(state, Date.now(), "准备出门旅行");
    if (!result.interrupted) return;
    saveState(result.state, { type: "interrupted", activityId: result.activity.id, reason: result.reason });
    schedule();
  }

  window.WhaleLife = Object.freeze({
    consider: consider,
    resolve: resolve,
    status: function () {
      var current = state.current;
      return {
        state: state,
        enabled: enabled(),
        activity: current ? core.activity(current.activityId) : null
      };
    }
  });

  window.addEventListener("whale-desktop-system-state", function (event) {
    var detail = event && event.detail ? event.detail : {};
    if (Number.isFinite(Number(detail.idleSeconds))) idleSeconds = Math.max(0, Number(detail.idleSeconds));
    if (!state.current && idleSeconds >= 120) consider(false);
  });
  window.addEventListener("whale-adventure-change", function (event) {
    var detail = event && event.detail ? event.detail : {};
    if (detail.event && detail.event.type === "departed") interruptForTravel();
    else consider(false);
  });
  window.addEventListener("whale-moe-prefs-change", function (event) {
    var key = event && event.detail ? event.detail.key : "";
    if (key === "lifeState") {
      state = loadState();
      return;
    }
    if (key === "life-enabled") {
      consider(false);
      return;
    }
    if (["mood", "satiety", "professionState", "relationshipState", "adventureState"].indexOf(key) !== -1) schedule();
  });
  window.addEventListener("whale-moe-core-ready", function () {
    consider(false);
  });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) consider(false);
    else schedule();
  });
  document.addEventListener(
    "DOMContentLoaded",
    function () {
      resolve(Date.now(), true);
      publish(null);
      schedule();
    },
    { once: true }
  );
})();
