const { app, BrowserWindow, Menu, Tray, nativeImage, screen, ipcMain, powerMonitor, net, shell } = require("electron");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { execFile } = require("node:child_process");
const { shouldRunComputerMonitor } = require("./runtime/computer-monitor-policy.cjs");
const { createDiagnostics } = require("./runtime/diagnostics.cjs");

let overlay = null;
let tray = null;
let quitting = false;
let mouseInteractive = false;
let cursorProbeTimer = null;
let systemStateTimer = null;
let computerStateTimer = null;
let topmostTimers = [];
let topmostWatchdogTimer = null;
let computerLinkEnabled = false;
let computerQuietActive = false;
let systemPaused = false;
let previousCpuTimes = null;
let foregroundQueryRunning = false;
let foregroundQueryProcess = null;
let foregroundQueryGeneration = 0;
let diagnostics = null;
let rendererRecoveryAttempts = 0;
let rendererRecoveryWindowAt = 0;
let lastWindowsQueryErrorAt = 0;
let cachedForeground = { process: "", category: "other" };
let cachedBattery = { present: false, percent: null, charging: null };
let lastBatteryQueryAt = 0;

const FOREGROUND_CATEGORIES = Object.freeze([
  ["ide", /^(idea64?|webstorm64?|pycharm64?|clion64?|goland64?|rider64?|studio64?|code|codium|devenv|eclipse)$/i],
  ["browser", /^(chrome|msedge|firefox|brave|opera|vivaldi)$/i],
  ["office", /^(winword|excel|powerpnt|outlook|wps|et|wpp|onenote)$/i],
  ["media", /^(spotify|cloudmusic|qqmusic|musicbee|vlc|potplayer|mpv|foobar2000)$/i],
  ["meeting", /^(teams|ms-teams|zoom|webex|slack|discord|dingtalk|wxwork|wechatwork)$/i],
  ["terminal", /^(windowsterminal|powershell|pwsh|cmd|conhost|wezterm|alacritty|mintty)$/i],
  ["design", /^(photoshop|illustrator|figma|blender|sketchbook|affinitydesigner|affinityphoto)$/i],
  ["game", /(win64-shipping|leagueclient|valorant|genshinimpact|starrail|minecraft|gameclient)/i]
]);

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

function overlayDesktopBounds() {
  const desktop = virtualDesktopBounds();
  // A borderless window that exactly matches a display can make Windows treat
  // the pet as a full-screen app and enable the user's automatic DND rule.
  // Keeping one transparent pixel outside the window avoids that classification
  // without affecting visible placement or cross-display dragging.
  return {
    x: desktop.x,
    y: desktop.y,
    width: Math.max(1, desktop.width - 1),
    height: Math.max(1, desktop.height - 1)
  };
}

function fitVirtualDesktop() {
  if (!overlay || overlay.isDestroyed()) return;
  const next = overlayDesktopBounds();
  const current = overlay.getBounds();
  overlay.setMaximumSize(
    Math.max(current.width, next.width),
    Math.max(current.height, next.height)
  );
  overlay.setBounds(next, false);
  overlay.setMaximumSize(next.width, next.height);
}

function clearTopmostTimers() {
  topmostTimers.forEach((timer) => clearTimeout(timer));
  topmostTimers = [];
  if (topmostWatchdogTimer) {
    clearInterval(topmostWatchdogTimer);
    topmostWatchdogTimer = null;
  }
}

function startTopmostTimers() {
  if (systemPaused || !overlay || overlay.isDestroyed() || !overlay.isVisible()) return;
  clearTopmostTimers();
  reinforceOverlayTopmost();
  [120, 800, 2200].forEach((delay) => {
    topmostTimers.push(setTimeout(reinforceOverlayTopmost, delay));
  });
  topmostWatchdogTimer = setInterval(reinforceOverlayTopmost, 3000);
}

function reinforceOverlayTopmost() {
  if (!overlay || overlay.isDestroyed() || !overlay.isVisible()) return;
  // Windows can briefly lose the TOPMOST z-order when the first transparent,
  // click-through window is shown while another app is taking foreground.
  // Reasserting the same non-fullscreen level fixes that race without focus.
  // Transparent click-through windows can lose TOPMOST during a later
  // Windows z-order change; use the strongest Electron level available.
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.moveTop();
}

