(function () {
  "use strict";

  var api = window.whaleDesktop;
  if (!api || !api.assets || !api.generated) return;

  window.__DSH_WHALE_ASSET_ROOT__ = api.generated;
  localStorage.setItem("whale-moe:mode", "float");

  function loadStyle(url) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = url;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  loadStyle(api.assets + "dsh-whale-moe.css");
  loadScript(api.assets + "whale-moe-core.js")
    .then(function () {
      window.dispatchEvent(new CustomEvent("whale-moe-core-ready"));
      return loadScript(api.assets + "dsh-whale-moe.js");
    })
    .catch(function (error) {
      console.error("鲸鱼娘资源加载失败", error);
      api.reportError({ message: "鲸鱼娘资源加载失败：" + error.message, stack: error.stack });
    });

  window.addEventListener("error", function (event) {
    api.reportError({ message: event.message, stack: event.error && event.error.stack });
  });
  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    api.reportError({ message: reason && reason.message ? reason.message : String(reason), stack: reason && reason.stack });
  });

  var interactive = false;
  function updateMouseModeAt(clientX, clientY) {
    var target = document.elementFromPoint(clientX, clientY);
    var next = Boolean(target && target.closest && target.closest(
      "[data-dsh-whale-frame], [data-dsh-whale-bubble], [data-dsh-whale-prefs], " +
      "[data-dsh-whale-context], [data-dsh-whale-game], [data-dsh-whale-catch], " +
      "[data-dsh-whale-gear-mini], [data-whale-desktop-settings]"
    ));
    if (next === interactive) return;
    interactive = next;
    api.setMouseInteractive(next);
  }

  function updateMouseMode(event) {
    updateMouseModeAt(event.clientX, event.clientY);
  }

  window.addEventListener("mousemove", updateMouseMode, { passive: true });
  api.onCursorProbe(function (point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    updateMouseModeAt(point.x, point.y);
  });
  api.onSystemState(function (state) {
    window.dispatchEvent(new CustomEvent("whale-desktop-system-state", { detail: state }));
  });
  api.onComputerState(function (state) {
    window.dispatchEvent(new CustomEvent("whale-desktop-computer-state", { detail: state }));
  });
  function syncComputerLinkPreference() {
    api.setComputerLinkEnabled(localStorage.getItem("whale-moe:computer-link") !== "0");
    api.setWindowPerchEnabled(localStorage.getItem("whale-moe:window-perch") === "1");
  }
  function syncQuietPreference() {
    api.setQuietActive(localStorage.getItem("whale-moe:quiet-active") === "1");
  }
  syncQuietPreference();
  syncComputerLinkPreference();
  window.addEventListener("whale-moe-prefs-change", function (event) {
    if (!event.detail) return;
    if (event.detail.key === "computer-link" || event.detail.key === "window-perch") syncComputerLinkPreference();
    if (event.detail.key === "quiet-active") syncQuietPreference();
  });
  api.onResetPosition(function () {
    localStorage.removeItem("whale-moe:floatX");
    localStorage.removeItem("whale-moe:floatY");
    window.dispatchEvent(new StorageEvent("storage", { key: "whale-moe:floatX" }));
  });
  api.onOpenSettings(function () {
    window.dispatchEvent(new CustomEvent("whale-desktop-open-settings"));
  });
})();
