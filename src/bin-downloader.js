const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Função para verificar espaço em disco disponível
function checkDiskSpace(dirPath) {
  try {
    if (process.platform === 'win32') {
      const result = execSync(`powershell -command "Get-WmiObject -Class Win32_LogicalDisk -Filter 'DeviceID=\\'${dirPath.charAt(0)}:\\'' | Select-Object -ExpandProperty FreeSpace"`, { encoding: 'utf8' });
      return parseInt(result.trim());
    } else {
      const result = execSync(`df -k '${dirPath}' | tail -1 | awk '{print $4}'`, { encoding: 'utf8' });
      return parseInt(result.trim()) * 1024; // Converter KB para bytes
    }
  } catch (error) {
    console.warn('Não foi possível verificar espaço em disco:', error.message);
    return null;
  }
}

// Função para verificar se há espaço suficiente (mínimo 500MB)
function hasEnoughSpace(dirPath) {
  const freeSpace = checkDiskSpace(dirPath);
  if (freeSpace === null) return true; // Se não conseguir verificar, assumir que há espaço
  const minRequired = 500 * 1024 * 1024; // 500MB
  return freeSpace >= minRequired;
}

class BinaryDownloader {
  constructor() {
    this.platform = process.platform;
    this.arch = process.arch;
    this.binDir = this.getBinDirectory();
    this.downloadUrls = this.getDownloadUrls();
    this.downloading = false; // Flag para evitar downloads simultâneos
    this.downloadPromise = null; // Promise do download em andamento
  }

  // Função para detectar como o app está rodando
  getAppMode() {
    try {
      const { app } = require('electron');
      
      if (app.isPackaged) {
        return {
          mode: 'installed',
          description: 'Aplicativo instalado via instalador',
          isPackaged: true,
          isDevelopment: false
        };
      } else {
        return {
          mode: 'development',
          description: 'Aplicativo rodando via npm start',
          isPackaged: false,
          isDevelopment: true
        };
      }
    } catch (error) {
      return {
        mode: 'nodejs',
        description: 'Rodando diretamente via Node.js (teste)',
        isPackaged: false,
        isDevelopment: true
      };
    }
  }

  getBinDirectory() {
    const appMode = this.getAppMode();
    
    if (appMode.isPackaged) {
      // Aplicativo instalado - binários em resources/bin
      return path.join(process.resourcesPath, 'bin');
    } else {
      // Desenvolvimento - binários em ./bin
      return path.join(__dirname, '..', 'bin');
    }
  }

  getDownloadUrls() {
    const urls = {
      win32: {
        ytdlp: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
        aria2c: 'https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-win-64bit-build1.zip',
        ffmpeg: 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
      },
      darwin: {
        ytdlp: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
        aria2c: 'https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-osx-darwin-build1.tar.bz2',
        ffmpeg: 'https://evermeet.cx/ffmpeg/ffmpeg-6.1.1.zip'
      },
      linux: {
        ytdlp: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
        aria2c: 'https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-linux-gnu-build1.tar.bz2',
        ffmpeg: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz'
      }
    };

    return urls[this.platform] || urls.linux;
  }

  async ensureBinDirectory() {
    if (!fs.existsSync(this.binDir)) {
      fs.mkdirSync(this.binDir, { recursive: true });
    }
    
    // Verificar espaço em disco antes de continuar
    if (!hasEnoughSpace(this.binDir)) {
      throw new Error('Espaço insuficiente em disco. É necessário pelo menos 500MB de espaço livre.');
    }
  }