function showOverlayInactive() {
  if (!overlay || overlay.isDestroyed()) return;
  overlay.showInactive();
  startTopmostTimers();
  startCursorProbe();
  startSystemStateSamples();
  reconcileComputerStateMonitor();
}

function hideOverlay() {
  if (!overlay || overlay.isDestroyed()) return;
  overlay.hide();
  clearTopmostTimers();
  stopCursorProbe();
  stopSystemStateSamples();
  reconcileComputerStateMonitor();
}

function createOverlay() {
  const assets = assetDirectory();
  const desktop = overlayDesktopBounds();
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
        `--whale-generated=${asDirectoryUrl(path.join(assets, "generated"))}`
      ]
    }
  });

  overlay.setMaximumSize(desktop.width, desktop.height);
  overlay.setBounds(desktop, false);
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.loadFile(path.join(__dirname, "renderer", "index.html"));
  overlay.once("ready-to-show", showOverlayInactive);
  overlay.webContents.on("did-finish-load", () => {
    logDiagnostic("info", "renderer-loaded", { url: overlay.webContents.getURL() });
  });
  overlay.webContents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
    if (isMainFrame) logDiagnostic("error", "renderer-load-failed", { code, description, url });
  });
  overlay.webContents.on("render-process-gone", (_event, details) => {
    logDiagnostic("error", "renderer-process-gone", details);
    recoverRenderer();
  });
  overlay.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      hideOverlay();
    }
  });
}

function startCursorProbe() {
  if (cursorProbeTimer || systemPaused || !overlay || overlay.isDestroyed() || !overlay.isVisible()) return;
  cursorProbeTimer = setInterval(() => {
    if (!overlay || overlay.isDestroyed() || !overlay.isVisible() || mouseInteractive) return;
    const cursor = screen.getCursorScreenPoint();
    const bounds = overlay.getBounds();
    if (
      cursor.x < bounds.x || cursor.y < bounds.y ||
      cursor.x >= bounds.x + bounds.width || cursor.y >= bounds.y + bounds.height
    ) return;
    overlay.webContents.send("whale:cursor-probe", {
      x: cursor.x - bounds.x,
      y: cursor.y - bounds.y
    });
  }, 80);
}

function stopCursorProbe() {
  if (!cursorProbeTimer) return;
  clearInterval(cursorProbeTimer);
  cursorProbeTimer = null;
}

function sendSystemState(kind) {
  if (!overlay || overlay.isDestroyed() || overlay.webContents.isDestroyed()) return;
  overlay.webContents.send("whale:system-state", {
    kind,
    idleSeconds: powerMonitor.getSystemIdleTime(),
    at: Date.now()
  });
}

function startSystemStateSamples() {
  if (systemStateTimer || systemPaused || !overlay || overlay.isDestroyed() || !overlay.isVisible()) return;
  sendSystemState("sample");
  systemStateTimer = setInterval(() => sendSystemState("sample"), 5000);
}

function stopSystemStateSamples() {
  if (!systemStateTimer) return;
  clearInterval(systemStateTimer);
  systemStateTimer = null;
}

function startSystemStateMonitor() {
  powerMonitor.on("lock-screen", () => {
    sendSystemState("lock");
    setSystemPaused(true);
  });
  powerMonitor.on("unlock-screen", () => {
    sendSystemState("unlock");
    setSystemPaused(false);
  });
  powerMonitor.on("suspend", () => {
    sendSystemState("suspend");
    setSystemPaused(true);
  });
  powerMonitor.on("resume", () => {
    sendSystemState("resume");
    setSystemPaused(false);
  });
}

function classifyForegroundProcess(processName) {
  const normalized = String(processName || "").replace(/\.exe$/i, "");
  const match = FOREGROUND_CATEGORIES.find((entry) => entry[1].test(normalized));
  return match ? match[0] : "other";
}

function cpuPercent() {
  const current = os.cpus().map((cpu) => cpu.times);
  if (!previousCpuTimes || previousCpuTimes.length !== current.length) {
    previousCpuTimes = current;
    return 0;
  }
  let idleDelta = 0;
  let totalDelta = 0;
  current.forEach((times, index) => {
    const before = previousCpuTimes[index];
    const total = times.user + times.nice + times.sys + times.idle + times.irq;
    const previousTotal = before.user + before.nice + before.sys + before.idle + before.irq;
    idleDelta += Math.max(0, times.idle - before.idle);
    totalDelta += Math.max(0, total - previousTotal);
  });
  previousCpuTimes = current;
  return totalDelta > 0 ? Math.round((1 - idleDelta / totalDelta) * 100) : 0;
}

