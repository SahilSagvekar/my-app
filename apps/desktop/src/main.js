// apps/desktop/src/main.js
//
// Option A: this Electron app is just a window pointed at the real
// website. No custom UI, no separate login screen — the real site's
// login page, dashboard, and review screens render exactly as they do
// in a browser. The only two things this file adds:
//
//  1. When the website's existing "Download" button is clicked inside
//     this app, save the video to the client's real disk instead of
//     doing a normal browser download (see the website-side patch in
//     ClientDashboard.tsx for the other half of this).
//  2. When the review screen requests a video for playback, and we
//     already have a local copy downloaded, transparently serve that
//     local file instead of streaming from the server — the website
//     never knows the difference.

const { app, BrowserWindow, ipcMain, session, protocol, net } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("node:path");
const fs = require("node:fs");
const { Readable } = require("node:stream");

// Custom scheme for serving locally-downloaded videos. We redirect the
// review screen's video requests here instead of straight to file://,
// because Chromium hard-blocks redirecting a network (https) request to
// file:// (net::ERR_UNSAFE_REDIRECT) as a security measure — a custom
// registered scheme doesn't hit that restriction. This MUST be called
// before app.whenReady().
protocol.registerSchemesAsPrivileged([
  {
    scheme: "e8video",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);

const SITE_ORIGIN = "https://e8productions.com";
const LOGIN_URL = `${SITE_ORIGIN}/login`;

const DOWNLOADS_DIR = path.join(app.getPath("userData"), "downloads");
const INDEX_FILE = path.join(app.getPath("userData"), "downloads-index.json");
const SETTINGS_FILE = path.join(app.getPath("userData"), "desktop-settings.json");

function ensureDownloadsDir() {
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  }
}

// --- Downloads index ---------------------------------------------------
// A simple JSON map of fileId -> { name, path, size, downloadedAt }.
// This is how we know (a) what's already downloaded, so the website's
// download button can skip re-downloading, and (b) what to redirect
// playback requests to. Kept in memory for fast lookups during request
// interception, persisted to disk so it survives app restarts.

let downloadsIndex = {};

function loadIndex() {
  try {
    if (fs.existsSync(INDEX_FILE)) {
      downloadsIndex = JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8"));
    }
  } catch (err) {
    console.error("Failed to load downloads index, starting fresh:", err);
    downloadsIndex = {};
  }
}

function saveIndex() {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(downloadsIndex, null, 2));
}

// --- Desktop-only settings (currently just the auto-download toggle) ---
// Defaults to enabled when no settings file exists yet — i.e. new users
// get auto-download on by default, and can switch it off from there.

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    }
  } catch (err) {
    console.error("Failed to load settings, using defaults:", err);
  }
  return { autoDownloadEnabled: true };
}

function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

function localPathForFile(fileId, fileName) {
  const ext = path.extname(fileName) || ".mp4";
  return path.join(DOWNLOADS_DIR, `${fileId}${ext}`);
}

// --- Window setup --------------------------------------------------------

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "E8 Client",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(LOGIN_URL);
}

// --- Local playback interception ----------------------------------------
// The review screen requests videos via /api/files/<id>/stream. If we
// already have that file downloaded locally, redirect the request to
// the local copy instead — same URL from the website's point of view,
// instant playback from disk under the hood.

const VIDEO_MIME_TYPES = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".m4v": "video/x-m4v",
  ".avi": "video/x-msvideo",
};

function guessMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return VIDEO_MIME_TYPES[ext] || "video/mp4";
}

// Answers e8video://<fileId> requests with the actual local file bytes,
// honoring the Range header so seeking/scrubbing in the video still
// works correctly (without this, playback works but skipping around
// does not).
function serveLocalFile(filePath, request) {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const mimeType = guessMimeType(filePath);
  const range = request.headers.get("range");

  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    const start = match ? parseInt(match[1], 10) : 0;
    const end = match && match[2] ? parseInt(match[2], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const nodeStream = fs.createReadStream(filePath, { start, end });
    return new Response(Readable.toWeb(nodeStream), {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": mimeType,
      },
    });
  }

  const nodeStream = fs.createReadStream(filePath);
  return new Response(Readable.toWeb(nodeStream), {
    status: 200,
    headers: {
      "Content-Length": String(fileSize),
      "Content-Type": mimeType,
      "Accept-Ranges": "bytes",
    },
  });
}

