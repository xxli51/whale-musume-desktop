import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (relative) => readFileSync(path.join(root, relative), "utf8");

test("standalone repository contains every runtime entry", () => {
  for (const relative of [
    "main.cjs",
    "preload.cjs",
    "runtime/computer-monitor-policy.cjs",
    "runtime/diagnostics.cjs",
    "renderer/index.html",
    "renderer/desktop.js",
    "renderer/storage.js",
    "renderer/adventure-core.js",
    "renderer/adventure.js",
    "renderer/profession-core.js",
    "renderer/profession.js",
    "renderer/relationship-core.js",
    "renderer/relationship.js",
    "renderer/house-core.js",
    "renderer/house.js",
    "renderer/house.css",
    "renderer/daily-summary-core.js",
    "renderer/daily-summary.js",
    "renderer/daily-summary.css",
    "renderer/life-core.js",
    "renderer/life.js",
    "renderer/settings-data.js",
    "renderer/settings.js",
    "renderer/companion.js",
    "assets/dsh-whale-moe.js",
    "assets/dsh-whale-moe.css",
    "assets/whale-moe-core.js",
    "build/icon.ico",
    "build/icon.png",
    "DISCLAIMER.md"
  ]) {
    assert.equal(existsSync(path.join(root, relative)), true, `${relative} is required`);
  }
});

test("repository exposes license and disclaimer notices", () => {
  const readme = read("README.md");
  const disclaimer = read("DISCLAIMER.md");
  assert.match(readme, /\[DISCLAIMER\.md\]\(DISCLAIMER\.md\)/);
  assert.match(disclaimer, /非官方项目/);
  assert.match(disclaimer, /按现状提供/);
  assert.match(disclaimer, /THIRD_PARTY_NOTICES\.md/);
});

test("desktop package is self-contained", () => {
  const pkg = JSON.parse(read("package.json"));
  const main = read("main.cjs");
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.equal(pkg.engines.node, ">=22.13.0");
  assert.equal(pkg.scripts.test, "node --test");
  assert.ok(pkg.build.files.includes("runtime/**/*"));
  assert.equal(pkg.build.extraResources[0].from, "assets");
  assert.match(main, /path\.join\(__dirname, "assets"\)/);
  assert.doesNotMatch(main, /path\.join\(__dirname, "\.\.", "assets"\)/);
});