  async downloadFile(url, filename, isRedirect = false) {
    return new Promise((resolve, reject) => {
      const filePath = path.join(this.binDir, filename);
      
      // Verificar se o arquivo já existe e tem conteúdo (apenas se não for redirecionamento)
      if (!isRedirect && fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size > 0) {
          console.log(`Arquivo ${filename} já existe e tem conteúdo (${stats.size} bytes), pulando download.`);
          resolve(filePath);
          return;
        } else {
          console.log(`Arquivo ${filename} existe mas está vazio, removendo e baixando novamente.`);
          fs.unlinkSync(filePath);
        }
      }

      console.log(`Baixando ${filename} de ${url}...`);
      const file = fs.createWriteStream(filePath);
      
      // Timeout de 10 minutos para downloads
      const timeoutId = setTimeout(() => {
        file.close();
        fs.unlink(filePath, () => {});
        reject(new Error(`Timeout ao baixar ${filename} (10 minutos)`));
      }, 10 * 60 * 1000);
      
      https.get(url, (response) => {
        // Seguir redirecionamentos
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          console.log(`Redirecionando para: ${response.headers.location}`);
          file.close();
          fs.unlink(filePath, () => {}); // Remove arquivo parcial
          // Recursivamente seguir o redirecionamento
          this.downloadFile(response.headers.location, filename, true).then(resolve).catch(reject);
          return;
        }
        
        if (response.statusCode !== 200) {
          file.close();
          fs.unlink(filePath, () => {}); // Remove arquivo parcial
          reject(new Error(`Erro ao baixar ${filename}: ${response.statusCode}`));
          return;
        }
        
        let downloadedBytes = 0;
        
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
        });
        
        response.pipe(file);
        
        file.on('finish', () => {
          clearTimeout(timeoutId);
          file.close();
          const finalStats = fs.statSync(filePath);
          console.log(`${filename} baixado com sucesso (${finalStats.size} bytes).`);
          resolve(filePath);
        });
        
        file.on('error', (err) => {
          clearTimeout(timeoutId);
          file.close();
          fs.unlink(filePath, () => {}); // Remove arquivo parcial
          reject(err);
        });
      }).on('error', (err) => {
        clearTimeout(timeoutId);
        file.close();
        fs.unlink(filePath, () => {}); // Remove arquivo parcial
        reject(err);
      });
    });
  }

  async extractArchive(archivePath, extractTo) {
    return new Promise((resolve, reject) => {
      try {
        const extension = path.extname(archivePath).toLowerCase();
        
        if (extension === '.zip') {
          // Para Windows e macOS FFmpeg
          if (this.platform === 'win32') {
            execSync(`powershell -command "Expand-Archive -Path '${archivePath}' -DestinationPath '${extractTo}' -Force"`, { stdio: 'inherit' });
          } else {
            execSync(`unzip -o '${archivePath}' -d '${extractTo}'`, { stdio: 'inherit' });
          }
        } else if (extension === '.bz2' || extension === '.xz') {
          // Para macOS e Linux
          execSync(`tar -xf '${archivePath}' -C '${extractTo}'`, { stdio: 'inherit' });
        }
        
        console.log(`Arquivo extraído: ${archivePath}`);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async downloadAndExtractAria2c() {
    const aria2cUrl = this.downloadUrls.aria2c;
    const filename = path.basename(aria2cUrl);
    
    try {
      const archivePath = await this.downloadFile(aria2cUrl, filename);
      await this.extractArchive(archivePath, this.binDir);
      
      // Encontrar o executável extraído
      const extractedDir = fs.readdirSync(this.binDir).find(dir => 
        dir.includes('aria2') && fs.statSync(path.join(this.binDir, dir)).isDirectory()
      );
      
      if (extractedDir) {
        const aria2cPath = path.join(this.binDir, extractedDir, 'aria2c' + (this.platform === 'win32' ? '.exe' : ''));
        if (fs.existsSync(aria2cPath)) {
          // Tornar executável no Unix
          if (this.platform !== 'win32') {
            execSync(`chmod +x '${aria2cPath}'`);
          }
          return aria2cPath;
        }
      }
      
      throw new Error('aria2c não encontrado após extração');
    } catch (error) {
      console.error('Erro ao baixar/extrair aria2c:', error);
      throw error;
    }
  }

  async downloadAndExtractFFmpeg() {
    const ffmpegUrl = this.downloadUrls.ffmpeg;
    const filename = path.basename(ffmpegUrl);
    
    try {
      const archivePath = await this.downloadFile(ffmpegUrl, filename);
      await this.extractArchive(archivePath, this.binDir);
      
      // Encontrar o executável extraído
      const extractedDir = fs.readdirSync(this.binDir).find(dir => 
        dir.includes('ffmpeg') && fs.statSync(path.join(this.binDir, dir)).isDirectory()
      );
      
      if (extractedDir) {
        const ffmpegPath = path.join(this.binDir, extractedDir, 'bin', 'ffmpeg' + (this.platform === 'win32' ? '.exe' : ''));
        if (fs.existsSync(ffmpegPath)) {
          // Tornar executável no Unix
          if (this.platform !== 'win32') {
            execSync(`chmod +x '${ffmpegPath}'`);
          }
          return ffmpegPath;
        }
      }
      
      throw new Error('ffmpeg não encontrado após extração');
    } catch (error) {
      console.error('Erro ao baixar/extrair ffmpeg:', error);
      throw error;
    }
  }

  async downloadYTDLP() {
    const ytdlpUrl = this.downloadUrls.ytdlp;
    const filename = path.basename(ytdlpUrl);
    
    try {
      const ytdlpPath = await this.downloadFile(ytdlpUrl, filename);
      
      // Tornar executável no Unix
      if (this.platform !== 'win32') {
        execSync(`chmod +x '${ytdlpPath}'`);
      }
      
      return ytdlpPath;
    } catch (error) {
      console.error('Erro ao baixar yt-dlp:', error);
      throw error;
    }
  }

  async downloadAllBinaries() {
    // Evitar downloads simultâneos
    if (this.downloading) {
      console.log('Download já em andamento, aguardando...');
      return this.downloadPromise;
    }
    
    this.downloading = true;
    this.downloadPromise = this._downloadAllBinaries();
    
    try {
      const result = await this.downloadPromise;
      return result;
    } finally {
      this.downloading = false;
      this.downloadPromise = null;
    }
  }
  
  async _downloadAllBinaries() {
    const appMode = this.getAppMode();
    console.log(`Modo de execução: ${appMode.description}`);
    console.log(`Detectado SO: ${this.platform} (${this.arch})`);
    console.log(`Diretório de binários: ${this.binDir}`);
    
    await this.ensureBinDirectory();
    
    try {
      const [ytdlpPath, aria2cPath, ffmpegPath] = await Promise.all([
        this.downloadYTDLP(),
        this.downloadAndExtractAria2c(),
        this.downloadAndExtractFFmpeg()
      ]);
      
      console.log('Todos os binários baixados com sucesso!');
      return {
        ytdlp: ytdlpPath,
        aria2c: aria2cPath,
        ffmpeg: ffmpegPath
      };
    } catch (error) {
      console.error('Erro ao baixar binários:', error);
      throw error;
    }
  }

  getBinaryPaths() {
    const ytdlpName = this.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    const aria2cName = this.platform === 'win32' ? 'aria2c.exe' : 'aria2c';
    const ffmpegName = this.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    
    // Procurar pelos binários no diretório
    const ytdlpPath = this.findBinary(ytdlpName);
    const aria2cPath = this.findBinary(aria2cName);
    const ffmpegPath = this.findBinary(ffmpegName);
    
    return {
      ytdlp: ytdlpPath,
      aria2c: aria2cPath,
      ffmpeg: ffmpegPath
    };
  }

  findBinary(binaryName) {
    if (!fs.existsSync(this.binDir)) {
      return null;
    }
    
    const items = fs.readdirSync(this.binDir);
    
    // Procurar diretamente no diretório
    const directPath = path.join(this.binDir, binaryName);
    if (fs.existsSync(directPath)) {
      return directPath;
    }
    
    // Procurar em subdiretórios
    for (const item of items) {
      const itemPath = path.join(this.binDir, item);
      if (fs.statSync(itemPath).isDirectory()) {
        const binaryPath = path.join(itemPath, binaryName);
        if (fs.existsSync(binaryPath)) {
          return binaryPath;
        }
        
        // Procurar em subdiretórios como 'bin'
        const binPath = path.join(itemPath, 'bin', binaryName);
        if (fs.existsSync(binPath)) {
          return binPath;
        }
      }
    }
    
    return null;
  }

  async checkAndDownloadBinaries() {
    const paths = this.getBinaryPaths();
    
    // Verificar se todos os binários existem
    const missingBinaries = [];
    if (!paths.ytdlp) missingBinaries.push('yt-dlp');
    if (!paths.aria2c) missingBinaries.push('aria2c');
    if (!paths.ffmpeg) missingBinaries.push('ffmpeg');
    
    if (missingBinaries.length > 0) {
      console.log(`Binários faltando: ${missingBinaries.join(', ')}`);
      console.log('Iniciando download automático...');
      
      const downloadedPaths = await this.downloadAllBinaries();
      return downloadedPaths;
    }
    
    console.log('Todos os binários já estão disponíveis.');
    return paths;
  }
}

module.exports = BinaryDownloader;
