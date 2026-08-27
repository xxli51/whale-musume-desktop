(function () {
  "use strict";

  var storage = window.WhaleStorage;
  var core = window.WhaleHouseCore;
  if (!storage || !core) return;
  var WALK_DURATION = 1600;
  var FURNITURE_STAY_DURATION = 10000;
  var renderGeneration = 0;
  var furnitureReturnTimer = null;
  var furnitureInteractionActive = false;
  var activePetWalk = null;
  var travelTransitionActive = false;
  var LIFE_TARGETS = Object.freeze({
    sleep: Object.freeze({ x: 42, bottom: 38 }),
    pajama: Object.freeze({ x: 42, bottom: 38 }),
    meal: Object.freeze({ x: 70, bottom: 42 }),
    cook: Object.freeze({ x: 72, bottom: 42 }),
    shower: Object.freeze({ x: 30, bottom: 42 }),
    stretch: Object.freeze({ x: 58, bottom: 38 }),
    tidy: Object.freeze({ x: 27, bottom: 42 }),
    paint: Object.freeze({ x: 70, bottom: 42 }),
    game: Object.freeze({ x: 72, bottom: 42 }),
    music: Object.freeze({ x: 62, bottom: 38 }),
    research: Object.freeze({ x: 28, bottom: 42 }),
    code: Object.freeze({ x: 72, bottom: 42 }),
    journal: Object.freeze({ x: 70, bottom: 42 }),
    stargaze: Object.freeze({ x: 61, bottom: 38 })
  });
  var HOME_POSITION = Object.freeze({ x: 50, bottom: 38 });
  var HOUSE_EXIT_POSITION = Object.freeze({ x: -15, bottom: 42 });
  var FURNITURE_INTERACTIONS = Object.freeze({
    "wood-desk": Object.freeze({
      x: 70,
      bottom: 42,
      pose: "thinking",
      line: "这张书桌有木头的香气，坐在这里很容易静下心来。"
    }),
    "book-shelf": Object.freeze({ x: 27, bottom: 42, pose: "curious", line: "这一格放我们的故事，下一格要留给以后。" }),
    "cloud-rug": Object.freeze({
      x: 43,
      bottom: 38,
      pose: "daily-melt",
      line: "云朵地毯软乎乎的……再踩一下也没关系吧。"
    }),
    "moon-lamp": Object.freeze({ x: 71, bottom: 42, pose: "night", line: "月亮灯亮着的时候，小屋就不会觉得孤单。" }),
    "code-desk": Object.freeze({
      x: 70,
      bottom: 42,
      pose: "work-debug",
      line: "让我看看，今天是哪一行代码在偷偷闹脾气？"
    }),
    "paint-easel": Object.freeze({ x: 70, bottom: 42, pose: "daily-painting", line: "这次想画一片有你在的海。" }),
    "tidy-board": Object.freeze({ x: 27, bottom: 42, pose: "sweep", line: "把计划排整齐，心里也会跟着清爽起来。" }),
    "star-scope": Object.freeze({ x: 70, bottom: 42, pose: "star", line: "望远镜里那颗最亮的星，今天也没有迟到。" }),
    "music-box": Object.freeze({ x: 70, bottom: 42, pose: "meme-music", line: "听，像不像海浪把一小段旋律送进来了？" }),
    "game-console": Object.freeze({
      x: 70,
      bottom: 42,
      pose: "daily-gaming",
      line: "就玩一局！这次我一定不会按错键。"
    }),
    "heart-cushion": Object.freeze({ x: 43, bottom: 38, pose: "blush", line: "这个抱枕……抱起来有一点像你陪在旁边。" }),
    "travel-trunk": Object.freeze({
      x: 42,
      bottom: 38,
      pose: "daily-picnic",
      line: "箱子里装着远方，也装着每一次平安回家的记忆。"
    }),
    "shell-mobile": Object.freeze({
      x: 27,
      bottom: 42,
      pose: "achievement",
      line: "每一枚小挂饰，都在替我们记住一次发现。"
    })
  });

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function loadState() {
    try {
      return core.normalizeState(JSON.parse(storage.get("houseState", "{}")));
    } catch (_error) {
      return core.blankState();
    }
  }

  function saveState(state) {
    storage.set("houseState", JSON.stringify(core.normalizeState(state)));
  }

  function adventureState() {
    var status = window.WhaleAdventure && window.WhaleAdventure.status();
    if (status && status.state) return status.state;
    try {
      var state = JSON.parse(storage.get("adventureState", "{}"));
      return window.WhaleAdventureCore ? window.WhaleAdventureCore.normalizeState(state) : state;
    } catch (_error) {
      return {};
    }
  }

  function context() {
    var professions = {};
    var professionStatus = window.WhaleProfession && window.WhaleProfession.status();
    if (professionStatus && professionStatus.state && window.WhaleProfessionCore) {
      window.WhaleProfessionCore.DEFINITIONS.forEach(function (def) {
        professions[def.id] = window.WhaleProfessionCore.levelForXp(professionStatus.state.careers[def.id].xp);
      });
    }
    var relationshipStatus = window.WhaleRelationship && window.WhaleRelationship.status();
    var adventureStatus = window.WhaleAdventure && window.WhaleAdventure.status();
    var currentAdventureState = adventureStatus && adventureStatus.state ? adventureStatus.state : adventureState();
    var lifeStatus = window.WhaleLife && window.WhaleLife.status();
    return {
      professions: professions,
      relationship: relationshipStatus && relationshipStatus.stage ? relationshipStatus.stage.id : "new",
      journeys: currentAdventureState.stats ? currentAdventureState.stats.completed : 0,
      collectionFound: adventureStatus && adventureStatus.progress ? adventureStatus.progress.found : 0,
      collection: currentAdventureState.collection || {},
      away: Boolean(currentAdventureState.current),
      adventureState: currentAdventureState,
      adventureEnabled: adventureStatus ? adventureStatus.enabled : storage.get("adventure-enabled", "1") !== "0",
      lifeActivity: lifeStatus && lifeStatus.activity ? lifeStatus.activity : null,
      lifeCurrent: lifeStatus && lifeStatus.state ? lifeStatus.state.current : null
    };
  }

  function closeHouse() {
    cancelFurnitureInteraction();
    cancelPetWalk();
    travelTransitionActive = false;
    renderGeneration += 1;
    var house = document.querySelector("[data-whale-house]");
    if (house) house.hidden = true;
    var settings = document.querySelector("[data-whale-desktop-settings]");
    window.whaleDesktop.setMouseInteractive(Boolean(settings && !settings.hidden));
  }

  function furnitureNode(furniture, slot) {
    var node = element("button", "wm-house-furniture wm-house-slot-" + slot, furniture.icon);
    node.type = "button";
    node.title = furniture.name + " · " + furniture.note;
    node.addEventListener("click", function () {
      interactWithFurniture(furniture, node);
    });
    return node;
  }

  function renderCollectibles(scene, roomContext) {
    var shelf = element("div", "wm-house-collection");
    var items = window.WhaleAdventureCore ? window.WhaleAdventureCore.ITEMS : {};
    Object.keys(roomContext.collection || {})
      .slice(0, 8)
      .forEach(function (itemId) {
        if (!items[itemId]) return;
        var item = element("span", "", items[itemId].icon);
        item.title = items[itemId].name + " × " + roomContext.collection[itemId];
        shelf.appendChild(item);
      });
    if (!shelf.children.length) shelf.appendChild(element("small", "", "旅行回来后，纪念品会摆在这里"));
    scene.appendChild(shelf);
  }

  function travelDuration(durationMs) {
    return durationMs < 3600000 ? Math.round(durationMs / 60000) + " 分钟" : Math.round(durationMs / 3600000) + " 小时";
  }

  function travelReturnTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }

  function renderTravelCorner(scene, roomContext) {
    var adventureCore = window.WhaleAdventureCore;
    if (!adventureCore) return;
    var state = roomContext.adventureState || {};
    var opener = element("button", "wm-house-travel-corner", "🧳 旅行角");
    opener.type = "button";
    opener.setAttribute("aria-expanded", "false");
    var panel = element("div", "wm-house-travel-panel");
    panel.hidden = true;
    panel.appendChild(element("strong", "wm-house-travel-title", state.current ? "旅途联络" : "下一站去哪里？"));

    if (state.current) {
      var location = adventureCore.locationById(state.current.locationId);
      panel.appendChild(
        element(
          "span",
          "",
          (location ? location.icon + " " + location.name : "🗺️ 远方") +
            " · 预计 " +
            travelReturnTime(state.current.returnsAt) +
            " 回来"
        )
      );
      if (state.current.purpose) panel.appendChild(element("small", "", state.current.purpose));
      var recall = element("button", "wm-house-travel-recall", "📣 提前召回");
      recall.type = "button";
      recall.addEventListener("click", function () {
        panel.hidden = true;
        if (window.WhaleAdventure) window.WhaleAdventure.recall();
      });
      panel.appendChild(recall);
    } else {
      var routes = element("div", "wm-house-travel-routes");
      Object.keys(adventureCore.ROUTES).forEach(function (routeId) {
        var route = adventureCore.ROUTES[routeId];
        var button = element("button", routeId === "nearby" ? "primary" : "", route.label);
        button.type = "button";
        button.disabled = !roomContext.adventureEnabled;
        button.appendChild(element("small", "", travelDuration(route.durationMs)));
        button.addEventListener("click", function () {
          panel.hidden = true;
          if (window.WhaleAdventure) window.WhaleAdventure.depart(routeId);
        });
        routes.appendChild(button);
      });
      panel.appendChild(routes);
      if (!roomContext.adventureEnabled) panel.appendChild(element("small", "", "旅行功能已在设置中暂停"));
    }

    var latest = state.journeys && state.journeys[0];
    if (latest) {
      var latestLocation = adventureCore.locationById(latest.locationId);
      var latestItem = adventureCore.ITEMS[latest.itemId];
      panel.appendChild(
        element(
          "small",
          "wm-house-travel-latest",
          "上次回来：" +
            (latestLocation ? latestLocation.icon + latestLocation.name : "远方") +
            (latestItem ? " · 带回 " + latestItem.icon + latestItem.name : "")
        )
      );
    }

    opener.addEventListener("click", function () {
      panel.hidden = !panel.hidden;
      opener.setAttribute("aria-expanded", String(!panel.hidden));
    });
    scene.appendChild(opener);
    scene.appendChild(panel);
  }

  function renderCustomizer(container, state, roomContext) {
    var names = { desk: "工作角", wall: "墙面", floor: "地面", decor: "装饰" };
    core.SLOTS.forEach(function (slot) {
      var group = element("div", "wm-house-option-group");
      group.appendChild(element("strong", "", names[slot]));
      var options = element("div", "wm-house-options");
      core.FURNITURE.filter(function (item) {
        return item.slot === slot;
      }).forEach(function (furniture) {
        var unlocked = core.isUnlocked(furniture, roomContext);
        var button = element(
          "button",
          state.slots[slot] === furniture.id ? "selected" : "",
          unlocked ? furniture.icon + " " + furniture.name : "🔒 " + furniture.name
        );
        button.disabled = !unlocked;
        button.title = furniture.note;
        button.addEventListener("click", function () {
          if (travelTransitionActive) return;
          var result = core.selectFurniture(loadState(), slot, furniture.id, context());
          if (!result.changed) return;
          saveState(result.state);
          renderHouse(document.querySelector("[data-whale-house]"));
        });
        options.appendChild(button);
      });
      group.appendChild(options);
      container.appendChild(group);
    });
  }

  function lifeTarget(activityId) {
    return LIFE_TARGETS[activityId] || HOME_POSITION;
  }

  function placePet(pet, position) {
    pet.style.left = position.x + "%";
    pet.style.bottom = position.bottom + "px";
  }

  function currentPetPosition(pet) {
    var scene = pet.closest(".wm-house-scene");
    var style = window.getComputedStyle(pet);
    var width = scene ? scene.clientWidth : 0;
    return {
      x: width > 0 ? (parseFloat(style.left) / width) * 100 : parseFloat(pet.style.left) || HOME_POSITION.x,
      bottom: parseFloat(style.bottom) || HOME_POSITION.bottom
    };
  }

  function cancelFurnitureInteraction() {
    if (furnitureReturnTimer) window.clearTimeout(furnitureReturnTimer);
    furnitureReturnTimer = null;
    furnitureInteractionActive = false;
  }

  function cancelPetWalk() {
    if (activePetWalk) activePetWalk.cancel();
    activePetWalk = null;
  }

  function animatePetWalk(pet, from, to, finalPose, generation, onArrive) {
    var direction = to.x >= from.x ? "right" : "left";
    cancelPetWalk();
    pet.classList.remove("wm-house-pet-walking");
    placePet(pet, from);
    pet.classList.add("wm-house-pet-walking");
    pet.src = window.whaleDesktop.generated + "dsh-whale-walk-" + direction + ".webp";

    function finishWalk() {
      if (generation !== renderGeneration || !pet.isConnected) return;
      cancelPetWalk();
      pet.classList.remove("wm-house-pet-walking");
      placePet(pet, to);
      pet.src = window.whaleDesktop.generated + finalPose;
      if (typeof onArrive === "function") onArrive();
    }

    if (typeof pet.animate === "function") {
      activePetWalk = pet.animate(
        [
          { left: from.x + "%", bottom: from.bottom + "px" },
          { left: to.x + "%", bottom: to.bottom + "px" }
        ],
        { duration: WALK_DURATION, easing: "linear", fill: "forwards" }
      );
      activePetWalk.onfinish = finishWalk;
      return;
    }

    void pet.offsetWidth;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (generation !== renderGeneration || !pet.isConnected) return;
        placePet(pet, to);
      });
    });
    window.setTimeout(finishWalk, WALK_DURATION);
  }

  function interactWithFurniture(furniture, furnitureButton) {
    var roomContext = context();
    if (roomContext.away) return;
    var house = document.querySelector("[data-whale-house]");
    var pet = house && house.querySelector(".wm-house-pet");
    var caption = house && house.querySelector("[data-house-caption]");
    var interaction = FURNITURE_INTERACTIONS[furniture.id];
    if (!pet || !interaction) return;

    cancelFurnitureInteraction();
    furnitureInteractionActive = true;
    var generation = ++renderGeneration;
    house.querySelectorAll(".wm-house-furniture-active").forEach(function (node) {
      node.classList.remove("wm-house-furniture-active");
    });
    furnitureButton.classList.add("wm-house-furniture-active");
    animatePetWalk(
      pet,
      currentPetPosition(pet),
      interaction,
      "dsh-whale-state-" + interaction.pose + ".webp",
      generation,
      function () {
        if (caption) caption.textContent = furniture.icon + " " + interaction.line;
        furnitureReturnTimer = window.setTimeout(function () {
          furnitureReturnTimer = null;
          if (generation !== renderGeneration || !pet.isConnected || context().away) return;
          furnitureButton.classList.remove("wm-house-furniture-active");
          var returnGeneration = ++renderGeneration;
          animatePetWalk(
            pet,
            currentPetPosition(pet),
            HOME_POSITION,
            "dsh-whale-idle-blink.webp",
            returnGeneration,
            function () {
              furnitureInteractionActive = false;
              if (caption) caption.textContent = "看完啦，我回到这里陪你。";
            }
          );
        }, FURNITURE_STAY_DURATION);
      }
    );
  }

  function renderHouse(house, transition) {
    if (!house) return;
    cancelFurnitureInteraction();
    cancelPetWalk();
    var generation = ++renderGeneration;
    house.innerHTML = "";
    var roomContext = context();
    var state = loadState();
    var resolved = core.resolvedSlots(state, roomContext);
    var panel = element("div", "wm-house-panel");
    var head = element("div", "wm-house-head");
    var heading = element("div", "");
    heading.appendChild(
      element("strong", "", "🏠 " + (storage.get("petName", "鲸鱼娘").trim() || "鲸鱼娘") + "的小屋")
    );
    heading.appendChild(
      element(
        "span",
        "",
        "来访 " +
          state.visits +
          " 次 · 已解锁 " +
          core.unlockedFurniture(roomContext).length +
          "/" +
          core.FURNITURE.length +
          " 件家具"
      )
    );
    head.appendChild(heading);
    var close = element("button", "wm-house-close", "×");
    close.addEventListener("click", closeHouse);
    head.appendChild(close);
    panel.appendChild(head);

    var savedX = Number(storage.get("housePanelX", NaN));
    var savedY = Number(storage.get("housePanelY", NaN));
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
      var maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
      var maxTop = Math.max(8, window.innerHeight - rect.height - 8);
      panel.style.left = Math.round(Math.max(8, Math.min(event.clientX - panelDrag.dx, maxLeft))) + "px";
      panel.style.top = Math.round(Math.max(8, Math.min(event.clientY - panelDrag.dy, maxTop))) + "px";
    });
    function finishPanelDrag(event) {
      if (!panelDrag || panelDrag.pointerId !== event.pointerId) return;
      panelDrag = null;
      if (head.hasPointerCapture(event.pointerId)) head.releasePointerCapture(event.pointerId);
      storage.set("housePanelX", Math.round(parseFloat(panel.style.left)));
      storage.set("housePanelY", Math.round(parseFloat(panel.style.top)));
    }
    head.addEventListener("pointerup", finishPanelDrag);
    head.addEventListener("pointercancel", finishPanelDrag);

    var hour = new Date().getHours();
    var scene = element("div", "wm-house-scene " + (hour >= 19 || hour < 6 ? "night" : "day"));
    var windowView = element("div", "wm-house-window", hour >= 19 || hour < 6 ? "🌙  ·  ✦" : "☀️  ·  ☁️");
    scene.appendChild(windowView);
    var journal = element("button", "wm-house-journal", "📖 今日手账");
    journal.type = "button";
    journal.title = "查看每日生活总结";
    journal.addEventListener("click", function () {
      if (window.WhaleDailySummary) window.WhaleDailySummary.open();
    });
    scene.appendChild(journal);
    scene.appendChild(element("div", "wm-house-wall-line"));
    core.SLOTS.forEach(function (slot) {
      scene.appendChild(furnitureNode(resolved[slot], slot));
    });
    renderCollectibles(scene, roomContext);
    renderTravelCorner(scene, roomContext);
    if (roomContext.away) {
      var away = element("div", "wm-house-away");
      away.appendChild(element("span", "", "🗺️ 外出旅行中，房间正安静地等她回来"));
      var recall = element("button", "wm-house-away-recall", "📣 提前召回");
      recall.type = "button";
      recall.addEventListener("click", function () {
        recall.disabled = true;
        recall.textContent = "正在召回…";
        if (window.WhaleAdventure) window.WhaleAdventure.recall();
      });
      away.appendChild(recall);
      scene.appendChild(away);
    } else {
      var pet = document.createElement("img");
      pet.className = "wm-house-pet";
      pet.alt = storage.get("petName", "鲸鱼娘");
      var activityId = roomContext.lifeActivity ? roomContext.lifeActivity.id : "";
      var activityPosition = lifeTarget(activityId);
      var finalPose = roomContext.lifeActivity
        ? "dsh-whale-state-" + roomContext.lifeActivity.pose + ".webp"
        : "dsh-whale-idle-blink.webp";
      pet.src = window.whaleDesktop.generated + finalPose;
      placePet(pet, roomContext.lifeActivity ? activityPosition : HOME_POSITION);
      scene.appendChild(pet);
      if (transition && transition.type === "started" && roomContext.lifeActivity) {
        animatePetWalk(pet, HOME_POSITION, activityPosition, finalPose, generation);
      } else if (transition && transition.type === "completed" && transition.activityId) {
        animatePetWalk(pet, lifeTarget(transition.activityId), HOME_POSITION, "dsh-whale-idle-blink.webp", generation);
      } else if (transition && transition.type === "arrived") {
        animatePetWalk(pet, HOUSE_EXIT_POSITION, HOME_POSITION, "dsh-whale-state-greet.webp", generation, function () {
          travelTransitionActive = false;
          var caption = scene.querySelector("[data-house-caption]");
          if (caption && transition.line) caption.textContent = transition.line;
          window.setTimeout(function () {
            if (generation !== renderGeneration || !pet.isConnected) return;
            pet.src = window.whaleDesktop.generated + "dsh-whale-idle-blink.webp";
          }, 2400);
        });
      }
      if (roomContext.lifeActivity) {
        var lifeBadge = element("div", "wm-house-life-badge");
        lifeBadge.appendChild(
          element("strong", "", roomContext.lifeActivity.icon + " 正在" + roomContext.lifeActivity.name)
        );
        if (roomContext.lifeCurrent) {
          lifeBadge.appendChild(
            element(
              "span",
              "",
              "预计 " +
                new Date(roomContext.lifeCurrent.endsAt).toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit"
                }) +
                " 完成"
            )
          );
        }
        scene.appendChild(lifeBadge);
      }
    }
    var caption = element(
      "div",
      "wm-house-caption",
      roomContext.away
        ? "她出门时把房间收拾得整整齐齐。"
        : roomContext.lifeActivity && roomContext.lifeCurrent
          ? roomContext.lifeCurrent.reason
          : "今天也在自己的小屋里陪着你。计入房间的成果都来自真实相处。 "
    );
    caption.setAttribute("data-house-caption", "true");
    scene.appendChild(caption);
    panel.appendChild(scene);
    var customize = element("div", "wm-house-customize");
    customize.appendChild(element("h3", "", "布置小屋"));
    renderCustomizer(customize, state, roomContext);
    panel.appendChild(customize);
    house.appendChild(panel);
  }

  function openHouse() {
    var house = document.querySelector("[data-whale-house]");
    if (!house) {
      house = element("div");
      house.setAttribute("data-whale-house", "true");
      house.addEventListener("pointerdown", function (event) {
        if (event.target === house) closeHouse();
      });
      document.body.appendChild(house);
    }
    var state = loadState();
    state.visits += 1;
    state.lastOpenedAt = Date.now();
    saveState(state);
    renderHouse(house);
    house.hidden = false;
    window.whaleDesktop.setMouseInteractive(true);
  }

  function refreshVisibleHouse() {
    var house = document.querySelector("[data-whale-house]");
    if (house && !house.hidden && !furnitureInteractionActive && !travelTransitionActive) renderHouse(house);
  }

  function handleAdventureChange(event) {
    var house = document.querySelector("[data-whale-house]");
    if (!house || house.hidden) return;
    var state = event && event.detail ? event.detail.state : null;
    var change = event && event.detail ? event.detail.event : null;
    if (state && state.current) {
      var pet = house.querySelector(".wm-house-pet");
      if (change && change.type === "departed" && pet) {
        var from = currentPetPosition(pet);
        cancelFurnitureInteraction();
        travelTransitionActive = true;
        house.querySelectorAll(".wm-house-life-badge").forEach(function (node) {
          node.remove();
        });
        var caption = house.querySelector("[data-house-caption]");
        if (caption) caption.textContent = change.line || "我从门口出发啦，回来再告诉你路上的故事。";
        var generation = ++renderGeneration;
        animatePetWalk(pet, from, HOUSE_EXIT_POSITION, "dsh-whale-walk-left.webp", generation, function () {
          travelTransitionActive = false;
          renderHouse(house);
        });
        return;
      }
    }
    if (change && (change.type === "recalled" || change.type === "returned")) {
      travelTransitionActive = true;
      renderHouse(house, { type: "arrived", line: change.line || "我回来啦！" });
      return;
    }
    renderHouse(house);
  }

  window.WhaleHouse = Object.freeze({
    open: openHouse,
    close: closeHouse,
    status: function () {
      var roomContext = context();
      return {
        state: loadState(),
        context: roomContext,
        unlocked: core.unlockedFurniture(roomContext).length,
        total: core.FURNITURE.length
      };
    }
  });
  window.addEventListener("whale-desktop-open-house", openHouse);
  window.addEventListener("whale-adventure-change", handleAdventureChange);
  window.addEventListener("whale-profession-change", refreshVisibleHouse);
  window.addEventListener("whale-relationship-change", refreshVisibleHouse);
  window.addEventListener("whale-life-change", function (event) {
    var house = document.querySelector("[data-whale-house]");
    if (!house || house.hidden) return;
    if (furnitureInteractionActive || travelTransitionActive) return;
    var detail = event && event.detail ? event.detail : {};
    var lifeEvent = detail.event || {};
    if (lifeEvent.type === "started") {
      renderHouse(house, { type: "started", activityId: lifeEvent.activityId });
      return;
    }
    if (lifeEvent.type === "completed") {
      renderHouse(house, {
        type: "completed",
        activityId: lifeEvent.entry && lifeEvent.entry.activityId
      });
      return;
    }
    renderHouse(house);
  });
  window.addEventListener("whale-moe-prefs-change", function (event) {
    var key = event && event.detail ? event.detail.key : "";
    if (key === "petName" || key === "houseState") refreshVisibleHouse();
  });
  window.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeHouse();
  });
})();
