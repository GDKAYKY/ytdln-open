const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  protocol,
  net,
  dialog,
} = require("electron");
const path = require("node:path");
const url = require("node:url");
const { spawn, execFileSync, execFile } = require("node:child_process");
const util = require("node:util");
const execFileAsync = util.promisify(execFile);
const BinaryDownloader = require("./bin-downloader");
// INICIO
const VideoDownloader = require("./video-downloader");
const libraryManager = require("./main/library-manager");
const queueManager = require("./main/queue-manager");
const server = require("./server");
// FIM
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const crypto = require("node:crypto");

// ============================================================================
// PROTOCOL REGISTRATION (MUST be before app.whenReady())
// ============================================================================
// Register custom protocols as privileged for security and functionality
// Will be executed in the main async block

// Register custom protocol for Deep Linking
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("ytdln-open", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient("ytdln-open");
}

let mainWindow = null;

// Ensure only one instance of the app is running
const gotTheLock = app.requestSingleInstanceLock();

if (gotTheLock) {
  app.on("second-instance", (event, commandLine) => {
    // Command comes as an array, protocol URL is usually the last item
    const deepLinkUrl = commandLine.find((arg) =>
      arg.startsWith("ytdln-open://")
    );
    if (deepLinkUrl) {
      // Process deep link silently without bringing window to front
      handleDeepLink(deepLinkUrl);
    }
  });
} else {
  app.quit();
}

function handleDeepLink(urlStr) {
  try {
    console.log(`[DeepLink] Received deep link, length: ${urlStr.length}`);
    
    // Validate URL size (Windows limit is ~32KB, but we allow up to 3500 for safety)
    if (urlStr.length > 3500) {
      console.error(`[DeepLink] URL exceeds maximum allowed size (${urlStr.length} > 3500 chars)`);
      return;
    }

    console.log("[DeepLink] URL size valid, parsing...");
    const parsedUrl = new URL(urlStr);
    
    // Example: ytdln-open://download?url=https://youtube.com/watch?v=...&settings=ey...
    const videoUrl = parsedUrl.searchParams.get("url");
    const settingsStr = parsedUrl.searchParams.get("settings");
    
    console.log(`[DeepLink] Video URL: ${videoUrl ? "present" : "missing"}`);
    console.log(`[DeepLink] Settings: ${settingsStr ? "present" : "missing"}`);
    
    let externalSettings = null;

    if (settingsStr) {
      try {
        const decoded = Buffer.from(settingsStr, "base64").toString("utf8");
        externalSettings = JSON.parse(decoded);
        console.log("[DeepLink] Settings decoded successfully");
      } catch (e) {
        console.error("[DeepLink] Error decoding external settings:", e);
      }
    }

    if (videoUrl) {
      let cleanVideoUrl = videoUrl;
      // Sanitize blob URLs coming from older extension versions or edge cases
      if (cleanVideoUrl.startsWith("blob:")) {
        const match = new RegExp(/blob:(https?:\/\/.+)/).exec(cleanVideoUrl);
        if (match) cleanVideoUrl = match[1];
      }

      // For extension requests, use streaming mode (PREPARE_NATIVE_DOWNLOAD)
      // This will prepare a stream and return a downloadId for the browser
      console.log(`[DeepLink] Preparing native stream for extension with URL: ${cleanVideoUrl}`);
      
      // Call server directly to prepare the stream
      // Pass the stored WebSocket connection so extension gets notified
      server.handleNativeDownloadFlow({
        url: cleanVideoUrl,
        settings: externalSettings,
      }, server.extensionWs);
    } else {
      console.warn(`[DeepLink] Cannot process: videoUrl is missing`);
    }
  } catch (e) {
    console.error("[DeepLink] Error processing deep link:", e);
  }
}

