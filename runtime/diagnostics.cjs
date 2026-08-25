"use strict";

const fs = require("node:fs");
const path = require("node:path");

function safeDetails(value) {
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return { value: String(value) };
  }
}

function createDiagnostics(options) {
  const directory = options && options.directory;
  if (!directory) throw new TypeError("diagnostics directory is required");
  const maxBytes = Math.max(1024, Number(options.maxBytes) || 1024 * 1024);
  const now = options && typeof options.now === "function" ? options.now : Date.now;
  const filePath = path.join(directory, "whale-musume.log");
  const previousPath = filePath + ".1";
  fs.mkdirSync(directory, { recursive: true });

  function rotateIfNeeded() {
    try {
      if (fs.statSync(filePath).size < maxBytes) return;
      try {
        fs.rmSync(previousPath, { force: true });
      } catch (_error) {
        /* absent or locked */
      }
      fs.renameSync(filePath, previousPath);
    } catch (_error) {
      /* first write or inaccessible file */
    }
  }

  function log(level, event, details) {
    const entry = {
      at: new Date(now()).toISOString(),
      level: String(level || "info"),
      event: String(event || "unknown"),
      details: safeDetails(details)
    };
    try {
      rotateIfNeeded();
      fs.appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf8");
    } catch (_error) {
      /* diagnostics must never crash the app */
    }
    return entry;
  }

  return Object.freeze({
    filePath,
    info: (event, details) => log("info", event, details),
    warn: (event, details) => log("warn", event, details),
    error: (event, details) => log("error", event, details)
  });
}

module.exports = Object.freeze({ createDiagnostics, safeDetails });
