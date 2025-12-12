const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');  
const { execSync } = require('node:child_process');

// --- validações iniciais ----------------------------------------------------

function runCommand(cmd) {
  return execSync(cmd, { stdio: 'inherit' });
}

function isWin() {
  return process.platform === 'win32';
}

function makeExecutable(p) {
  if (!isWin()) {
    try { runCommand(`chmod +x '${p}'`); } catch (e) { throw new Error(`Couldn't make ${p} executable`); }
  }
}

function checkDiskSpace(dirPath) {
  try {
    if (isWin()) {
      const drive = dirPath.charAt(0).toUpperCase();
      const result = execSync(
        String.raw`powershell -NoProfile -Command "(Get-WmiObject -Class Win32_LogicalDisk -Filter \"DeviceID='${drive}:'\").FreeSpace"`,
        { encoding: 'utf8' }
      );
      return Number.parseInt(result.trim(), 10);
    } else {
      const result = execSync(`df -k '${dirPath}' | tail -1 | awk '{print $4}'`, { encoding: 'utf8' });
      return Number.parseInt(result.trim(), 10) * 1024;
    }
  } catch (error) {
    console.warn('Could not check disk space:', error.message);
    return null;
  }
}

function hasEnoughSpace(dirPath, minBytes = 500 * 1024 * 1024) {
  const free = checkDiskSpace(dirPath);
  if (free === null) return true; // fallback permissivo
  return free >= minBytes;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// procura recursivamente por executável (limita profundidade pra evitar travar)
function findExecutableByPatterns(root, patterns = [], maxDepth = 2, curDepth = 0) {
  if (!fs.existsSync(root) || curDepth > maxDepth) return null;
  for (const item of fs.readdirSync(root)) {
    const full = path.join(root, item);
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }

    if (stat.isFile() && patterns.some(p => item.toLowerCase().includes(p.toLowerCase())))
      return full;

    if (stat.isDirectory()) {
      const found = findExecutableByPatterns(full, patterns, maxDepth, curDepth + 1);
      if (found) return found;
    }
  }
  return null;
}
// --- Downloader genérico -------------------------------------------------

class BinaryDownloader {
  constructor(opts = {}) {
    this.platform = process.platform;
    this.arch = process.arch;
    this.binDir = this.getBinDirectory();
    this.urls = this.getDownloadUrls();
    this.downloading = false;
    this.downloadPromise = null;
    this.timeoutMs = opts.timeoutMs || 10 * 60 * 1000; // 10 min
  }

  // detecta modo (electron / node)
  getAppMode() {
    try {
      const { app } = require('electron');
      if (app.isPackaged) return { mode: 'installed', isPackaged: true, description: 'Aplicativo instalado via instalador' };
      return { mode: 'development', isPackaged: false, description: 'Rodando via npm start (dev)' };
    } catch (err) {
      return { mode: 'nodejs', isPackaged: false, description: 'Rodando via Node.js (teste)' };
    }
  }

  getBinDirectory() {
    const appMode = this.getAppMode();
    return appMode.isPackaged ? path.join(process.resourcesPath, 'bin') : path.join(__dirname, '..', 'bin');
  }

  getDownloadUrls() {
    const common = {
      win32: {
        ytdlp: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
        aria2c: 'https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-win-64bit-build1.zip',
        // Usar release build do gyan.dev que é mais estável
        ffmpeg: 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
      },
      darwin: {
        ytdlp: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
         // Mac geralmente já tem curl/aria2 via brew, mas aqui mantemos o link
        aria2c: 'https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-osx-darwin-build1.tar.bz2',
        ffmpeg: 'https://evermeet.cx/ffmpeg/ffmpeg-6.1.1.zip'
      },
      linux: {
        ytdlp: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
        aria2c: 'https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-linux-gnu-build1.tar.bz2',
        // Usar static build do johnvansickle
        ffmpeg: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz'
      }
    };
    return common[this.platform] || common.linux;
  }

  async ensureBinDirectory() {
    ensureDir(this.binDir);
    if (!hasEnoughSpace(this.binDir)) {
      throw new Error('Espaço insuficiente em disco. É necessário pelo menos 500MB de espaço livre.');
    }
  }

