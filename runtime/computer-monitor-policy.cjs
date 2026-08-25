"use strict";

function shouldRunComputerMonitor(state) {
  const current = state && typeof state === "object" ? state : {};
  return (
    current.preferenceEnabled === true &&
    current.overlayVisible === true &&
    current.quietActive !== true &&
    current.systemPaused !== true
  );
}

module.exports = Object.freeze({ shouldRunComputerMonitor });
