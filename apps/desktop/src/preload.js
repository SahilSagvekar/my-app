// apps/desktop/src/preload.js
//
// This is the ONLY bridge between the real website's own JS and the
// desktop app. It exposes exactly what's listed here under window.e8 —
// the website checks `window.e8?.isDesktopApp` to know it's running
// inside the desktop shell (vs. a normal browser tab) and behaves
// accordingly.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("e8", {
  isDesktopApp: true,

  downloadFile: (fileId, fileName) =>
    ipcRenderer.invoke("download:start", { fileId, fileName }),

  isDownloaded: (fileId) =>
    ipcRenderer.invoke("download:isDownloaded", { fileId }),

  onDownloadProgress: (callback) => {
    ipcRenderer.on("download:progress", (_event, data) => callback(data));
  },

  getAutoDownloadSetting: () =>
    ipcRenderer.invoke("settings:getAutoDownload"),

  setAutoDownloadSetting: (enabled) =>
    ipcRenderer.invoke("settings:setAutoDownload", { enabled }),
});