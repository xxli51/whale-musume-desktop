"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.dirname(__dirname);
const ignored = new Set([".git", "node_modules", "dist", "dist-next", "build", "generated"]);
const extensions = new Set([".js", ".cjs", ".mjs"]);

function collect(directory, output) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(fullPath, output);
    else if (extensions.has(path.extname(entry.name))) output.push(fullPath);
  }
}

const files = [];
collect(root, files);
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Syntax check failed: ${file}\n`);
    process.exit(result.status || 1);
  }
}
process.stdout.write(`Syntax OK: ${files.length} files\n`);
