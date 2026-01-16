const { app } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync, execFile } = require("node:child_process");

// State
let downloadedFiles = [];
let binaryPaths = null;

const downloadsMetadataPath = path.join(
  app.getPath("userData"),
  "downloads.json"
);

const thumbnailsCachePath = path.join(app.getPath("userData"), "thumbnails");
if (!fs.existsSync(thumbnailsCachePath)) {
  fs.mkdirSync(thumbnailsCachePath, { recursive: true });
}

function setBinaryPaths(paths) {
  binaryPaths = paths;
}

function loadDownloadedFiles() {
  try {
    if (fs.existsSync(downloadsMetadataPath)) {
      const data = fs.readFileSync(downloadsMetadataPath, "utf8");
      downloadedFiles = JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading downloaded files metadata:", error);
    downloadedFiles = [];
  }
}

async function saveDownloadedFiles() {
  try {
    const tempPath = `${downloadsMetadataPath}.tmp`;
    await fsPromises.writeFile(
      tempPath,
      JSON.stringify(downloadedFiles, null, 2)
    );
    await fsPromises.rename(tempPath, downloadsMetadataPath);
  } catch (error) {
    console.error("Error saving downloaded files metadata:", error);
  }
}

function addDownloadedFile(fileInfo) {
  const fileData = {
    id: fileInfo.id ?? crypto.randomUUID(),
    title: fileInfo.title ?? "Unknown Title",
    url: fileInfo.url ?? "",
    filePath: fileInfo.filePath ?? "",
    fileName: fileInfo.fileName ?? "",
    fileSize: fileInfo.fileSize ?? 0,
    duration: fileInfo.duration ?? 0,
    thumbnail: fileInfo.thumbnail ?? "",
    format: fileInfo.format ?? "",
    downloadDate: fileInfo.downloadDate ?? new Date().toISOString(),
  };

  downloadedFiles.unshift(fileData);
  saveDownloadedFiles().catch((err) => console.error("Save failed", err));
  return fileData;
}

function removeDownloadedFile(fileId) {
  const before = downloadedFiles.length;
  downloadedFiles = downloadedFiles.filter((f) => f.id !== fileId);

  if (downloadedFiles.length !== before) {
    saveDownloadedFiles().catch((err) => console.error("Save failed", err));
    return true;
  }
  return false;
}

function getCachedThumbnailPath(videoPath) {
  const hash = crypto.createHash("md5").update(videoPath).digest("hex");
  return path.join(thumbnailsCachePath, `${hash}.jpg`);
}

async function findThumbnailForFile(videoFilePath) {
  if (!videoFilePath) return "";

  try {
    const dir = path.dirname(videoFilePath);
    const ext = path.extname(videoFilePath);
    const baseName = path.basename(videoFilePath, ext);

    const imageExtensions = [".jpg", ".jpeg", ".png", ".webp"];

    // Procurar no diretório do vídeo
    for (const imgExt of imageExtensions) {
      const thumbPath = path.join(dir, baseName + imgExt);
      if (fs.existsSync(thumbPath)) {
        return thumbPath;
      }
    }

    // Se não encontrou no diretório do vídeo, procurar no diretório temporário
    // (para streams que salvam thumbnail em temp)
    const tempDir = os.tmpdir();
    for (const imgExt of imageExtensions) {
      const thumbPath = path.join(tempDir, baseName + imgExt);
      if (fs.existsSync(thumbPath)) {
        return thumbPath;
      }
    }
  } catch (error) {
    console.error("Erro ao procurar thumbnail:", error);
  }
  return "";
}

function extractThumbnail(videoPath) {
  if (!videoPath || !fs.existsSync(videoPath)) return "";

  const cachePath = getCachedThumbnailPath(videoPath);
  if (fs.existsSync(cachePath)) return cachePath;

  try {
    const ffmpegPath = binaryPaths?.ffmpeg || "ffmpeg";

    try {
      execFileSync(
        ffmpegPath,
        [
          "-y",
          "-i",
          videoPath,
          "-map",
          "0:v:1",
          "-c",
          "copy",
          "-f",
          "image2",
          cachePath,
        ],
        { stdio: "ignore" }
      );

      if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0) {
        return cachePath;
      }
    } catch (e) {
      // Ignore
    }

    execFileSync(
      ffmpegPath,
      [
        "-y",
        "-i",
        videoPath,
        "-ss",
        "00:00:01",
        "-frames:v",
        "1",
        "-f",
        "image2",
        cachePath,
      ],
      { stdio: "ignore" }
    );

    if (fs.existsSync(cachePath)) return cachePath;
  } catch (err) {
    console.error("Falha na extração de thumbnail:", err);
  }
  return "";
}

