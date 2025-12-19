const { app, BrowserWindow, ipcMain, shell, protocol, net, dialog } = require('electron');
const path = require('node:path');
const url = require('node:url');
const { spawn, execFileSync, execFile } = require('node:child_process');
const util = require('node:util');
const execFileAsync = util.promisify(execFile);
const BinaryDownloader = require('./bin-downloader');
// INICIO
const VideoDownloader = require('./video-downloader');
// FIM
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const crypto = require('node:crypto');

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
    'open-video-file',
    'select-folder',
    'folder-selected',
    'open-specific-folder',
    'clean-temp-files',
    'move-temp-files-to-downloads'
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
function safeExecFile(command, args = [], options = {}) {
    try {
        const result = execFileSync(command, args, {
            encoding: 'utf8',
            timeout: 1000,
            ...options
        });
        return result.trim();
    }
    catch (error) {
        console.error(`Erro ao executar comando: ${command}`, error);
        return null;
    }
}

function findSystemBinary(binaryName) {
    if (process.platform === 'win32') {
        const result = safeExecFile('where', [binaryName]);
        return result ? result.split('\n')[0].trim() : null;
    } else {
        const result = safeExecFile('which', [binaryName]);
        return result || null;
    }
}

async function scanDownloadsDir() {
    try {
        const downloadsPath = app.getPath('downloads');
        try {
            await fsPromises.access(downloadsPath);
        } catch {
            return false;
        }

        const files = await fsPromises.readdir(downloadsPath);
        const videoExtensions = new Set(['.mp4', '.mkv', '.webm', '.avi', '.mov', '.flv']);
        let newFilesFound = false;

        // Process files in chunks or parallel? Parallel is fine for local fs usually.
        await Promise.all(files.map(async (file) => {
            const ext = path.extname(file).toLowerCase();
            if (videoExtensions.has(ext)) {
                // Ignore temp files and partial downloads
                if (file.includes('.tmp') || file.endsWith('.part')) return;
                const filePath = path.join(downloadsPath, file);
                
                const isTracked = downloadedFiles.some(f => f.filePath === filePath);
                
                if (!isTracked) {
                    try {
                        const stats = await fsPromises.stat(filePath);
                        const thumbnailPath = await findThumbnailForFile(filePath);
                        
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
        }));
        
        return newFilesFound;
    } catch (err) {
        console.error("Erro ao escanear pasta de downloads:", err);
        return false;
    }
}

// ============================================================================
// BINARY MANAGEMENT
// ============================================================================

// binaryDownloader removed as it was unused and uninitialized
let videoDownloader = null;
let binaryPaths = null;

// INICIO
async function initializeBinaries() {
    try {
        videoDownloader = new VideoDownloader();
        await videoDownloader.init();
        binaryPaths = videoDownloader.binaries;

        console.log('✓ Binários inicializados e validados:', binaryPaths);
        return binaryPaths; // Retorna os caminhos baixados
    } catch (error) {
        console.error('Erro ao inicializar binários (Tentando Fallback):', error);

        // Tentar usar binários do sistema como fallback
        const fallbackPaths = {
            ytdlp: findSystemBinary('yt-dlp'),
            ffmpeg: findSystemBinary('ffmpeg')
        };

        if (fallbackPaths.ytdlp && fallbackPaths.ffmpeg) {
            console.log('Usando binários do sistema como fallback');
            
            binaryPaths = fallbackPaths; // Atualiza a variável global

            return fallbackPaths; // Retorna os caminhos do sistema
        }

        // Se o fallback falhar, lança o erro.
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

async function saveDownloadedFiles() {
    try {
        const tempPath = `${downloadsMetadataPath}.tmp`;
        await fsPromises.writeFile(tempPath, JSON.stringify(downloadedFiles, null, 2));
        await fsPromises.rename(tempPath, downloadsMetadataPath);
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
    saveDownloadedFiles().catch(err => console.error("Save failed", err));
    return fileData;
}

function removeDownloadedFile(fileId) {
  const before = downloadedFiles.length;
  downloadedFiles = downloadedFiles.filter(f => f.id !== fileId);

  if (downloadedFiles.length !== before) {
    // Fire and forget save, or we should make removeDownloadedFile async?
    // For now, let's just call it without awaiting since it's a void return mostly
    saveDownloadedFiles().catch(err => console.error("Save failed", err));
    return true;
  }
  return false;
}


async function findThumbnailForFile(videoFilePath) {
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

async function getDownloadedFiles() {
    // Escanear pasta por novos arquivos antes de processar
    if (await scanDownloadsDir()) {
        console.log('Novos arquivos detectados durante o scan.');
    }

    let changed = false;
    const validFiles = [];
    const idsToRemove = [];

    // Validar arquivos e buscar thumbnails perdidas
    // Use Promise.all for parallelism or for loop with await
    await Promise.all(downloadedFiles.map(async (file) => {
        if (file.filePath) {
             try {
                await fsPromises.access(file.filePath);
                // Arquivo existe
                
                // Se não tem thumbnail ou ela não existe mais, tenta encontrar
                let thumbExists = false;
                if (file.thumbnail) {
                    try {
                        await fsPromises.access(file.thumbnail);
                        thumbExists = true;
                    } catch {}
                }

                if (!file.thumbnail || !thumbExists) {
                    // Tentar encontrar externa
                    let thumb = findThumbnailForFile(file.filePath);
                    
                    // Se não achar externa, tentar cache/extração (mas sem bloquear muito)
                    if (!thumb) {
                        const cachePath = getCachedThumbnailPath(file.filePath);
                        try {
                            await fsPromises.access(cachePath);
                            thumb = cachePath;
                        } catch {}
                    }

                    if (thumb) {
                        file.thumbnail = thumb;
                        changed = true;
                    }
                }
                validFiles.push(file);
             } catch {
                 // Arquivo não existe
                 idsToRemove.push(file.id);
             }
        } else {
            idsToRemove.push(file.id);
        }
    }));
    
    // Sort logic usually needed if using Promise.all, but original code didn't sort explicitly other than unshift. 
    // Wait, map maintains order of inputs in the output array, but validFiles push inside async might mix order.
    // Let's stick to a for loop for safety on order or re-sort.
    // Actually, let's do a linear scan with await to preserve order easily, as metadata list shouldn't be huge.
    // Re-doing the block above as a loop to preserve order simply.
    
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

const thumbnailsCachePath = path.join(app.getPath('userData'), 'thumbnails');
if (!fs.existsSync(thumbnailsCachePath)) {
    fs.mkdirSync(thumbnailsCachePath, { recursive: true });
}

function getCachedThumbnailPath(videoPath) {
    const hash = crypto.createHash('md5').update(videoPath).digest('hex');
    return path.join(thumbnailsCachePath, `${hash}.jpg`);
}

// Revert to synchronous implementation as originally requested
function extractThumbnail(videoPath) {
    if (!videoPath || !fs.existsSync(videoPath)) return '';

    const cachePath = getCachedThumbnailPath(videoPath);
    if (fs.existsSync(cachePath)) return cachePath;

    try {
        const ffmpegPath = binaryPaths?.ffmpeg || 'ffmpeg';

        // Tenta extrair a imagem embutida (stream 0:v:1 assumindo layout padrão pós-merge)
        try {
            execFileSync(ffmpegPath, [
                '-y',
                '-i', videoPath,
                '-map', '0:v:1',
                '-c', 'copy',
                '-f', 'image2',
                cachePath
            ], { stdio: 'ignore' });

            if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0) {
                return cachePath;
            }
        } catch (e) {
            // Se falhar (ex: sem stream v:1), tenta fallback
        }

        // Fallback: Extrair primeiro frame
        execFileSync(ffmpegPath, [
            '-y',
            '-i', videoPath,
            '-ss', '00:00:01',
            '-frames:v', '1',
            '-f', 'image2',
            cachePath
        ], { stdio: 'ignore' });

        if (fs.existsSync(cachePath)) return cachePath;

    } catch (err) {
        console.error('Falha na extração de thumbnail:', err);
    }
    return '';
}

// Revert to original Promise/callback implementation
function mergeThumbnailIntoVideo(videoFilePath) {
    if (!videoFilePath) return false;

    const dir = path.dirname(videoFilePath);
    const ext = path.extname(videoFilePath);
    const base = path.basename(videoFilePath, ext);

    const thumbExts = ['.webp', '.jpg', '.jpeg', '.png'];
    let thumbPath = null;

    for (const tExt of thumbExts) {
        const candidate = path.join(dir, base + tExt);
        if (fs.existsSync(candidate)) {
            thumbPath = candidate;
            break;
        }
    }

    // sem thumbnail -> não faz nada
    if (!thumbPath) return false;

    const tmpOutput = path.join(dir, `${base}.tmp${ext}`);
    const ffmpegPath = binaryPaths?.ffmpeg || 'ffmpeg';

    return new Promise((resolve) => {
        execFile(
            ffmpegPath,
            [
                '-y',
                '-i', videoFilePath,
                '-i', thumbPath,
                '-map', '0',
                '-map', '1',
                '-c', 'copy',
                '-disposition:v:1', 'attached_pic',
                tmpOutput
            ],
            (err) => {
                if (err || !fs.existsSync(tmpOutput)) {
                    // falhou -> não toca em nada
                    if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
                    return resolve(false);
                }

                try {
                    // substitui o original
                    fs.renameSync(tmpOutput, videoFilePath);

                    // cleanup da thumbnail
                    fs.unlinkSync(thumbPath);

                    resolve(true);
                } catch {
                    // rollback simples
                    if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
                    resolve(false);
                }
            }
        );
    });
}

async function trackDownloadedFile(videoUrl, specificPath = null, settings = {}) {
    try {
        const downloadsPath = app.getPath('downloads');
        const files = await fsPromises.readdir(downloadsPath);
        const videoFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.flv'].includes(ext);
        });

        if (videoFiles.length === 0 && !specificPath) return;

        let filePath = specificPath;

        if (!filePath || !(await fsPromises.stat(filePath).catch(()=>false))) {
             // Need to find latest file manually if not provided
             // This logic of reducing mostly works but is heavy if many files. 
             // Ideally we shouldn't rely on scanning all files to find the one we just downloaded.
             // But detecting the exact file from yt-dlp is sometimes tricky.
             // We'll keep the logic but make it async-compatible (load stats for all)
             
             const fileStats = await Promise.all(videoFiles.map(async f => {
                 const p = path.join(downloadsPath, f);
                 const s = await fsPromises.stat(p);
                 return { file: f, mtime: s.mtime };
             }));

             if (fileStats.length > 0) {
                 const latest = fileStats.reduce((prev, current) => {
                     return (prev.mtime > current.mtime) ? prev : current;
                 });
                 filePath = path.join(downloadsPath, latest.file);
             }
        }
        
        if (filePath) {
            let thumbnailPath = '';
            
            // 1. Encontrar thumbnail baixada
            const originalThumbPath = await findThumbnailForFile(filePath);

            if (originalThumbPath && fs.existsSync(originalThumbPath)) {
                try {
                    // 2. Definir caminho na biblioteca (cache)
                    // Usa o mesmo hash do video para consistencia, mas mantendo a extensao original da thumb
                    const thumbExt = path.extname(originalThumbPath);
                    const cachePathBase = getCachedThumbnailPath(filePath); // Retorna com .jpg
                    const libraryThumbPath = cachePathBase.substring(0, cachePathBase.lastIndexOf('.')) + thumbExt;
                    
                    // 3. Copiar para a biblioteca
                    await fsPromises.copyFile(originalThumbPath, libraryThumbPath);
                    thumbnailPath = libraryThumbPath;

                    // 4. Apagar original se a config "writeThumbnail" estiver desligada
                    // Se estiver ligada, o usuário quer manter o arquivo.
                    if (!settings.writeThumbnail) {
                        try {
                            await fsPromises.unlink(originalThumbPath);
                        } catch (e) {
                             console.error('Erro ao deletar thumbnail original:', e);
                        }
                    }
                } catch (e) {
                    console.error('Erro ao processar thumbnail da biblioteca:', e);
                }
            }

            // Fallback: se algo deu errado ou não baixou (embora tenhamos forçado a flag), tenta extrair
            if (!thumbnailPath) {
                 // Tentar extrair se não achou arquivo
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
                thumbnail: thumbnailPath
            });
        }
    } catch (error) {
        console.error('Error tracking downloaded file:', error);
    }
}

// ============================================================================
// YT-DLP UTILITIES
// ============================================================================



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

// INICIO
createIpcHandler('download-video-with-settings', async (event, videoUrl, settings) => {
    if (!validateVideoUrlOrNotify(event, videoUrl)) return;

    try {
        const detectedPath = await videoDownloader.download(videoUrl, settings, {
            onProgress: (msg) => event.sender.send('download-progress', msg),
            onError: (msg) => event.sender.send('download-error', msg)
        });
        
        console.log('Download completed successfully.');
        await trackDownloadedFile(videoUrl, detectedPath, settings);
        event.sender.send('download-success');
    } catch (err) {
        console.error('Download failed:', err);
        event.sender.send('download-error', err.message);
    }
});
// FIM

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
            // Fix: Not using binaryDownloader as it is null/unused.
            // Using standard appMode default as portable/installed distinction logic isn't present in BinaryDownloader.
            const appMode = 'standard'; 
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

createIpcHandler('get-downloaded-files', async (event) => {
    const files = await getDownloadedFiles();
    // Transform paths to media:// protocol URLs for renderer
    // URLs must strictly use forward slashes and encoding, even on Windows.
    const safeFiles = files.map(f => ({
        ...f,
        thumbnail: f.thumbnail ? url.pathToFileURL(f.thumbnail).href.replace('file:', 'media:') : ''
    }));
    event.sender.send('downloaded-files-list', safeFiles);
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

createIpcHandler('select-folder', async (event, type) => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
        event.sender.send('folder-selected', { type, path: result.filePaths[0] });
    }
});

createIpcHandler('open-specific-folder', async (event, folderPath) => {
    if (folderPath && fs.existsSync(folderPath)) {
        await shell.openPath(folderPath);
    }
});

createIpcHandler('clean-temp-files', async (event) => {
    try {
        const downloadsPath = app.getPath('downloads');
        // Clean downloads path of partials
        const cleanDir = async (dir) => {
           if (!fs.existsSync(dir)) return;
           const files = await fsPromises.readdir(dir);
           for (const file of files) {
               if (file.endsWith('.part') || file.endsWith('.ytdl') || file.endsWith('.tmp') || file.includes('.tmp')) {
                   try {
                       await fsPromises.unlink(path.join(dir, file));
                       console.log('Deleted temp file:', file);
                   } catch (e) {
                       console.error('Failed to delete:', file, e.message);
                   }
               }
           }
        };

        await cleanDir(downloadsPath);
        
        // Also clean system temp/ytdln-cache if it exists
        const tempBase = app.getPath('temp');
        await cleanDir(path.join(tempBase, 'ytdln-cache'));

        event.sender.send('download-success'); 
    } catch (e) {
        throw new Error('Failed to clean temp files: ' + e.message);
    }
});

createIpcHandler('move-temp-files-to-downloads', async (event) => {
    try {
        const downloadsPath = app.getPath('downloads');
        const tempBase = app.getPath('temp');
        const cacheDir = path.join(tempBase, 'ytdln-cache');
        
        if (fs.existsSync(cacheDir)) {
             const files = await fsPromises.readdir(cacheDir);
             let movedCount = 0;
             for (const file of files) {
                 const ext = path.extname(file).toLowerCase();
                 // Move common media files
                 if (['.mp4', '.mkv', '.webm', '.mp3', '.wav', '.aac', '.flac', '.opus'].includes(ext)) {
                     const src = path.join(cacheDir, file);
                     const dest = path.join(downloadsPath, file);
                     try {
                         await fsPromises.rename(src, dest);
                         movedCount++;
                         // Track it
                         trackDownloadedFile('', dest, {}); 
                     } catch (e) {
                         console.error('Failed to move file:', file, e);
                     }
                 }
             }
             if (movedCount === 0) {
                 // No files moved, maybe because none were there.
                 console.log('No files to move.');
             } else {
                 event.sender.send('download-success');
             }
        }
    } catch (e) {
        throw new Error(e.message);
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
            webSecurity: true // Security enforced, using media:// protocol
        }
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.loadFile('src/index.html').then(r =>{console.log(r)} );
    return mainWindow;
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================
(async () => {
try {
    await app.whenReady();

    protocol.handle('media', (request) => {
        try {
            // Convert custom media: URL back to file: URL
            const fileUrl = request.url.replace(/^media:/, 'file:');
            // Convert file: URL to absolute system path (handles Windows backslashes correctly)
            const filePath = url.fileURLToPath(fileUrl);
            
            return net.fetch(url.pathToFileURL(filePath).toString());
        } catch (e) {
            console.error('Media protocol error:', e);
            return new Response('Not found', { status: 404 });
        }
    });

    // Create window FIRST to show loading screen
    const mainWindow = createWindow();

    try {
        console.log('Initializing binaries...');
        await initializeBinaries();
        
        // Notify renderer that app is ready using existing channel
        if (mainWindow && !mainWindow.isDestroyed()) {
             const appMode = 'standard'; 
             mainWindow.webContents.send('binaries-status', {
                status: 'ready',
                paths: binaryPaths,
                platform: process.platform,
                arch: process.arch,
                appMode: appMode
            });
        }
        
        loadDownloadedFiles();

    } catch (initError) {
        console.error('Binary initialization failed:', initError);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('binaries-status', {
                status: 'error', 
                message: `Failed to initialize binaries: ${initError.message}`
            });
        }
    }

} catch (error) {
    console.error('Erro ao inicializar aplicação:', error);
}
})();
app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
