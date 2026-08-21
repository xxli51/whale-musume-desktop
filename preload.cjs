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
  quit() {
    ipcRenderer.send("whale:quit");
  },
  onResetPosition(callback) {
    ipcRenderer.on("whale:reset-position", () => callback());
  },
  onOpenSettings(callback) {
    ipcRenderer.on("whale:open-settings", () => callback());
  },
  onCursorProbe(callback) {
    ipcRenderer.on("whale:cursor-probe", (_event, point) => callback(point));
  },
  onSystemState(callback) {
    ipcRenderer.on("whale:system-state", (_event, state) => callback(state));
  },
  setComputerLinkEnabled(enabled) {
    ipcRenderer.send("whale:set-computer-link-enabled", Boolean(enabled));
  },
  onComputerState(callback) {
    ipcRenderer.on("whale:computer-state", (_event, state) => callback(state));
  }
}));
