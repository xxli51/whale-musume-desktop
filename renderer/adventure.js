(function () {
  "use strict";

  var storage = window.WhaleStorage;
  var core = window.WhaleAdventureCore;
  if (!storage || !core) return;

  var foregroundCategory = "other";
  var focusRounds = 0;
  var timer = null;

  function loadState() {
    var raw = storage.get("adventureState", "{}");
    try {
      return core.normalizeState(JSON.parse(raw));
    } catch (_error) {
      return core.blankState();
    }
  }

  function saveState(state) {
    storage.set("adventureState", JSON.stringify(core.normalizeState(state)));
  }

  function weatherKind() {
    var weather = window.__dshWhaleMoeWeather;
    if (!weather || !weather.current || !window.DshWhaleMoeCore) return "unknown";
    var text = window.DshWhaleMoeCore.weatherText(weather.current.code);
    return text && text.kind ? text.kind : "unknown";
  }

  function context() {
    var professionStatus = window.WhaleProfession && window.WhaleProfession.status();
    var profession = professionStatus && professionStatus.state ? professionStatus.state.primaryId : "";
    var relationshipStatus = window.WhaleRelationship && window.WhaleRelationship.status();
    var personality = relationshipStatus && relationshipStatus.personality ? relationshipStatus.personality : null;
    return {
      hour: new Date().getHours(),
      weather: weatherKind(),
      activity: foregroundCategory,
      profession: profession,
      relationship: relationshipStatus && relationshipStatus.stage ? relationshipStatus.stage.id : "new",
      personality: personality ? personality.id : "",
      personalityScore: personality ? personality.score : 0,
      city: storage.get("weatherCity", ""),
      title: storage.get("title", "主人"),
      petName: storage.get("petName", "鲸鱼娘"),
      focusRounds: focusRounds
    };
  }

  function announce(type, pose, line) {
    var detail = { type: type, pose: pose, line: line, at: Date.now() };
    if (typeof window.DshWhaleMoeMood !== "function") {
      storage.set("pendingReminder", JSON.stringify(detail));
      return;
    }
    window.dispatchEvent(new CustomEvent("whale-desktop-companion-reminder", { detail: detail }));
  }

  function personalitySignal(type, amount) {
    window.dispatchEvent(
      new CustomEvent("whale-personality-signal", { detail: { type: type, amount: amount || 1, at: Date.now() } })
    );
  }

  function publish(state, event) {
    if (window.whaleDesktop && typeof window.whaleDesktop.setAdventureAway === "function") {
      window.whaleDesktop.setAdventureAway(Boolean(state && state.current && state.current.returnsAt > Date.now()));
    }
    window.dispatchEvent(
      new CustomEvent("whale-adventure-change", {
        detail: { state: state, event: event || null, progress: core.collectionProgress(state), at: Date.now() }
      })
    );
  }

  function resolve(now) {
    var result = core.resolveJourney(loadState(), now || Date.now());
    if (!result.resolved) {
      publish(result.state, null);
      return result;
    }
    saveState(result.state);
    publish(result.state, { type: "returned", journey: result.journey, line: result.line });
    personalitySignal("returned", 1);
    if (result.journey.firstFind) personalitySignal("first-find", 1);
    announce("adventure-return", result.journey.firstFind ? "achievement" : "daily-done", result.line);
    return result;
  }

  function depart(route) {
    if (storage.get("adventure-enabled", "1") === "0") {
      return { started: false, reason: "disabled", state: loadState() };
    }
    var result = core.startJourney(loadState(), route, context(), Date.now(), Math.random);
    if (!result.started) return result;
    saveState(result.state);
    announce("adventure-depart", "daily-picnic", result.line);
    publish(result.state, { type: "departed", journey: result.journey, line: result.line });
    personalitySignal("depart", 1);
    schedule(1000);
    return result;
  }

  function recall() {
    var result = core.recallJourney(loadState(), Date.now());
    if (result.reason === "already-returned") return resolve(Date.now());
    if (!result.recalled) {
      publish(result.state, null);
      return result;
    }
    saveState(result.state);
    publish(result.state, { type: "recalled", location: result.location, line: result.line });
    personalitySignal("recall", 1);
    announce("adventure-recall", "running", result.line);
    schedule(1000);
    return result;
  }

  function schedule(delay) {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(
      function () {
        timer = null;
        resolve(Date.now());
        var state = loadState();
        var baseDelay = document.hidden ? 60000 : 15000;
        var untilReturn = state.current ? state.current.returnsAt - Date.now() + 25 : baseDelay;
        schedule(Math.max(100, Math.min(baseDelay, untilReturn)));
      },
      Math.max(0, Number(delay) || 0)
    );
  }

  window.WhaleAdventure = Object.freeze({
    depart: depart,
    recall: recall,
    resolve: resolve,
    status: function () {
      var state = loadState();
      return {
        state: state,
        progress: core.collectionProgress(state),
        enabled: storage.get("adventure-enabled", "1") !== "0"
      };
    }
  });

  window.addEventListener("whale-desktop-computer-state", function (event) {
    var state = event && event.detail ? event.detail : {};
    var category = state.foreground && state.foreground.category;
    if (category) foregroundCategory = String(category).slice(0, 32);
  });
  window.addEventListener("whale-companion-status", function (event) {
    var status = event && event.detail ? event.detail : {};
    if (status.pomodoro) focusRounds = Math.max(0, Number(status.pomodoro.rounds) || 0);
  });
  window.addEventListener("whale-desktop-recall-adventure", recall);
  window.addEventListener("whale-moe-prefs-change", function (event) {
    if (event.detail && event.detail.key === "adventure-enabled") schedule(0);
  });
  document.addEventListener("visibilitychange", function () {
    schedule(0);
  });
  document.addEventListener(
    "DOMContentLoaded",
    function () {
      schedule(0);
    },
    { once: true }
  );
})();
