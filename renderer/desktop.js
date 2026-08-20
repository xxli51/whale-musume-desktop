(function () {
  "use strict";

  var api = window.whaleDesktop;
  if (!api || !api.assets || !api.generated) return;

  window.__DSH_WHALE_DESKTOP__ = true;
  window.__DSH_WHALE_ASSET_ROOT__ = api.generated;
  window.__DSH_WHALE_CALIBRATION_URL__ = api.calibration;
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
    .then(function () { return loadScript(api.assets + "dsh-whale-moe.js"); })
    .catch(function (error) { console.error("鲸鱼娘资源加载失败", error); });

  var interactive = false;
  function updateMouseMode(event) {
    var target = document.elementFromPoint(event.clientX, event.clientY);
    var next = Boolean(target && target.closest && target.closest(
      "[data-dsh-whale-frame], [data-dsh-whale-bubble], [data-dsh-whale-prefs], " +
      "[data-dsh-whale-context], [data-dsh-whale-game], [data-dsh-whale-catch], " +
      "[data-dsh-whale-gear-mini], [data-whale-desktop-settings]"
    ));
    if (next === interactive) return;
    interactive = next;
    api.setMouseInteractive(next);
  }

  window.addEventListener("mousemove", updateMouseMode, { passive: true });
  window.addEventListener("blur", function () {
    interactive = false;
    api.setMouseInteractive(false);
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
