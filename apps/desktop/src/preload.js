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

  // Drive/Files downloads — separate from the video-review system above.
  // Saves straight to the person's normal OS Downloads folder using
  // Electron's native download manager.
  downloadToDownloadsFolder: (url) =>
    ipcRenderer.invoke("drive:download", { url }),

  onDriveDownloadProgress: (callback) => {
    ipcRenderer.on("drive-download:progress", (_event, data) => callback(data));
  },

  onDriveDownloadDone: (callback) => {
    ipcRenderer.on("drive-download:done", (_event, data) => callback(data));
  },
});