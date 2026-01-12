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
const StreamDownloadAPI = require("./stream-download-api");
// FIM
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const crypto = require("node:crypto");

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
]);

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    return ["http:", "https:"].includes(urlObj.protocol);
  } catch {
    throw new Error("URL inválida");
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
    throw new Error(`Canal IPC não permitido: ${channel}`);
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
    console.error(`Erro ao executar comando: ${command}`, error);
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

// binaryDownloader removed as it was unused and uninitialized
let videoDownloader = null;
let binaryPaths = null;
let streamDownloadAPI = null;

// INICIO
async function initializeBinaries() {
  try {
    videoDownloader = new VideoDownloader();
    await videoDownloader.init();
    binaryPaths = videoDownloader.binaries;
    libraryManager.setBinaryPaths(binaryPaths);

    console.log("✓ Binários inicializados e validados:", binaryPaths);
    return binaryPaths; // Retorna os caminhos baixados
  } catch (error) {
    console.error("Erro ao inicializar binários (Tentando Fallback):", error);

    // Tentar usar binários do sistema como fallback
    const fallbackPaths = {
      ytdlp: findSystemBinary("yt-dlp"),
      ffmpeg: findSystemBinary("ffmpeg"),
    };

    if (fallbackPaths.ytdlp && fallbackPaths.ffmpeg) {
      console.log("Usando binários do sistema como fallback");

      binaryPaths = fallbackPaths; // Atualiza a variável global
      libraryManager.setBinaryPaths(fallbackPaths);

      return fallbackPaths; // Retorna os caminhos do sistema
    }

    // Se o fallback falhar, lança o erro.
    throw error;
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function validateVideoUrlOrNotify(event, videoUrl) {
  if (!videoUrl || typeof videoUrl !== "string") {
    event.sender.send("download-error", "URL do vídeo é obrigatória.");
    return false;
  }
  if (!isValidUrl(videoUrl)) {
    event.sender.send(
      "download-error",
      "URL inválida ou domínio não suportado."
    );
    return false;
  }
  return true;
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

/**
 * Cria um handler IPC com tratamento de erro e validação padronizados
 * @param {string} channel - Nome do canal IPC
 * @param {Function} handler - Função handler (pode ser async)
 */
function createIpcHandler(channel, handler) {
  ipcMain.on(channel, async (event, ...args) => {
    try {
      validateIpcChannel(channel);
      await handler(event, ...args);
    } catch (error) {
      console.error(`Erro no canal '${channel}':`, error);
      event.sender.send(
        "download-error",
        error.message || "Erro interno desconhecido"
      );
    }
  });
}

// INICIO
createIpcHandler(
  "download-video-with-settings",
  async (event, videoUrl, settings) => {
    if (!validateVideoUrlOrNotify(event, videoUrl)) return;

    try {
      const { detectedPath, duration } = await videoDownloader.download(
        videoUrl,
        settings,
        {
          onProgress: (msg) => event.sender.send("download-progress", msg),
          onError: (msg) => event.sender.send("download-error", msg),
        }
      );

      console.log("Download completed successfully.");
      await libraryManager.trackDownloadedFile(
        videoUrl,
        detectedPath,
        settings,
        duration
      );
      event.sender.send("download-success");
    } catch (err) {
      console.error("Download failed:", err);
      event.sender.send("download-error", err.message);
    }
  }
);
// FIM

ipcMain.on("download-video", async (event, videoUrl) => {
  const defaultSettings = {
    outputFormat: "mp4",
    quality: "best",
    concurrentFragments: 8,
    embedSubs: false,
    writeInfoJson: false,
    writeThumbnail: false,
    writeDescription: false,
    userAgent: "",
    referer: "",
    socketTimeout: 30,
    retries: 5,
    fragmentRetries: 5,
    extractorRetries: 3,
    noCheckCertificate: true,
    ignoreErrors: true,
    audioFormat: "best",
  };
  ipcMain.emit(
    "download-video-with-settings",
    event,
    videoUrl,
    defaultSettings
  );
});

ipcMain.on("check-binaries-status", (event) => {
  try {
    validateIpcChannel("check-binaries-status");

    if (binaryPaths) {
      // Fix: Not using binaryDownloader as it is null/unused.
      // Using standard appMode default as portable/installed distinction logic isn't present in BinaryDownloader.
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
        message: "Binários ainda não foram inicializados",
      });
    }
  } catch (error) {
    console.error("Erro ao verificar status dos binários:", error);
    event.sender.send("binaries-status", {
      status: "error",
      message: `Erro interno: ${error.message} \n ${error.stack}`,
    });
  }
});

createIpcHandler("open-downloads-folder", async () => {
  const downloadsPath = app.getPath("downloads");
  await shell.openPath(downloadsPath);
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

createIpcHandler("delete-downloaded-file", (event, fileId) => {
  const file = libraryManager.getFileById(fileId);

  if (file?.filePath && fs.existsSync(file.filePath)) {
    fs.unlinkSync(file.filePath);
  }

  libraryManager.removeDownloadedFile(fileId);
  event.sender.send("file-deleted", fileId);
});

createIpcHandler("open-file-location", (event, fileId) => {
  const file = libraryManager.getFileById(fileId);
  const filePath = file?.filePath;

  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(file.filePath);
  } else {
    throw new Error("Arquivo não encontrado.");
  }
});

createIpcHandler("open-video-file", (event, fileId) => {
  const file = libraryManager.getFileById(fileId);

  if (file?.filePath && fs.existsSync(file.filePath)) {
    shell.openPath(file.filePath);
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
  if (folderPath && (await fsPromises.stat(folderPath).catch(() => false))) {
    await shell.openPath(folderPath);
  } else {
    // If invalid or empty, open default downloads
    await shell.openPath(app.getPath("downloads"));
  }
});

createIpcHandler("move-temp-files-to-downloads", async (event) => {
  // Placeholder implementation for now
  event.sender.send("download-success", "Funcionalidade em desenvolvimento.");
});

createIpcHandler("clean-temp-files", async (event) => {
  try {
    const thumbDir = path.join(app.getPath("userData"), "thumbnails");
    if (fs.existsSync(thumbDir)) {
      const files = await fsPromises.readdir(thumbDir);
      for (const file of files) {
        await fsPromises.unlink(path.join(thumbDir, file)).catch(() => {});
      }
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
  const mainWindow = new BrowserWindow({
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

  mainWindow
    .loadFile(path.join(__dirname, "../ui/dist/index.html"))
    .then((r) => {
      console.log(r);
    });
  return mainWindow;
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================
(async () => {
  try {
    await app.whenReady();

    protocol.handle("media", (request) => {
      try {
        // Convert custom media: URL back to file: URL
        const fileUrl = request.url.replace(/^media:/, "file:");
        // Convert file: URL to absolute system path (handles Windows backslashes correctly)
        const filePath = url.fileURLToPath(fileUrl);

        return net.fetch(url.pathToFileURL(filePath).toString());
      } catch (e) {
        console.error("Media protocol error:", e);
        return new Response("Not found", { status: 404 });
      }
    });

    // Create window FIRST to show loading screen
    const mainWindow = createWindow();

    try {
      console.log("Initializing binaries...");
      await initializeBinaries();

      // Inicializar API de Stream
      console.log("Initializing Stream Download API...");
      streamDownloadAPI = new StreamDownloadAPI(videoDownloader, 9000);
      await streamDownloadAPI.start();

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
    console.error("Erro ao inicializar aplicação:", error);
  }
})();
app.on("activate", function () {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