  downloadFile(url, filename) {
    const filePath = path.join(this.binDir, filename);
    return new Promise((resolve, reject) => {
      // Já existe e tem tamanho -> pula
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
        console.log(`Arquivo ${filename} já existe, pulando download.`);
        return resolve(filePath);
      }

      console.log(`Baixando ${filename} de ${url} ...`);
      const tmpPath = filePath + '.part';
      const file = fs.createWriteStream(tmpPath);

      const timeout = setTimeout(() => {
        file.close();
        try { fs.unlinkSync(tmpPath); } catch (e) {}
        reject(new Error(`Timeout ao baixar ${filename}`));
      }, this.timeoutMs);

      const request = https.get(url, (res) => {
        // seguir redirecionamento
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          clearTimeout(timeout);
          file.close();
          try { fs.unlinkSync(tmpPath); } catch (e) {}
          return resolve(this.downloadFile(res.headers.location, filename));
        }

        if (res.statusCode !== 200) {
          clearTimeout(timeout);
          file.close();
          try { fs.unlinkSync(tmpPath); } catch (e) {}
          return reject(new Error(`HTTP ${res.statusCode} ao baixar ${filename}`));
        }

        res.pipe(file);
        file.on('finish', () => {
          clearTimeout(timeout);
          file.close();
          fs.renameSync(tmpPath, filePath);
          console.log(`${filename} baixado (${fs.statSync(filePath).size} bytes).`);
          resolve(filePath);
        });
      });

      request.on('error', (err) => {
        clearTimeout(timeout);
        file.close();
        try { fs.unlinkSync(tmpPath); } catch (e) {}
        reject(err);
      });
    });
  }

  async extractArchive(archivePath) {
    const ext = path.extname(archivePath).toLowerCase();
    const dest = this.binDir;
    try {
      if (ext === '.zip') {
        if (isWin()) {
          runCommand(`powershell -NoProfile -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${dest}' -Force"`);
        } else {
          runCommand(`unzip -o '${archivePath}' -d '${dest}'`);
        }
      } else if (ext === '.bz2' || ext === '.xz' || /\.tar\.(gz|bz2|xz)$/.test(archivePath)) {
        runCommand(`tar -xf '${archivePath}' -C '${dest}'`);
      } else {
        // Se for um binário puro (sem compressão), nada a extrair
        return;
      }
      console.log(`Extraído: ${path.basename(archivePath)}`);
    } catch (err) {
      throw new Error(`Falha ao extrair ${archivePath}: ${err.message}`);
    }
  }

  async downloadAndExtract(url, nameHintPatterns = []) {
    const filename = path.basename(new URL(url).pathname);
    const downloaded = await this.downloadFile(url, filename);
    // Se for arquivo comprimido, tenta extrair
    const ext = path.extname(downloaded).toLowerCase();
    if (['.zip', '.bz2', '.xz', '.gz'].some(e => downloaded.endsWith(e) || /\.tar\./.test(downloaded))) {
      await this.extractArchive(downloaded);
      // procura executável pelo padrão
      const found = findExecutableByPatterns(this.binDir, nameHintPatterns);
      if (found) {
        makeExecutable(found);
        return found;
      }
      // fallback: procurar executável com nomes óbvios
    } else {
      makeExecutable(downloaded);
      return downloaded;
    }
    return null;
  }

  // wrappers específicos que usam a função genérica
  async downloadYTDLP() {
    const url = this.urls.ytdlp;
    const namePatterns = [ 'yt-dlp', 'ytdlp' ];
    const p = await this.downloadAndExtract(url, namePatterns);
    if (!p) throw new Error('Não encontrou yt-dlp após download.');
    return p;
  }

  async downloadAria2c() {
    const url = this.urls.aria2c;
    const namePatterns = [ 'aria2c', 'aria2' ];
    const p = await this.downloadAndExtract(url, namePatterns);
    if (!p) throw new Error('Não encontrou aria2c após extração.');
    return p;
  }

  async downloadFFmpeg() {
    const url = this.urls.ffmpeg;
    const namePatterns = [ 'ffmpeg' ];
    const p = await this.downloadAndExtract(url, namePatterns);
    if (!p) throw new Error('Não encontrou ffmpeg após extração.');
    return p;
  }

  // download de todos (controla concorrência simples)
  async downloadAllBinaries() {
    if (this.downloading) return this.downloadPromise;
    this.downloading = true;
    this.downloadPromise = this._downloadAllBinaries();
    try {
      return await this.downloadPromise;
    } finally {
      this.downloading = false;
      this.downloadPromise = null;
    }
  }

  async _downloadAllBinaries() {
    console.log(`Modo: ${this.getAppMode().description} — Plataf.: ${this.platform}/${this.arch}`);
    console.log(`Diretório de binários: ${this.binDir}`);
    await this.ensureBinDirectory();

    try {
      const [ytdlp, aria2c, ffmpeg] = await Promise.all([
        this.downloadYTDLP(),
        this.downloadAria2c(),
        this.downloadFFmpeg()
      ]);
      console.log('Todos os binários baixados/extrados.');
      return { ytdlp, aria2c, ffmpeg };
    } catch (err) {
      console.error('Erro no download dos binários:', err.message);
      throw err;
    }
  }

  getBinaryPaths() {
    const ytdlpName = isWin() ? 'yt-dlp.exe' : 'yt-dlp';
    const aria2cName = isWin() ? 'aria2c.exe' : 'aria2c';
    const ffmpegName = isWin() ? 'ffmpeg.exe' : 'ffmpeg';

    const direct = (name) => {
      const p = path.join(this.binDir, name);
      if (fs.existsSync(p)) return p;
      return findExecutableByPatterns(this.binDir, [path.parse(name).name]);
    };

    return {
      ytdlp: direct(ytdlpName),
      aria2c: direct(aria2cName),
      ffmpeg: direct(ffmpegName)
    };
  }

  async checkAndDownloadBinaries() {
    const paths = this.getBinaryPaths();
    const missing = [];
    if (!paths.ytdlp) missing.push('yt-dlp');
    if (!paths.aria2c) missing.push('aria2c');
    if (!paths.ffmpeg) missing.push('ffmpeg');

    if (missing.length === 0) {
      console.log('Todos os binários já disponíveis.');
      return paths;
    }

    console.log('Binários faltando:', missing.join(', '), '- iniciando download.');
    return await this.downloadAllBinaries();
  }
}

module.exports = BinaryDownloader;