function mergeThumbnailIntoVideo(videoFilePath) {
  if (!videoFilePath) return false;

  const dir = path.dirname(videoFilePath);
  const ext = path.extname(videoFilePath);
  const base = path.basename(videoFilePath, ext);

  const thumbExts = [".webp", ".jpg", ".jpeg", ".png"];
  let thumbPath = null;

  for (const tExt of thumbExts) {
    const candidate = path.join(dir, base + tExt);
    if (fs.existsSync(candidate)) {
      thumbPath = candidate;
      break;
    }
  }

  if (!thumbPath) return false;

  const tmpOutput = path.join(dir, `${base}.tmp${ext}`);
  const ffmpegPath = binaryPaths?.ffmpeg || "ffmpeg";

  return new Promise((resolve) => {
    execFile(
      ffmpegPath,
      [
        "-y",
        "-i",
        videoFilePath,
        "-i",
        thumbPath,
        "-map",
        "0",
        "-map",
        "1",
        "-c",
        "copy",
        "-disposition:v:1",
        "attached_pic",
        tmpOutput,
      ],
      (err) => {
        if (err || !fs.existsSync(tmpOutput)) {
          if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
          return resolve(false);
        }

        try {
          fs.renameSync(tmpOutput, videoFilePath);
          fs.unlinkSync(thumbPath);
          resolve(true);
        } catch {
          if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
          resolve(false);
        }
      }
    );
  });
}

async function scanDownloadsDir(customPaths = []) {
  try {
    const defaultDownloadsPath = app.getPath("downloads");
    // Ensure all paths are valid directories and unique
    const uniquePaths = new Set([defaultDownloadsPath]);

    if (customPaths && Array.isArray(customPaths)) {
      customPaths.forEach((p) => {
        if (p && typeof p === "string") uniquePaths.add(p);
      });
    }

    const videoExtensions = new Set([
      ".mp4",
      ".mkv",
      ".webm",
      ".avi",
      ".mov",
      ".flv",
    ]);
    let newFilesFound = false;

    // Scan all unique paths
    for (const downloadPath of uniquePaths) {
      try {
        await fsPromises.access(downloadPath);
        const files = await fsPromises.readdir(downloadPath);

        await Promise.all(
          files.map(async (file) => {
            const ext = path.extname(file).toLowerCase();
            if (videoExtensions.has(ext)) {
              if (file.includes(".tmp") || file.endsWith(".part")) return;
              const filePath = path.join(downloadPath, file);

              // Check if file is already tracked by exact path or by name/size similarity
              // For now, sticking to path check which is safest
              const isTracked = downloadedFiles.some(
                (f) => f.filePath === filePath
              );

              if (!isTracked) {
                try {
                  const stats = await fsPromises.stat(filePath);
                  const thumbnailPath = await findThumbnailForFile(filePath);

                  downloadedFiles.unshift({
                    id:
                      Date.now().toString() +
                      Math.random().toString(36).slice(2, 11),
                    title: path.parse(file).name,
                    fileName: file,
                    filePath: filePath,
                    fileSize: stats.size,
                    duration: 0,
                    format: ext.substring(1).toUpperCase(),
                    thumbnail: thumbnailPath,
                    downloadDate: stats.birthtime,
                    url: "",
                  });
                  newFilesFound = true;
                } catch (e) {
                  // console.error("Erro ao processar arquivo encontrado:", file, e);
                }
              }
            }
          })
        );
      } catch (pathErr) {
        // Just ignore if a specific path is not accessible
        // console.warn(`Could not access path: ${downloadPath}`, pathErr);
      }
    }

    return newFilesFound;
  } catch (err) {
    console.error("Erro ao escanear pastas de downloads:", err);
    return false;
  }
}

