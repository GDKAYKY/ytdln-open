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
      // redirect (302 etc)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, outPath)
          .then(resolve)
          .catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
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
      `Expand-Archive -Force "${zipPath}" "${targetDir}"`
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
      const inner = fs.readdirSync(full);
      for (const f of inner) {
        const src = path.join(full, f);
        const dst = path.join(BIN_DIR, f);
        if (!fs.existsSync(dst)) {
          fs.renameSync(src, dst);
        }
      }
      fs.rmSync(full, { recursive: true, force: true });
    }
  }
}

function cleanup() {
  const entries = fs.readdirSync(BIN_DIR);

  for (const entry of entries) {
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

    for (const [name, url] of Object.entries(URLS)) {
      const outPath = path.join(BIN_DIR, name);
      if (!fs.existsSync(outPath)) {
        await downloadFile(url, outPath);
      }
    }

    for (const file of fs.readdirSync(BIN_DIR)) {
      if (file.endsWith('.zip')) {
        extractZipWindows(path.join(BIN_DIR, file), BIN_DIR);
      }
      normalizeBinDirectory();
    }

    cleanup();

    return {
      ytdlp: path.join(BIN_DIR, 'yt-dlp.exe'),
      ffmpeg: path.join(BIN_DIR, 'ffmpeg.exe'),
      ffprobe: path.join(BIN_DIR, 'ffprobe.exe'),
      ffplay: path.join(BIN_DIR, 'ffplay.exe')
    };
  }
}

module.exports = BinaryDownloader;