function queryWindowsStatus(includeBattery, callback) {
  if (process.platform !== "win32") {
    callback(null);
    return null;
  }
  const script = [
    "Add-Type -Namespace WhaleMusume -Name NativeWindow -MemberDefinition '[System.Runtime.InteropServices.DllImport(\"user32.dll\")] public static extern System.IntPtr GetForegroundWindow(); [System.Runtime.InteropServices.DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(System.IntPtr hWnd, out uint processId);'",
    "$handle=[WhaleMusume.NativeWindow]::GetForegroundWindow()",
    "[uint32]$processId=0",
    "[WhaleMusume.NativeWindow]::GetWindowThreadProcessId($handle,[ref]$processId) | Out-Null",
    "$process=(Get-Process -Id $processId -ErrorAction SilentlyContinue).ProcessName",
    includeBattery
      ? "$battery=Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1; $result=[pscustomobject]@{process=$process;batteryPresent=[bool]$battery;batteryPercent=if($battery){[int]$battery.EstimatedChargeRemaining}else{$null};batteryCharging=if($battery){[int]$battery.BatteryStatus -in @(6,7,8,9,11)}else{$null}}"
      : "$result=[pscustomobject]@{process=$process}",
    "$result | ConvertTo-Json -Compress"
  ].join("; ");
  return execFile(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", script],
    { windowsHide: true, timeout: 5000, maxBuffer: 64 * 1024 },
    (error, stdout) => {
      if (error || !stdout.trim()) {
        const now = Date.now();
        if (error && now - lastWindowsQueryErrorAt >= 5 * 60000) {
          lastWindowsQueryErrorAt = now;
          logDiagnostic("warn", "windows-status-query-failed", { message: error.message, code: error.code });
        }
        callback(null);
        return;
      }
      try { callback(JSON.parse(stdout.trim())); } catch (_error) { callback(null); }
    }
  );
}

function sendComputerState() {
  if (!computerMonitorShouldRun() || foregroundQueryRunning) return;
  foregroundQueryRunning = true;
  const queryGeneration = ++foregroundQueryGeneration;
  const now = Date.now();
  const includeBattery = now - lastBatteryQueryAt >= 60000;
  const resource = {
    cpuPercent: cpuPercent(),
    memoryPercent: Math.round((1 - os.freemem() / os.totalmem()) * 100)
  };
  foregroundQueryProcess = queryWindowsStatus(includeBattery, (details) => {
    if (queryGeneration !== foregroundQueryGeneration) return;
    foregroundQueryProcess = null;
    foregroundQueryRunning = false;
    if (details && details.process) {
      cachedForeground = {
        process: String(details.process).slice(0, 80),
        category: classifyForegroundProcess(details.process)
      };
    }
    if (includeBattery) {
      lastBatteryQueryAt = now;
      if (details) {
        cachedBattery = {
          present: Boolean(details.batteryPresent),
          percent: Number.isFinite(details.batteryPercent) ? details.batteryPercent : null,
          charging: typeof details.batteryCharging === "boolean" ? details.batteryCharging : null
        };
      }
    }
    if (!computerMonitorShouldRun() || !overlay || overlay.isDestroyed() || overlay.webContents.isDestroyed()) return;
    let onBattery = false;
    try { onBattery = powerMonitor.isOnBatteryPower(); } catch (_error) { /* unsupported platform */ }
    overlay.webContents.send("whale:computer-state", {
      foreground: cachedForeground,
      resource,
      power: { ...cachedBattery, onBattery },
      network: { online: net.isOnline() },
      at: now
    });
  });
}

function setComputerLinkEnabled(enabled) {
  computerLinkEnabled = Boolean(enabled);
  reconcileComputerStateMonitor();
}

function logDiagnostic(level, event, details) {
  if (diagnostics && typeof diagnostics[level] === "function") diagnostics[level](event, details);
}

function recoverRenderer() {
  if (quitting || !overlay || overlay.isDestroyed()) return;
  const now = Date.now();
  if (now - rendererRecoveryWindowAt > 60000) {
    rendererRecoveryWindowAt = now;
    rendererRecoveryAttempts = 0;
  }
  rendererRecoveryAttempts += 1;
  if (rendererRecoveryAttempts > 3) {
    hideOverlay();
    logDiagnostic("error", "renderer-recovery-abandoned", { attempts: rendererRecoveryAttempts });
    return;
  }
  const delay = rendererRecoveryAttempts * 1000;
  setTimeout(() => {
    if (!quitting && overlay && !overlay.isDestroyed() && !overlay.webContents.isDestroyed()) {
      overlay.webContents.reload();
    }
  }, delay);
}

