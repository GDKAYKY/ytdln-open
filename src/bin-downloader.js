const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const tar = require("tar");

const BIN_DIR = path.join(__dirname, "..", "bin");

const URLS = {
  "yt-dlp.exe":
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
  "ffmpeg.zip":
    "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
};

const ALLOWED_BINARIES = new Set([
  "yt-dlp.exe",
  "ffmpeg.exe",
  "ffprobe.exe",
  "ffplay.exe",
]);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Padrão Node 25+: Usar fetch() nativo em vez do módulo https legado.
 */
async function downloadFile(url, outPath) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Falha ao baixar arquivo: ${response.status} ${response.statusText}`
    );
  }

  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(outPath);
    const reader = response.body.getReader();

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fileStream.write(Buffer.from(value));
        }
        fileStream.end();
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
      } catch (error) {
        fileStream.destroy();
        reject(error);
      }
    })();
  });
}

function extractZipWindows(zipPath, targetDir) {
  // Use tar package for extraction with PowerShell fallback
  return new Promise((resolve, reject) => {
    // Try tar extraction first (works with .tar.gz, .tar.bz2, etc.)
    tar
      .extract({
        file: zipPath,
        cwd: targetDir,
      })
      .then(resolve)
      .catch((error) => {
        // Fallback to PowerShell for ZIP files
        const result = spawnSync(
          "powershell",
          [
            "-NoProfile",
            "-Command",
            `Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${targetDir}'`,
          ],
          { encoding: "utf-8" }
        );

        if (result.error || result.status !== 0) {
          reject(
            new Error(
              `Failed to extract ZIP: ${result.error?.message || result.stderr || "Unknown error"}`
            )
          );
        } else {
          resolve();
        }
      });
  });
}

function normalizeBinDirectory() {
  const entries = fs.readdirSync(BIN_DIR);

  for (const entry of entries) {
    const full = path.join(BIN_DIR, entry);

    if (fs.statSync(full).isDirectory()) {
      const search = (dir) => {
        for (const item of fs.readdirSync(dir)) {
          const itemPath = path.join(dir, item);
          const stat = fs.statSync(itemPath);

          if (stat.isDirectory()) {
            search(itemPath);
          } else if (ALLOWED_BINARIES.has(item)) {
            const dst = path.join(BIN_DIR, item);
            if (!fs.existsSync(dst)) {
              fs.renameSync(itemPath, dst);
            }
          }
        }
      };

      search(full);
      fs.rmSync(full, { recursive: true, force: true });
    }
  }
}

function cleanup() {
  for (const entry of fs.readdirSync(BIN_DIR)) {
    const full = path.join(BIN_DIR, entry);

    if (fs.statSync(full).isDirectory()) {
      fs.rmSync(full, { recursive: true, force: true });
      continue;
    }

    if (!ALLOWED_BINARIES.has(entry)) {
      fs.rmSync(full, { force: true });
    }
  }
}

class BinaryDownloader {
  async ensureAll() {
    ensureDir(BIN_DIR);

    const binaryPaths = {
      ytdlp: path.join(BIN_DIR, "yt-dlp.exe"),
      ffmpeg: path.join(BIN_DIR, "ffmpeg.exe"),
      ffprobe: path.join(BIN_DIR, "ffprobe.exe"),
      ffplay: path.join(BIN_DIR, "ffplay.exe"),
    };

    const missingYtdlp = !fs.existsSync(binaryPaths.ytdlp);
    const missingFFmpeg =
      !fs.existsSync(binaryPaths.ffmpeg) ||
      !fs.existsSync(binaryPaths.ffprobe) ||
      !fs.existsSync(binaryPaths.ffplay);

    if (!missingYtdlp && !missingFFmpeg) {
      return binaryPaths;
    }

    if (missingYtdlp) {
      await downloadFile(URLS["yt-dlp.exe"], binaryPaths.ytdlp);
    }

    if (missingFFmpeg) {
      const zipPath = path.join(BIN_DIR, "ffmpeg.zip");
      await downloadFile(URLS["ffmpeg.zip"], zipPath);

      if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size === 0) {
        throw new Error("FFmpeg download failed: file is empty or missing");
      }

      try {
        await extractZipWindows(zipPath, BIN_DIR);
      } catch (error) {
        fs.rmSync(zipPath, { force: true });
        throw new Error(`FFmpeg extraction failed: ${error.message}`);
      }

      normalizeBinDirectory();

      const missingBinaries = [
        fs.existsSync(binaryPaths.ffmpeg) ? "" : "ffmpeg.exe",
        fs.existsSync(binaryPaths.ffprobe) ? "" : "ffprobe.exe",
        fs.existsSync(binaryPaths.ffplay) ? "" : "ffplay.exe",
      ].filter(Boolean);

      if (missingBinaries.length > 0) {
        throw new Error(
          `FFmpeg extraction incomplete. Missing: ${missingBinaries.join(", ")}`
        );
      }

      fs.rmSync(zipPath, { force: true });
    }

    cleanup();
    return binaryPaths;
  }
}
module.exports = BinaryDownloader;
