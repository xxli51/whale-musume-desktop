(function () {
  "use strict";

  var storage = window.WhaleStorage;
  var core = window.WhaleRelationshipCore;
  if (!storage || !core) return;
  var state = loadState();

  function loadState() {
    try {
      return core.normalizeState(JSON.parse(storage.get("relationshipState", "{}")));
    } catch (_error) {
      return core.blankState();
    }
  }

  function enabled() {
    return storage.get("relationship-enabled", "1") !== "0";
  }

  function companionDays() {
    var since = Number(storage.get("companionSince", "0"));
    return since ? Math.max(0, Math.floor((Date.now() - since) / 86400000)) : 0;
  }

  function status() {
    var stage = core.relationshipStage(Number(storage.get("affinity", "0")), companionDays());
    return {
      state: state,
      stage: stage,
      personality: core.personality(state),
      enabled: enabled(),
      companionDays: companionDays()
    };
  }

  function publish(event) {
    var detail = status();
    detail.event = event || null;
    window.dispatchEvent(new CustomEvent("whale-relationship-change", { detail: detail }));
  }

  function syncStage(announce) {
    var current = status().stage;
    if (state.stageId === current.id) return;
    var previous = state.stageId;
    var previousIndex = core.STAGES.findIndex(function (stage) {
      return stage.id === previous;
    });
    var currentIndex = core.STAGES.findIndex(function (stage) {
      return stage.id === current.id;
    });
    state.stageId = current.id;
    storage.set("relationshipState", JSON.stringify(state));
    if (announce && previous && currentIndex > previousIndex) {
      window.dispatchEvent(
        new CustomEvent("whale-desktop-companion-reminder", {
          detail: {
            type: "relationship-stage",
            pose: "meme-heart",
            line: current.icon + " 我们的关系变成「" + current.name + "」啦。以后也请继续陪着我～",
            at: Date.now()
          }
        })
      );
    }
    publish({ type: "stage", stageId: current.id });
  }

  function onSignal(event) {
    if (!enabled()) return;
    var detail = event && event.detail ? event.detail : {};
    var result = core.applySignal(state, detail.type, detail.amount, detail.at || Date.now());
    if (!result.applied) return;
    state = result.state;
    storage.set("relationshipState", JSON.stringify(state));
    syncStage(true);
    publish({ type: "signal", signal: detail.type });
  }

  window.WhaleRelationship = Object.freeze({ status: status });
  window.addEventListener("whale-personality-signal", onSignal);
  window.addEventListener("whale-moe-prefs-change", function (event) {
    var key = event && event.detail ? event.detail.key : "";
    if (key === "relationshipState") state = loadState();
    if (key === "growth" || key === "affinity" || key === "companionSince") syncStage(true);
  });
  document.addEventListener(
    "DOMContentLoaded",
    function () {
      syncStage(false);
      publish(null);
    },
    { once: true }
  );
})();
