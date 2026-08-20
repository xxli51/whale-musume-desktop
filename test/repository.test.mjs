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
  assert.equal(pkg.version, "1.0.0");
  assert.equal(pkg.build.extraResources[0].from, "assets");
  assert.match(main, /path\.join\(__dirname, "assets"\)/);
  assert.doesNotMatch(main, /path\.join\(__dirname, "\.\.", "assets"\)/);
});

test("all pose assets and desktop safety fixes are present", () => {
  const generated = path.join(root, "assets", "generated");
  const poses = readdirSync(generated).filter((name) => /^dsh-whale-state-.*\.webp$/.test(name));
  const presenter = read("assets/dsh-whale-moe.js");
  const settings = read("renderer/settings.js");
  assert.equal(poses.length, 89);
  assert.match(presenter, /Math\.min\(360, root\.innerWidth, root\.innerHeight\)/);
  assert.match(presenter, /if \(root\.__DSH_WHALE_DESKTOP__\) return;/);
  assert.match(settings, /Desktop v1\.0\.0/);
  assert.match(settings, /desktopSettingsX/);
});
