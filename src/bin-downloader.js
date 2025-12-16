const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { spawnSync } = require('node:child_process');

const BIN_DIR = path.join(__dirname, '..', 'bin');

const URLS = {
  'yt-dlp.exe': 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
  'ffmpeg.zip': 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
};

const ALLOWED_BINARIES = new Set([
  'yt-dlp.exe',
  'ffmpeg.exe',
  'ffprobe.exe',
  'ffplay.exe'
]);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function downloadFile(url, outPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);

    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return downloadFile(res.headers.location, outPath).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      res.pipe(file);

      file.on('finish', () => {
        file.close(resolve);
      });

      file.on('error', err => {
        file.close();
        if (fs.existsSync(outPath)) fs.rmSync(outPath);
        reject(err);
      });
    }).on('error', err => {
      file.close();
      if (fs.existsSync(outPath)) fs.rmSync(outPath);
      reject(err);
    });
  });
}

function extractZipWindows(zipPath, targetDir) {
  const result = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${targetDir}'`
    ],
    { stdio: 'ignore' }
  );

  if (result.error) {
    throw result.error;
  }
}

function normalizeBinDirectory() {
  const entries = fs.readdirSync(BIN_DIR);

  for (const entry of entries) {
    const full = path.join(BIN_DIR, entry);

    if (fs.statSync(full).isDirectory()) {
      const search = dir => {
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
      ytdlp: path.join(BIN_DIR, 'yt-dlp.exe'),
      ffmpeg: path.join(BIN_DIR, 'ffmpeg.exe'),
      ffprobe: path.join(BIN_DIR, 'ffprobe.exe'),
      ffplay: path.join(BIN_DIR, 'ffplay.exe')
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
      await downloadFile(URLS['yt-dlp.exe'], binaryPaths.ytdlp);
    }

    if (missingFFmpeg) {
      const zipPath = path.join(BIN_DIR, 'ffmpeg.zip');
      await downloadFile(URLS['ffmpeg.zip'], zipPath);

      if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size === 0) {
        throw new Error('FFmpeg download failed');
      }

      extractZipWindows(zipPath, BIN_DIR);
      normalizeBinDirectory();

      if (
        !fs.existsSync(binaryPaths.ffmpeg) ||
        !fs.existsSync(binaryPaths.ffprobe) ||
        !fs.existsSync(binaryPaths.ffplay)
      ) {
        throw new Error('FFmpeg extraction incomplete');
      }
    }

    cleanup();
    return binaryPaths.ytdlp, binaryPaths.ffmpeg, binaryPaths.ffprobe, binaryPaths.ffplay;
  }
}
module.exports = BinaryDownloader;