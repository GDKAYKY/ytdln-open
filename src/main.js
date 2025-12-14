const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const BinaryDownloader = require('./bin-downloader');
const fs = require('node:fs');

const ALLOWED_IPC_CHANNELS = new Set([
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
    'delete-downloaded-file',
    'open-file-location',
    'open-video-file'
]);

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

function isValidUrl(url) {
    try {
        const urlObj = new URL(url);
        return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
        throw new Error('URL inválida');
    }
}

function sanitizeArgs(args) {
    return args.map(arg => {
        if (typeof arg === 'string') {
            return arg.replaceAll(/[;&|`$[\]{}]/g, '');
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

/**
 * Valida a integridade do binário usando hash SHA256
 * @param {string} binaryPath - Caminho para o binário
 * @param {string} expectedHash - Hash SHA256 esperado
 * @returns {boolean}
 */


/**
 * Garante que o binário tem permissões de execução (Linux/Mac)
 * @param {string} binaryPath - Caminho para o binário
 */

/**
 * Executa um comando de forma segura usando execFileSync
 * @param {string} command - Comando para executar
 * @param {Array} args - Argumentos do comando
 * @param {Object} options - Opções do execFileSync
 * @returns {string|null}
 */
function safeExecFile(command, args = [], options = {}) {
    try {
        const result = execFileSync(command, args, {
            encoding: 'utf8',
            timeout: 10,
            ...options
        });
        return result.trim();
    }
    catch (error) {
        console.error(`Erro ao executar comando: ${command}`, error);
        return null;
    }
}

/**
 * Encontra um binário no PATH do sistema
 * @param {string} binaryName - Nome do binário
 * @returns {string|null}
 */
function findSystemBinary(binaryName) {
    if (process.platform === 'win32') {
        const result = safeExecFile('where', [binaryName]);
        return result ? result.split('\n')[0].trim() : null;
    } else {
        const result = safeExecFile('which', [binaryName]);
        return result || null;
    }
}

function scanDownloadsDir() {
    try {
        const downloadsPath = app.getPath('downloads');
        if (!fs.existsSync(downloadsPath)) return;

        const files = fs.readdirSync(downloadsPath);
        const videoExtensions = new Set(['.mp4', '.mkv', '.webm', '.avi', '.mov', '.flv']);
        let newFilesFound = false;

        files.forEach(file => {
            const ext = path.extname(file).toLowerCase();
            if (videoExtensions.has(ext)) {
                const filePath = path.join(downloadsPath, file);
                
                const isTracked = downloadedFiles.some(f => f.filePath === filePath);
                
                if (!isTracked) {
                    try {
                        const stats = fs.statSync(filePath);
                        const thumbnailPath = findThumbnailForFile(filePath);
                        
                        downloadedFiles.unshift({
                            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                            title: path.parse(file).name,
                            fileName: file,
                            filePath: filePath,
                            fileSize: stats.size,
                            duration: 0,
                            format: ext.substring(1).toUpperCase(),
                            thumbnail: thumbnailPath,
                            downloadDate: stats.birthtime,
                            url: '' 
                        });
                        newFilesFound = true;
                    } catch (e) {
                        console.error("Erro ao processar arquivo encontrado:", file, e);
                    }
                }
            }
        });
        
        return newFilesFound;
    } catch (err) {
        console.error("Erro ao escanear pasta de downloads:", err);
        return false;
    }
}

// ============================================================================
// BINARY MANAGEMENT
// ============================================================================

let binaryDownloader = null;
let binaryPaths = null;

async function initializeBinaries() {
    try {
        binaryDownloader = new BinaryDownloader();
        binaryPaths = await binaryDownloader.checkAndDownloadBinaries();

        console.log('✓ Binários inicializados e validados:', binaryPaths);
        return binaryPaths;
    } catch (error) {
        console.error('Erro ao inicializar binários:', error);

        // Tentar usar binários do sistema como fallback
        const fallbackPaths = {
            ytdlp: getYtdlpPath(),
            ffmpeg: getFfmpegPath()
        };

        if (fallbackPaths.ytdlp && fallbackPaths.ffmpeg) {
            console.log('Usando binários do sistema como fallback');
            binaryPaths = fallbackPaths;
            return fallbackPaths;
        }

        throw error;
    }
}

// ============================================================================
// DOWNLOADED FILES MANAGEMENT
// ============================================================================

let downloadedFiles = [];
const downloadsMetadataPath = path.join(app.getPath('userData'), 'downloads.json');

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
    id: fileInfo.id ?? crypto.randomUUID(),
    title: fileInfo.title ?? 'Unknown Title',
    url: fileInfo.url ?? '',
    filePath: fileInfo.filePath ?? '',
    fileName: fileInfo.fileName ?? '',
    fileSize: fileInfo.fileSize ?? 0,
    duration: fileInfo.duration ?? 0,
    thumbnail: fileInfo.thumbnail ?? '',
    format: fileInfo.format ?? '',
    downloadDate: fileInfo.downloadDate ?? new Date().toISOString()
    };

    downloadedFiles.unshift(fileData);
    saveDownloadedFiles();
    return fileData;
}

function removeDownloadedFile(fileId) {
  const before = downloadedFiles.length;
  downloadedFiles = downloadedFiles.filter(f => f.id !== fileId);

  if (downloadedFiles.length !== before) {
    saveDownloadedFiles();
    return true;
  }
  return false;
}


function findThumbnailForFile(videoFilePath) {
    if (!videoFilePath) return '';
    
    try {
        const dir = path.dirname(videoFilePath);
        const ext = path.extname(videoFilePath);
        const baseName = path.basename(videoFilePath, ext);
        
        // Extensões de imagem comuns para thumbnails
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
        
        for (const imgExt of imageExtensions) {
            const thumbPath = path.join(dir, baseName + imgExt);
            if (fs.existsSync(thumbPath)) {
                return thumbPath;
            }
        }
    } catch (error) {
        console.error('Erro ao procurar thumbnail:', error);
    }
    return '';
}

function getDownloadedFiles() {
    // Escanear pasta por novos arquivos antes de processar
    if (scanDownloadsDir()) {
        console.log('Novos arquivos detectados durante o scan.');
    }

    let changed = false;
    const validFiles = [];
    const idsToRemove = [];

    // Validar arquivos e buscar thumbnails perdidas
    for (const file of downloadedFiles) {
        if (file.filePath && fs.existsSync(file.filePath)) {
            // Se não tem thumbnail ou ela não existe mais, tenta encontrar
            if (!file.thumbnail || !fs.existsSync(file.thumbnail)) {
                const thumb = findThumbnailForFile(file.filePath);
                if (thumb) {
                    file.thumbnail = thumb;
                    changed = true;
                }
            }
            validFiles.push(file);
        } else {
            idsToRemove.push(file.id);
        }
    }

    if (idsToRemove.length > 0) {
        downloadedFiles = validFiles;
        saveDownloadedFiles();
    } else if (changed) {
        saveDownloadedFiles();
    }

    return downloadedFiles;
}

function trackDownloadedFile(videoUrl) {
    try {
        const downloadsPath = app.getPath('downloads');
        const files = fs.readdirSync(downloadsPath);
        const videoFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.flv'].includes(ext);
        });

        if (videoFiles.length === 0) return;

        const latestFile = videoFiles.reduce((latest, current) => {
            const latestPath = path.join(downloadsPath, latest);
            const currentPath = path.join(downloadsPath, current);
            const latestTime = fs.statSync(latestPath).mtime;
            const currentTime = fs.statSync(currentPath).mtime;
            return currentTime > latestTime ? current : latest;
        }, videoFiles[0]); // Use first element as initial value

        const filePath = path.join(downloadsPath, latestFile);
        const thumbnailPath = findThumbnailForFile(filePath);
        const stats = fs.statSync(filePath);

        addDownloadedFile({
            title: path.parse(latestFile).name,
            fileName: latestFile,
            filePath: filePath,
            fileSize: stats.size,
            format: path.extname(latestFile).substring(1).toUpperCase(),
            url: videoUrl,
            thumbnail: thumbnailPath
        });
    } catch (error) {
        console.error('Error tracking downloaded file:', error);
    }
}

// ============================================================================
// YT-DLP UTILITIES
// ============================================================================

function buildYtdlpArgs(settings, videoUrl, ffmpegPath) {
    const args = ['--progress', '--newline'];

    args.push(
        '-o', path.join(app.getPath('downloads'), '%(title)s.%(ext)s'),
        '--ffmpeg-location', ffmpegPath,
        '--merge-output-format', settings.outputFormat
    );

    if (settings.quality !== 'best') {
        if (settings.quality === 'worst') {
            args.push('-f', 'worst');
        } else {
            args.push('-f', `best[height<=${settings.quality.replace('p', '')}]`);
        }
    }

    args.push('--concurrent-fragments', settings.concurrentFragments.toString());

    if (settings.embedSubs) args.push('--embed-subs');
    if (settings.writeInfoJson) args.push('--write-info-json');
    if (settings.writeThumbnail) args.push('--write-thumbnail');
    if (settings.writeDescription) args.push('--write-description');
    if (settings.userAgent) args.push('--user-agent', settings.userAgent);
    if (settings.referer) args.push('--referer', settings.referer);

    args.push(
        '--socket-timeout', settings.socketTimeout.toString(),
        '--retries', settings.retries.toString(),
        '--fragment-retries', settings.fragmentRetries.toString(),
        '--extractor-retries', settings.extractorRetries.toString()
    );

    if (settings.noCheckCertificate) args.push('--no-check-certificate');
    if (settings.ignoreErrors) args.push('--ignore-errors');

    args.push(videoUrl);
    return args;
}

function getVideoInfo(ytdlpPath, videoUrl) {
    return new Promise((resolve) => {
        const infoArgs = ['--dump-json', videoUrl];
        const ytdlpProcess = spawn(ytdlpPath, sanitizeArgs(infoArgs), {
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let infoJson = '';

        ytdlpProcess.stdout.on('data', (data) => {
            infoJson += data.toString();
        });

        ytdlpProcess.stderr.on('data', (data) => {
            console.error(`yt-dlp (info) stderr: ${data}`);
        });

        ytdlpProcess.on('close', (code) => {
            if (code !== 0) {
                resolve(null);
                return;
            }

            try {
                const info = JSON.parse(infoJson);
                resolve({ acodec: info.acodec || '' });
            } catch (e) {
                console.error('Erro ao analisar JSON do vídeo:', e);
                resolve(null);
            }
        });

        ytdlpProcess.on('error', (err) => {
            console.error('Erro ao executar yt-dlp:', err);
            resolve(null);
        });
    });
}

function buildDownloadArgs(settings, videoUrl, ffmpegPath, sourceAcodec) {
    const args = buildYtdlpArgs(settings, videoUrl, ffmpegPath);
    const targetFormat = settings.audioFormat;

    if (targetFormat === 'best') {
        console.log('Formato de áudio de destino é "best". Remuxing.');
        return args;
    }

    const codecMap = {
        'mp3': { check: 'mp3', ffmpeg: 'libmp3lame' },
        'aac': { check: 'mp4a', ffmpeg: 'aac' },
        'opus': { check: 'opus', ffmpeg: 'libopus' }
    };

    const target = codecMap[targetFormat];

    if (target && !sourceAcodec.startsWith(target.check)) {
        console.log(`Codec de áudio detectado: ${sourceAcodec}. Re-encodando para ${targetFormat.toUpperCase()}.`);
        args.push('--postprocessor-args', `ffmpeg:-c:v copy -c:a ${target.ffmpeg}`);
    } else {
        console.log(`Codec de áudio já é compatível (${sourceAcodec}). Remuxing.`);
    }

    return args;
}

function runYtdlpProcess(event, ytdlpPath, downloadArgs, videoUrl) {
    const sanitizedArgs = sanitizeArgs(downloadArgs);
    const ytdlpProcess = spawn(ytdlpPath, sanitizedArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
    });

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
            trackDownloadedFile(videoUrl);
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
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function validateVideoUrlOrNotify(event, videoUrl) {
    if (!videoUrl || typeof videoUrl !== 'string') {
        event.sender.send('download-error', 'URL do vídeo é obrigatória.');
        return false;
    }
    if (!isValidUrl(videoUrl)) {
        event.sender.send('download-error', 'URL inválida ou domínio não suportado.');
        return false;
    }
    return true;
}

function ensureBinariesReadyOrNotify(event) {
    if (!binaryPaths) {
        event.sender.send('download-error', 'Binários não inicializados. Reinicie a aplicação.');
        return null;
    }

    let ytdlpPath = binaryPaths.ytdlp;
    let ffmpegPath = binaryPaths.ffmpeg;

    // Verificar existência e tentar fallback se necessário
    if (!fs.existsSync(ytdlpPath)) {
        ytdlpPath = getYtdlpPath();
        if (!ytdlpPath) {
            event.sender.send('download-error', 'yt-dlp not found.');
            return null;
        }
    }

    if (!fs.existsSync(ffmpegPath)) {
        ffmpegPath = getFfmpegPath();
        if (!ffmpegPath) {
            event.sender.send('download-error', 'ffmpeg not found.');
            return null;
        }
    }

    return { ytdlpPath, ffmpegPath };
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
            event.sender.send('download-error', error.message || 'Erro interno desconhecido');
        }
    });
}

createIpcHandler('download-video-with-settings', async (event, videoUrl, settings) => {
    if (!validateVideoUrlOrNotify(event, videoUrl)) return;

    const bin = ensureBinariesReadyOrNotify(event);
    if (!bin) return;

    const { ytdlpPath, ffmpegPath } = bin;

    const videoInfo = await getVideoInfo(ytdlpPath, videoUrl);
    if (!videoInfo) {
        throw new Error('Failed to get video information.');
    }

    const args = buildDownloadArgs(settings, videoUrl, ffmpegPath, videoInfo.acodec);
    runYtdlpProcess(event, ytdlpPath, args, videoUrl);
});

ipcMain.on('download-video', async (event, videoUrl) => {
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
        audioFormat: 'best'
    };
    ipcMain.emit('download-video-with-settings', event, videoUrl, defaultSettings);
});

ipcMain.on('check-binaries-status', (event) => {
    try {
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
            message: `Erro interno: ${error.message} \n ${error.stack}`
        });
    }
});

createIpcHandler('open-downloads-folder', async () => {
    const downloadsPath = app.getPath('downloads');
    await shell.openPath(downloadsPath);
});

createIpcHandler('get-downloaded-files', (event) => {
    const files = getDownloadedFiles();
    event.sender.send('downloaded-files-list', files);
});

createIpcHandler('delete-downloaded-file', (event, fileId) => {
    const file = downloadedFiles.find(f => f.id === fileId);

    if (file?.filePath && fs.existsSync(file.filePath)) {
        fs.unlinkSync(file.filePath);
    }

    removeDownloadedFile(fileId);
    event.sender.send('file-deleted', fileId);
});

createIpcHandler('open-file-location', (event, fileId) => {
    const file = downloadedFiles.find(f => f.id === fileId);
    const filePath = file?.filePath;

    if (filePath && fs.existsSync(filePath)) {
        shell.showItemInFolder(file.filePath);
    } else {
        throw new Error('Arquivo não encontrado.');
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
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false // Permitir carregar recursos locais (thumbnails)
        }
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.loadFile('src/index.html').then(r =>{console.log(r)} );
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================
(async () => {
try {
    await app.whenReady();

    await initializeBinaries();
    logBinariesInfo();
    loadDownloadedFiles();
    createWindow();
} catch (error) {
    console.error('Erro ao inicializar aplicação:', error);
    createWindow();
}
})();
app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
