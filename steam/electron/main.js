// 밈능검 Steam 래퍼 (Electron)
// App ID 발급 후: `npm i steamworks.js` 설치하고 아래 주석 해제
const { app, BrowserWindow } = require("electron");
const path = require("path");

// const steamworks = require("steamworks.js");
// const client = steamworks.init(APP_ID); // steam_appid.txt 또는 숫자 직접

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 860,
    resizable: true,
    autoHideMenuBar: true,
    title: "밈능검 — 밈 능력 검정시험(비공식)",
    webPreferences: { contextIsolation: true }
  });
  win.loadFile(path.join(__dirname, "app", "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
