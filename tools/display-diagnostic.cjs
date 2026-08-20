const { app, BrowserWindow, screen } = require("electron");

app.whenReady().then(async () => {
  const displays = screen.getAllDisplays();
  const left = Math.min(...displays.map((display) => display.bounds.x));
  const top = Math.min(...displays.map((display) => display.bounds.y));
  const right = Math.max(...displays.map((display) => display.bounds.x + display.bounds.width));
  const bottom = Math.max(...displays.map((display) => display.bounds.y + display.bounds.height));
  const requested = { x: left, y: top, width: right - left, height: bottom - top };
  const window = new BrowserWindow({
    x: requested.x,
    y: requested.y,
    width: 800,
    height: 600,
    maxWidth: requested.width,
    maxHeight: requested.height,
    resizable: false,
    maximizable: false,
    movable: false,
    show: false,
    frame: false,
    transparent: true
  });
  window.setMaximumSize(requested.width, requested.height);
  window.setBounds(requested, false);
  await window.loadURL("data:text/html,<body></body>");
  const renderer = await window.webContents.executeJavaScript("({ innerWidth, innerHeight, outerWidth, outerHeight, screenX, screenY, devicePixelRatio })");
  process.stdout.write(JSON.stringify({ displays, requested, actual: window.getBounds(), renderer }, null, 2));
  window.destroy();
  app.quit();
});
