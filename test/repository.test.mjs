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
  assert.match(presenter, /if \(motionReduced\(\)\) \{ announceEntrance\(\); return; \}/);
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
  assert.match(presenter, /core\.pointerThrowStep\(pointerThrowState/);
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
