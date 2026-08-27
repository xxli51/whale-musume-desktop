const { contextBridge, ipcRenderer } = require("electron");

function argument(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : "";
}

contextBridge.exposeInMainWorld("whaleDesktop", Object.freeze({
  assets: argument("whale-assets"),
  generated: argument("whale-generated"),
  setMouseInteractive(interactive) {
    ipcRenderer.send("whale:set-mouse-interactive", Boolean(interactive));
  },
  getDesktopSettings() {
    return ipcRenderer.invoke("whale:get-desktop-settings");
  },
  setLaunchAtLogin(enabled) {
    ipcRenderer.send("whale:set-launch-at-login", Boolean(enabled));
  },
  setAlwaysOnTop(enabled) {
    ipcRenderer.send("whale:set-always-on-top", Boolean(enabled));
  },
  setSettingsVisible(visible) {
    ipcRenderer.send("whale:settings-visible", Boolean(visible));
  },
  quit() {
    ipcRenderer.send("whale:quit");
  },
  onResetPosition(callback) {
    ipcRenderer.on("whale:reset-position", () => callback());
  },
  onOpenSettings(callback) {
    ipcRenderer.on("whale:open-settings", () => callback());
  },
  onOpenHouse(callback) {
    ipcRenderer.on("whale:open-house", () => callback());
  },
  onOpenDailySummary(callback) {
    ipcRenderer.on("whale:open-daily-summary", () => callback());
  },
  setAdventureAway(away) {
    ipcRenderer.send("whale:set-adventure-away", Boolean(away));
  },
  onRecallAdventure(callback) {
    ipcRenderer.on("whale:recall-adventure", () => callback());
  },
  onCursorProbe(callback) {
    ipcRenderer.on("whale:cursor-probe", (_event, point) => callback(point));
  },
  onDisplayBounds(callback) {
    ipcRenderer.on("whale:display-bounds", (_event, displays) => callback(displays));
  },
  onSystemState(callback) {
    ipcRenderer.on("whale:system-state", (_event, state) => callback(state));
  },
  setComputerLinkEnabled(enabled) {
    ipcRenderer.send("whale:set-computer-link-enabled", Boolean(enabled));
  },
  setWindowPerchEnabled(enabled) {
    ipcRenderer.send("whale:set-window-perch-enabled", Boolean(enabled));
  },
  setQuietActive(active) {
    ipcRenderer.send("whale:set-quiet-active", Boolean(active));
  },
  setProfessionEnabled(enabled) {
    ipcRenderer.send("whale:set-profession-enabled", Boolean(enabled));
  },
  reportError(details) {
    ipcRenderer.send("whale:renderer-error", {
      message: String(details && details.message || "").slice(0, 1000),
      stack: String(details && details.stack || "").slice(0, 8000)
    });
  },
  onComputerState(callback) {
    ipcRenderer.on("whale:computer-state", (_event, state) => callback(state));
  }
}));
