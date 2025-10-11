const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const BinaryDownloader = require('./bin-downloader');

// Whitelist de canais IPC permitidos
const ALLOWED_IPC_CHANNELS = [
  'download-video',
  'check-binaries-status',
  'download-progress',
  'download-success',
  'download-error',
  'binaries-status'
];

// Função para validar URL
function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    // Permitir apenas HTTPS e HTTP
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false;
    }
    // Lista de domínios permitidos (YouTube, Vimeo, etc.)
    const allowedDomains = [
      'youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com',
      'vimeo.com', 'www.vimeo.com', 'player.vimeo.com',
      'dailymotion.com', 'www.dailymotion.com',
      'twitch.tv', 'www.twitch.tv', 'clips.twitch.tv',
      'twitter.com', 'www.twitter.com', 'x.com', 'www.x.com',
      'instagram.com', 'www.instagram.com',
      'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com'
    ];
    
    const hostname = urlObj.hostname.toLowerCase();
    return allowedDomains.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

// Função para sanitizar argumentos do spawn
function sanitizeArgs(args) {
  return args.map(arg => {
    if (typeof arg === 'string') {
      // Remover caracteres perigosos mas preservar barras invertidas para caminhos Windows
      return arg.replace(/[;&|`$(){}[\]]/g, '');
    }
    return arg;
  });
}

// Instância do downloader de binários
let binaryDownloader = null;
let binaryPaths = null;

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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // It's crucial to not enable nodeIntegration and to use a preload script.
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  mainWindow.loadFile('src/index.html');

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(async () => {
  try {
    // Inicializar binários antes de criar a janela
    await initializeBinaries();
    createWindow();
  } catch (error) {
    console.error('Erro ao inicializar aplicação:', error);
    // Criar janela mesmo com erro para mostrar mensagem ao usuário
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

// Função para tentar download sem aria2c
function retryDownloadWithoutAria2c(event, videoUrl, ytdlpPath, ffmpegPath) {
  const args = [
    '--progress',
    '--newline',
    '-o',
    path.join(app.getPath('downloads'), '%(title)s.%(ext)s'),
    '--ffmpeg-location',
    ffmpegPath,
    '--merge-output-format', 'mp4',
    '--no-check-certificate',
    '--ignore-errors',
    '--extractor-retries', '3',
    '--fragment-retries', '5',
    '--retries', '5',
    '--socket-timeout', '30',
    '--concurrent-fragments', '8', // Mais fragmentos quando não usa aria2c
    videoUrl
  ];

  const sanitizedArgs = sanitizeArgs(args);
  const ytdlpProcess = spawn(ytdlpPath, sanitizedArgs);

  // Timeout para operações longas (30 minutos)
  const timeoutId = setTimeout(() => {
    if (!ytdlpProcess.killed) {
      ytdlpProcess.kill('SIGTERM');
      event.sender.send('download-error', 'Download cancelado por timeout (30 minutos).');
    }
  }, 30 * 60 * 1000);

  ytdlpProcess.stdout.on('data', (data) => {
    const output = data.toString();
    event.sender.send('download-progress', output);
  });

  ytdlpProcess.stderr.on('data', (data) => {
    console.error(`yt-dlp stderr (sem aria2c): ${data}`);
    event.sender.send('download-error', data.toString());
  });

  ytdlpProcess.on('close', (code) => {
    clearTimeout(timeoutId);
    if (code === 0) {
      console.log('Download completed successfully (sem aria2c).');
      event.sender.send('download-success');
    } else {
      console.error(`yt-dlp process exited with code ${code} (sem aria2c)`);
      event.sender.send('download-error', `Download falhou mesmo sem aria2c. Código: ${code}`);
    }
  });
  
  ytdlpProcess.on('error', (err) => {
    clearTimeout(timeoutId);
    console.error('Failed to start yt-dlp process (sem aria2c).', err);
    event.sender.send('download-error', `Failed to start process. Error: ${err.message}`);
  });
}

// Listen for a 'download-video' message from the renderer process
ipcMain.on('download-video', async (event, videoUrl) => {
  try {
    // Validar canal IPC
    validateIpcChannel('download-video');
    
    // Validar entrada
    if (!videoUrl || typeof videoUrl !== 'string') {
      event.sender.send('download-error', 'URL do vídeo é obrigatória.');
      return;
    }
    
    // Validar URL
    if (!isValidUrl(videoUrl)) {
      event.sender.send('download-error', 'URL inválida ou domínio não suportado.');
      return;
    }
    
    // Verificar se os binários estão disponíveis
    if (!binaryPaths) {
      event.sender.send('download-error', 'Binários não inicializados. Reinicie a aplicação.');
      return;
    }

    const { ytdlp: ytdlpPath, aria2c: aria2cPath, ffmpeg: ffmpegPath } = binaryPaths;

    // Verificar se os binários existem
    const fs = require('fs');
    if (!fs.existsSync(ytdlpPath) || !fs.existsSync(aria2cPath) || !fs.existsSync(ffmpegPath)) {
      event.sender.send('download-error', 'Um ou mais binários não foram encontrados.');
      return;
    }

    const args = [
      '--progress',
      '--newline',
      '-o',
      path.join(app.getPath('downloads'), '%(title)s.%(ext)s'), // Save to user's Downloads folder
      '--downloader',
      aria2cPath,
      '--downloader-args', 'aria2c:\'--max-connection-per-server=4\' \'--min-split-size=1M\' \'--split=8\' \'--retry-wait=2\' \'--max-tries=5\' \'--timeout=30\' \'--connect-timeout=10\' \'--disable-ipv6=true\' \'--file-allocation=none\' \'--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\' \'--referer=https://www.youtube.com/\'',
      '--ffmpeg-location',
      ffmpegPath,
      '--merge-output-format', 'mp4', // Forçar formato de saída
      '--no-check-certificate', // Evitar problemas de certificado
      '--ignore-errors', // Continuar mesmo com erros menores
      '--extractor-retries', '3', // Tentar extrair informações 3 vezes
      '--fragment-retries', '5', // Tentar baixar fragmentos 5 vezes
      '--retries', '5', // Tentar download geral 5 vezes
      '--socket-timeout', '30', // Timeout de socket 30 segundos
      '--concurrent-fragments', '4', // Fragmentos simultâneos (compatível com aria2c)
      videoUrl
    ];

    // Sanitizar argumentos
    const sanitizedArgs = sanitizeArgs(args);
    const ytdlpProcess = spawn(ytdlpPath, sanitizedArgs);

    // Timeout para operações longas (30 minutos)
    const timeoutId = setTimeout(() => {
      if (!ytdlpProcess.killed) {
        ytdlpProcess.kill('SIGTERM');
        event.sender.send('download-error', 'Download cancelado por timeout (30 minutos).');
      }
    }, 30 * 60 * 1000);

    ytdlpProcess.stdout.on('data', (data) => {
      const output = data.toString();
      // Send progress updates to the renderer
      event.sender.send('download-progress', output);
    });

    ytdlpProcess.stderr.on('data', (data) => {
      // Handle errors, could also send to renderer
      console.error(`yt-dlp stderr: ${data}`);
      event.sender.send('download-error', data.toString());
    });

    ytdlpProcess.on('close', (code) => {
      clearTimeout(timeoutId);
      if (code === 0) {
        console.log('Download completed successfully.');
        event.sender.send('download-success');
      } else {
        console.error(`yt-dlp process exited with code ${code}`);
        // Tentar novamente sem aria2c se falhou
        if (code === 1) {
          console.log('Tentando download sem aria2c...');
          retryDownloadWithoutAria2c(event, videoUrl, ytdlpPath, ffmpegPath);
        } else {
          event.sender.send('download-error', `Process exited with code ${code}`);
        }
      }
    });
    
    ytdlpProcess.on('error', (err) => {
      clearTimeout(timeoutId);
      console.error('Failed to start yt-dlp process.', err);
      event.sender.send('download-error', `Failed to start process. Error: ${err.message}`);
    });
  } catch (error) {
    console.error('Erro no download:', error);
    event.sender.send('download-error', `Erro no download: ${error.message}`);
  }
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