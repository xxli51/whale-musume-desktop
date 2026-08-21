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
    "renderer/index.html",
    "renderer/desktop.js",
    "renderer/settings.js",
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
  assert.equal(pkg.version, "2.1.0");
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
  assert.match(settings, /Desktop v2\.1\.0/);
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
  for (const legacyLink of [
    /dsh\.balance/,
    /dsh-whale-balance-low/,
    /data-slot=/,
    /data-phase=/,
    /data-status=/,
    /data-running/,
    /dshLogCluster/,
    /MutationObserver/,
  ]) {
    assert.doesNotMatch(presenter, legacyLink);
  }
  assert.doesNotMatch(desktop, /__DSH_WHALE_DESKTOP__/);
  assert.doesNotMatch(settings, /关键词感知/);
  assert.match(presenter, /IDLE_ACTION_POOL\.concat\(DESKTOP_FALLBACK_ACTIONS\)/);
  assert.match(settings, /var POSES = \[/);
  assert.deepEqual(core.default.QUEST_POOL.map((quest) => quest.metric).sort(), ["feed", "pat", "signin"]);
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
  assert.match(presenter, /pose !== memory\.lastIdleActionPose/);
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
    "ide", "browser", "office", "media", "meeting", "terminal", "design", "game",
    "cpu-high", "memory-high", "battery-low", "plugged", "unplugged", "offline", "online"
  ]) {
    assert.ok(core.default.DIALOGUE.computer[event]?.length >= 3, `${event} needs computer-link dialogue`);
  }
});