function setupPlaybackInterception() {
  // Handler for the custom scheme itself — e8video://<fileId>
  session.defaultSession.protocol.handle("e8video", (request) => {
    const fileId = request.url.replace("e8video://", "").split("/")[0];
    const entry = fileId && downloadsIndex[fileId];

    if (entry && fs.existsSync(entry.path)) {
      return serveLocalFile(entry.path, request);
    }

    return new Response("Not found", { status: 404 });
  });

  // Narrow, scoped interception — ONLY matches the exact video-stream
  // URL pattern. Every other request (the page itself, its JS/CSS,
  // every other API call) is completely untouched and behaves exactly
  // as if this code didn't exist.
  const filter = { urls: [`${SITE_ORIGIN}/api/files/*/stream*`] };

  session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
    const match = details.url.match(/\/api\/files\/([^/]+)\/stream/);
    const fileId = match?.[1];

    const entry = fileId && downloadsIndex[fileId];
    if (entry && fs.existsSync(entry.path)) {
      callback({ redirectURL: `e8video://${fileId}` });
      return;
    }

    callback({}); // not downloaded — let it hit the server as normal
  });
}

// --- Download IPC handler -----------------------------------------------
// Called from the website's own JS (via the bridge in preload.js) when
// the existing Download button is clicked inside this app. Auth reuses
// the same cookie the website itself just logged in with — no separate
// token/login flow needed.

ipcMain.handle("download:start", async (event, { fileId, fileName }) => {
  ensureDownloadsDir();

  // Already downloaded? Nothing to do.
  const existing = downloadsIndex[fileId];
  if (existing && fs.existsSync(existing.path)) {
    return { success: true, alreadyDownloaded: true };
  }

  const cookies = await session.defaultSession.cookies.get({
    url: SITE_ORIGIN,
    name: "authToken",
  });
  const authCookie = cookies[0]?.value;
  if (!authCookie) {
    return { success: false, message: "Not logged in" };
  }

  const destPath = localPathForFile(fileId, fileName);
  const tempPath = destPath + ".part";

  try {
    const res = await fetch(`${SITE_ORIGIN}/api/files/${fileId}/download`, {
      headers: { Cookie: `authToken=${authCookie}` },
    });

    if (!res.ok || !res.body) {
      return { success: false, message: `Download failed (${res.status})` };
    }

    const totalBytes = Number(res.headers.get("content-length")) || 0;
    let receivedBytes = 0;

    const fileStream = fs.createWriteStream(tempPath);
    const reader = res.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      fileStream.write(value);
      receivedBytes += value.length;

      if (totalBytes > 0) {
        const percent = Math.round((receivedBytes / totalBytes) * 100);
        event.sender.send("download:progress", { fileId, percent });
      }
    }

    await new Promise((resolve, reject) => {
      fileStream.end((err) => (err ? reject(err) : resolve()));
    });

    fs.renameSync(tempPath, destPath);

    downloadsIndex[fileId] = {
      name: fileName,
      path: destPath,
      size: receivedBytes,
      downloadedAt: new Date().toISOString(),
    };
    saveIndex();

    event.sender.send("download:progress", { fileId, percent: 100 });

    return { success: true };
  } catch (err) {
    console.error("Download error:", err);
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    return { success: false, message: err.message || "Download failed" };
  }
});

ipcMain.handle("download:isDownloaded", async (_event, { fileId }) => {
  const entry = downloadsIndex[fileId];
  return !!(entry && fs.existsSync(entry.path));
});

// --- Auto-download setting IPC handlers ---------------------------------

ipcMain.handle("settings:getAutoDownload", async () => {
  return loadSettings().autoDownloadEnabled;
});

ipcMain.handle("settings:setAutoDownload", async (_event, { enabled }) => {
  const settings = loadSettings();
  settings.autoDownloadEnabled = !!enabled;
  saveSettings(settings);
  return settings.autoDownloadEnabled;
});

// --- App lifecycle -----------------------------------------------------

app.whenReady().then(() => {
  loadIndex();
  setupPlaybackInterception();
  createWindow();

  // Auto-update check — only meaningful for a real installed app (reads
  // the publish config baked in at build time, see package.json). Running
  // this during `npm start` dev would just error since there's no
  // packaged installer to compare against, so it's skipped entirely then.
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error("Auto-update check failed:", err);
    });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});