test("all pose assets and desktop safety fixes are present", () => {
  const generated = path.join(root, "assets", "generated");
  const poses = readdirSync(generated).filter((name) => /^dsh-whale-state-.*\.webp$/.test(name));
  const presenter = read("assets/dsh-whale-moe.js");
  const settings = read("renderer/settings.js");
  const settingsCss = read("renderer/settings.css");
  const desktop = read("renderer/desktop.js");
  const main = read("main.cjs");
  assert.equal(poses.length, 89);
  assert.match(presenter, /Math\.min\(360, root\.innerWidth, root\.innerHeight\)/);
  assert.doesNotMatch(presenter, /__DSH_WHALE_DESKTOP__/);
  assert.match(settings, new RegExp(`Desktop v${pkgVersion().replaceAll(".", "\\.")}`));
  assert.match(settings, /desktopSettingsX/);
  assert.match(settings, /wm-pose-grid/);
  assert.match(settingsCss, /flex:\s*0 0 auto/);
  assert.match(settingsCss, /details\.wm-card:not\(\[open\]\)/);
  assert.match(settingsCss, /\.wm-quest-controls/);
  assert.match(main, /screen\.getCursorScreenPoint\(\)/);
  assert.match(main, /function overlayDesktopBounds\(\)/);
  assert.match(main, /setAlwaysOnTop\(true, "screen-saver"\)/);
  assert.match(main, /function showOverlayInactive\(\)/);
  assert.match(main, /overlay\.moveTop\(\)/);
  assert.match(main, /setInterval\(reinforceOverlayTopmost, 3000\)/);
  assert.match(main, /visibleOnFullScreen: false/);
  assert.match(desktop, /api\.onCursorProbe/);
  assert.match(desktop, /api\.onDisplayBounds/);
  assert.match(main, /function rendererDisplayBounds\(\)/);
  assert.match(presenter, /constrainRectToDisplays/);
  assert.doesNotMatch(desktop, /addEventListener\("blur"/);
});

test("standalone presenter has no DSH host data or DOM linkage", async () => {
  const core = await import("../assets/whale-moe-core.js");
  const presenter = read("assets/dsh-whale-moe.js");
  const desktop = read("renderer/desktop.js");
  const settings = read("renderer/settings.js");
  const settingsData = read("renderer/settings-data.js");
  for (const legacyLink of [
    /dsh\.balance/,
    /dsh-whale-balance-low/,
    /data-slot=/,
    /data-phase=/,
    /data-status=/,
    /data-running/,
    /dshLogCluster/,
    /MutationObserver/
  ]) {
    assert.doesNotMatch(presenter, legacyLink);
  }
  assert.doesNotMatch(desktop, /__DSH_WHALE_DESKTOP__/);
  assert.doesNotMatch(settings, /关键词感知/);
  assert.match(presenter, /IDLE_ACTION_POOL\.concat\(DESKTOP_FALLBACK_ACTIONS\)/);
  assert.match(settings, /window\.WhaleSettingsData\.POSE_GROUPS/);
  assert.match(settingsData, /var poseGroups = \[/);
  assert.deepEqual(core.default.QUEST_POOL.map((quest) => quest.metric).sort(), [
    "belly",
    "feed",
    "game",
    "game-win",
    "pat",
    "praise",
    "signin",
    "tail"
  ]);
  assert.equal(core.default.POSES.balanceLow, "balance-low");
});

test("every random idle action has matching non-repeating dialogue", async () => {
  const core = await import("../assets/whale-moe-core.js");
  const presenter = read("assets/dsh-whale-moe.js");
  const poolMatch = presenter.match(/var IDLE_ACTION_POOL = \[([^;]+)\];/);
  assert.ok(poolMatch, "IDLE_ACTION_POOL must remain discoverable");
  const actions = [...poolMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  actions.push("wink");
  for (const action of actions) {
    const lines = core.default.DIALOGUE.idleAction[action];
    assert.ok(Array.isArray(lines), `${action} requires an idleAction dialogue bank`);
    assert.ok(lines.length >= 4, `${action} requires several dialogue variants`);
  }
  assert.match(presenter, /pickDialogueAvoidRecent\("idleAction", pose/);
  assert.match(presenter, /pose === memory\.lastIdleActionPose/);
});

function pkgVersion() {
  return JSON.parse(read("package.json")).version;
}

test("companion tools are persistent, private, and wired to the mascot", () => {
  const companion = read("renderer/companion.js");
  const settings = read("renderer/settings.js");
  const storage = read("renderer/storage.js");
  const presenter = read("assets/dsh-whale-moe.js");
  const index = read("renderer/index.html");
  assert.match(index, /\.\/companion\.js/);
  for (const feature of ["pomodoroState", "postureMinutes", "waterMinutes", "offwork-time", "quiet-active"]) {
    assert.match(companion, new RegExp(feature));
  }
  assert.match(storage, /whale-musume-save/);
  assert.match(storage, /SECRET_KEYS = Object\.freeze\(\["weatherKey"\]\)/);
  assert.match(settings, /displayScale/);
  assert.match(settings, /positionLocked/);
  assert.match(presenter, /whale-desktop-companion-reminder/);
  assert.match(presenter, /growth\.satiety <= 25/);
});

test("procedural adventures persist deterministic memories and collectibles", () => {
  const index = read("renderer/index.html");
  const storage = read("renderer/storage.js");
  const settings = read("renderer/settings.js");
  const controller = read("renderer/adventure.js");
  const presenter = read("assets/dsh-whale-moe.js");
  const main = read("main.cjs");
  const preload = read("preload.cjs");
  const desktop = read("renderer/desktop.js");
  assert.match(index, /\.\/adventure-core\.js/);
  assert.match(index, /\.\/adventure\.js/);
  assert.match(storage, /adventureState/);
  assert.match(settings, /旅行与收藏/);
  assert.match(settings, /纪念品收藏/);
  assert.match(controller, /whale-desktop-companion-reminder/);
  assert.match(controller, /whale-desktop-computer-state/);
  assert.match(presenter, /function adventureAway\(now\)/);
  assert.match(presenter, /state: "adventure-away"/);
  assert.match(presenter, /isAway\(state, at, 6500\)/);
  assert.match(presenter, /scheduleDepartureExit/);
  assert.match(presenter, /state: "adventure-departing"/);
  assert.match(presenter, /state: "adventure-arriving"/);
  assert.match(presenter, /beginAdventureArrival/);
  assert.match(presenter, /whale-adventure-change", onAdventureChange/);
  assert.match(presenter, /WhaleAdventureCore\.isAway/);
  assert.match(
    presenter,
    /change\.type === "returned" \|\| change\.type === "recalled"\)[\s\S]*?weatherEnsure\(true\)/,
    "returning from travel must refresh the current weather code"
  );
  assert.match(
    presenter,
    /function weatherFxGate\(computed\) \{[\s\S]*?!!doc\.querySelector\("\[data-dsh-whale-root\]"\)/,
    "weather effects must stay off after the travelling mascot leaves the desktop"
  );
  assert.match(main, /提前召回鲸鱼娘/);
  assert.match(main, /if \(adventureAway\)/);
  assert.match(main, /whale:recall-adventure/);
  assert.match(preload, /setAdventureAway/);
  assert.match(preload, /onRecallAdventure/);
  assert.match(desktop, /whale-desktop-recall-adventure/);
  assert.match(controller, /recallJourney/);
  assert.match(controller, /type: "departed", journey: result\.journey, line: result\.line/);
});

test("career growth uses private foreground categories and influences adventures", () => {
  const index = read("renderer/index.html");
  const storage = read("renderer/storage.js");
  const settings = read("renderer/settings.js");
  const profession = read("renderer/profession.js");
  const adventure = read("renderer/adventure.js");
  const main = read("main.cjs");
  const preload = read("preload.cjs");
  const desktop = read("renderer/desktop.js");
  assert.match(index, /profession-core\.js/);
  assert.match(index, /profession\.js/);
  assert.match(storage, /professionState/);
  assert.match(settings, /职业成长/);
  assert.match(profession, /whale-desktop-computer-state/);
  assert.match(profession, /idleSeconds < 120/);
  assert.match(adventure, /professionStatus\.state\.primaryId/);
  assert.match(main, /professionTrackingEnabled/);
  assert.match(main, /whale:set-profession-enabled/);
  assert.match(preload, /setProfessionEnabled/);
  assert.match(desktop, /profession-enabled/);
});

test("relationship stages and personality are driven by shared experiences", () => {
  const index = read("renderer/index.html");
  const storage = read("renderer/storage.js");
  const settings = read("renderer/settings.js");
  const relationship = read("renderer/relationship.js");
  const presenter = read("assets/dsh-whale-moe.js");
  const adventure = read("renderer/adventure.js");
  const profession = read("renderer/profession.js");
  assert.match(index, /relationship-core\.js/);
  assert.match(index, /relationship\.js/);
  assert.match(storage, /relationshipState/);
  assert.match(settings, /关系与性格/);
  assert.match(settings, /性格形成记录/);
  assert.match(relationship, /whale-personality-signal/);
  assert.match(presenter, /whale-personality-signal/);
  assert.match(presenter, /function relationshipDialogue\(event\)/);
  assert.match(adventure, /personalitySignal\("recall"/);
  assert.match(profession, /type: focusSignal \? "focus" : "profession"/);
});

test("whale house is accessible and unlocked by persisted achievements", () => {
  const index = read("renderer/index.html");
  const storage = read("renderer/storage.js");
  const house = read("renderer/house.js");
  const houseCss = read("renderer/house.css");
  const settings = read("renderer/settings.js");
  const main = read("main.cjs");
  const preload = read("preload.cjs");
  const desktop = read("renderer/desktop.js");
  assert.match(index, /house-core\.js/);
  assert.match(index, /house\.js/);
  assert.match(index, /house\.css/);
  assert.match(storage, /houseState/);
  assert.match(house, /WhaleProfession/);
  assert.match(house, /WhaleRelationship/);
  assert.match(house, /WhaleAdventure/);
  assert.match(house, /dsh-whale-idle-blink\.webp/);
  assert.doesNotMatch(house, /dsh-whale-state-idle-cute\.webp/);
  assert.match(house, /dsh-whale-walk-" \+ direction \+ "\.webp/);
  assert.match(house, /LIFE_TARGETS/);
  assert.match(house, /transition\.type === "started"/);
  assert.match(house, /transition\.type === "completed"/);
  assert.match(house, /away: Boolean\(currentAdventureState\.current\)/);
  assert.match(house, /querySelectorAll\("\.wm-house-life-badge"\)/);
  assert.match(house, /whale-adventure-change", handleAdventureChange/);
  assert.match(house, /HOUSE_EXIT_POSITION/);
  assert.match(house, /我从门口出发啦/);
  assert.match(house, /transition\.type === "arrived"/);
  assert.match(house, /change\.type === "recalled" \|\| change\.type === "returned"/);
  assert.match(
    house,
    /change\.type === "recalled" \|\| change\.type === "returned"\)\) \{\s*travelTransitionActive = true/
  );
  assert.match(house, /travelTransitionActive = true/);
  assert.match(house, /!travelTransitionActive\) renderHouse/);
  assert.match(house, /furnitureInteractionActive \|\| travelTransitionActive/);
  assert.match(house, /wm-house-away-recall/);
  assert.match(house, /recall\.textContent = "正在召回…"/);
  assert.match(house, /renderTravelCorner\(scene, roomContext\)/);
  assert.match(house, /🧳 旅行角/);
  assert.match(house, /window\.WhaleAdventure\.depart\(routeId\)/);
  assert.match(house, /window\.WhaleAdventure\.recall\(\)/);
  assert.match(house, /上次回来/);
  assert.match(house, /FURNITURE_STAY_DURATION = 10000/);
  assert.match(house, /FURNITURE_INTERACTIONS/);
  assert.match(house, /furnitureInteractionActive = true/);
  assert.match(house, /!furnitureInteractionActive && !travelTransitionActive/);
  assert.match(house, /if \(furnitureInteractionActive \|\| travelTransitionActive\) return/);
  assert.match(house, /interactWithFurniture\(furniture, node\)/);
  assert.match(house, /currentPetPosition\(pet\)/);
  assert.match(house, /activePetWalk = pet\.animate/);
  assert.match(house, /fill: "forwards"/);
  assert.match(house, /activePetWalk\.onfinish = finishWalk/);
  assert.match(house, /看完啦，我回到这里陪你/);
  assert.match(houseCss, /wm-house-pet-walking/);
  assert.match(houseCss, /wm-house-furniture-active/);
  assert.match(houseCss, /wm-house-travel-panel/);
  assert.match(houseCss, /wm-house-travel-routes/);
  assert.match(houseCss, /wm-house-away-recall/);
  assert.match(houseCss, /data-whale-house/);
  assert.match(houseCss, /\.wm-house-head:active/);
  assert.match(house, /head\.setPointerCapture\(event\.pointerId\)/);
  assert.match(house, /storage\.set\("housePanelX"/);
  assert.match(storage, /housePanelX: \[-100000, 100000\]/);
  assert.match(settings, /进入鲸鱼小屋/);
  assert.match(main, /label: "鲸鱼小屋"/);
  assert.match(preload, /onOpenHouse/);
  assert.match(desktop, /whale-desktop-open-house/);
});

test("daily life summaries roll up persisted systems and remain accessible", () => {
  const index = read("renderer/index.html");
  const storage = read("renderer/storage.js");
  const daily = read("renderer/daily-summary.js");
  const dailyCss = read("renderer/daily-summary.css");
  const settings = read("renderer/settings.js");
  const house = read("renderer/house.js");
  const main = read("main.cjs");
  const preload = read("preload.cjs");
  const desktop = read("renderer/desktop.js");
  assert.match(index, /daily-summary-core\.js/);
  assert.match(index, /daily-summary\.js/);
  assert.match(index, /daily-summary\.css/);
  assert.match(storage, /dailySummaryState/);
  assert.match(daily, /relationshipState/);
  assert.match(daily, /professionState/);
  assert.match(daily, /adventureState/);
  assert.match(dailyCss, /data-whale-daily/);
  assert.match(settings, /翻开生活手账/);
  assert.match(house, /今日手账/);
  assert.match(main, /label: "今日生活总结"/);
  assert.match(preload, /onOpenDailySummary/);
  assert.match(desktop, /whale-desktop-open-daily/);
});

test("autonomous life uses persisted contextual decisions without conflicting with travel", () => {
  const index = read("renderer/index.html");
  const storage = read("renderer/storage.js");
  const life = read("renderer/life.js");
  const settings = read("renderer/settings.js");
  const house = read("renderer/house.js");
  const daily = read("renderer/daily-summary.js");
  const presenter = read("assets/dsh-whale-moe.js");
  assert.match(index, /life-core\.js/);
  assert.match(index, /life\.js/);
  assert.match(storage, /lifeState/);
  assert.match(storage, /life-enabled/);
  assert.match(life, /idleSeconds < 120/);
  assert.match(life, /interruptForTravel/);
  assert.match(life, /quiet-active/);
  assert.match(settings, /让鲸鱼在空闲时自主安排生活/);
  assert.match(settings, /看看她现在想做什么/);
  assert.match(house, /lifeActivity/);
  assert.match(daily, /lifeActivities/);
  assert.match(presenter, /function activeLife\(now\)/);
  assert.match(presenter, /lifeApplied/);
});

test("settings preferences update in place without rebuilding the panel", () => {
  const settings = read("renderer/settings.js");
  const listenerStart = settings.indexOf('window.addEventListener("whale-moe-prefs-change"');
  const listenerEnd = settings.indexOf('window.addEventListener("whale-companion-status"', listenerStart);
  assert.ok(listenerStart >= 0 && listenerEnd > listenerStart, "preference listener must remain discoverable");
  const listener = settings.slice(listenerStart, listenerEnd);
  assert.match(listener, /updatePreferenceView\(key\)/);
  assert.doesNotMatch(listener, /renderPanel\(\)/);
  assert.match(settings, /refreshSection\("🎯 今日任务", renderDaily\)/);
  assert.match(settings, /updateSectionMeta\("🎛️ 陪伴表现"/);
});

test("settings offer seven persistent themes and default to deep ocean", () => {
  const settings = read("renderer/settings.js");
  const settingsCss = read("renderer/settings.css");
  const storage = read("renderer/storage.js");
  const themes = ["a", "b", "c", "d", "e", "f", "g"];
  [
    ["a", "海盐玻璃"],
    ["b", "深海控制台"],
    ["c", "奶油手账"],
    ["d", "极简原生"],
    ["e", "薄荷渐变"],
    ["f", "暖阳橙"],
    ["g", "樱花粉"]
  ].forEach(([id, name]) => assert.match(settings, new RegExp(`\\["${id}", "${name}"`)));
  assert.match(settings, /value\("settingsTheme", "b"\)/);
  assert.match(settings, /data-settings-theme-option/);
  assert.match(settings, /wm-settings-nav/);
  assert.match(settings, /data-settings-page-target/);
  assert.match(settings, /activateSettingsPage\("general"\)/);
  assert.match(settings, /\["sound", "♫", "音量"/);
  assert.match(settings, /wm-general-dashboard/);
  assert.match(settings, /dsh-whale-settings-peek\.webp/);
  assert.match(settings, /dsh-whale-state-daily-coffee\.webp/);
  assert.match(settings, /"伴随状态"/);
  assert.match(settings, /"开机启动"/);
  assert.match(settings, /"互动频率"/);
  assert.match(settings, /"节能模式"/);
  assert.match(settingsCss, /grid-template-columns: repeat\(6, 1fr\)/);
  assert.match(settingsCss, /@container \(min-width: 561px\) and \(max-height: 560px\)/);
  assert.match(settingsCss, /grid-template-rows: repeat\(3, minmax\(118px, auto\)\)/);
  assert.match(settingsCss, /details\.wm-card:not\(\[open\]\) > \.wm-card-content \{ display: none !important; \}/);
  assert.match(settingsCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(settingsCss, /width: min\(1055px/);
  assert.match(settingsCss, /resize: both/);
  assert.match(settingsCss, /@container \(max-width: 760px\)/);
  assert.match(settings, /new ResizeObserver/);
  assert.match(storage, /desktopSettingsWidth: \[680, 1600\]/);
  assert.match(storage, /desktopSettingsHeight: \[430, 1200\]/);
  assert.match(storage, /settingsTheme: 16/);
  assert.match(storage, /\["a", "b", "c", "d", "e", "f", "g"\]/);
  themes.forEach((theme) => {
    assert.match(settingsCss, new RegExp('data-settings-theme="' + theme + '"'));
  });
  [
    "dsh-whale-settings-peek.webp",
    "dsh-whale-state-idle-cute.webp",
    "dsh-whale-state-blush.webp",
    "dsh-whale-state-waiting.webp",
    "dsh-whale-state-daily-coffee.webp"
  ].forEach((assetName) => {
    assert.match(settings, new RegExp(assetName.replace(".", "\\.")));
    assert.ok(existsSync(path.join(root, "assets", "generated", assetName)), `${assetName} must exist`);
  });
});

test("random auto-walk uses directional animated WebP assets and yields to direct interaction", () => {
  const settingsData = read("renderer/settings-data.js");
  const presenter = read("assets/dsh-whale-moe.js");
  const styles = read("assets/dsh-whale-moe.css");
  assert.match(settingsData, /\["auto-walk", "随机自动走动", true\]/);
  assert.match(presenter, /function startAutoWalk\(/);
  assert.doesNotMatch(presenter, /memory\.lastInteractionAt < 45000/);
  assert.match(presenter, /positionLocked\(\)/);
  assert.match(presenter, /quietActive\(\)/);
  assert.match(presenter, /function onUserActivity\(\) \{[\s\S]*?finishEntrance\(true\);[\s\S]*?stopAutoWalk\(true\)/);
  assert.match(presenter, /dsh-whale-walk-/);
  assert.match(presenter, /dsh-whale-walk-" \+ side \+ "\.webp"/);
  assert.doesNotMatch(presenter, /AUTO_WALK_FRAME_COUNT|AUTO_WALK_FRAME_MS|dsh-whale-walk-.*\.png/);
  assert.doesNotMatch(presenter, /memory\.moodPose = "running"/);
  for (const side of ["left", "right"]) {
    const name = `assets/generated/dsh-whale-walk-${side}.webp`;
    const assetPath = path.join(root, name);
    assert.equal(existsSync(assetPath), true, `${name} is required`);
    const bytes = readFileSync(assetPath);
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", `${name} must be WebP`);
    assert.match(bytes.toString("ascii"), /ANIM/, `${name} must contain animation frames`);
  }
  const generatedNames = readdirSync(path.join(root, "assets/generated"));
  assert.deepEqual(
    generatedNames.filter((name) => /^dsh-whale-walk-(left|right)-\d{2}\.png$/.test(name)),
    [],
    "individual walk PNG frames must not be packaged after animated WebP assembly"
  );
  assert.deepEqual(
    generatedNames.filter((name) => name.startsWith("walk-") || name.startsWith("dsh-whale-walk-v")),
    [],
    "obsolete walk generation artifacts must not be packaged"
  );
  assert.match(styles, /data-dsh-whale-walking/);
});

test("startup entrance walks from far to near once and greets with local time", () => {
  const presenter = read("assets/dsh-whale-moe.js");
  const styles = read("assets/dsh-whale-moe.css");
  assert.match(presenter, /entranceState = \{ started: false, active: false/);
  assert.match(presenter, /function startEntrance\(/);
  assert.match(presenter, /if \(doc\.hidden\) return;\s*entranceState\.started = true/);
  assert.match(presenter, /layout\.src = autoWalkSrc\("right"\)/);
  assert.match(presenter, /if \(motionReduced\(\)\) \{\s*announceEntrance\(\);\s*return;\s*\}/);
  assert.match(presenter, /function entranceGreeting\(/);
  assert.match(presenter, /星期日.*星期六/);
  assert.match(presenter, /function announceEntrance\(\)[\s\S]*showChatLine\(entranceGreeting\(Date\.now\(\)\)\)/);
  assert.match(presenter, /entranceState\.greetingUntil = Date\.now\(\) \+ 7500/);
  assert.match(presenter, /if \(entranceGreetingBusy\(now\)\) return false/);
  assert.match(presenter, /finishEntrance\(true\)/);
  assert.match(styles, /wm-red-carpet-entrance/);
  assert.match(styles, /translateY\(-42vh\) scale\(0\.12\)/);
  assert.match(styles, /translateY\(0\) scale\(1\)/);
});

test("owner and mascot names are independently customizable", () => {
  const presenter = read("assets/dsh-whale-moe.js");
  const settings = read("renderer/settings.js");
  const storage = read("renderer/storage.js");
  assert.match(settings, /row\("如何称呼我", titleInput\)/);
  assert.match(settings, /row\("如何称呼桌宠", petNameInput\)/);
  assert.match(settings, /data-whale-pet-name/);
  assert.match(storage, /petName: 32/);
  assert.match(presenter, /function petName\(\)/);
  assert.match(presenter, /replace\(\/主人\|鲸鱼娘\/g/);
});

test("mouse physics can be disabled and integrates with drag and auto-walk", () => {
  const settingsData = read("renderer/settings-data.js");
  const storage = read("renderer/storage.js");
  const presenter = read("assets/dsh-whale-moe.js");
  const styles = read("assets/dsh-whale-moe.css");
  assert.match(settingsData, /\["mouse-physics", "鼠标物理互动", true\]/);
  assert.match(storage, /"mouse-physics"/);
  assert.match(presenter, /core\.pointerThrowVelocity\(completedDrag\.samples\)/);
  assert.match(presenter, /core\.pointerThrowStep\(\s*pointerThrowState/);
  assert.match(presenter, /function detectCircleGesture\(/);
  assert.match(presenter, /pointerThrowState\.active/);
  assert.match(styles, /wm-throw-bounce-x/);
});

test("window perch follows maximized foreground bounds without reading titles", () => {
  const main = read("main.cjs");
  const preload = read("preload.cjs");
  const desktop = read("renderer/desktop.js");
  const settingsData = read("renderer/settings-data.js");
  const storage = read("renderer/storage.js");
  const presenter = read("assets/dsh-whale-moe.js");
  const styles = read("assets/dsh-whale-moe.css");

  assert.match(settingsData, /\["window-perch", "最大化窗口栖息", false\]/);
  assert.match(storage, /"window-perch"/);
  assert.match(main, /GetWindowRect/);
  assert.match(main, /IsZoomed/);
  assert.match(main, /whale:set-window-perch-enabled/);
  assert.doesNotMatch(main, /GetWindowText/);
  assert.match(preload, /setWindowPerchEnabled/);
  assert.match(desktop, /whale-moe:window-perch/);
  assert.match(presenter, /function windowPerchActive\(/);
  assert.match(presenter, /target\.maximized === true/);
  assert.match(presenter, /dsh-whale-workbench-peek\.webp/);
  assert.match(styles, /data-dsh-whale-mode="perch"/);
});

test("scene reactions defer to an active walk and resume after it stops", () => {
  const presenter = read("assets/dsh-whale-moe.js");
  assert.match(presenter, /var walking = autoWalkState\.active && layout && layout\.kind === "float"/);
  assert.match(presenter, /var moodApplied = moodActive && moodAllowed && !walking/);
  assert.match(presenter, /if \(autoWalkState\.active\) \{[\s\S]*memory\.pendingMoodDuration = moodDuration/);
  assert.match(presenter, /autoWalkState\.active = false;[\s\S]*resumeDeferredMood\(\);[\s\S]*schedule\(\);/);
  assert.match(presenter, /function resumeDeferredMood\(\) \{[\s\S]*startMoodTimer\(memory\.pendingMoodDuration\)/);
});

test("idle blink uses one animated WebP timeline", () => {
  const presenter = read("assets/dsh-whale-moe.js");
  const generated = path.join(root, "assets/generated");
  const name = "dsh-whale-idle-blink.webp";
  const assetPath = path.join(generated, name);
  assert.equal(existsSync(assetPath), true, `${name} is required`);
  const bytes = readFileSync(assetPath);
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", `${name} must be WebP`);
  assert.match(bytes.toString("ascii"), /ANIM/, `${name} must contain an animation timeline`);
  assert.match(presenter, /function idleBlinkSrc\(\)/);
  assert.match(presenter, /dsh-whale-idle-blink\.webp/);
  assert.doesNotMatch(presenter, /IDLE_BLINK_DELAYS|idleBlinkFrameSrc|idleBlinkState/);
  assert.deepEqual(
    readdirSync(generated).filter((entry) => /^dsh-whale-idle-blink-\d{2}\.webp$/.test(entry)),
    [],
    "individual idle blink WebP frames must not be packaged"
  );
});

test("growth closes the hunger loop without rewarding overfeeding", async () => {
  const core = await import("../assets/whale-moe-core.js");
  const hungry = core.default.computeGrowth({ satiety: 5 }, { type: "feed" }, Date.now(), 0);
  const full = core.default.computeGrowth({ satiety: 95 }, { type: "feed" }, Date.now(), 0);
  assert.equal(hungry.growth.satiety, 35);
  assert.equal(hungry.wasFull, false);
  assert.equal(full.growth.satiety, 100);
  assert.equal(full.wasFull, true);
  assert.ok(full.deltas.affinity < hungry.deltas.affinity);
});

test("desktop uses safe system monitoring and fallbacks for unavailable signals", async () => {
  const core = await import("../assets/whale-moe-core.js");
  const main = read("main.cjs");
  const preload = read("preload.cjs");
  const desktop = read("renderer/desktop.js");
  const presenter = read("assets/dsh-whale-moe.js");
  assert.match(main, /powerMonitor\.getSystemIdleTime\(\)/);
  assert.match(main, /powerMonitor\.on\("lock-screen"/);
  assert.match(main, /powerMonitor\.on\("resume"/);
  assert.match(preload, /onSystemState/);
  assert.match(desktop, /whale-desktop-system-state/);
  assert.match(presenter, /IDLE_ACTION_POOL\.concat\(DESKTOP_FALLBACK_ACTIONS\)/);
  assert.match(presenter, /state\.kind === "unlock"/);
  for (const pose of ["meme-broke", "meme-cry", "meme-heart", "meme-no", "meme-shock", "meme-yes"]) {
    assert.ok(core.default.DIALOGUE.idleAction[pose]?.length >= 4, `${pose} needs fallback dialogue`);
  }
});

test("computer status linkage is private, switchable, and fully voiced", async () => {
  const core = await import("../assets/whale-moe-core.js");
  const main = read("main.cjs");
  const preload = read("preload.cjs");
  const desktop = read("renderer/desktop.js");
  const settings = read("renderer/settings.js");
  const presenter = read("assets/dsh-whale-moe.js");
  assert.match(main, /classifyForegroundProcess/);
  assert.match(main, /os\.cpus\(\)/);
  assert.match(main, /os\.freemem\(\)/);
  assert.match(main, /Win32_Battery/);
  assert.match(main, /net\.isOnline\(\)/);
  assert.match(main, /whale:set-computer-link-enabled/);
  assert.doesNotMatch(main, /GetWindowText/);
  assert.match(preload, /onComputerState/);
  assert.match(desktop, /whale-desktop-computer-state/);
  assert.match(settings, /电脑状态联动/);
  assert.match(settings, /computer-link/);
  assert.match(presenter, /COMPUTER_LINK_ACTIONS/);
  assert.match(presenter, /cpuHotSamples >= 2/);
  for (const event of [
    "ide",
    "browser",
    "office",
    "media",
    "meeting",
    "terminal",
    "design",
    "game",
    "cpu-high",
    "memory-high",
    "battery-low",
    "plugged",
    "unplugged",
    "offline",
    "online"
  ]) {
    assert.ok(core.default.DIALOGUE.computer[event]?.length >= 3, `${event} needs computer-link dialogue`);
  }
});

test("background schedulers pause instead of polling hidden windows", () => {
  const main = read("main.cjs");
  const companion = read("renderer/companion.js");
  const presenter = read("assets/dsh-whale-moe.js");
  assert.match(main, /function stopCursorProbe\(\)/);
  assert.match(main, /function stopSystemStateSamples\(\)/);
  assert.match(main, /function startTopmostTimers\(\)/);
  assert.match(companion, /function scheduleTick\(delay\)/);
  assert.doesNotMatch(companion, /setInterval\(tick/);
  assert.match(presenter, /function scheduleIdleLoop\(delay\)/);
  assert.doesNotMatch(presenter, /__dshWhaleMoeIdleTimer = root\.setInterval/);
});
