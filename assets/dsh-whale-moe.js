/* dsh-whale-moe v3 — standalone desktop mascot presenter.
   The dsh-prefixed DOM/CSS/resource names are retained for animation compatibility;
   the presenter does not inspect or react to DSH host-page state or data.
   Activation: always on; toggled off via its own gear menu
   (localStorage "whale-moe:pet" = "0"). */
(function (root) {
  "use strict";
  if (!root || !root.document) return;

  var core = root.DshWhaleMoeCore;
  var doc = root.document;
  var ASSET_ROOT = root.__DSH_WHALE_ASSET_ROOT__ || "/assets/generated/";
  var POSE_VERSION = "?v=6";
  var DEBOUNCE_MS = 120;
  var PARTICLE_MAX = 30;
  var HEART_CHARS = ["♥", "✿", "☆", "♪"];

  var PREFS = [
    { key: "pet", label: "看板娘" },
    { key: "chat", label: "台词气泡" },
    { key: "particles", label: "粒子效果" }
  ];

  function readPref(key) {
    try { return root.localStorage.getItem("whale-moe:" + key) !== "0"; } catch (e) { return true; }
  }
  function writePref(key, value) {
    try { root.localStorage.setItem("whale-moe:" + key, value ? "1" : "0"); } catch (e) { /* storage unavailable */ }
  }

  var MODES = Object.freeze({ float: 1, mini: 1 });
  function readMode() {
    try {
      var value = root.localStorage.getItem("whale-moe:mode");
      if (value === null) return "float";
      return MODES[value] ? value : "float";
    } catch (e) { return "float"; }
  }
  function readFloatPos() {
    try {
      var rawX = root.localStorage.getItem("whale-moe:floatX");
      var rawY = root.localStorage.getItem("whale-moe:floatY");
      if (rawX === null || rawY === null) return null;
      var x = Number(rawX);
      var y = Number(rawY);
      if (Number.isFinite(x) && Number.isFinite(y)) return { x: x, y: y };
    } catch (e) { /* ignore */ }
    return null;
  }
  function writeFloatPos(x, y) {
    try {
      root.localStorage.setItem("whale-moe:floatX", String(Math.round(x)));
      root.localStorage.setItem("whale-moe:floatY", String(Math.round(y)));
    } catch (e) { /* storage unavailable */ }
  }

  /* ---------- own layers ---------- */

  function removeRoot() {
    stopIdleBlink();
    var nodes = doc.querySelectorAll("[data-dsh-whale-root]");
    for (var i = 0; i < nodes.length; i += 1) nodes[i].remove();
    var particles = doc.querySelectorAll("[data-dsh-whale-particle]");
    for (var p = 0; p < particles.length; p += 1) particles[p].remove();
    var games = doc.querySelectorAll("[data-dsh-whale-game], [data-dsh-whale-catch]");
    for (var g = 0; g < games.length; g += 1) games[g].remove();
    gameOpen = false;
    catchOpen = false;
    if (gameTimer) { root.clearInterval(gameTimer); gameTimer = null; }
    if (catchTimer) { root.clearInterval(catchTimer); catchTimer = null; }
    weatherFxStop();
  }

  function createToggleButton(label, key) {
    var btn = doc.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-dsh-whale-toggle", key);
    btn.setAttribute("aria-pressed", String(readPref(key)));
    btn.textContent = label + (readPref(key) ? "：开" : "：关");
    btn.addEventListener("click", function (event) {
      event.stopPropagation();
      var next = !readPref(key);
      writePref(key, next);
      btn.setAttribute("aria-pressed", String(next));
      btn.textContent = label + (next ? "：开" : "：关");
      reconcile();
    });
    return btn;
  }

  var layerState = { active: "a", loaded: { a: "", b: "" }, gen: 0, pendingSwap: "", pendingSince: 0 };
  var IDLE_BLINK_DELAYS = Object.freeze([190, 110, 130, 110, 120, 500]);
  var idleBlinkState = { requested: false, timer: null, frame: 0, preloaded: false };

  function idleBlinkFrameSrc(index) {
    return ASSET_ROOT + "dsh-whale-idle-blink-" + String(index + 1).padStart(2, "0") + ".webp" + POSE_VERSION;
  }

  function isStaticIdleSrc(src) {
    return !!src && src.indexOf("dsh-whale-state-idle-cute.webp") !== -1;
  }

  function stopIdleBlink() {
    idleBlinkState.requested = false;
    idleBlinkState.frame = 0;
    if (idleBlinkState.timer) {
      root.clearTimeout(idleBlinkState.timer);
      idleBlinkState.timer = null;
    }
    var rootNode = doc.querySelector("[data-dsh-whale-root]");
    var active = rootNode && rootNode.querySelector("[data-dsh-whale-layer].dsh-whale-active");
    if (active && layerState.loaded[layerState.active] === idleBlinkFrameSrc(0)) {
      active.setAttribute("src", idleBlinkFrameSrc(0));
    }
  }

  function startIdleBlink() {
    idleBlinkState.requested = true;
    if (!idleBlinkState.preloaded && typeof root.Image === "function") {
      idleBlinkState.preloaded = true;
      for (var p = 0; p < IDLE_BLINK_DELAYS.length; p += 1) {
        var preload = new root.Image();
        preload.src = idleBlinkFrameSrc(p);
      }
    }
    if (idleBlinkState.timer) return;

    function tick() {
      idleBlinkState.timer = null;
      if (!idleBlinkState.requested) return;
      var rootNode = doc.querySelector("[data-dsh-whale-root]");
      var active = rootNode && rootNode.querySelector("[data-dsh-whale-layer].dsh-whale-active");
      var ready = active && !layerState.pendingSwap && layerState.loaded[layerState.active] === idleBlinkFrameSrc(0);
      if (ready) {
        var index = idleBlinkState.frame;
        active.setAttribute("src", idleBlinkFrameSrc(index));
        rootNode.setAttribute("data-dsh-whale-idle-frame", String(index + 1));
        idleBlinkState.frame = (index + 1) % IDLE_BLINK_DELAYS.length;
        idleBlinkState.timer = root.setTimeout(tick, IDLE_BLINK_DELAYS[index]);
      } else {
        idleBlinkState.timer = root.setTimeout(tick, 80);
      }
    }
    tick();
  }

  function setPose(src, animate, soft) {
    var rootNode = doc.querySelector("[data-dsh-whale-root]");
    if (!rootNode) return;
    var idleRequested = isStaticIdleSrc(src);
    if (idleRequested) src = idleBlinkFrameSrc(0);
    if (idleRequested) startIdleBlink();
    else stopIdleBlink();
    if (src && src.indexOf("?") === -1) src += POSE_VERSION;
    var nextName = layerState.active === "a" ? "b" : "a";
    var current = rootNode.querySelector('[data-dsh-whale-layer="' + layerState.active + '"]');
    var next = rootNode.querySelector('[data-dsh-whale-layer="' + nextName + '"]');
    if (!current || !next) return;

    /* A previous blink/transition can leave an inline opacity that would pin
       an inactive layer visible under the new pose — always clear it. */
    current.style.opacity = "";
    next.style.opacity = "";

    /* Stuck-animation recovery: background/throttled tabs can pause WAAPI so
       neither onfinish nor oncancel fires. If a swap has been pending too long,
       land it immediately on the layer that was already loaded for the swap. */
    if (layerState.pendingSwap && Date.now() - layerState.pendingSince > 1600) {
      layerState.gen += 1;
      layerState.pendingSwap = "";
      layerState.pendingSince = 0;
      next.classList.add("dsh-whale-active");
      current.classList.remove("dsh-whale-active");
      layerState.active = nextName;
    }

    if (layerState.loaded[layerState.active] === src) return;

    /* Motion-hide swap (industry sprite/VTuber style): old pose squashes down
       quickly, the image is swapped at the heaviest motion point, then the new
       pose pops back with overshoot. No opacity crossfade, and the two layers
       are never active at the same time.
       soft=false → click/reaction poses switch instantly (no transition). */
    function swap() {
      var motionNode = rootNode.querySelector("[data-dsh-whale-motion]");
      function applyLayers() {
        next.classList.add("dsh-whale-active");
        current.classList.remove("dsh-whale-active");
        layerState.active = nextName;
        layerState.pendingSwap = "";
        layerState.pendingSince = 0;
      }
      if (!soft || motionReduced() || !motionNode || typeof motionNode.animate !== "function") {
        applyLayers();
        return;
      }
      /* 待机微动作和换图动画不能叠在同一节点上，先取消 */
      motionNode.classList.remove("dsh-whale-hop", "dsh-whale-squint");
      var swapGen = layerState.gen;
      layerState.pendingSwap = src;
      layerState.pendingSince = Date.now();
      var hide = motionNode.animate(
        [
          { transform: "translateY(0) scale(1)" },
          { transform: "translateY(12px) scale(0.86, 0.92)" }
        ],
        { duration: 140, easing: "cubic-bezier(0.55, 0, 1, 0.45)" }
      );
      hide.oncancel = function () {
        hide.onfinish = null;
        if (swapGen !== layerState.gen) {
          /* 本次换图已被更新的换图取代：只清理属于自己的标记，
             绝不能把新一代动画的 pendingSwap 一起抹掉，否则渲染循环
             会反复重启同一组动画，表现为“抽搐”。 */
          if (layerState.pendingSwap === src) {
            layerState.pendingSwap = "";
            layerState.pendingSince = 0;
          }
          return;
        }
        applyLayers();
      };
      hide.onfinish = function () {
        hide.onfinish = null;
        if (swapGen !== layerState.gen) {
          if (layerState.pendingSwap === src) {
            layerState.pendingSwap = "";
            layerState.pendingSince = 0;
          }
          return;
        }
        applyLayers();
        motionNode.animate(
          [
            { transform: "translateY(18px) scale(0.88, 0.94)" },
            { transform: "translateY(0) scale(1)" }
          ],
          { duration: 480, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
        );
      };
    }

    if (!animate || layerState.loaded[layerState.active] === "") {
      layerState.gen += 1;
      layerState.pendingSwap = "";
      layerState.pendingSince = 0;
      current.setAttribute("src", src);
      current.classList.add("dsh-whale-active");
      next.classList.remove("dsh-whale-active");
      layerState.loaded[layerState.active] = src;
      return;
    }
    if (layerState.loaded[nextName] === src) {
      if (layerState.pendingSwap === src) return; /* already animating this swap */
      layerState.gen += 1;
      swap();
      return;
    }
    next.setAttribute("src", src);
    layerState.loaded[nextName] = src;
    layerState.gen += 1;
    var gen = layerState.gen;
    next.addEventListener("load", function handler() {
      next.removeEventListener("load", handler);
      if (gen !== layerState.gen) return; /* superseded by a newer pose */
      if (layerState.pendingSwap === src) return;
      swap();
    }, { once: true });
  }

  function burst(symbol) {
    var rootNode = doc.querySelector("[data-dsh-whale-root]");
    if (!rootNode || motionReduced()) return;
    var node = doc.createElement("span");
    node.setAttribute("data-dsh-whale-burst", "true");
    node.textContent = symbol;
    rootNode.appendChild(node);
    node.addEventListener("animationend", function () { node.remove(); }, { once: true });
    root.setTimeout(function () { node.remove(); }, 1000);
  }

  function emojiBurst(symbols) {
    var rootNode = doc.querySelector("[data-dsh-whale-root]");
    if (!rootNode || motionReduced() || !symbols || !symbols.length) return;
    for (var i = 0; i < symbols.length; i += 1) {
      var node = doc.createElement("span");
      node.setAttribute("data-dsh-whale-burst", "true");
      node.className = "dsh-emoji-fly";
      node.textContent = symbols[i];
      var side = i % 2 === 0 ? -1 : 1;
      node.style.setProperty("--wm-dx", String(side * (14 + (i % 3) * 12)) + "px");
      node.style.setProperty("--wm-dy", String(-34 - (i % 3) * 16) + "px");
      node.style.setProperty("--wm-rot", String(side * (8 + i * 7)) + "deg");
      node.style.animationDelay = (i * 55) + "ms";
      rootNode.appendChild(node);
      node.addEventListener("animationend", function () { node.remove(); }, { once: true });
      root.setTimeout(function () { node.remove(); }, 1200 + i * 60);
    }
  }

  var typingTimer = null;
  var nextTimer = null;
  function typeBubble(textNode, line) {
    if (typingTimer) root.clearTimeout(typingTimer);
    memory.currentTypingLine = line;
    if (motionReduced()) {
      textNode.textContent = line;
      memory.currentTypingLine = "";
      typingTimer = null;
      return;
    }
    textNode.textContent = "";
    var caret = doc.createElement("span");
    caret.setAttribute("data-dsh-whale-caret", "true");
    caret.textContent = "▍";
    textNode.appendChild(caret);
    var index = 0;
    (function tick() {
      if (index >= line.length) {
        caret.remove();
        typingTimer = null;
        memory.currentTypingLine = "";
        return;
      }
      var ch = line.charAt(index);
      textNode.insertBefore(doc.createTextNode(ch), caret);
      index += 1;
      var delay = 64;
      if ("，。！？～…".indexOf(ch) !== -1) delay = 260;
      else if (ch === " ") delay = 90;
      else if (index % 5 === 0) delay = 130;
      typingTimer = root.setTimeout(tick, delay);
    })();
  }

  function ensureRoot() {
    var rootNode = doc.querySelector("[data-dsh-whale-root]");
    if (rootNode) return rootNode;
    rootNode = doc.createElement("div");
    rootNode.setAttribute("data-dsh-whale-root", "true");

    var frame = doc.createElement("div");
    frame.setAttribute("data-dsh-whale-frame", "true");
    frame.setAttribute("data-dsh-whale-mascot", "true");
    frame.setAttribute("aria-hidden", "true");

    var motion = doc.createElement("div");
    motion.setAttribute("data-dsh-whale-motion", "true");

    var layerA = doc.createElement("img");
    layerA.alt = "";
    layerA.draggable = false;
    layerA.setAttribute("data-dsh-whale-layer", "a");
    layerA.addEventListener("error", function () { layerA.style.display = "none"; });
    layerA.addEventListener("load", function () { layerA.style.display = ""; });
    var layerB = doc.createElement("img");
    layerB.alt = "";
    layerB.draggable = false;
    layerB.setAttribute("data-dsh-whale-layer", "b");
    layerB.addEventListener("error", function () { layerB.style.display = "none"; });
    layerB.addEventListener("load", function () { layerB.style.display = ""; });
    motion.appendChild(layerA);
    motion.appendChild(layerB);
    frame.appendChild(motion);

    var bubble = doc.createElement("div");
    bubble.setAttribute("data-dsh-whale-bubble", "true");
    bubble.hidden = true;
    var text = doc.createElement("span");
    text.setAttribute("data-dsh-whale-bubble-text", "true");
    var gear = doc.createElement("button");
    gear.type = "button";
    gear.setAttribute("data-dsh-whale-gear", "true");
    gear.setAttribute("aria-label", "鲸鱼娘偏好");
    gear.textContent = "⚙";
    gear.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleMenu();
    });
    bubble.appendChild(text);
    bubble.appendChild(gear);

    var gearMini = doc.createElement("button");
    gearMini.type = "button";
    gearMini.setAttribute("data-dsh-whale-gear-mini", "true");
    gearMini.setAttribute("aria-label", "鲸鱼娘偏好");
    gearMini.textContent = "⚙";
    gearMini.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleMenu();
    });

    var menu = doc.createElement("div");
    menu.setAttribute("data-dsh-whale-prefs", "true");
    menu.hidden = true;
    for (var i = 0; i < PREFS.length; i += 1) menu.appendChild(createToggleButton(PREFS[i].label, PREFS[i].key));

    rootNode.appendChild(frame);
    rootNode.appendChild(bubble);
    rootNode.appendChild(gearMini);
    rootNode.appendChild(menu);
    doc.body.appendChild(rootNode);

    rootNode.addEventListener("click", function (event) { event.stopPropagation(); });
    var suppressClick = false;
    frame.addEventListener("click", function (event) {
      event.stopPropagation();
      if (suppressClick) { suppressClick = false; return; }
      var m = rootNode.querySelector("[data-dsh-whale-motion]");
      if (m && !motionReduced()) {
        m.classList.remove("dsh-whale-react");
        void m.offsetWidth;
        m.classList.add("dsh-whale-react");
        root.setTimeout(function () { m.classList.remove("dsh-whale-react"); }, 650);
      }
      patMascot(resolveHitZone(event.clientX, event.clientY, rootNode));
    });
    frame.addEventListener("pointerdown", function (event) {
      pressStartedAt = Date.now();
      if (readMode() === "float" && event.button === 0) startDrag(event, rootNode);
    });
    frame.addEventListener("contextmenu", function (event) {
      event.preventDefault();
      event.stopPropagation();
      showContextMenu(event.clientX, event.clientY);
    });
    rootNode.__dshWhaleMoeSuppressClick = function () { suppressClick = true; };
    return rootNode;
  }

  var dragState = null;
  function startDrag(event, rootNode) {
    event.preventDefault();
    dragState = {
      node: rootNode,
      dx: event.clientX - rootNode.getBoundingClientRect().left,
      dy: event.clientY - rootNode.getBoundingClientRect().top,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY
    };
    root.addEventListener("pointermove", onDrag, true);
    root.addEventListener("pointerup", endDrag, true);
    root.addEventListener("pointercancel", endDrag, true);
  }
  function onDrag(event) {
    if (!dragState) return;
    var node = dragState.node;
    var width = node.getBoundingClientRect().width;
    var height = node.getBoundingClientRect().height;
    var left = event.clientX - dragState.dx;
    var top = event.clientY - dragState.dy;
    if (!dragState.moved && (Math.abs(event.clientX - dragState.startX) > 4 || Math.abs(event.clientY - dragState.startY) > 4)) {
      dragState.moved = true;
      node.classList.add("dsh-whale-dragging");
      schedule();
    }
    node.style.left = Math.round(clamp(left, 8, root.innerWidth - width - 8)) + "px";
    node.style.top = Math.round(clamp(top, 8, root.innerHeight - height - 8)) + "px";
    if (dragState.moved) {
      /* 摇摆跟随光标水平速度，而不是自动动画 */
      var motionNode = node.querySelector("[data-dsh-whale-motion]");
      if (motionNode) {
        var vx = event.clientX - dragState.lastX;
        var angle = clamp(vx * 1.1, -16, 16);
        motionNode.style.setProperty("--wm-drag-angle", angle.toFixed(1) + "deg");
      }
    }
    dragState.lastX = event.clientX;
    dragState.lastY = event.clientY;
  }
  function endDrag() {
    root.removeEventListener("pointermove", onDrag, true);
    root.removeEventListener("pointerup", endDrag, true);
    root.removeEventListener("pointercancel", endDrag, true);
    if (dragState && dragState.node) {
      dragState.node.classList.remove("dsh-whale-dragging");
    }
    if (dragState && dragState.moved && dragState.node) {
      writeFloatPos(parseFloat(dragState.node.style.left), parseFloat(dragState.node.style.top));
      var node = dragState.node;
      if (node.__dshWhaleMoeSuppressClick) node.__dshWhaleMoeSuppressClick();
    }
    dragState = null;
    schedule();
  }

  function toggleMenu() {
    var menu = doc.querySelector("[data-dsh-whale-prefs]");
    if (menu) menu.hidden = !menu.hidden;
  }

  function showContextMenu(x, y) {
    var old = doc.querySelector("[data-dsh-whale-context]");
    if (old) old.remove();
    var menu = doc.createElement("div");
    menu.setAttribute("data-dsh-whale-context", "true");
    var items = [
      { label: "投喂小点心", action: function () { var out = applyGrowth({ type: "feed" }, Date.now(), 0); applyQuestSignal("feed", 1); burst("🍰"); showMood("eat", 3000); var line = say("interact", "feed"); if (line) showLine(line); if (out.unlocks.length) announceUnlocks(out.unlocks); } },
      { label: "戳一下", action: function () { applyGrowth({ type: "poke" }, Date.now(), 0); burst("💢"); showMood("angry", 3000); var line = say("interact", "poke"); if (line) showLine(line); } },
      { label: "夸夸 鲸鱼娘", action: function () { applyGrowth({ type: "praise" }, Date.now(), 0); applyQuestSignal("praise", 1); burst("✨"); showMood("tail-swing", 3000, true); var line = say("interact", "praise"); if (line) showLine(line); } }
    ];
    if (readPref("game")) {
      items.push({ label: "小游戏：戳泡泡", action: function () { openGame(); } });
      items.push({ label: "小游戏：接点心", action: function () { openCatchGame(); } });
    }
    items.push(
      { label: "回到原位", action: function () { try { root.localStorage.removeItem("whale-moe:floatX"); root.localStorage.removeItem("whale-moe:floatY"); } catch (e) { /* ignore */ } reconcile(); } },
      { label: "打开看板娘设置", action: function () {
        root.dispatchEvent(new CustomEvent("whale-desktop-open-settings"));
      } },
      { label: "关闭菜单", action: function () { menu.remove(); } }
    );
    for (var i = 0; i < items.length; i += 1) {
      (function (item) {
        var btn = doc.createElement("button");
        btn.type = "button";
        btn.textContent = item.label;
        btn.addEventListener("click", function (event) { event.stopPropagation(); item.action(); menu.remove(); });
        menu.appendChild(btn);
      })(items[i]);
    }
    doc.body.appendChild(menu);
    menu.style.left = Math.min(x, root.innerWidth - 180) + "px";
    menu.style.top = Math.min(y, root.innerHeight - 160) + "px";
    doc.addEventListener("pointerdown", function closer(event) {
      if (!menu.contains(event.target)) { menu.remove(); doc.removeEventListener("pointerdown", closer, true); }
    }, true);
  }

  /* ---------- interactions ---------- */

  var patHistory = [];
  var celebrateUntil = 0;
  var pressStartedAt = 0;
  var moodTimer = null;
  var lastTripleAt = 0;
  var lastPatProcessedAt = 0;
  var lastPatSpeechAt = 0;
  var IDLE_ACTION_POOL = ["daily-eat", "daily-coffee", "daily-stretch", "daily-pajama", "daily-shower", "cool-shades", "meme-smug", "daily-picnic", "daily-cooking", "daily-fishing", "daily-painting", "daily-gaming", "tail-swing", "meme-music"];
  var DESKTOP_FALLBACK_ACTIONS = [
    "abstract", "bold", "meme-broke", "meme-cry", "meme-doge", "meme-doubt", "meme-heart", "meme-kyun", "meme-no",
    "meme-ojisan", "meme-omg", "meme-peace", "meme-shock", "meme-sike", "meme-smile-pain", "meme-wakuwaku", "meme-worship", "meme-yes",
    "failure", "running", "success", "thinking", "tool", "work-boss", "work-celebrate", "work-deadline", "work-debug", "work-deploy",
    "work-idea", "work-meeting", "work-pat", "work-ram", "work-review", "work-slack-phone", "work-slack", "work-sleep",
    "celebrate", "greet", "night", "sleep", "sweep", "waiting"
  ];
  var DESKTOP_ACTION_DIALOGUE = Object.freeze({
    abstract: ["keyword", "crazy"], bold: ["keyword", "cheer"],
    "meme-doge": ["keyword", "doge"], "meme-doubt": ["keyword", "doubt"], "meme-kyun": ["keyword", "kyun"],
    "meme-ojisan": ["keyword", "ojisan"], "meme-omg": ["keyword", "omg"], "meme-peace": ["keyword", "peace"],
    "meme-sike": ["keyword", "sike"], "meme-smile-pain": ["keyword", "smilepain"],
    "meme-wakuwaku": ["keyword", "wakuwaku"], "meme-worship": ["keyword", "worship"],
    "meme-broke": ["idleAction", "meme-broke"], "meme-cry": ["idleAction", "meme-cry"],
    "meme-heart": ["idleAction", "meme-heart"], "meme-no": ["idleAction", "meme-no"],
    "meme-shock": ["idleAction", "meme-shock"], "meme-yes": ["idleAction", "meme-yes"],
    failure: ["work", "failure"], running: ["work", "tool"], success: ["work", "success"], thinking: ["work", "thinking"], tool: ["work", "tool"],
    "work-boss": ["meme", "cake"], "work-celebrate": ["work", "success"], "work-deadline": ["meme", "ddl"],
    "work-debug": ["context", "bug"], "work-deploy": ["context", "deploy"], "work-idea": ["context", "code"],
    "work-meeting": ["keyword", "meeting"], "work-pat": ["interact", "pat"], "work-ram": ["work", "long"],
    "work-review": ["keyword", "review"], "work-slack-phone": ["meme", "slack"], "work-slack": ["meme", "slack"], "work-sleep": ["keyword", "tired"],
    "daily-done": ["idleAction", "daily-done"],
    celebrate: ["work", "success"], night: ["daily", "night"], sleep: ["daily", "night"], sweep: ["daily", "idle"], waiting: ["daily", "idle"]
  });
  var COMPUTER_LINK_ACTIONS = Object.freeze({
    ide: "work-debug", browser: "curious", office: "work-review", media: "meme-music",
    meeting: "work-meeting", terminal: "tool", design: "daily-painting", game: "daily-gaming",
    "cpu-high": "work-ram", "memory-high": "work-ram", "battery-low": "work-sleep",
    plugged: "tail-swing", unplugged: "waiting", offline: "waiting", online: "celebrate"
  });
  var computerLinkState = {
    initialized: false,
    foregroundCategory: "",
    online: null,
    onBattery: null,
    batteryLow: false,
    cpuHotSamples: 0,
    memoryHotSamples: 0,
    cpuHot: false,
    memoryHot: false,
    lastAnyAt: 0,
    lastTriggered: Object.create(null)
  };
  function showMood(kind, duration, animate) {
    var rootNode = doc.querySelector("[data-dsh-whale-root]");
    if (!rootNode) return;
    memory.moodPose = kind;
    memory.moodUntil = Date.now() + (duration || 3000);
    memory.moodAnimate = animate === true;
    schedule();
    if (moodTimer) { root.clearTimeout(moodTimer); moodTimer = null; }
    moodTimer = root.setTimeout(function () {
      moodTimer = null;
      memory.moodPose = "";
      memory.moodUntil = 0;
      memory.moodAnimate = false;
      schedule();
    }, duration || 3000);
  }

  function fxAt(x, y, kind) {
    if (motionReduced() || !readPref("particles")) return;
    var span = doc.createElement("span");
    span.setAttribute("data-dsh-whale-fx", "true");
    span.className = kind;
    span.style.left = Math.round(x) + "px";
    span.style.top = Math.round(y) + "px";
    doc.body.appendChild(span);
    span.addEventListener("animationend", function () { span.remove(); }, { once: true });
    root.setTimeout(function () { span.remove(); }, 1300);
  }

  function resolveHitZone(clientX, clientY, rootNode) {
    var rect = rootNode.getBoundingClientRect();
    if (rect.width <= 1) return "head";
    var activeSrc = layerState.loaded[layerState.active] || "";
    var poseSet = /-peek\.webp/.test(activeSrc) ? "peek" : "full";
    var nx = (clientX - rect.left) / rect.width;
    var ny = (clientY - rect.top) / rect.height;
    var zone = core.hitZone(nx, ny, poseSet);
    rootNode.setAttribute("data-dsh-whale-zone", zone);
    return zone;
  }

  function bellyReact(now) {
    applyGrowth({ type: "belly" }, now, 0);
    applyQuestSignal("belly", 1);
    showMood("react-belly", 2600, true);
    emojiBurst(["💫", "✨"]);
    var line = say("interact", "belly");
    if (line) showLine(line);
    reconcile();
  }

  function tailReact(now) {
    applyGrowth({ type: "tail" }, now, 0);
    applyQuestSignal("tail", 1);
    showMood("react-tail", 2600, true);
    emojiBurst(["🌀", "💨"]);
    var line = say("interact", "tail");
    if (line) showLine(line);
    reconcile();
  }

  function patMascot(zone) {
    var now = Date.now();
    if (now < celebrateUntil) return;
    var busyNow = BUSY_STATES[memory.state.state] === 1;
    /* 分区反应:非忙态下肚皮/尾巴/头各有专属反应;忙态一律 work-pat/work-ram */
    if (!busyNow && readPref("zones") && zone === "tail") { tailReact(now); return; }
    if (!busyNow && readPref("zones") && zone === "belly") { bellyReact(now); return; }
    patHistory = patHistory.filter(function (t) { return now - t < 2000; });
    patHistory.push(now);
    if (patHistory.length >= 3 && now - lastTripleAt >= 2600) {
      patHistory = [];
      lastTripleAt = now;
      lastPatProcessedAt = now;
      celebrateUntil = now + 2200;
      memory.celebrationVisible = false;
      spawnParticles(12, now);
      showMood("star", 2200);
      var trip = applyGrowth({ type: "triple" }, now, 0);
      if (trip.unlocks.length) announceUnlocks(trip.unlocks);
      var node = doc.querySelector("[data-dsh-whale-root]");
      if (node && !motionReduced()) {
        var motionNode = node.querySelector("[data-dsh-whale-motion]");
        if (motionNode) {
          motionNode.classList.add("dsh-whale-spin");
          root.setTimeout(function () { motionNode.classList.remove("dsh-whale-spin"); }, 850);
        }
      }
    } else {
      /* rapid-fire clicks: keep pose/particle feedback but skip growth and
         speech churn so the bubble never stutters 诶嘿诶嘿 repeatedly */
      var rapid = now - lastPatProcessedAt < 450;
      lastPatProcessedAt = now;
      showMood(busyNow ? (Math.random() < 0.5 ? "work-pat" : "work-ram") : (zone === "head" ? "react-head" : "blush"), busyNow ? 2400 : 2600, true);
      emojiBurst(busyNow ? ["💻", "💦", "✨"] : ["💖", "✨", "⭐"]);
      if (rapid) { reconcile(); return; }
      var pat = applyGrowth({ type: "pat" }, now, patHistory.length);
      applyQuestSignal("pat", 1);
      if (now - lastPatSpeechAt >= 2500) {
        lastPatSpeechAt = now;
        var patLine = say("interact", "pat");
        if (patLine) showLine(patLine);
      }
      if (pat.unlocks.length) announceUnlocks(pat.unlocks);
    }
    reconcile();
  }

  function showLineNow(line) {
    var rootNode = ensureRoot();
    var bubble = rootNode.querySelector("[data-dsh-whale-bubble]");
    var text = rootNode.querySelector("[data-dsh-whale-bubble-text]");
    if (!bubble || !text) return;
    var wasHidden = bubble.hidden;
    bubble.classList.remove("dsh-whale-out");
    if (memory.bubbleOutTimer) { root.clearTimeout(memory.bubbleOutTimer); memory.bubbleOutTimer = null; }
    typeBubble(text, localizeLine(line));
    bubble.hidden = false;
    memory.bubbleHideAt = Date.now() + 4500;
    if (wasHidden) bubble.classList.add("dsh-whale-pop");
  }

  function scheduleNext() {
    if (nextTimer) root.clearTimeout(nextTimer);
    nextTimer = root.setTimeout(function () {
      nextTimer = null;
      var next = memory.pendingLine;
      memory.pendingLine = "";
      if (next) showLineNow(next);
    }, 160);
  }

  function showLine(line) {
    var rootNode = ensureRoot();
    var bubble = rootNode.querySelector("[data-dsh-whale-bubble]");
    var text = rootNode.querySelector("[data-dsh-whale-bubble-text]");
    if (!bubble || !text) return;
    /* single-slot queue: never restart the typewriter or stack timers */
    if (!bubble.hidden && (typingTimer || nextTimer)) {
      if (typingTimer) {
        root.clearTimeout(typingTimer);
        typingTimer = null;
        text.textContent = memory.currentTypingLine;
        memory.currentTypingLine = "";
      }
      memory.pendingLine = line;
      scheduleNext();
      return;
    }
    memory.pendingLine = "";
    showLineNow(line);
  }

  function announceUnlocks(ids) {
    var label = core.ACHIEVEMENTS.filter(function (a) { return ids.indexOf(a.id) !== -1; }).map(function (a) { return a.name; }).join("、");
    if (!label) return;
    if (!BUSY_STATES[memory.state.state]) showMood("achievement", 3500, true);
    burst("🏅");
    showLine("成就达成：" + label + "！");
  }

  function spawnParticles(count, now) {
    if (!readPref("particles") || motionReduced()) return;
    var current = doc.querySelectorAll("[data-dsh-whale-particle]").length;
    count = Math.max(0, Math.min(count, PARTICLE_MAX - current));
    var kinds = ["dot", "spark", "heart"];
    for (var i = 0; i < count; i += 1) {
      var span = doc.createElement("span");
      span.setAttribute("data-dsh-whale-particle", "true");
      span.className = "dsh-particle-" + kinds[(now + i) % kinds.length];
      var rootNode = ensureRoot();
      var rect = rootNode.getBoundingClientRect();
      var drift = Math.round((Math.random() - 0.5) * 30);
      span.style.left = Math.round(rect.left + rect.width / 2 + drift) + "px";
      span.style.top = Math.round(rect.top + rect.height * 0.35) + "px";
      span.style.setProperty("--wm-drift", drift + "px");
      doc.body.appendChild(span);
      span.addEventListener("animationend", function () { span.remove(); }, { once: true });
      root.setTimeout(function () { span.remove(); }, 1100);
    }
  }

  function motionReduced() {
    try { return root.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  }

  /* ---------- mini game: bubble pop ---------- */

  var gameStats = null;
  var gameState = null;
  var gameOpen = false;
  var gamePausedFlag = false;
  var gameTimer = null;
  var gameCursor = 0;

  function loadGameStats() {
    try {
      var raw = root.localStorage.getItem("whale-moe:gameStats");
      gameStats = raw ? JSON.parse(raw) : { plays: 0, wins: 0, best: 0, comboMax: 0, today: "", playsToday: 0, highscore: false };
    } catch (e) {
      gameStats = { plays: 0, wins: 0, best: 0, comboMax: 0, today: "", playsToday: 0, highscore: false };
    }
    return gameStats;
  }
  function saveGameStats() {
    try { root.localStorage.setItem("whale-moe:gameStats", JSON.stringify(gameStats)); } catch (e) { /* ignore */ }
  }
  function dayKeyOf(now) {
    var d = new Date(typeof now === "number" ? now : Date.now());
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function gamePaused() {
    if (!gameOpen) return true;
    if (doc.hidden) return true;
    return false;
  }

  function gamePanel() {
    return doc.querySelector("[data-dsh-whale-game]");
  }

  function closeGame() {
    gameOpen = false;
    if (gameTimer) { root.clearInterval(gameTimer); gameTimer = null; }
    var panel = gamePanel();
    if (panel) panel.remove();
    schedule();
  }

  function ensureGamePanel() {
    var existing = gamePanel();
    if (existing) {
      existing.focus();
      return existing;
    }
    var panel = doc.createElement("div");
    panel.setAttribute("data-dsh-whale-game", "true");
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "小游戏：戳泡泡");
    panel.setAttribute("tabindex", "-1");
    panel.innerHTML = "";
    var head = doc.createElement("div");
    head.setAttribute("data-dsh-whale-game-head", "true");
    var score = doc.createElement("span");
    score.setAttribute("data-dsh-whale-game-score", "true");
    score.textContent = "得分 0";
    var time = doc.createElement("span");
    time.setAttribute("data-dsh-whale-game-time", "true");
    time.textContent = "30s";
    var combo = doc.createElement("span");
    combo.setAttribute("data-dsh-whale-game-combo", "true");
    combo.textContent = "";
    var best = doc.createElement("span");
    best.setAttribute("data-dsh-whale-game-best", "true");
    best.textContent = "最佳 " + (gameStats ? gameStats.best : 0);
    head.appendChild(score);
    head.appendChild(time);
    head.appendChild(combo);
    head.appendChild(best);
    panel.appendChild(head);
    var grid = doc.createElement("div");
    grid.setAttribute("data-dsh-whale-game-grid", "true");
    for (var i = 0; i < core.GAME.GRID * core.GAME.GRID; i += 1) {
      (function (cell) {
        var btn = doc.createElement("button");
        btn.type = "button";
        btn.setAttribute("data-dsh-whale-cell", String(cell));
        btn.setAttribute("aria-label", "第 " + (cell + 1) + " 格");
        btn.addEventListener("pointerdown", function (event) {
          event.preventDefault();
          event.stopPropagation();
          onGamePop(cell);
        });
        grid.appendChild(btn);
      })(i);
    }
    panel.appendChild(grid);
    var paused = doc.createElement("div");
    paused.setAttribute("data-dsh-whale-game-paused", "true");
    paused.textContent = "⏸ 已暂停";
    paused.hidden = true;
    panel.appendChild(paused);
    doc.body.appendChild(panel);
    panel.addEventListener("keydown", onGameKeydown);
    panel.focus();
    return panel;
  }

  function gamePauseBadge(on, reason) {
    var badge = doc.querySelector("[data-dsh-whale-game-paused]");
    if (!badge) return;
    badge.hidden = !on;
    if (on) badge.textContent = reason === "hidden" ? "⏸ 页面已隐藏，回来继续" : "⏸ 已暂停";
  }

  function openGame() {
    if (!readPref("game")) return;
    if (gameOpen) return;
    if (catchOpen) closeCatchGame();
    loadGameStats();
    gameState = core.gameNewState(Date.now(), Math.random);
    gameOpen = true;
    gamePausedFlag = false;
    gameCursor = 0;
    var panel = ensureGamePanel();
    var oldOverlay = panel.querySelector("[data-dsh-whale-game-overlay]");
    if (oldOverlay) oldOverlay.remove();
    gamePauseBadge(false);
    showMood("game-think", 5000, true);
    gameTimer = root.setInterval(gameTickLoop, 250);
    schedule();
  }

  function renderGamePanel() {
    var panel = gamePanel();
    if (!panel || !gameState) return;
    var score = panel.querySelector("[data-dsh-whale-game-score]");
    var time = panel.querySelector("[data-dsh-whale-game-time]");
    var combo = panel.querySelector("[data-dsh-whale-game-combo]");
    var best = panel.querySelector("[data-dsh-whale-game-best]");
    if (score) score.textContent = "得分 " + gameState.score;
    if (time) time.textContent = Math.ceil(gameState.remainingMs / 1000) + "s";
    if (combo) combo.textContent = gameState.combo > 1 ? "连击 x" + gameState.combo : "";
    if (best) best.textContent = "最佳 " + (gameStats ? gameStats.best : 0);
    var cells = panel.querySelectorAll("[data-dsh-whale-cell]");
    for (var i = 0; i < cells.length; i += 1) {
      var bubble = gameState.board[i];
      cells[i].textContent = "";
      cells[i].removeAttribute("data-dsh-whale-bubble-kind");
      cells[i].classList.remove("dsh-whale-cursor");
      if (bubble) {
        cells[i].setAttribute("data-dsh-whale-bubble-kind", bubble.kind);
        cells[i].textContent = bubble.kind === "star" ? "⭐" : (bubble.kind === "bomb" ? "💣" : "");
        cells[i].setAttribute("aria-label", "第 " + (i + 1) + " 格，" + (bubble.kind === "bomb" ? "炸弹" : "泡泡"));
      } else {
        cells[i].setAttribute("aria-label", "第 " + (i + 1) + " 格");
      }
      if (i === gameCursor) cells[i].classList.add("dsh-whale-cursor");
    }
  }

  function gameTickLoop() {
    if (!gameOpen || !gameState) return;
    var now = Date.now();
    if (gamePaused()) {
      if (!gamePausedFlag) { gamePausedFlag = true; gamePauseBadge(true, "hidden"); }
      return;
    }
    if (gamePausedFlag) { gamePausedFlag = false; gamePauseBadge(false); }
    var out = core.gameTick(gameState, now, Math.random);
    gameState = out.state;
    renderGamePanel();
    if (gameState.status === "ended") endGame(core.gameResult(gameState));
  }

  function onGamePop(cell) {
    if (!gameOpen || !gameState || gameState.status !== "playing") return;
    if (gamePaused()) return;
    var now = Date.now();
    var out = core.gamePop(gameState, cell, now, Math.random);
    gameState = out.state;
    if (out.hit) {
      var btn = doc.querySelector('[data-dsh-whale-cell="' + cell + '"]');
      if (btn) {
        var rect = btn.getBoundingClientRect();
        fxAt(rect.left + rect.width / 2, rect.top + rect.height / 2, "fx-ripple");
      }
      if (out.kind === "star") spawnParticles(6, now);
      if (out.kind === "bomb") showMood("game-cheat", 2200, true);
      if (out.combo >= 5) showMood("game-happy", 2000, true);
    }
    renderGamePanel();
  }

  function onGameKeydown(event) {
    if (!gameOpen) return;
    var key = event.key;
    if (key === "Escape") { event.preventDefault(); closeGame(); return; }
    if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      var g = core.GAME.GRID;
      var row = Math.floor(gameCursor / g);
      var col = gameCursor % g;
      if (key === "ArrowUp") row = (row + g - 1) % g;
      if (key === "ArrowDown") row = (row + 1) % g;
      if (key === "ArrowLeft") col = (col + g - 1) % g;
      if (key === "ArrowRight") col = (col + 1) % g;
      gameCursor = row * g + col;
      renderGamePanel();
      return;
    }
    if (key === "Enter" || key === " ") { event.preventDefault(); onGamePop(gameCursor); }
  }

  function settleGame(panel, result, againFn, closeFn, extraText) {
    loadGameStats();
    gameStats.plays = (gameStats.plays || 0) + 1;
    var today = dayKeyOf(Date.now());
    if (gameStats.today !== today) { gameStats.today = today; gameStats.playsToday = 0; }
    gameStats.playsToday = (gameStats.playsToday || 0) + 1;
    if (result.grade === "win") gameStats.wins = (gameStats.wins || 0) + 1;
    if (result.comboMax > (gameStats.comboMax || 0)) gameStats.comboMax = result.comboMax;
    var rewardAllowed = core.gameRewardAllowed(gameStats, Date.now());
    if (result.score > (gameStats.best || 0)) {
      gameStats.best = result.score;
      gameStats.highscore = true;
      if (rewardAllowed) applyGrowth({ type: "high-score" }, Date.now(), 0);
    }
    saveGameStats();
    applyQuestSignal("game", 1);
    if (result.grade === "win") applyQuestSignal("game-win", 1);
    var unlocks = core.evaluateGameAchievements(growth ? growth.achievements : [], gameStats);
    if (unlocks.length) {
      growth.achievements = growth.achievements.concat(unlocks);
      saveGrowth();
      try { root.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "growth", value: String(Date.now()) } })); } catch (e) { /* ignore */ }
      announceUnlocks(unlocks);
    }
    if (rewardAllowed) {
      applyGrowth({ type: core.gameReward(result.grade) }, Date.now(), 0);
    }
    showMood(result.grade === "win" ? "game-win" : (result.grade === "draw" ? "game-happy" : "game-lose"), 3400, true);
    if (panel) {
      var overlay = doc.createElement("div");
      overlay.setAttribute("data-dsh-whale-game-overlay", "true");
      var titleText = result.grade === "win" ? "🎉 大胜利！" : (result.grade === "draw" ? "及格！" : "再接再厉～");
      var line = doc.createElement("div");
      line.textContent = titleText + " 得分 " + result.score + " · 最佳 " + gameStats.best + " · 最高连击 " + result.comboMax + (extraText ? " · " + extraText : "") + (rewardAllowed ? "" : "（今日奖励已达上限）");
      overlay.appendChild(line);
      if (unlocks.length) {
        var ach = doc.createElement("div");
        ach.textContent = "🏅 新成就解锁！";
        overlay.appendChild(ach);
      }
      var again = doc.createElement("button");
      again.type = "button";
      again.textContent = "再玩一局";
      again.addEventListener("click", function (event) { event.stopPropagation(); againFn(); });
      var close = doc.createElement("button");
      close.type = "button";
      close.textContent = "关闭";
      close.addEventListener("click", function (event) { event.stopPropagation(); closeFn(); });
      overlay.appendChild(again);
      overlay.appendChild(close);
      panel.appendChild(overlay);
    }
  }

  function endGame(result) {
    if (!gameOpen) return;
    gameOpen = false;
    if (gameTimer) { root.clearInterval(gameTimer); gameTimer = null; }
    settleGame(gamePanel(), result, function () { openGame(); }, function () { closeGame(); });
  }

  /* ---------- mini game 2: catch the snacks ---------- */

  var catchState = null;
  var catchOpen = false;
  var catchTimer = null;

  function catchPanel() {
    return doc.querySelector("[data-dsh-whale-catch]");
  }
  function closeCatchGame() {
    catchOpen = false;
    if (catchTimer) { root.clearInterval(catchTimer); catchTimer = null; }
    var panel = catchPanel();
    if (panel) panel.remove();
    schedule();
  }
  function ensureCatchPanel() {
    var existing = catchPanel();
    if (existing) { existing.focus(); return existing; }
    var panel = doc.createElement("div");
    panel.setAttribute("data-dsh-whale-catch", "true");
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "小游戏：接点心");
    panel.setAttribute("tabindex", "-1");
    var head = doc.createElement("div");
    head.setAttribute("data-dsh-whale-catch-head", "true");
    var score = doc.createElement("span");
    score.setAttribute("data-dsh-whale-catch-score", "true");
    score.textContent = "得分 0";
    var time = doc.createElement("span");
    time.setAttribute("data-dsh-whale-catch-time", "true");
    time.textContent = "30s";
    var combo = doc.createElement("span");
    combo.setAttribute("data-dsh-whale-catch-combo", "true");
    combo.textContent = "";
    var best = doc.createElement("span");
    best.setAttribute("data-dsh-whale-catch-best", "true");
    best.textContent = "最佳 " + (gameStats ? gameStats.best : 0);
    head.appendChild(score);
    head.appendChild(time);
    head.appendChild(combo);
    head.appendChild(best);
    panel.appendChild(head);
    var arena = doc.createElement("div");
    arena.setAttribute("data-dsh-whale-catch-arena", "true");
    var basket = doc.createElement("div");
    basket.setAttribute("data-dsh-whale-catch-basket", "true");
    basket.textContent = "🧺";
    arena.appendChild(basket);
    panel.appendChild(arena);
    var paused = doc.createElement("div");
    paused.setAttribute("data-dsh-whale-catch-paused", "true");
    paused.textContent = "⏸ 页面已隐藏，回来继续";
    paused.hidden = true;
    panel.appendChild(paused);
    doc.body.appendChild(panel);
    panel.addEventListener("keydown", onCatchKeydown);
    arena.addEventListener("pointermove", function (event) {
      if (!catchOpen || !catchState) return;
      var rect = arena.getBoundingClientRect();
      if (rect.width <= 1) return;
      var x = (event.clientX - rect.left) / rect.width;
      catchState = core.catchMove(catchState, x);
      renderCatchPanel();
    });
    panel.focus();
    return panel;
  }
  function renderCatchPanel() {
    var panel = catchPanel();
    if (!panel || !catchState) return;
    var score = panel.querySelector("[data-dsh-whale-catch-score]");
    var time = panel.querySelector("[data-dsh-whale-catch-time]");
    var combo = panel.querySelector("[data-dsh-whale-catch-combo]");
    var best = panel.querySelector("[data-dsh-whale-catch-best]");
    var arena = panel.querySelector("[data-dsh-whale-catch-arena]");
    var basket = panel.querySelector("[data-dsh-whale-catch-basket]");
    if (score) score.textContent = "得分 " + catchState.score;
    if (time) time.textContent = Math.ceil(catchState.remainingMs / 1000) + "s";
    if (combo) combo.textContent = catchState.combo > 1 ? "连击 x" + catchState.combo : "";
    if (best) best.textContent = "最佳 " + (gameStats ? gameStats.best : 0);
    if (basket) basket.style.left = (catchState.basketX * 100) + "%";
    var existing = arena.querySelectorAll("[data-dsh-whale-catch-item]");
    for (var i = 0; i < existing.length; i += 1) existing[i].remove();
    for (var j = 0; j < catchState.items.length; j += 1) {
      var item = catchState.items[j];
      var span = doc.createElement("span");
      span.setAttribute("data-dsh-whale-catch-item", "true");
      span.className = "dsh-whale-catch-" + item.kind;
      span.textContent = item.kind === "star" ? "⭐" : (item.kind === "bomb" ? "💣" : "🍰");
      span.style.left = (item.x * 100) + "%";
      span.style.top = (item.y * 100) + "%";
      arena.appendChild(span);
    }
  }
  function catchPaused() {
    return !catchOpen || doc.hidden;
  }
  function catchTickLoop() {
    if (!catchOpen || !catchState) return;
    var pausedBadge = doc.querySelector("[data-dsh-whale-catch-paused]");
    if (catchPaused()) {
      if (pausedBadge) pausedBadge.hidden = false;
      return;
    }
    if (pausedBadge) pausedBadge.hidden = true;
    var out = core.catchTick(catchState, Date.now(), Math.random);
    catchState = out.state;
    for (var i = 0; i < out.events.length; i += 1) {
      if (out.events[i].kind === "caught" && out.events[i].item === "bomb") showMood("game-cheat", 2200, true);
    }
    renderCatchPanel();
    if (catchState.status === "ended") endCatchGame(core.catchResult(catchState));
  }
  function onCatchKeydown(event) {
    if (!catchOpen) return;
    var key = event.key;
    if (key === "Escape") { event.preventDefault(); closeCatchGame(); return; }
    if (key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      var step = key === "ArrowLeft" ? -0.07 : 0.07;
      catchState = core.catchMove(catchState, catchState.basketX + step);
      renderCatchPanel();
    }
  }
  function openCatchGame() {
    if (!readPref("game")) return;
    if (catchOpen) return;
    if (gameOpen) closeGame();
    loadGameStats();
    catchState = core.catchNewState(Date.now(), Math.random);
    catchOpen = true;
    ensureCatchPanel();
    showMood("game-think", 5000, true);
    catchTimer = root.setInterval(catchTickLoop, 100);
    schedule();
  }
  function endCatchGame(result) {
    if (!catchOpen) return;
    catchOpen = false;
    if (catchTimer) { root.clearInterval(catchTimer); catchTimer = null; }
    settleGame(catchPanel(), result, function () { openCatchGame(); }, function () { closeCatchGame(); }, "接到 " + result.caught + " 个");
  }

  /* ---------- state plumbing ---------- */

  var growth = null;
  var dialogueCounters = { daily: {}, work: {}, interact: {}, keyword: {}, bond: {}, context: {}, meme: {} };

  function loadGrowth() {
    try {
      var since = root.localStorage.getItem("whale-moe:companionSince");
      if (since === null) {
        since = String(Date.now());
        try { root.localStorage.setItem("whale-moe:companionSince", since); } catch (e) { /* ignore */ }
      }
      growth = {
        mood: Number(root.localStorage.getItem("whale-moe:mood")) || core.DEFAULT_GROWTH.mood,
        affinity: Number(root.localStorage.getItem("whale-moe:affinity")) || 0,
        satiety: Number(root.localStorage.getItem("whale-moe:satiety")) || core.DEFAULT_GROWTH.satiety,
        lastSignin: root.localStorage.getItem("whale-moe:lastSignin") || "",
        signinStreak: Number(root.localStorage.getItem("whale-moe:signinStreak")) || 0,
        achievements: (root.localStorage.getItem("whale-moe:achievements") || "").split(",").filter(Boolean),
        level: Number(root.localStorage.getItem("whale-moe:level")) || 1,
        companionSince: Number(since) || Date.now()
      };
    } catch (e) { growth = Object.assign({}, core.DEFAULT_GROWTH, { companionSince: Date.now() }); }
  }
  function saveGrowth() {
    try {
      root.localStorage.setItem("whale-moe:mood", String(Math.round(growth.mood)));
      root.localStorage.setItem("whale-moe:affinity", String(Math.round(growth.affinity)));
      root.localStorage.setItem("whale-moe:satiety", String(Math.round(growth.satiety)));
      root.localStorage.setItem("whale-moe:lastSignin", growth.lastSignin);
      root.localStorage.setItem("whale-moe:signinStreak", String(growth.signinStreak));
      root.localStorage.setItem("whale-moe:achievements", growth.achievements.join(","));
      root.localStorage.setItem("whale-moe:level", String(growth.level));
      if (growth.companionSince) root.localStorage.setItem("whale-moe:companionSince", String(growth.companionSince));
    } catch (e) { /* storage unavailable */ }
  }
  function syncCompanionAchievements(now) {
    if (!growth || !growth.companionSince) return;
    var days = Math.max(0, Math.floor((now - growth.companionSince) / 86400000));
    var tiers = [{ id: "day1", days: 1 }, { id: "day7", days: 7 }, { id: "day30", days: 30 }];
    var unlocks = tiers.filter(function (tier) { return days >= tier.days && growth.achievements.indexOf(tier.id) === -1; }).map(function (tier) { return tier.id; });
    if (unlocks.length) {
      growth.achievements = growth.achievements.concat(unlocks);
      saveGrowth();
      try { root.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "growth", value: String(Date.now()) } })); } catch (e) { /* ignore */ }
      announceUnlocks(unlocks);
    }
  }

  function applyGrowth(event, now, pats) {
    var out = core.computeGrowth(growth, event, now, pats);
    growth = out.growth;
    saveGrowth();
    if (out.leveledUp) onBondLevelUp();
    try { root.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "growth", value: String(Date.now()) } })); } catch (e) { /* ignore */ }
    return out;
  }
  function say(bank, event) {
    if (!readPref("chat")) return "";
    dialogueCounters[bank] = dialogueCounters[bank] || {};
    dialogueCounters[bank][event] = (dialogueCounters[bank][event] || 0) + 1;
    var line = core.pickDialogue(bank, event, dialogueCounters[bank][event], Math.random);
    if (growth && (bank === "interact" || bank === "work")) {
      var tier = core.moodTier(growth.mood);
      if (tier === "low" && Math.random() < 0.15) {
        line = core.pickDialogue("bond", "low-mood", dialogueCounters[bank][event], Math.random);
      } else if (tier === "high" && Math.random() < 0.15) {
        line = core.pickDialogue("bond", "high-mood", dialogueCounters[bank][event], Math.random);
      }
    }
    return line;
  }

  /* ---------- daily quests / weekly signin / bond ---------- */

  var quests = null;
  var weekSignin = null;

  function loadQuests() {
    try {
      var raw = root.localStorage.getItem("whale-moe:quests");
      quests = raw ? JSON.parse(raw) : null;
    } catch (e) { quests = null; }
    return quests;
  }
  function saveQuests() {
    try { root.localStorage.setItem("whale-moe:quests", JSON.stringify(quests)); } catch (e) { /* ignore */ }
  }
  function loadWeekSignin() {
    try {
      var raw = root.localStorage.getItem("whale-moe:weekSignin");
      weekSignin = raw ? JSON.parse(raw) : null;
    } catch (e) { weekSignin = null; }
    return weekSignin;
  }
  function saveWeekSignin() {
    try { root.localStorage.setItem("whale-moe:weekSignin", JSON.stringify(weekSignin)); } catch (e) { /* ignore */ }
  }
  function refreshQuestsIfNeeded(now) {
    if (!quests) loadQuests();
    var refreshed = core.refreshQuests(quests, now, Math.random);
    if (refreshed !== quests) { quests = refreshed; saveQuests(); }
  }
  function applyQuestSignal(metric, amount) {
    if (!quests) loadQuests();
    var out = core.computeQuests(quests, { metric: metric, amount: amount }, Date.now());
    quests = out.quests;
    saveQuests();
    return out;
  }
  function claimQuestById(id) {
    if (!quests) loadQuests();
    var out = core.claimQuest(quests, id, Date.now());
    quests = out.quests;
    saveQuests();
    if (!out.claimed) return false;
    applyGrowth({ type: "quest" }, Date.now(), 0);
    if (out.newlyAll) applyGrowth({ type: "questAll" }, Date.now(), 0);
    var unlocks = core.evaluateQuestAchievements(growth, quests, weekSignin);
    if (unlocks.length) {
      growth.achievements = growth.achievements.concat(unlocks);
      saveGrowth();
      try { root.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "growth", value: String(Date.now()) } })); } catch (e) { /* ignore */ }
      announceUnlocks(unlocks);
    }
    burst("🎯");
    if (!BUSY_STATES[memory.state.state]) showMood("daily-done", 3200, true);
    if (!BUSY_STATES[memory.state.state] && readPref("chat") && bubbleFree()) {
      var doneLine = core.pickDialogueAvoidRecent("idleAction", "daily-done", 0, Math.random, recentLines);
      if (doneLine) showChatLine(doneLine);
    }
    root.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "quests", value: 1 } }));
    return true;
  }
  function syncWeekSignin(now) {
    if (!weekSignin) loadWeekSignin();
    var out = core.computeWeekSignin(weekSignin, dayKeyOf(now), now);
    weekSignin = out.weekSignin;
    saveWeekSignin();
    try { root.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "growth", value: String(Date.now()) } })); } catch (e) { /* ignore */ }
    if (out.milestoneHit === "7") {
      applyGrowth({ type: "weekly" }, now, 0);
      var unlocks = core.evaluateQuestAchievements(growth, quests, weekSignin);
      if (unlocks.length) {
        growth.achievements = growth.achievements.concat(unlocks);
        saveGrowth();
        try { root.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "growth", value: String(Date.now()) } })); } catch (e) { /* ignore */ }
        announceUnlocks(unlocks);
      }
    }
    return out.milestoneHit;
  }
  function applyBadge(id) {
    try { root.localStorage.setItem("whale-moe:badge", String(id || "")); } catch (e) { /* ignore */ }
    root.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: "badge", value: id || "" } }));
  }
  function maybeFestival(now) {
    var pose = core.festivalKey(now);
    if (!pose) return;
    var today = dayKeyOf(now);
    try {
      if (root.localStorage.getItem("whale-moe:festivalShown") === today) return;
      root.localStorage.setItem("whale-moe:festivalShown", today);
    } catch (e) { /* ignore */ }
    if (!BUSY_STATES[memory.state.state]) showMood(pose, 7000, true);
    if (readPref("chat")) {
      var line = core.pickDialogue("daily", "holiday", 0, Math.random);
      if (line) showChatLine(line);
    }
  }
  function onBondLevelUp() {
    if (!growth) return;
    var unlocks = core.bondUnlocks(growth.level);
    if (unlocks.action && IDLE_ACTION_POOL.indexOf("wink") === -1) IDLE_ACTION_POOL.push("wink");
    var line = "";
    if (growth.level >= 7 && unlocks.egg) line = say("bond", "l7");
    else if (growth.level >= 5 && unlocks.badge) line = say("bond", "l5");
    else if (unlocks.action) line = say("bond", "l3");
    if (line && !BUSY_STATES[memory.state.state] && readPref("chat")) showLine(localizeLine(line));
    if (!BUSY_STATES[memory.state.state]) showMood("levelup", 4200, true);
  }
  function title() {
    try { var t = root.localStorage.getItem("whale-moe:title"); return t && t.trim() ? t.trim() : "主人"; } catch (e) { return "主人"; }
  }
  function localizeLine(line) {
    return String(line).split("主人").join(title());
  }
  function isNight(now) {
    var h = new Date(now || Date.now()).getHours();
    var nightOn = true;
    try { nightOn = root.localStorage.getItem("whale-moe:night") !== "0"; } catch (e) { /* default on */ }
    return nightOn && (h >= 22 || h < 6);
  }

  var STATE_HOLD_MS = Object.freeze({ success: 3000, failure: 3500, curious: 2500, tool: 1200, thinking: 1200 });
  var STATE_CHIP = Object.freeze({ thinking: "思考中", tool: "工作中", success: "完成", failure: "出错", curious: "好奇" });
  var BUSY_STATES = Object.freeze({ thinking: 1, tool: 1, success: 1, failure: 1 });

  function blinkOnce() {
    var rootNode = doc.querySelector("[data-dsh-whale-root]");
    if (!rootNode || motionReduced() || memory.state.state !== "idle") return;
    stopIdleBlink();
    startIdleBlink();
  }
  root.DshWhaleMoeBlink = blinkOnce;
  root.DshWhaleMoeMood = showMood;

  function showChip(label, persist) {
    var rootNode = doc.querySelector("[data-dsh-whale-root]");
    if (!rootNode || motionReduced()) return;
    var old = rootNode.querySelector("[data-dsh-whale-chip]");
    if (old) old.remove();
    var chip = doc.createElement("span");
    chip.setAttribute("data-dsh-whale-chip", "true");
    chip.textContent = label;
    rootNode.appendChild(chip);
    if (!persist) root.setTimeout(function () { chip.remove(); }, 2200);
  }

  var memory = {
    view: "home",
    viewChangedAt: -Infinity,
    lastInteractionAt: Date.now(),
    state: { state: "idle", lastSpeechAt: -Infinity },
    idleTick: 0,
    idlePoseIndex: 0,
    idlePoseFor: 9000,
    lastIdlePoseAt: 0,
    nextIdleMicroAt: 0,
    nextIdleActionAt: 0,
    failureStreak: 0,
    lastGrowthTick: 0,
    stateHoldUntil: 0,
    lastEventState: "",
    moodPose: "",
    moodUntil: 0,
    moodAnimate: false,
    celebrationVisible: false,
    currentTypingLine: "",
    pendingLine: "",
    bubbleOutTimer: null,
    lastPoseSrc: "",
    lastLine: "",
    bubbleHideAt: 0,
    failed: false
  };

  function collectSignals() {
    return {
      view: "home",
      waiting: false,
      thinking: false,
      tool: false,
      successAt: -Infinity,
      error: false,
      curiousAt: -Infinity,
      lastInteraction: memory.lastInteractionAt,
      denseCode: false
    };
  }

  function render(computed) {
    if (!readPref("pet") || !computed || computed.state === "hidden") {
      removeRoot();
      root.__dshWhaleMoeDebug = { state: "hidden", pose: null, line: "", view: memory.view };
      return;
    }
    var rootNode = ensureRoot();
    var frame = rootNode.querySelector("[data-dsh-whale-frame]");
    var bubble = rootNode.querySelector("[data-dsh-whale-bubble]");
    var bubbleText = rootNode.querySelector("[data-dsh-whale-bubble-text]");
    var view = memory.view;

    /* layout routing */
    var layout = resolveLayout(view, computed);
    var moodActive = memory.moodUntil > Date.now() && !!memory.moodPose;
    /* 工作态优先级最高：只要在忙，情绪姿势一律让位给 running，
       只有点击互动专用的 work-pat/work-ram 可以短暂覆盖。 */
    var moodAllowed = BUSY_STATES[computed.state] !== 1 || memory.moodPose === "work-pat" || memory.moodPose === "work-ram";
    if (!layout || layout.hidden) {
      rootNode.style.display = "none";
    } else {
      if (moodActive && moodAllowed) {
        layout.src = ASSET_ROOT + "dsh-whale-state-" + memory.moodPose + ".webp";
      }
      placeAt(rootNode, layout.x, layout.y, layout.w, layout.h);
      rootNode.style.width = layout.w + "px";
      rootNode.style.height = layout.h + "px";
      frame.style.width = layout.w + "px";
      frame.style.height = layout.h + "px";
      frame.style.cursor = layout.kind === "float" ? "grab" : "pointer";
      rootNode.setAttribute("data-dsh-whale-mode", layout.kind);
      if (layout.kind === "mini") rootNode.setAttribute("data-dsh-whale-dense", "true");
      else rootNode.removeAttribute("data-dsh-whale-dense");
      /* 忙闲视觉：工作中持续亮状态签 + 光晕，空闲立即撤掉 */
      if (BUSY_STATES[computed.state] === 1) {
        rootNode.setAttribute("data-dsh-whale-busy", "true");
        var chipNow = rootNode.querySelector("[data-dsh-whale-chip]");
        if (!chipNow || chipNow.textContent !== STATE_CHIP[computed.state]) showChip(STATE_CHIP[computed.state], true);
      } else {
        rootNode.removeAttribute("data-dsh-whale-busy");
        var idleChip = rootNode.querySelector("[data-dsh-whale-chip]");
        if (idleChip) idleChip.remove();
      }
    }
    if (!layout.hidden) setPose(layout.src, true, moodActive ? memory.moodAnimate : true);

    /* celebration override: 3 quick pats — type once, then keep the finished
       bubble stable so repeated renders/reconciles can never re-jump it */
    if (Date.now() < celebrateUntil && view !== "settings" && readPref("chat")) {
      var celebLine = localizeLine("诶嘿～最喜欢主人啦！");
      if (!memory.celebrationVisible) {
        memory.celebrationVisible = true;
        memory.lastLine = celebLine;
        typeBubble(bubbleText, celebLine);
        bubble.hidden = false;
        memory.bubbleHideAt = Date.now() + 4500;
        bubble.classList.remove("dsh-whale-pop");
        void bubble.offsetWidth;
        bubble.classList.add("dsh-whale-pop");
      }
      return;
    }
    if (memory.celebrationVisible) memory.celebrationVisible = false;

    /* Manual desktop dialogue remains visible until its expiry. */
    if (!bubble.hidden && Date.now() > memory.bubbleHideAt && !typingTimer && !nextTimer) {
      if (!memory.bubbleOutTimer) {
        bubble.classList.add("dsh-whale-out");
        memory.bubbleOutTimer = root.setTimeout(function () {
          memory.bubbleOutTimer = null;
          bubble.hidden = true;
          bubble.classList.remove("dsh-whale-out");
        }, 200);
      }
    }

    memory.state = computed;
    memory.lastLine = computed.line;
    root.__dshWhaleMoeDebug = { state: computed.state, pose: computed.pose, line: computed.line, view: view, mode: readMode(), layout: layout.kind, failed: memory.failed, lastEventState: memory.lastEventState, stateHoldUntil: memory.stateHoldUntil, holdLeft: Math.max(0, memory.stateHoldUntil - Date.now()), moodPose: memory.moodPose, moodUntil: memory.moodUntil, moodAnimate: memory.moodAnimate, layers: { active: layerState.active, loaded: layerState.loaded, gen: layerState.gen, pendingSwap: layerState.pendingSwap, pendingSince: layerState.pendingSince }, at: Date.now(), idleChat: { nextAt: idleChat.nextAt, lastGreetAt: idleChat.lastGreetAt, lastGreetBucket: idleChat.lastGreetBucket }, weather: weatherSummary() };
  }

  /* 待机 base 稳定为 idle-cute；情绪动作只由随机低频的 showMood 覆盖。
     拖拽中显示“被拎起来”并交给 CSS 左右摇摆。 */
  function statePose(computed, view) {
    if (dragState && dragState.moved) return "pick-up";
    /* 忙时情绪让位：running 优先，仅点击互动专用的两个姿势可覆盖 */
    var busy = BUSY_STATES[computed.state] === 1;
    var moodOk = !busy || memory.moodPose === "work-pat" || memory.moodPose === "work-ram";
    if (memory.moodUntil > Date.now() && memory.moodPose && moodOk) return memory.moodPose;
    if (computed.state === "idle") return "idle-cute";
    return computed.pose;
  }

  function resolveLayout(view, computed) {
    var vw = root.innerWidth;
    var vh = root.innerHeight;
    var mode = readMode();
    if (mode === "float") {
      var saved = readFloatPos();
      var fw = 200;
      var fh = 200;
      /* during an active drag, keep the live pointer position; never snap back */
      var fx = saved ? saved.x : vw - fw - 20;
      var fy = saved ? saved.y : vh - fh - 20;
      if (dragState && dragState.node) {
        fx = parseFloat(dragState.node.style.left) || fx;
        fy = parseFloat(dragState.node.style.top) || fy;
      }
      return {
        hidden: false, kind: "float", w: fw, h: fh,
        src: ASSET_ROOT + "dsh-whale-state-" + statePose(computed, view) + ".webp",
        x: clamp(fx, 8, vw - fw - 8),
        y: clamp(fy, 8, vh - fh - 8)
      };
    }

    /* mini corner */
    var mw = 64;
    var mh = 64;
    return {
      hidden: false, kind: "mini", w: mw, h: mh,
      src: ASSET_ROOT + "dsh-whale-state-" + statePose(computed, view) + ".webp",
      x: vw - mw - 14,
      y: vh - mh - 14
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function placeAt(rootNode, x, y, width, height) {
    rootNode.style.display = "block";
    rootNode.style.left = Math.round(clamp(x, 8, root.innerWidth - width - 8)) + "px";
    rootNode.style.top = Math.round(clamp(y, 8, root.innerHeight - height - 8)) + "px";
  }

  /* ---------- reconcile / lifecycle ---------- */

  function safeReconcile() {
    try {
      reconcile();
    } catch (error) {
      if (!memory.failed) {
        memory.failed = true;
        if (root.console && root.console.warn) root.console.warn("[dsh-whale-moe] presenter disabled after error:", error);
      }
      root.__dshWhaleMoeDebug = { state: "hidden", pose: null, line: "", view: memory.view, failed: true, error: String(error) };
      removeRoot();
    }
  }

  function reconcile() {
    if (!doc.body) return;
    var view = "home";
    var now = Date.now();
    if (!growth) loadGrowth();
    syncCompanionAchievements(now);
    refreshQuestsIfNeeded(now);
    if (!memory.lastGrowthTick) { memory.lastGrowthTick = now; applyGrowth({ type: "signin" }, now, 0); applyQuestSignal("signin", 1); syncWeekSignin(now); maybeFestival(now); }
    else if (now - memory.lastGrowthTick >= 60000) {
      var deltaMin = (now - memory.lastGrowthTick) / 60000;
      memory.lastGrowthTick = now;
      applyGrowth({ type: "tick", deltaMin: deltaMin }, now, 0);
    }
    if (isNight(now)) doc.body.setAttribute("data-dsh-whale-night", "true");
    else doc.body.removeAttribute("data-dsh-whale-night");
    if (view !== memory.view) {
      memory.view = view;
      memory.viewChangedAt = now;
    }
    var signals = collectSignals();
    var computed = core.computeState(memory.state, signals, now, Math.random);
    render(computed);
    weatherFxReconcile(computed);
    if (readPref("pet")) idleChatTick(now);
  }

  var scheduled = false;
  function schedule() {
    root.__dshWhaleMoeScheduleCalls = (root.__dshWhaleMoeScheduleCalls || 0) + 1;
    root.__dshWhaleMoeScheduleSkipped = (root.__dshWhaleMoeScheduleSkipped || 0) + (scheduled || memory.failed ? 1 : 0);
    if (scheduled || memory.failed) return;
    scheduled = true;
    root.setTimeout(function () {
      scheduled = false;
      safeReconcile();
    }, DEBOUNCE_MS);
  }

  /* ---------- weather service (Open-Meteo, no key required) ---------- */
  var WEATHER_REFRESH_MIN = 30 * 60000;
  var WEATHER_REFRESH_MAX = 60 * 60000;
  var WEATHER_DATA_MS = 2 * 3600000;
  var recentLines = [];
  var weatherState = {
    city: readWeather("weatherCity"),
    key: readWeather("weatherKey"),
    coords: readCoords(),
    current: null,
    fetchedAt: 0,
    lastToldKind: "",
    nextRefreshAt: 0,
    retryAt: 0,
    status: ""
  };

  function readWeather(key) {
    try { return root.localStorage.getItem("whale-moe:" + key) || ""; } catch (e) { return ""; }
  }
  function readCoords() {
    try {
      var lat = root.localStorage.getItem("whale-moe:weatherLat");
      var lon = root.localStorage.getItem("whale-moe:weatherLon");
      if (lat === null || lon === null) return null;
      return { lat: Number(lat), lon: Number(lon) };
    } catch (e) { return null; }
  }
  function writeCoords(coords) {
    try {
      if (coords) {
        root.localStorage.setItem("whale-moe:weatherLat", String(coords.lat));
        root.localStorage.setItem("whale-moe:weatherLon", String(coords.lon));
      } else {
        root.localStorage.removeItem("whale-moe:weatherLat");
        root.localStorage.removeItem("whale-moe:weatherLon");
      }
    } catch (e) { /* storage unavailable */ }
  }

  function weatherJson(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = root.setTimeout(function () {
        if (ctrl) ctrl.abort();
        reject(new Error("weather timeout"));
      }, timeoutMs || 7000);
      root.fetch(url, { signal: ctrl ? ctrl.signal : undefined, headers: { Accept: "application/json" } }).then(function (res) {
        if (!res.ok) throw new Error("weather http " + res.status);
        return res.json();
      }).then(function (json) {
        root.clearTimeout(timer);
        resolve(json);
      }).catch(function (error) {
        root.clearTimeout(timer);
        reject(error);
      });
    });
  }

  function weatherKeyParam() {
    var key = readWeather("weatherKey").trim();
    return key ? "&apikey=" + encodeURIComponent(key) : "";
  }

  function geocodeCity(city) {
    var url = "https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(city) + "&count=1&language=zh&format=json" + weatherKeyParam();
    return weatherJson(url, 8000).then(function (json) {
      if (!json || !json.results || !json.results.length) throw new Error("city not found");
      return { lat: Number(json.results[0].latitude), lon: Number(json.results[0].longitude), name: json.results[0].name || city };
    });
  }

  function fetchWeather(city, key) {
    var useCity = (city || readWeather("weatherCity")).trim();
    if (!useCity) return Promise.reject(new Error("no city"));
    var cached = weatherState.coords;
    var coordsP = cached ? Promise.resolve(cached) : geocodeCity(useCity);
    return coordsP.then(function (coords) {
      weatherState.coords = coords;
      writeCoords(coords);
      var url = "https://api.open-meteo.com/v1/forecast?latitude=" + coords.lat + "&longitude=" + coords.lon + "&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&timezone=auto" + weatherKeyParam();
      return weatherJson(url, 8000).then(function (json) {
        if (!json || !json.current) throw new Error("no current weather");
        weatherState.current = {
          temp: Number(json.current.temperature_2m),
          code: String(json.current.weather_code),
          wind: Number(json.current.wind_speed_10m || 0),
          humidity: Number(json.current.relative_humidity_2m || 0)
        };
        weatherState.fetchedAt = Date.now();
        weatherState.retryAt = 0;
        weatherState.nextRefreshAt = weatherState.fetchedAt + WEATHER_REFRESH_MIN + Math.floor(Math.random() * (WEATHER_REFRESH_MAX - WEATHER_REFRESH_MIN));
        weatherState.status = "ok";
        schedule();
        return weatherState.current;
      });
    });
  }

  function weatherEnsure(force) {
    var now = Date.now();
    var city = readWeather("weatherCity").trim();
    if (!city) return Promise.resolve(null);
    if (weatherState.city !== city || weatherState.key !== readWeather("weatherKey")) {
      weatherState.city = city;
      weatherState.key = readWeather("weatherKey");
      weatherState.coords = null;
      writeCoords(null);
    }
    var fresh = weatherState.current && now - weatherState.fetchedAt < WEATHER_DATA_MS;
    if (force || (!fresh && now >= weatherState.nextRefreshAt && now >= weatherState.retryAt)) {
      return fetchWeather(city).catch(function () {
        weatherState.status = "error";
        weatherState.retryAt = now + 60 * 60000;
        return null;
      });
    }
    return Promise.resolve(weatherState.current);
  }

  function weatherSummary() {
    if (!weatherState.current) return null;
    var w = core.weatherText(weatherState.current.code);
    return { temp: weatherState.current.temp, emoji: w.emoji, label: w.label, kind: w.kind, wind: weatherState.current.wind };
  }

  function weatherLine(now, counter) {
    var summary = weatherSummary();
    if (!summary) return "";
    var line = core.pickDialogueAvoidRecent("weather", summary.kind, counter || 0, Math.random, recentLines);
    if (!line) return "";
    var tail = " · 现在 " + Math.round(summary.temp) + "°C " + summary.label;
    return line + tail;
  }

  function weatherChangedSinceTold() {
    var summary = weatherSummary();
    return summary && summary.kind !== weatherState.lastToldKind;
  }

  root.__dshWhaleMoeWeather = weatherState;
  root.DshWhaleMoeWeatherTest = function (city, key) {
    var useCity = (city || readWeather("weatherCity")).trim();
    if (!useCity) return Promise.reject(new Error("请先填写城市"));
    var beforeCoords = weatherState.coords;
    var beforeKey = weatherState.key;
    if (key !== undefined && key !== null) {
      try { root.localStorage.setItem("whale-moe:weatherKey", String(key)); } catch (e) {}
    }
    weatherState.coords = null;
    return fetchWeather(useCity, key || "").then(function () {
      var s = weatherSummary();
      return "✅ 已连通：" + useCity + " " + Math.round(s.temp) + "°C " + s.label;
    }).catch(function (error) {
      weatherState.coords = beforeCoords;
      weatherState.key = beforeKey;
      throw error;
    });
  };

  /* ---------- weather visual fx (gated canvas layer) ----------
     rAF 门控例外(相对文件头 "no ambient rAF" 约定):
     仅在 motion/flash kind 激活 && 特效开关开 && 城市已填 && 天气新鲜(<2h)
     && 非 forced-colors && 非 reduced-motion && 页面可见时运行;
     任一条件翻转即 weatherFxStop() 取消循环并摘除节点,不养常驻循环。 */

  var WEATHER_FX_PARTICLE_MAX = 160;
  var weatherFxState = {
    canvas: null, ctx: null, rafId: 0, kind: "", mode: "", intensity: 1,
    particles: [], lastFrame: 0, nextFlashAt: 0, flashUntil: 0,
    running: false, busy: false, staticOnly: false, dpr: 1, frameMs: 0,
    viewport: { left: 0, top: 0, width: 0, height: 0 }
  };

  function forcedColorsActive() {
    try { return root.matchMedia("(forced-colors: active)").matches; } catch (e) { return false; }
  }
  function weatherFxCurrent() {
    if (!weatherState.current) return null;
    return core.weatherFx(weatherState.current.code, weatherState.current.temp, weatherState.current.wind);
  }
  function weatherFxGate(computed) {
    var enabled = readPref("weatherFx")
      && readWeather("weatherCity").trim().length > 0
      && weatherState.current
      && Date.now() - weatherState.fetchedAt < WEATHER_DATA_MS
      && !forcedColorsActive();
    var staticOnly = false;
    if (enabled && motionReduced()) { staticOnly = true; }
    var busy = !!(computed && BUSY_STATES[computed.state] === 1);
    return { enabled: enabled, busy: busy, staticOnly: staticOnly };
  }
  function ensureFxLayer() {
    var existing = doc.querySelector("[data-dsh-whale-weather-fx]");
    if (existing) {
      weatherFxState.canvas = existing;
      weatherFxState.ctx = existing.getContext("2d");
      return existing;
    }
    var canvas = doc.createElement("canvas");
    canvas.setAttribute("data-dsh-whale-weather-fx", "true");
    doc.body.appendChild(canvas);
    weatherFxState.canvas = canvas;
    weatherFxState.ctx = canvas.getContext("2d");
    return canvas;
  }
  function weatherFxSize() {
    var canvas = weatherFxState.canvas;
    if (!canvas || !weatherFxState.ctx) return;
    var dpr = Math.min(root.devicePixelRatio || 1, 1.5);
    var viewport = weatherFxViewport();
    var w = viewport.width;
    var h = viewport.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.inset = "auto";
    canvas.style.left = Math.round(viewport.left) + "px";
    canvas.style.top = Math.round(viewport.top) + "px";
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    weatherFxState.dpr = dpr;
    weatherFxState.viewport = viewport;
  }
  function weatherFxViewport() {
    var size = Math.max(1, Math.min(360, root.innerWidth, root.innerHeight));
    var pet = doc.querySelector("[data-dsh-whale-root]");
    var rect = pet && pet.getBoundingClientRect ? pet.getBoundingClientRect() : null;
    var centerX = rect ? rect.left + rect.width / 2 : root.innerWidth / 2;
    var centerY = rect ? rect.top + rect.height / 2 : root.innerHeight / 2;
    return {
      left: clamp(centerX - size / 2, 0, Math.max(0, root.innerWidth - size)),
      top: clamp(centerY - size / 2, 0, Math.max(0, root.innerHeight - size)),
      width: size,
      height: size
    };
  }
  function weatherFxPlaceLayer() {
    if (!weatherFxState.canvas) return;
    var viewport = weatherFxViewport();
    if (viewport.width !== weatherFxState.viewport.width || viewport.height !== weatherFxState.viewport.height) {
      weatherFxSize();
      return;
    }
    weatherFxState.viewport = viewport;
    weatherFxState.canvas.style.left = Math.round(viewport.left) + "px";
    weatherFxState.canvas.style.top = Math.round(viewport.top) + "px";
  }
  function weatherFxSeedParticles(spec) {
    var pool = [];
    var count = Math.min(WEATHER_FX_PARTICLE_MAX, spec.count | 0);
    var w = weatherFxState.viewport.width || root.innerWidth;
    var h = weatherFxState.viewport.height || root.innerHeight;
    for (var i = 0; i < count; i += 1) {
      pool.push({
        x: Math.random() * w,
        y: Math.random() * h,
        phase: Math.random() * Math.PI * 2,
        speed: spec.speed * (0.85 + Math.random() * 0.3),
        length: spec.length || 0,
        size: spec.size || 2,
        opacity: spec.opacity * (0.7 + Math.random() * 0.5)
      });
    }
    return pool;
  }
  function weatherFxDrawStatic(spec) {
    var ctx = weatherFxState.ctx;
    var w = weatherFxState.viewport.width;
    var h = weatherFxState.viewport.height;
    var dpr = weatherFxState.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    /* Keep the transparent desktop overlay free of full-screen tint blocks. */
  }
  function weatherFxDrawMotion(spec, ts, dim) {
    var ctx = weatherFxState.ctx;
    var w = weatherFxState.viewport.width;
    var h = weatherFxState.viewport.height;
    var dpr = weatherFxState.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var kind = weatherFxState.kind;
    var busyDim = dim || 1;
    for (var i = 0; i < weatherFxState.particles.length; i += 1) {
      var p = weatherFxState.particles[i];
      var drift = spec.drift || 0;
      if (kind === "rain") {
        p.y += p.speed / 60;
        p.x += (spec.windDrift || 0) * 0.4 + Math.sin(p.phase) * 2;
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
        ctx.strokeStyle = "rgba(180,200,230," + (p.opacity * busyDim) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 2, p.y - (p.length || 14));
        ctx.stroke();
      } else if (kind === "snow") {
        p.y += p.speed / 60;
        p.x += Math.sin(p.phase + ts / 800) * drift / 30;
        if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
        ctx.fillStyle = "rgba(255,255,255," + (p.opacity * busyDim) + ")";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size || 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === "wind") {
        p.x += p.speed / 60;
        p.y += Math.sin(p.phase) * 0.6;
        if (p.x > w + 160) { p.x = -160; p.y = Math.random() * h; }
        ctx.strokeStyle = "rgba(220,230,245," + (p.opacity * busyDim) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - (p.length || 60), p.y + 2);
        ctx.stroke();
      }
    }
  }
  function weatherFxLoop(ts) {
    if (doc.hidden) { weatherFxStop(); return; }
    var spec = weatherFxCurrent();
    var gate = weatherFxGate(memory.state);
    if (!gate.enabled || !spec) { weatherFxStop(); return; }
    weatherFxPlaceLayer();
    var dim = gate.busy ? 0.6 : 1;
    var intensity = gate.busy ? Math.max(1, spec.intensity - 1) : spec.intensity;
    var now = Date.now();
    if (spec.mode === "static" || gate.staticOnly) {
      if (weatherFxState.staticOnly !== true) {
        weatherFxState.staticOnly = true;
        weatherFxDrawStatic({ tint: spec.params.tint, opacity: spec.params.opacity * dim });
      }
    } else {
      weatherFxState.staticOnly = false;
      weatherFxDrawMotion(spec.params, now, dim);
      if (spec.kind === "thunder" && spec.params.flash) {
        if (!weatherFxState.nextFlashAt) weatherFxState.nextFlashAt = now + spec.params.flash.minMs + Math.random() * (spec.params.flash.maxMs - spec.params.flash.minMs);
        if (now >= weatherFxState.nextFlashAt && now >= weatherFxState.flashUntil) {
          weatherFxState.flashUntil = now + 140;
          weatherFxState.nextFlashAt = now + spec.params.flash.minMs + Math.random() * (spec.params.flash.maxMs - spec.params.flash.minMs);
        }
      }
    }
    weatherFxState.rafId = root.requestAnimationFrame(weatherFxLoop);
  }
  function weatherFxStart(spec) {
    if (weatherFxState.running && weatherFxState.kind === spec.kind && weatherFxState.intensity === spec.intensity) return;
    weatherFxStop();
    ensureFxLayer();
    weatherFxSize();
    weatherFxState.kind = spec.kind;
    weatherFxState.mode = spec.mode;
    weatherFxState.intensity = spec.intensity;
    weatherFxState.particles = (spec.mode === "motion") ? weatherFxSeedParticles(spec.params) : [];
    weatherFxState.staticOnly = false;
    weatherFxState.running = true;
    weatherFxState.lastFrame = Date.now();
    weatherFxState.rafId = root.requestAnimationFrame(weatherFxLoop);
  }
  function weatherFxStop() {
    if (weatherFxState.rafId) { root.cancelAnimationFrame(weatherFxState.rafId); weatherFxState.rafId = 0; }
    weatherFxState.running = false;
    weatherFxState.particles = [];
    weatherFxState.nextFlashAt = 0;
    weatherFxState.flashUntil = 0;
    var nodes = doc.querySelectorAll("[data-dsh-whale-weather-fx]");
    for (var i = 0; i < nodes.length; i += 1) nodes[i].remove();
    weatherFxState.canvas = null;
    weatherFxState.ctx = null;
  }
  function weatherFxReconcile(computed) {
    var gate = weatherFxGate(computed);
    var spec = weatherFxCurrent();
    if (!gate.enabled || !spec) { weatherFxStop(); return; }
    if (!weatherFxState.running || weatherFxState.kind !== spec.kind || weatherFxState.intensity !== spec.intensity) {
      weatherFxStart(spec);
    }
    if (weatherFxState.busy !== gate.busy) weatherFxState.busy = gate.busy;
  }
  root.__dshWhaleMoeWeatherFxDebug = {
    get running() { return weatherFxState.running; },
    get kind() { return weatherFxState.kind; },
    get intensity() { return weatherFxState.intensity; },
    get busy() { return weatherFxState.busy; },
    get particles() { return weatherFxState.particles.length; }
  };

  /* ---------- idle chat scheduler (5-8 min) ---------- */
  var IDLE_CHAT_MIN = 5 * 60000;
  var IDLE_CHAT_MAX = 8 * 60000;
  var GREET_GAP_MS = 3 * 3600000;
  var idleChat = {
    nextAt: Date.now() + IDLE_CHAT_MIN + Math.floor(Math.random() * (IDLE_CHAT_MAX - IDLE_CHAT_MIN)),
    lastGreetAt: -Infinity,
    lastGreetBucket: ""
  };

  function rememberLine(line) {
    if (!line) return;
    recentLines.push(line);
    if (recentLines.length > 12) recentLines.shift();
  }

  function bubbleFree() {
    try {
      var bubble = doc.querySelector("[data-dsh-whale-bubble]");
      return !bubble || bubble.hidden || !(bubble.textContent || "").trim();
    } catch (e) { return true; }
  }

  function showChatLine(line) {
    if (!line) return;
    rememberLine(line);
    showLine(line);
  }

  function desktopActionLine(pose) {
    if (core.DIALOGUE.idleAction && core.DIALOGUE.idleAction[pose]) {
      return core.pickDialogueAvoidRecent("idleAction", pose, 0, Math.random, recentLines);
    }
    if (pose === "greet") {
      return core.pickDialogueAvoidRecent("greet", core.greetBucket(new Date().getHours()), 0, Math.random, recentLines);
    }
    var route = DESKTOP_ACTION_DIALOGUE[pose];
    if (!route) return core.pickDialogueAvoidRecent("daily", "idle", 0, Math.random, recentLines);
    return core.pickDialogueAvoidRecent(route[0], route[1], 0, Math.random, recentLines);
  }

  function showRandomIdleAction() {
    var pose = core.pickIdlePose(growth, Date.now(), Math.random);
    /* avoid immediate repeat */
    if (pose === memory.lastIdleActionPose) {
      var fallback = IDLE_ACTION_POOL.concat(DESKTOP_FALLBACK_ACTIONS);
      fallback = fallback.filter(function (p) { return p !== pose; });
      if (fallback.length) pose = fallback[Math.floor(Math.random() * fallback.length)];
    }
    memory.lastIdleActionPose = pose;
    showMood(pose, 4200 + Math.floor(Math.random() * 1600), true);
    if (!readPref("chat") || !bubbleFree()) return;
    var line = desktopActionLine(pose);
    if (line) showChatLine(line);
  }

  function onDesktopSystemState(event) {
    var state = event && event.detail ? event.detail : {};
    var now = Date.now();
    var idleSeconds = Number(state.idleSeconds);
    if (Number.isFinite(idleSeconds) && idleSeconds >= 0) {
      memory.lastInteractionAt = now - Math.min(idleSeconds, 86400) * 1000;
    }
    if (state.kind === "lock" || state.kind === "suspend") {
      showMood("sleep", 60000, true);
      if (readPref("chat") && bubbleFree()) {
        var sleepLine = core.pickDialogueAvoidRecent("daily", "night", 0, Math.random, recentLines);
        if (sleepLine) showChatLine(sleepLine);
      }
    } else if (state.kind === "unlock" || state.kind === "resume") {
      memory.lastInteractionAt = now;
      showMood("greet", 5200, true);
      if (readPref("chat") && bubbleFree()) {
        var greetLine = core.pickDialogueAvoidRecent("greet", core.greetBucket(new Date(now).getHours()), 0, Math.random, recentLines);
        if (greetLine) showChatLine(greetLine);
      }
    } else if (state.kind === "sample" && idleSeconds < 180 && isNight(now) && now - (memory.lastSystemNightAt || 0) >= 3 * 3600000) {
      memory.lastSystemNightAt = now;
      showMood("night", 5200, true);
      if (readPref("chat") && bubbleFree()) {
        var nightLine = core.pickDialogueAvoidRecent("daily", "night", 0, Math.random, recentLines);
        if (nightLine) showChatLine(nightLine);
      }
    }
    schedule();
  }

  function triggerComputerLink(eventKey, now, urgent) {
    var pose = COMPUTER_LINK_ACTIONS[eventKey];
    if (!pose || doc.hidden || !readPref("computer-link") || !readPref("pet") || !readPref("chat")) return false;
    if (BUSY_STATES[memory.state.state] || !bubbleFree()) return false;
    var perEventGap = /^(offline|online|plugged|unplugged)$/.test(eventKey) ? 60000 : 15 * 60000;
    if (now - (computerLinkState.lastTriggered[eventKey] || 0) < perEventGap) return false;
    if (!urgent && now - computerLinkState.lastAnyAt < 90000) return false;
    var line = core.pickDialogueAvoidRecent("computer", eventKey, 0, Math.random, recentLines);
    if (!line) return false;
    computerLinkState.lastTriggered[eventKey] = now;
    computerLinkState.lastAnyAt = now;
    showMood(pose, 6000, true);
    showChatLine(line);
    return true;
  }

  function onDesktopComputerState(event) {
    if (!readPref("computer-link")) return;
    var sample = event && event.detail ? event.detail : {};
    var now = Number(sample.at) || Date.now();
    var category = sample.foreground && sample.foreground.category ? String(sample.foreground.category) : "other";
    var online = sample.network && typeof sample.network.online === "boolean" ? sample.network.online : null;
    var onBattery = sample.power && typeof sample.power.onBattery === "boolean" ? sample.power.onBattery : null;
    var batteryPercent = sample.power && typeof sample.power.percent === "number" ? sample.power.percent : NaN;
    var charging = sample.power && typeof sample.power.charging === "boolean" ? sample.power.charging : null;
    var cpu = sample.resource && typeof sample.resource.cpuPercent === "number" ? sample.resource.cpuPercent : NaN;
    var memoryUsed = sample.resource && typeof sample.resource.memoryPercent === "number" ? sample.resource.memoryPercent : NaN;
    var candidates = [];

    if (!computerLinkState.initialized) {
      computerLinkState.initialized = true;
      computerLinkState.foregroundCategory = category;
      computerLinkState.online = online;
      computerLinkState.onBattery = onBattery;
      if (category !== "other") candidates.push({ key: category, urgent: false });
    } else {
      if (online !== null && computerLinkState.online !== null && online !== computerLinkState.online) {
        candidates.push({ key: online ? "online" : "offline", urgent: true });
      }
      if (onBattery !== null && computerLinkState.onBattery !== null && onBattery !== computerLinkState.onBattery) {
        candidates.push({ key: onBattery ? "unplugged" : "plugged", urgent: true });
      }
      if (category !== computerLinkState.foregroundCategory && category !== "other") {
        candidates.push({ key: category, urgent: false });
      }
      computerLinkState.foregroundCategory = category;
      computerLinkState.online = online;
      computerLinkState.onBattery = onBattery;
    }

    var lowNow = Number.isFinite(batteryPercent) && batteryPercent <= 20 && charging !== true && onBattery === true;
    if (lowNow && !computerLinkState.batteryLow) candidates.unshift({ key: "battery-low", urgent: true });
    computerLinkState.batteryLow = lowNow || (computerLinkState.batteryLow && Number.isFinite(batteryPercent) && batteryPercent <= 25 && charging !== true);

    computerLinkState.cpuHotSamples = Number.isFinite(cpu) && cpu >= 85 ? computerLinkState.cpuHotSamples + 1 : 0;
    if (computerLinkState.cpuHot && Number.isFinite(cpu) && cpu < 70) computerLinkState.cpuHot = false;
    if (!computerLinkState.cpuHot && computerLinkState.cpuHotSamples >= 2) {
      computerLinkState.cpuHot = true;
      candidates.push({ key: "cpu-high", urgent: false });
    }
    computerLinkState.memoryHotSamples = Number.isFinite(memoryUsed) && memoryUsed >= 85 ? computerLinkState.memoryHotSamples + 1 : 0;
    if (computerLinkState.memoryHot && Number.isFinite(memoryUsed) && memoryUsed < 75) computerLinkState.memoryHot = false;
    if (!computerLinkState.memoryHot && computerLinkState.memoryHotSamples >= 2) {
      computerLinkState.memoryHot = true;
      candidates.push({ key: "memory-high", urgent: false });
    }

    for (var i = 0; i < candidates.length; i += 1) {
      if (triggerComputerLink(candidates[i].key, now, candidates[i].urgent)) break;
    }
    schedule();
  }

  function maybeGreet(now) {
    if (now - idleChat.lastGreetAt < GREET_GAP_MS) return false;
    var bucket = core.greetBucket(new Date(now).getHours());
    if (bucket === "night") return false;
    idleChat.lastGreetAt = now;
    idleChat.lastGreetBucket = bucket;
    var line = core.pickDialogueAvoidRecent("greet", bucket, 0, Math.random, recentLines);
    var summary = weatherSummary();
    if (line && summary) line += " · 现在 " + Math.round(summary.temp) + "°C " + summary.label;
    showChatLine(line);
    return true;
  }

  function idleChatTick(now) {
    var city = readWeather("weatherCity").trim();
    if (memory.state.state !== "idle" || !readPref("chat") || !bubbleFree() || !readPref("pet")) return;
    if (now < idleChat.nextAt) return;

    idleChat.nextAt = now + IDLE_CHAT_MIN + Math.floor(Math.random() * (IDLE_CHAT_MAX - IDLE_CHAT_MIN));
    var line = "";
    var bucket = core.greetBucket(new Date(now).getHours());
    if (now - idleChat.lastGreetAt >= GREET_GAP_MS && bucket !== "night") {
      line = core.pickDialogueAvoidRecent("greet", bucket, 0, Math.random, recentLines);
      idleChat.lastGreetAt = now;
      idleChat.lastGreetBucket = bucket;
    } else if (city) {
      weatherEnsure(false).then(function () {
        if (memory.state.state !== "idle" || !bubbleFree() || !weatherChangedSinceTold()) return;
        var weatherNow = weatherLine(Date.now(), 0);
        if (weatherNow) {
          var summary = weatherSummary();
          weatherState.lastToldKind = summary ? summary.kind : "";
          var weatherPose = "";
          if (summary && weatherState.current) {
            var fxSpec = core.weatherFx(weatherState.current.code, weatherState.current.temp, weatherState.current.wind);
            var fxKind = fxSpec ? fxSpec.kind : summary.kind;
            if (fxKind === "rain") weatherPose = Math.random() < 0.3 ? "weather-rain-happy" : "weather-umbrella";
            else if (fxKind === "snow") weatherPose = "weather-snow";
            else if (fxKind === "cold") weatherPose = "weather-cold";
            else if (fxKind === "thunder") weatherPose = "weather-thunder";
            else if (fxKind === "hot") weatherPose = "daily-melt";
          }
          if (weatherPose) showMood(weatherPose, 6500, true);
          showChatLine(weatherNow);
        }
      });
    }
    if (!line) {
      line = core.pickDialogueAvoidRecent("daily", "idle", 0, Math.random, recentLines);
    }
    if (!line && growth && growth.level >= 3 && Math.random() < 0.25) {
      var tier = core.moodTier(growth.mood);
      var bondEvent = growth.level >= 7 ? "l7" : (growth.level >= 5 ? "l5" : "l3");
      if (tier === "low") bondEvent = "low-mood";
      else if (tier === "high" && Math.random() < 0.5) bondEvent = "high-mood";
      line = core.pickDialogueAvoidRecent("bond", bondEvent, 0, Math.random, recentLines);
    }
    if (!line) {
      var memeBank = Math.random() < 0.5 ? "worker" : (Math.random() < 0.5 ? "slack" : "ddl");
      line = core.pickDialogueAvoidRecent("meme", memeBank, 0, Math.random, recentLines);
    }
    if (line) showChatLine(line);
  }

  root.__dshWhaleMoeIdleChat = idleChat;
  root.__dshWhaleMoeClaimQuest = claimQuestById;
  root.__dshWhaleMoeApplyBadge = applyBadge;
  root.__dshWhaleMoeDesktopAction = function (action) {
    if (action === "feed") {
      var feedOut = applyGrowth({ type: "feed" }, Date.now(), 0);
      applyQuestSignal("feed", 1);
      burst("🍰");
      showMood("eat", 3000);
      var feedLine = say("interact", "feed");
      if (feedLine) showLine(feedLine);
      if (feedOut.unlocks.length) announceUnlocks(feedOut.unlocks);
    } else if (action === "poke") {
      applyGrowth({ type: "poke" }, Date.now(), 0);
      burst("💢");
      showMood("angry", 3000);
      var pokeLine = say("interact", "poke");
      if (pokeLine) showLine(pokeLine);
    } else if (action === "praise") {
      applyGrowth({ type: "praise" }, Date.now(), 0);
      applyQuestSignal("praise", 1);
      burst("✨");
      showMood("tail-swing", 3000, true);
      var praiseLine = say("interact", "praise");
      if (praiseLine) showLine(praiseLine);
    } else if (action === "bubble-game") {
      openGame();
    } else if (action === "catch-game") {
      openCatchGame();
    }
  };

  function onUserActivity() {
    memory.lastInteractionAt = Date.now();
    schedule();
  }

  function start() {
    if (root.__dshWhaleMoeStarted) return;
    root.__dshWhaleMoeStarted = true;
    root.addEventListener("pointerdown", onUserActivity, true);
    root.addEventListener("keydown", onUserActivity, true);
    root.addEventListener("resize", schedule);
    root.addEventListener("storage", schedule);
    root.addEventListener("whale-moe-prefs-change", schedule);
    root.addEventListener("whale-desktop-system-state", onDesktopSystemState);
    root.addEventListener("whale-desktop-computer-state", onDesktopComputerState);
    root.addEventListener("visibilitychange", function () {
      if (doc.hidden) {
        if (gameOpen) { gamePausedFlag = true; gamePauseBadge(true, "hidden"); }
        weatherFxStop();
      } else {
        schedule();
      }
    });
    if (!root.__dshWhaleMoeIdleTimer && !motionReduced()) {
      root.__dshWhaleMoeIdleTimer = root.setInterval(function () {
        var now = Date.now();
        var node = doc.querySelector("[data-dsh-whale-root]");
        if (node && memory.state.state === "idle") {
          /* 微动作：随机 18-28s 一次，幅度轻 */
          if (!memory.nextIdleMicroAt) memory.nextIdleMicroAt = now + 18000 + Math.floor(Math.random() * 10000);
          if (now >= memory.nextIdleMicroAt) {
            memory.nextIdleMicroAt = now + 18000 + Math.floor(Math.random() * 10000);
            var motionNode = node.querySelector("[data-dsh-whale-motion]");
            if (motionNode && !layerState.pendingSwap) {
              var cls = Math.random() < 0.5 ? "dsh-whale-hop" : "dsh-whale-squint";
              motionNode.classList.remove("dsh-whale-hop", "dsh-whale-squint");
              void motionNode.offsetWidth;
              motionNode.classList.add(cls);
              root.setTimeout(function () { motionNode.classList.remove("dsh-whale-hop", "dsh-whale-squint"); }, 900);
            }
          }
          /* 大动作：随机 35-60s 一次，无固定顺序，每张停留 4.2-5.8s。
             D7: 复活低频毒舌(teasing)——仅非工作台视图、待机态、按
             TEASE_CHANCE 概率触发，不进入状态机，工作态稳定规则不受影响。 */
          if (!memory.nextIdleActionAt) memory.nextIdleActionAt = now + 35000 + Math.floor(Math.random() * 25000);
          if (now >= memory.nextIdleActionAt) {
            memory.nextIdleActionAt = now + 35000 + Math.floor(Math.random() * 25000);
            if (Math.random() < core.TEASE_CHANCE * 4) {
              showMood("teasing", 3200, true);
              if (readPref("chat")) {
                var teaseLine = say("interact", "tease");
                if (teaseLine) showChatLine(teaseLine);
              }
            } else {
              showRandomIdleAction();
            }
          }
        }
        schedule();
      }, 3000);
    }
    var gazePending = false;
    root.addEventListener("pointermove", function (event) {
      if (gazePending || motionReduced()) return;
      var mode = readMode();
      if (mode !== "float" && mode !== "side") return;
      var node = doc.querySelector("[data-dsh-whale-root]");
      if (!node) return;
      gazePending = true;
      root.requestAnimationFrame(function () {
        gazePending = false;
        var rect = node.getBoundingClientRect();
        if (rect.width <= 1) return;
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var gx = clamp((event.clientX - cx) / Math.max(rect.width, 48) * 5, -4, 4);
        var gy = clamp((event.clientY - cy) / Math.max(rect.height, 48) * 4, -3, 3);
        node.style.setProperty("--wm-gaze-x", gx.toFixed(2) + "px");
        node.style.setProperty("--wm-gaze-y", gy.toFixed(2) + "px");
        node.style.setProperty("--wm-gaze-r", (gx * 0.3).toFixed(2) + "deg");
      });
    }, { passive: true });

    function init() {
      safeReconcile();
    }
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
  }

  root.__dshWhaleMoeDebug = { state: "boot", pose: null, line: "", view: "home" };
  start();
})(typeof window === "undefined" ? null : window);