async function getDownloadedFiles(customPaths = []) {
  if (await scanDownloadsDir(customPaths)) {
    console.log("Novos arquivos detectados durante o scan.");
  }

  const newValidFiles = [];
  const newIdsToRemove = [];
  let loopChanged = false;

  for (const file of downloadedFiles) {
    if (file.filePath) {
      try {
        await fsPromises.access(file.filePath);

        let thumbExists = false;
        if (file.thumbnail) {
          try {
            await fsPromises.access(file.thumbnail);
            thumbExists = true;
          } catch {}
        }

        if (!file.thumbnail || !thumbExists) {
          let thumb = await findThumbnailForFile(file.filePath);
          if (!thumb) {
            const cachePath = getCachedThumbnailPath(file.filePath);
            try {
              await fsPromises.access(cachePath);
              thumb = cachePath;
            } catch {}
          }
          if (thumb) {
            file.thumbnail = thumb;
            loopChanged = true;
          }
        }
        newValidFiles.push(file);
      } catch {
        newIdsToRemove.push(file.id);
      }
    } else {
      newIdsToRemove.push(file.id);
    }
  }

  if (newIdsToRemove.length > 0) {
    downloadedFiles = newValidFiles;
    await saveDownloadedFiles();
  } else if (loopChanged) {
    await saveDownloadedFiles();
  }

  return downloadedFiles;
}

async function trackDownloadedFile(
  videoUrl,
  specificPath = null,
  settings = {},
  duration = 0
) {
  try {
    const downloadsPath = app.getPath("downloads");
    const files = await fsPromises.readdir(downloadsPath);
    const videoFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return [".mp4", ".mkv", ".webm", ".avi", ".mov", ".flv"].includes(ext);
    });

    if (videoFiles.length === 0 && !specificPath) return;

    let filePath = specificPath;

    if (!filePath || !(await fsPromises.stat(filePath).catch(() => false))) {
      const fileStats = await Promise.all(
        videoFiles.map(async (f) => {
          const p = path.join(downloadsPath, f);
          const s = await fsPromises.stat(p);
          return { file: f, mtime: s.mtime };
        })
      );

      if (fileStats.length > 0) {
        const latest = fileStats.reduce((prev, current) => {
          return prev.mtime > current.mtime ? prev : current;
        });
        filePath = path.join(downloadsPath, latest.file);
      }
    }

    if (filePath) {
      let thumbnailPath = "";

      const originalThumbPath = await findThumbnailForFile(filePath);

      if (originalThumbPath && fs.existsSync(originalThumbPath)) {
        try {
          const thumbExt = path.extname(originalThumbPath);
          const cachePathBase = getCachedThumbnailPath(filePath);
          const libraryThumbPath =
            cachePathBase.substring(0, cachePathBase.lastIndexOf(".")) +
            thumbExt;

          // SEMPRE copiar para o cache (independente de writeThumbnailToDownload)
          await fsPromises.copyFile(originalThumbPath, libraryThumbPath);
          thumbnailPath = libraryThumbPath;

          // Deletar do downloads SEMPRE (a cópia no cache é o que importa)
          try {
            await fsPromises.unlink(originalThumbPath);
          } catch (e) {
            console.error("Erro ao deletar thumbnail original:", e);
          }
        } catch (e) {
          console.error("Erro ao processar thumbnail da biblioteca:", e);
        }
      }

      if (!thumbnailPath) {
        thumbnailPath = extractThumbnail(filePath);
      }

      const stats = await fsPromises.stat(filePath);
      const fileName = path.basename(filePath);

      addDownloadedFile({
        title: path.parse(fileName).name,
        fileName: fileName,
        filePath: filePath,
        fileSize: stats.size,
        format: path.extname(fileName).substring(1).toUpperCase(),
        url: videoUrl,
        thumbnail: thumbnailPath,
        duration: duration,
      });
    }
  } catch (error) {
    console.error("Error tracking downloaded file:", error);
  }
}

function getFileById(fileId) {
  return downloadedFiles.find((f) => f.id === fileId);
}

module.exports = {
  loadDownloadedFiles,
  saveDownloadedFiles,
  addDownloadedFile,
  removeDownloadedFile,
  getDownloadedFiles,
  trackDownloadedFile,
  setBinaryPaths,
  getBinaryPaths: () => binaryPaths,
  getFileById,
  findThumbnailForFile,
  getCachedThumbnailPath,
  extractThumbnail,
  mergeThumbnailIntoVideo,
};
