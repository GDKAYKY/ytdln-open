const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const chalk = require('chalk');
const BinaryDownloader = require('./bin-downloader');
const fs = require('fs');

const ALLOWED_IPC_CHANNELS = [
  'download-video',
  'download-video-with-settings',
  'check-binaries-status',
  'download-progress',
  'download-success',
  'download-error',
  'binaries-status',
  'open-downloads-folder',
  'get-downloaded-files',
  'delete-downloaded-file',
  'open-file-location'
];

// Função para validar URL
function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    // Permitir apenas HTTPS e HTTP
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Função para sanitizar argumentos do spawn
function sanitizeArgs(args) {
  return args.map(arg => {
    if (typeof arg === 'string') {
      // Remover caracteres perigosos mas preservar barras invertidas para caminhos Windows
      return arg.replace(/[;&|`$[\]{}]/g, '');
    }
    return arg;
  });
}

// Instância do downloader de binários
let binaryDownloader = null;
let binaryPaths = null;

// Downloaded files tracking
let downloadedFiles = [];
const downloadsMetadataPath = path.join(app.getPath('userData'), 'downloads.json');

// Functions to manage downloaded files metadata
function loadDownloadedFiles() {
  try {
    if (fs.existsSync(downloadsMetadataPath)) {
      const data = fs.readFileSync(downloadsMetadataPath, 'utf8');
      downloadedFiles = JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading downloaded files metadata:', error);
    downloadedFiles = [];
  }
}

function saveDownloadedFiles() {
  try {
    fs.writeFileSync(downloadsMetadataPath, JSON.stringify(downloadedFiles, null, 2));
  } catch (error) {
    console.error('Error saving downloaded files metadata:', error);
  }
}

function addDownloadedFile(fileInfo) {
  const fileData = {
    id: Date.now() + Math.random(),
    title: fileInfo.title || 'Unknown Title',
    url: fileInfo.url || '',
    filePath: fileInfo.filePath || '',
    fileName: fileInfo.fileName || '',
    fileSize: fileInfo.fileSize || 0,
    duration: fileInfo.duration || 0,
    thumbnail: fileInfo.thumbnail || '',
    format: fileInfo.format || '',
    downloadDate: new Date().toISOString(),
    ...fileInfo
  };
  
  downloadedFiles.unshift(fileData); // Add to beginning
  saveDownloadedFiles();
  return fileData;
}

function removeDownloadedFile(fileId) {
  downloadedFiles = downloadedFiles.filter(file => file.id !== fileId);
  saveDownloadedFiles();
}

function getDownloadedFiles() {
  // Filter out files that no longer exist
  return downloadedFiles.filter(file => {
    if (file.filePath && fs.existsSync(file.filePath)) {
      return true;
    } else {
      // Remove file from metadata if it doesn't exist anymore
      removeDownloadedFile(file.id);
      return false;
    }
  });
}

// Helper function to get the path to the extra resources,
// works for both development and packaged apps.
function getExtraResourcesPath() {
  // For packaged app, the binaries are in resources/bin
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin');
  }
  // For development, we'll look in a 'bin' folder in the project root
  return path.join(__dirname, '..', 'bin');
}

// Função para inicializar e verificar binários
async function initializeBinaries() {
  try {
    binaryDownloader = new BinaryDownloader();
    binaryPaths = await binaryDownloader.checkAndDownloadBinaries();
    console.log('Binários inicializados:', binaryPaths);
    return binaryPaths;
  } catch (error) {
    console.error('Erro ao inicializar binários:', error);
    throw error;
  }
}

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, // Don't show until ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile('src/index.html');
}

app.whenReady().then(async () => {
  try {
    await initializeBinaries();
    loadDownloadedFiles(); // Load downloaded files metadata
    createWindow();
  } catch (error) {
    console.error('Erro ao inicializar aplicação:', error);
    createWindow();
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Middleware para validar canais IPC
function validateIpcChannel(channel) {
  if (!ALLOWED_IPC_CHANNELS.includes(channel)) {
    throw new Error(`Canal IPC não permitido: ${channel}`);
  }
}


// Função para construir argumentos do yt-dlp baseado nas configurações
function buildYtdlpArgs(settings, videoUrl, ffmpegPath) {
  const args = ['--progress', '--newline'];
  
  // Template de saída
  args.push('-o', path.join(app.getPath('downloads'), '%(title)s.%(ext)s'));
  
  // FFmpeg location
  args.push('--ffmpeg-location', ffmpegPath);
  
  // Formato de merge
  args.push('--merge-output-format', settings.outputFormat);
  
  // Qualidade
  if (settings.quality !== 'best') {
    if (settings.quality === 'worst') {
      args.push('-f', 'worst');
    } else {
      args.push('-f', `best[height<=${settings.quality.replace('p', '')}]`);
    }
  }
  
  // Fragmentos simultâneos
  args.push('--concurrent-fragments', settings.concurrentFragments.toString());
  
  // Legendas
  if (settings.embedSubs) {
    args.push('--embed-subs');
  }
  
  // Informações do vídeo
  if (settings.writeInfoJson) {
    args.push('--write-info-json');
  }
  
  // Thumbnail
  if (settings.writeThumbnail) {
    args.push('--write-thumbnail');
  }
  
  // Descrição
  if (settings.writeDescription) {
    args.push('--write-description');
  }
  
  // User Agent
  if (settings.userAgent) {
    args.push('--user-agent', settings.userAgent);
  }
  
  // Referer
  if (settings.referer) {
    args.push('--referer', settings.referer);
  }
  
  // Timeouts e retries
  args.push('--socket-timeout', settings.socketTimeout.toString());
  args.push('--retries', settings.retries.toString());
  args.push('--fragment-retries', settings.fragmentRetries.toString());
  args.push('--extractor-retries', settings.extractorRetries.toString());
  
  // Flags booleanas
  if (settings.noCheckCertificate) {
    args.push('--no-check-certificate');
  }
  
  if (settings.ignoreErrors) {
    args.push('--ignore-errors');
  }
  
  // URL do vídeo
  args.push(videoUrl);
  
  return args;
}

// Listen for a 'download-video-with-settings' message from the renderer process
ipcMain.on('download-video-with-settings', async (event, videoUrl, settings) => {
  try {
    validateIpcChannel('download-video-with-settings');

    if (!videoUrl || typeof videoUrl !== 'string') {
      return event.sender.send('download-error', 'URL do vídeo é obrigatória.');
    }
    if (!isValidUrl(videoUrl)) {
      return event.sender.send('download-error', 'URL inválida ou domínio não suportado.');
    }
    if (!binaryPaths) {
      return event.sender.send('download-error', 'Binários não inicializados. Reinicie a aplicação.');
    }

    const { ytdlp: ytdlpPath, ffmpeg: ffmpegPath } = binaryPaths;
    const fs = require('fs');
    if (!fs.existsSync(ytdlpPath) || !fs.existsSync(ffmpegPath)) {
      return event.sender.send('download-error', 'yt-dlp ou ffmpeg não foram encontrados.');
    }

    const runDownload = (downloadArgs) => {
      const sanitizedArgs = sanitizeArgs(downloadArgs);
      const ytdlpProcess = spawn(ytdlpPath, sanitizedArgs);

      const timeoutId = setTimeout(() => {
        if (!ytdlpProcess.killed) {
          ytdlpProcess.kill('SIGTERM');
          event.sender.send('download-error', 'Download cancelado por timeout (30 minutos).');
        }
      }, 30 * 60 * 1000);

      ytdlpProcess.stdout.on('data', (data) => {
        event.sender.send('download-progress', data.toString());
      });
      ytdlpProcess.stderr.on('data', (data) => {
        console.error(`yt-dlp stderr: ${data}`);
        event.sender.send('download-error', data.toString());
      });
      ytdlpProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        if (code === 0) {
          console.log('Download completed successfully.');
          
          // Try to extract file information and add to downloaded files
          try {
            const downloadsPath = app.getPath('downloads');
            const files = fs.readdirSync(downloadsPath);
            const videoFiles = files.filter(file => {
              const ext = path.extname(file).toLowerCase();
              return ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.flv'].includes(ext);
            });
            
            // Find the most recent video file
            if (videoFiles.length > 0) {
              const latestFile = videoFiles.reduce((latest, current) => {
                const latestPath = path.join(downloadsPath, latest);
                const currentPath = path.join(downloadsPath, current);
                const latestTime = fs.statSync(latestPath).mtime;
                const currentTime = fs.statSync(currentPath).mtime;
                return currentTime > latestTime ? current : latest;
              });
              
              const filePath = path.join(downloadsPath, latestFile);
              const stats = fs.statSync(filePath);
              
              addDownloadedFile({
                title: path.parse(latestFile).name,
                fileName: latestFile,
                filePath: filePath,
                fileSize: stats.size,
                format: path.extname(latestFile).substring(1).toUpperCase(),
                url: videoUrl
              });
            }
          } catch (error) {
            console.error('Error tracking downloaded file:', error);
          }
          
          event.sender.send('download-success');
        } else {
          console.error(`yt-dlp process exited with code ${code}`);
          event.sender.send('download-error', `Process exited with code ${code}`);
        }
      });
      ytdlpProcess.on('error', (err) => {
        clearTimeout(timeoutId);
        console.error('Failed to start yt-dlp process.', err);
        event.sender.send('download-error', `Failed to start process. Error: ${err.message}`);
      });
    };

    // Etapa 1: Obter metadados do vídeo
    const infoArgs = ['--dump-json', videoUrl];
    const ytdlpInfoProcess = spawn(ytdlpPath, sanitizeArgs(infoArgs));
    let infoJson = '';
    ytdlpInfoProcess.stdout.on('data', (data) => {
      infoJson += data.toString();
    });
    ytdlpInfoProcess.stderr.on('data', (data) => {
      console.error(`yt-dlp (info) stderr: ${data}`);
    });
    ytdlpInfoProcess.on('close', (code) => {
      if (code !== 0) {
        return event.sender.send('download-error', 'Falha ao obter informações do vídeo.');
      }
      
      try {
        const info = JSON.parse(infoJson);
        const acodec = info.acodec || '';

        // Etapa 2: Construir argumentos e decidir sobre o re-encode
        const args = buildYtdlpArgs(settings, videoUrl, ffmpegPath);
        
        const targetAudioCodec = settings.audioFormat;
        
        if (targetAudioCodec !== 'best') {
            const codecMap = {
                'mp3': { check: 'mp3', ffmpeg: 'libmp3lame' },
                'aac': { check: 'mp4a', ffmpeg: 'aac' },
                'opus': { check: 'opus', ffmpeg: 'libopus' }
            };

            const target = codecMap[targetAudioCodec];

            // Se o codec de áudio de destino for especificado e não corresponder ao codec de origem,
            // copia o vídeo e re-encoda apenas o áudio.
            if (target && !acodec.startsWith(target.check)) {
                console.log(`Codec de áudio detectado: ${acodec}. Re-encodando para ${targetAudioCodec.toUpperCase()}.`);
                args.push('--postprocessor-args', `ffmpeg:-c:v copy -c:a ${target.ffmpeg}`);
            } else {
                console.log(`Codec de áudio já é compatível (${acodec}) ou formato de destino é 'best'. Remuxing.`);
            }
        } else {
            console.log(`Formato de áudio de destino é 'best'. Remuxing.`);
        }
        
        // Etapa 3: Iniciar o download
        runDownload(args);

      } catch (e) {
        console.error('Erro ao analisar JSON do vídeo:', e);
        event.sender.send('download-error', 'Falha ao analisar informações do vídeo.');
      }
    });

  } catch (error) {
    console.error('Erro no download:', error);
    event.sender.send('download-error', `Erro no download: ${error.message}`);
  }
});

// Listen for a 'download-video' message from the renderer process
ipcMain.on('download-video', async (event, videoUrl) => {
  // Redirect to the main download handler with default settings
  const defaultSettings = {
    outputFormat: 'mp4',
    quality: 'best',
    concurrentFragments: 8,
    embedSubs: false,
    writeInfoJson: false,
    writeThumbnail: false,
    writeDescription: false,
    userAgent: '',
    referer: '',
    socketTimeout: 30,
    retries: 5,
    fragmentRetries: 5,
    extractorRetries: 3,
    noCheckCertificate: true,
    ignoreErrors: true,
  };
  ipcMain.emit('download-video-with-settings', event, videoUrl, defaultSettings);
});

// Handler para verificar status dos binários
ipcMain.on('check-binaries-status', (event) => {
  try {
    // Validar canal IPC
    validateIpcChannel('check-binaries-status');
    
    if (binaryPaths) {
      const appMode = binaryDownloader ? binaryDownloader.getAppMode() : null;
      event.sender.send('binaries-status', {
        status: 'ready',
        paths: binaryPaths,
        platform: process.platform,
        arch: process.arch,
        appMode: appMode
      });
    } else {
      event.sender.send('binaries-status', {
        status: 'not-ready',
        message: 'Binários ainda não foram inicializados'
      });
    }
  } catch (error) {
    console.error('Erro ao verificar status dos binários:', error);
    event.sender.send('binaries-status', {
      status: 'error',
      message: 'Erro interno ao verificar binários'
    });
  }
});

// Handler para abrir a pasta de downloads
ipcMain.on('open-downloads-folder', async (event) => {
  try {
    validateIpcChannel('open-downloads-folder');
    const open = (await import('open')).default;
    const downloadsPath = app.getPath('downloads');
    await open(downloadsPath);
  } catch (error) {
    console.error('Erro ao abrir a pasta de downloads:', error);
    // Opcional: notificar o renderer sobre o erro
    event.sender.send('download-error', 'Não foi possível abrir a pasta de downloads.');
  }
});

// Handler para obter arquivos baixados
ipcMain.on('get-downloaded-files', (event) => {
  try {
    validateIpcChannel('get-downloaded-files');
    const files = getDownloadedFiles();
    event.sender.send('downloaded-files-list', files);
  } catch (error) {
    console.error('Erro ao obter arquivos baixados:', error);
    event.sender.send('download-error', 'Erro ao carregar arquivos baixados.');
  }
});

// Handler para deletar arquivo baixado
ipcMain.on('delete-downloaded-file', (event, fileId) => {
  try {
    validateIpcChannel('delete-downloaded-file');
    const file = downloadedFiles.find(f => f.id === fileId);
    if (file && file.filePath && fs.existsSync(file.filePath)) {
      fs.unlinkSync(file.filePath);
    }
    removeDownloadedFile(fileId);
    event.sender.send('file-deleted', fileId);
  } catch (error) {
    console.error('Erro ao deletar arquivo:', error);
    event.sender.send('download-error', 'Erro ao deletar arquivo.');
  }
});

// Handler para abrir localização do arquivo
ipcMain.on('open-file-location', async (event, fileId) => {
  try {
    validateIpcChannel('open-file-location');
    const file = downloadedFiles.find(f => f.id === fileId);
    if (file && file.filePath) {
      const open = (await import('open')).default;
      await open(file.filePath);
    }
  } catch (error) {
    console.error('Erro ao abrir localização do arquivo:', error);
    event.sender.send('download-error', 'Erro ao abrir localização do arquivo.');
  }
});