const ALLOWED_IPC_CHANNELS = new Set([
  "download-video",
  "download-video-with-settings",
  "check-binaries-status",
  "download-progress",
  "download-success",
  "download-error",
  "binaries-status",
  "open-downloads-folder",
  "get-downloaded-files",
  "delete-downloaded-file",
  "open-file-location",
  "open-video-file",
  "select-folder",
  "open-specific-folder",
  "move-temp-files-to-downloads",
  "clean-temp-files",
  "queue:add",
  "queue:remove",
  "queue:get-state",
  "queue:update",
  "queue:progress",
]);

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates if the IPC sender is trusted (comes from the app's main window)
 * Prevents malicious iframes or external content from using IPC channels
 * @param {IpcMainEvent} event - IPC event
 * @returns {boolean} true if sender is trusted
 */
function validateIpcSender(event) {
  try {
    const senderUrl = event.sender.getURL();
    // Accept app URLs (file:// or app://)
    if (senderUrl.startsWith("file://") || senderUrl.startsWith("app://")) {
      return true;
    }
    console.warn(`Unauthorized IPC sender: ${senderUrl}`);
    return false;
  } catch (error) {
    console.error("Error validating IPC sender:", error);
    return false;
  }
}

function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    return ["http:", "https:"].includes(urlObj.protocol);
  } catch {
    throw new Error("Invalid URL");
  }
}

