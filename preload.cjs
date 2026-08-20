const { contextBridge, ipcRenderer } = require("electron");

function argument(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : "";
}

contextBridge.exposeInMainWorld("whaleDesktop", Object.freeze({
  assets: argument("whale-assets"),
  generated: argument("whale-generated"),
  calibration: argument("whale-calibration"),
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
  }
}));