function setComputerQuietActive(active) {
  computerQuietActive = Boolean(active);
  reconcileComputerStateMonitor();
}

function setSystemPaused(paused) {
  systemPaused = Boolean(paused);
  if (systemPaused) {
    clearTopmostTimers();
    stopCursorProbe();
    stopSystemStateSamples();
  } else {
    startTopmostTimers();
    startCursorProbe();
    startSystemStateSamples();
  }
  reconcileComputerStateMonitor();
}

function computerMonitorShouldRun() {
  return shouldRunComputerMonitor({
    preferenceEnabled: computerLinkEnabled,
    quietActive: computerQuietActive,
    systemPaused,
    overlayVisible: Boolean(overlay && !overlay.isDestroyed() && overlay.isVisible())
  });
}

function reconcileComputerStateMonitor() {
  const shouldRun = computerMonitorShouldRun();
  if (!shouldRun) {
    if (computerStateTimer) {
      clearInterval(computerStateTimer);
      computerStateTimer = null;
    }
    cancelForegroundQuery();
    previousCpuTimes = null;
    return;
  }
  if (computerStateTimer) return;
  previousCpuTimes = null;
  sendComputerState();
  computerStateTimer = setInterval(sendComputerState, 10000);
}

function stopComputerStateMonitor() {
  if (computerStateTimer) {
    clearInterval(computerStateTimer);
    computerStateTimer = null;
  }
  cancelForegroundQuery();
  previousCpuTimes = null;
}

function cancelForegroundQuery() {
  foregroundQueryGeneration += 1;
  if (foregroundQueryProcess && !foregroundQueryProcess.killed) {
    try { foregroundQueryProcess.kill(); } catch (_error) { /* process already exited */ }
  }
  foregroundQueryProcess = null;
  foregroundQueryRunning = false;
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
        if (overlay.isVisible()) hideOverlay();
        else showOverlayInactive();
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
        showOverlayInactive();
        overlay.webContents.send("whale:open-settings");
      }
    },
    { type: "separator" },
    {
      label: "打开诊断日志目录",
      click: () => {
        const logsPath = app.getPath("logs");
        shell.openPath(logsPath).then((error) => {
          if (error) logDiagnostic("warn", "open-logs-failed", { error });
        });
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
    if (overlay.isVisible()) hideOverlay();
    else showOverlayInactive();
    refreshTrayMenu();
  });
  refreshTrayMenu();
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (overlay) showOverlayInactive();
    refreshTrayMenu();
  });

  app.whenReady().then(() => {
    app.setAppLogsPath();
    diagnostics = createDiagnostics({ directory: app.getPath("logs") });
    logDiagnostic("info", "app-ready", { version: app.getVersion(), platform: process.platform, arch: process.arch });
    process.on("uncaughtExceptionMonitor", (error, origin) => logDiagnostic("error", "uncaught-exception", { error: String(error && error.stack || error), origin }));
    process.on("unhandledRejection", (reason) => logDiagnostic("error", "unhandled-rejection", { reason: String(reason && reason.stack || reason) }));
    app.on("child-process-gone", (_event, details) => logDiagnostic("error", "child-process-gone", details));
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
    ipcMain.on("whale:set-computer-link-enabled", (_event, enabled) => {
      setComputerLinkEnabled(enabled);
    });
    ipcMain.on("whale:set-quiet-active", (_event, active) => {
      setComputerQuietActive(active);
    });
    ipcMain.on("whale:renderer-error", (event, details) => {
      if (!overlay || overlay.isDestroyed() || event.sender !== overlay.webContents) return;
      logDiagnostic("error", "renderer-error", {
        message: String(details && details.message || "").slice(0, 1000),
        stack: String(details && details.stack || "").slice(0, 8000)
      });
    });

    createOverlay();
    startSystemStateMonitor();
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
  logDiagnostic("info", "app-before-quit", null);
  stopCursorProbe();
  stopSystemStateSamples();
  stopComputerStateMonitor();
  clearTopmostTimers();
});
