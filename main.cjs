const { app, BrowserWindow, Menu, Tray, nativeImage, screen, ipcMain } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let overlay = null;
let tray = null;
let quitting = false;
let mouseInteractive = false;

function assetDirectory() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "assets")
    : path.join(__dirname, "assets");
}

function applicationIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(__dirname, "build", "icon.png");
}

function asDirectoryUrl(directory) {
  return pathToFileURL(directory + path.sep).href;
}

function virtualDesktopBounds() {
  const displays = screen.getAllDisplays();
  const left = Math.min(...displays.map((display) => display.bounds.x));
  const top = Math.min(...displays.map((display) => display.bounds.y));
  const right = Math.max(...displays.map((display) => display.bounds.x + display.bounds.width));
  const bottom = Math.max(...displays.map((display) => display.bounds.y + display.bounds.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function fitVirtualDesktop() {
  if (!overlay || overlay.isDestroyed()) return;
  const next = virtualDesktopBounds();
  const current = overlay.getBounds();
  overlay.setMaximumSize(
    Math.max(current.width, next.width),
    Math.max(current.height, next.height)
  );
  overlay.setBounds(next, false);
  overlay.setMaximumSize(next.width, next.height);
}

function createOverlay() {
  const assets = assetDirectory();
  const desktop = virtualDesktopBounds();
  overlay = new BrowserWindow({
    x: desktop.x,
    y: desktop.y,
    width: Math.min(800, desktop.width),
    height: Math.min(600, desktop.height),
    maxWidth: desktop.width,
    maxHeight: desktop.height,
    transparent: true,
    icon: applicationIconPath(),
    backgroundColor: "#00000000",
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [
        `--whale-assets=${asDirectoryUrl(assets)}`,
        `--whale-generated=${asDirectoryUrl(path.join(assets, "generated"))}`,
        `--whale-calibration=${pathToFileURL(path.join(assets, "peek-calibration.json")).href}`
      ]
    }
  });

  overlay.setMaximumSize(desktop.width, desktop.height);
  overlay.setBounds(desktop, false);
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.loadFile(path.join(__dirname, "renderer", "index.html"));
  overlay.once("ready-to-show", () => overlay.showInactive());
  overlay.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      overlay.hide();
    }
  });
}

function refreshTrayMenu() {
  if (!tray) return;
  const shown = Boolean(overlay && overlay.isVisible());
  const launchAtLogin = app.getLoginItemSettings().openAtLogin;
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: shown ? "隐藏鲸鱼娘" : "显示鲸鱼娘",
      click: () => {
        if (!overlay) return;
        if (overlay.isVisible()) overlay.hide();
        else overlay.showInactive();
        refreshTrayMenu();
      }
    },
    {
      label: "回到右下角",
      click: () => overlay && overlay.webContents.send("whale:reset-position")
    },
    {
      label: "设置与动作",
      click: () => {
        if (!overlay) return;
        overlay.showInactive();
        overlay.webContents.send("whale:open-settings");
      }
    },
    { type: "separator" },
    {
      label: "开机启动",
      type: "checkbox",
      checked: launchAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked });
        refreshTrayMenu();
      }
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        quitting = true;
        app.quit();
      }
    }
  ]));
}

function createTray() {
  const iconPath = applicationIconPath();
  let icon = nativeImage.createFromPath(iconPath);
  if (!icon.isEmpty()) icon = icon.resize({ width: 32, height: 32 });
  tray = new Tray(icon);
  tray.setToolTip("鲸鱼娘桌面宠物");
  tray.on("click", () => {
    if (!overlay) return;
    if (overlay.isVisible()) overlay.hide();
    else overlay.showInactive();
    refreshTrayMenu();
  });
  refreshTrayMenu();
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (overlay) overlay.showInactive();
    refreshTrayMenu();
  });

  app.whenReady().then(() => {
    ipcMain.on("whale:set-mouse-interactive", (_event, interactive) => {
      const next = Boolean(interactive);
      if (!overlay || mouseInteractive === next) return;
      mouseInteractive = next;
      overlay.setIgnoreMouseEvents(!next, { forward: true });
    });
    ipcMain.on("whale:quit", () => {
      quitting = true;
      app.quit();
    });

    createOverlay();
    createTray();
    screen.on("display-metrics-changed", fitVirtualDesktop);
    screen.on("display-added", fitVirtualDesktop);
    screen.on("display-removed", fitVirtualDesktop);
  });
}

app.on("window-all-closed", () => {
  // Keep the tray process alive on Windows.
});

app.on("before-quit", () => {
  quitting = true;
});