function sanitizeArgs(args) {
  return args.map((arg) => {
    if (typeof arg === "string") {
      return arg.replaceAll(/[;&|`$[\]{}]/g, "");
    }
    return arg;
  });
}

function validateIpcChannel(channel) {
  if (!ALLOWED_IPC_CHANNELS.has(channel)) {
    throw new Error(`IPC channel not allowed: ${channel}`);
  }
}

// ============================================================================
// BINARY VALIDATION AND SECURITY
// ============================================================================
function safeExecFile(command, args = [], options = {}) {
  try {
    const result = execFileSync(command, args, {
      encoding: "utf8",
      timeout: 1000,
      ...options,
    });
    return result.trim();
  } catch (error) {
    console.error(`Error executing command: ${command}`, error);
    return null;
  }
}

function findSystemBinary(binaryName) {
  if (process.platform === "win32") {
    const result = safeExecFile("where", [binaryName]);
    return result ? result.split("\n")[0].trim() : null;
  } else {
    const result = safeExecFile("which", [binaryName]);
    return result || null;
  }
}

// scanDownloadsDir moved to library-manager

// ============================================================================
// BINARY MANAGEMENT
// ============================================================================

// videoDownloader and binaryPaths initialized in app lifecycle
let videoDownloader = null;
let binaryPaths = null;

async function initializeBinaries() {
  try {
    videoDownloader = new VideoDownloader();
    await videoDownloader.init();
    binaryPaths = videoDownloader.binaries;
    libraryManager.setBinaryPaths(binaryPaths);

    console.log("✓ Binaries initialized and validated:", binaryPaths);
    return binaryPaths; // Return downloaded paths
  } catch (error) {
    console.error("Error initializing binaries (Attempting Fallback):", error);

    // Try to use system binaries as fallback
    const fallbackPaths = {
      ytdlp: findSystemBinary("yt-dlp"),
      ffmpeg: findSystemBinary("ffmpeg"),
    };

    if (fallbackPaths.ytdlp && fallbackPaths.ffmpeg) {
      console.log("Using system binaries as fallback");

      binaryPaths = fallbackPaths; // Update global variable
      libraryManager.setBinaryPaths(fallbackPaths);

      return fallbackPaths; // Return system paths
    }

    // If fallback fails, throw the error
    throw error;
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function validateVideoUrlOrNotify(event, videoUrl) {
  if (!videoUrl || typeof videoUrl !== "string") {
    event.sender.send("download-error", "Video URL is required.");
    return false;
  }
  if (!isValidUrl(videoUrl)) {
    event.sender.send(
      "download-error",
      "Invalid URL or unsupported domain."
    );
    return false;
  }
  return true;
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

/**
 * Creates an IPC handler with standardized error handling, sender validation, and channel validation
 * @param {string} channel - IPC channel name
 * @param {Function} handler - Handler function (can be async)
 */
function createIpcHandler(channel, handler) {
  ipcMain.on(channel, async (event, ...args) => {
    try {
      // Validate sender first (critical security)
      if (!validateIpcSender(event)) {
        throw new Error("Unauthorized IPC sender");
      }

      // Validate channel
      validateIpcChannel(channel);

      // Execute handler
      await handler(event, ...args);
    } catch (error) {
      console.error(`Error on channel '${channel}':`, error);
      event.sender.send(
        "download-error",
        error.message || "Unknown internal error"
      );
    }
  });
}

// START - Extension streaming only
createIpcHandler(
  "download-video-with-settings",
  async (event, videoUrl, settings) => {
    console.log("[IPC] download-video-with-settings received (not used in native mode)");
  }
);
// END

createIpcHandler("download-video", async (event, videoUrl) => {
  console.log("[IPC] download-video received (not used in native mode)");
});

ipcMain.on("check-binaries-status", (event) => {
  try {
    // Validate sender
    if (!validateIpcSender(event)) {
      throw new Error("Unauthorized IPC sender");
    }

    validateIpcChannel("check-binaries-status");

    if (binaryPaths) {
      const appMode = "standard";
      event.sender.send("binaries-status", {
        status: "ready",
        paths: binaryPaths,
        platform: process.platform,
        arch: process.arch,
        appMode: appMode,
      });
    } else {
      event.sender.send("binaries-status", {
        status: "not-ready",
        message: "Binaries have not been initialized yet",
      });
    }
  } catch (error) {
    console.error("Error checking binaries status:", error);
    event.sender.send("binaries-status", {
      status: "error",
      message: `Internal error: ${error.message} \n ${error.stack}`,
    });
  }
});

createIpcHandler("open-downloads-folder", async () => {
  const downloadsPath = app.getPath("downloads");
  await shell.openPath(downloadsPath);
});

// Library Integrity Handlers
const libraryIntegrity = require("./main/library-integrity");

ipcMain.handle("library:check-integrity", async () => {
  try {
    const report = await libraryIntegrity.checkLibraryIntegrity();
    return { success: true, data: report };
  } catch (error) {
    console.error("Error checking integrity:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("library:generate-report", async () => {
  try {
    const report = await libraryIntegrity.generateLibraryReport();
    return { success: true, data: report };
  } catch (error) {
    console.error("Error generating report:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("library:repair", async (event, options) => {
  try {
    const report = await libraryIntegrity.repairLibrary(options);
    return { success: true, data: report };
  } catch (error) {
    console.error("Error repairing library:", error);
    return { success: false, error: error.message };
  }
});

createIpcHandler("get-downloaded-files", async (event, paths) => {
  // paths is expected to be { musicFolder: string, videoFolder: string }
  const foldersToScan = [];
  if (paths?.musicFolder) foldersToScan.push(paths.musicFolder);
  if (paths?.videoFolder) foldersToScan.push(paths.videoFolder);

  const files = await libraryManager.getDownloadedFiles(foldersToScan);
  // Transform paths to media:// protocol URLs for renderer
  // URLs must strictly use forward slashes and encoding, even on Windows.
  const safeFiles = files.map((f) => ({
    ...f,
    thumbnail: f.thumbnail
      ? url.pathToFileURL(f.thumbnail).href.replace("file:", "media:")
      : "",
  }));
  event.sender.send("downloaded-files-list", safeFiles);
});

createIpcHandler("delete-downloaded-file", async (event, fileId) => {
  const file = libraryManager.getFileById(fileId);

  if (file?.filePath) {
    try {
      await fsPromises.access(file.filePath);
      await fsPromises.unlink(file.filePath);
    } catch (error) {
      console.warn(`File not found when deleting: ${file.filePath}`);
    }
  }

  libraryManager.removeDownloadedFile(fileId);
  event.sender.send("file-deleted", fileId);
});

createIpcHandler("open-file-location", async (event, fileId) => {
  const file = libraryManager.getFileById(fileId);
  const filePath = file?.filePath;

  if (filePath) {
    try {
      await fsPromises.access(filePath);
      shell.showItemInFolder(filePath);
    } catch (error) {
      throw new Error("File not found.");
    }
  } else {
    throw new Error("File not found.");
  }
});

createIpcHandler("open-video-file", async (event, fileId) => {
  const file = libraryManager.getFileById(fileId);

  if (file?.filePath) {
    try {
      await fsPromises.access(file.filePath);
      await shell.openPath(file.filePath);
    } catch (error) {
      throw new Error("File not found.");
    }
  } else {
    throw new Error("File not found.");
  }
});

createIpcHandler("select-folder", async (event, type) => {
  const { cancelled, filePaths } = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (!cancelled && filePaths.length > 0) {
    event.sender.send("folder-selected", { path: filePaths[0], type });
  }
});

createIpcHandler("open-specific-folder", async (event, folderPath) => {
  if (folderPath) {
    try {
      await fsPromises.access(folderPath);
      await shell.openPath(folderPath);
    } catch (error) {
      // If invalid or empty, open default downloads
      await shell.openPath(app.getPath("downloads"));
    }
  } else {
    // If invalid or empty, open default downloads
    await shell.openPath(app.getPath("downloads"));
  }
});

createIpcHandler("move-temp-files-to-downloads", async (event) => {
  // Placeholder implementation for now
  event.sender.send("download-success", "Feature under development.");
});

createIpcHandler("clean-temp-files", async (event) => {
  try {
    const thumbDir = path.join(app.getPath("userData"), "thumbnails");
    try {
      await fsPromises.access(thumbDir);
      const files = await fsPromises.readdir(thumbDir);
      for (const file of files) {
        await fsPromises.unlink(path.join(thumbDir, file)).catch(() => {});
      }
    } catch (error) {
      // Directory does not exist, nothing to do
    }
    event.sender.send("download-success", "Temp files (cache) cleaned.");
  } catch (error) {
    event.sender.send(
      "download-error",
      "Failed to clean temp files: " + error.message
    );
  }
});

// ============================================================================
// WINDOW MANAGEMENT
// ============================================================================

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true, // Security enforced, using media:// protocol
    },
    autoHideMenuBar: true,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.loadFile(path.join(__dirname, "../ui/dist/index.html"));
  return mainWindow;
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================

// Register custom protocols as privileged for security and functionality
// MUST be called before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: "media",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
  {
    scheme: "ytdln-open",
    privileges: {
      standard: true,
      secure: true,
    },
  },
]);

(async () => {
  try {
    await app.whenReady();

    protocol.handle("media", async (request) => {
      try {
        // Convert custom media: URL back to file: URL
        const fileUrl = request.url.replace(/^media:/, "file:");
        // Convert file: URL to absolute system path (handles Windows backslashes correctly)
        const filePath = url.fileURLToPath(fileUrl);

        // Validate that the path is within allowed directories
        // (downloads, userData, etc.) to prevent path traversal
        const downloadsPath = app.getPath("downloads");
        const userDataPath = app.getPath("userData");
        const normalizedPath = path.normalize(filePath);
        const normalizedDownloads = path.normalize(downloadsPath);
        const normalizedUserData = path.normalize(userDataPath);

        console.log(`[Media] Request: ${fileUrl}`);
        console.log(`[Media] Normalized path: ${normalizedPath}`);
        console.log(`[Media] Downloads: ${normalizedDownloads}`);
        console.log(`[Media] UserData: ${normalizedUserData}`);

        const isAllowed =
          normalizedPath.startsWith(normalizedDownloads) ||
          normalizedPath.startsWith(normalizedUserData);

        if (!isAllowed) {
          console.warn(`[Media] Access denied to file: ${filePath}`);
          return new Response("Forbidden", { status: 403 });
        }

        // Check if file exists before fetching
        await fsPromises.access(filePath);
        console.log(`[Media] Serving file: ${filePath}`);

        return net.fetch(url.pathToFileURL(filePath).toString());
      } catch (e) {
        console.error("[Media] Protocol error:", e);
        return new Response("Not found", { status: 404 });
      }
    });

    // Create window on startup
    createWindow();

    // On Windows/Linux, process the startup URL if present
    const startUrl = process.argv.find((arg) =>
      arg.startsWith("ytdln-open://")
    );
    if (startUrl) {
      // Small delay to ensure renderer is ready
      setTimeout(() => handleDeepLink(startUrl), 2000);
    }

    try {
      console.log("Initializing binaries...");
      await initializeBinaries();

      // Notify renderer that app is ready using existing channel
      if (mainWindow && !mainWindow.isDestroyed()) {
        const appMode = "standard";
        mainWindow.webContents.send("binaries-status", {
          status: "ready",
          paths: binaryPaths,
          platform: process.platform,
          arch: process.arch,
          appMode: appMode,
        });
      }

      libraryManager.loadDownloadedFiles();
      await queueManager.init();
      server.setDownloader(videoDownloader);
      await server.init();

      console.log("[App] Initialization complete - Extension streaming mode active");
    } catch (initError) {
      console.error("Binary initialization failed:", initError);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("binaries-status", {
          status: "error",
          message: `Failed to initialize binaries: ${initError.message}`,
        });
      }
    }
  } catch (error) {
    console.error("Error initializing application:", error);
  }
})();
app.on("activate", function () {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    mainWindow.show();
  } else if (mainWindow && mainWindow.isVisible() === false) {
    mainWindow.show();
  }
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  server.close();
});
