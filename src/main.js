const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const BinaryDownloader = require('./bin-downloader');
const fs = require('fs');
const crypto = require('crypto');

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

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

function isValidUrl(url) {
    try {
        const urlObj = new URL(url);
        return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
        return false;
    }
}

function sanitizeArgs(args) {
    return args.map(arg => {
        if (typeof arg === 'string') {
            return arg.replace(/[;&|`$[\]{}]/g, '');
        }
        return arg;
    });
}

function validateIpcChannel(channel) {
    if (!ALLOWED_IPC_CHANNELS.includes(channel)) {
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
function validateBinaryIntegrity(binaryPath, expectedHash) {
    try {
        const fileBuffer = fs.readFileSync(binaryPath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        const hex = hashSum.digest('hex');

        return hex === expectedHash;
    } catch (error) {
        console.error('Erro ao validar integridade do binário:', error);
        return false;
    }
}

/**
 * Garante que o binário tem permissões de execução (Linux/Mac)
 * @param {string} binaryPath - Caminho para o binário
 */
function ensureExecutable(binaryPath) {
    if (process.platform !== 'win32') {
        try {
            fs.chmodSync(binaryPath, 0o755);
            console.log(`Permissões de execução definidas para: ${binaryPath}`);
        } catch (error) {
            console.error('Erro ao definir permissões:', error);
        }
    }
}

/**
 * Obtém o caminho do FFmpeg com fallback para binário do sistema
 * @returns {string|null}
 */
function getFfmpegPath() {
    // Tenta usar binário empacotado primeiro
    if (binaryPaths?.ffmpeg && fs.existsSync(binaryPaths.ffmpeg)) {
        return binaryPaths.ffmpeg;
    }

    // Fallback para binário do sistema
    try {
        const command = process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg';
        const systemFfmpeg = execSync(command, { encoding: 'utf8' }).trim().split('\n')[0];
        if (systemFfmpeg && fs.existsSync(systemFfmpeg)) {
            console.log('Usando FFmpeg do sistema:', systemFfmpeg);
            return systemFfmpeg;
        }
    } catch (error) {
        // Comando não encontrou o ffmpeg
    }

    console.error('FFmpeg não encontrado');
    return null;
}

/**
 * Obtém o caminho do yt-dlp com fallback para binário do sistema
 * @returns {string|null}
 */
function getYtdlpPath() {
    // Tenta usar binário empacotado primeiro
    if (binaryPaths?.ytdlp && fs.existsSync(binaryPaths.ytdlp)) {
        return binaryPaths.ytdlp;
    }

    // Fallback para binário do sistema
    try {
        const command = process.platform === 'win32' ? 'where yt-dlp' : 'which yt-dlp';
        const systemYtdlp = execSync(command, { encoding: 'utf8' }).trim().split('\n')[0];
        if (systemYtdlp && fs.existsSync(systemYtdlp)) {
            console.log('Usando yt-dlp do sistema:', systemYtdlp);
            return systemYtdlp;
        }
    } catch (error) {
        // Comando não encontrou o yt-dlp
    }

    console.error('yt-dlp não encontrado');
    return null;
}

/**
 * Valida todos os binários necessários
 * @param {Object} paths - Objeto com os caminhos dos binários
 * @returns {boolean}
 */
function validateBinaries(paths) {
    const { ytdlp, ffmpeg } = paths;

    // Verifica existência
    if (!fs.existsSync(ytdlp)) {
        console.error('yt-dlp não encontrado:', ytdlp);
        return false;
    }

    if (!fs.existsSync(ffmpeg)) {
        console.error('ffmpeg não encontrado:', ffmpeg);
        return false;
    }

    // Define permissões de execução
    ensureExecutable(ytdlp);
    ensureExecutable(ffmpeg);

    // Verifica se são executáveis (teste básico)
    try {
        if (process.platform === 'win32') {
            execSync(`"${ytdlp}" --version`, { timeout: 5000 });
            execSync(`"${ffmpeg}" -version`, { timeout: 5000 });
        } else {
            execSync(`${ytdlp} --version`, { timeout: 5000 });
            execSync(`${ffmpeg} -version`, { timeout: 5000 });
        }
        console.log('✓ Binários validados com sucesso');
        return true;
    } catch (error) {
        console.error('Erro ao validar executabilidade dos binários:', error);
        return false;
    }
}

/**
 * Obtém a versão de um binário
 * @param {string} binaryPath - Caminho para o binário
 * @param {string} versionFlag - Flag para obter versão (--version ou -version)
 * @returns {string|null}
 */
function getBinaryVersion(binaryPath, versionFlag = '--version') {
    try {
        const command = process.platform === 'win32'
            ? `"${binaryPath}" ${versionFlag}`
            : `${binaryPath} ${versionFlag}`;

        const output = execSync(command, {
            encoding: 'utf8',
            timeout: 5000
        });

        // Extrai apenas a primeira linha (geralmente contém a versão)
        return output.split('\n')[0].trim();
    } catch (error) {
        console.error(`Erro ao obter versão de ${binaryPath}:`, error);
        return null;
    }
}

/**
 * Loga informações sobre os binários
 */
function logBinariesInfo() {
    if (!binaryPaths) return;

    console.log('='.repeat(60));
    console.log('INFORMAÇÕES DOS BINÁRIOS');
    console.log('='.repeat(60));

    const ytdlpVersion = getBinaryVersion(binaryPaths.ytdlp);
    const ffmpegVersion = getBinaryVersion(binaryPaths.ffmpeg, '-version');

    console.log('yt-dlp:');
    console.log('  Path:', binaryPaths.ytdlp);
    console.log('  Version:', ytdlpVersion || 'Desconhecida');

    console.log('\nFFmpeg:');
    console.log('  Path:', binaryPaths.ffmpeg);
    console.log('  Version:', ffmpegVersion || 'Desconhecida');

    console.log('='.repeat(60));
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

        // Validar binários antes de usar
        if (!validateBinaries(binaryPaths)) {
            throw new Error('Falha na validação dos binários');
        }

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

function getExtraResourcesPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'bin');
    }
    return path.join(__dirname, '..', 'bin');
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

    downloadedFiles.unshift(fileData);
    saveDownloadedFiles();
    return fileData;
}

function removeDownloadedFile(fileId) {
    downloadedFiles = downloadedFiles.filter(file => file.id !== fileId);
    saveDownloadedFiles();
}

function getDownloadedFiles() {
    return downloadedFiles.filter(file => {
        if (file.filePath && fs.existsSync(file.filePath)) {
            return true;
        }
        removeDownloadedFile(file.id);
        return false;
    });
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
    } catch (error) {
        console.error('Error tracking downloaded file:', error);
    }
}

// ============================================================================
// YT-DLP UTILITIES
// ============================================================================

function buildYtdlpArgs(settings, videoUrl, ffmpegPath) {
    const args = ['--progress', '--newline'];

    args.push('-o', path.join(app.getPath('downloads'), '%(title)s.%(ext)s'));
    args.push('--ffmpeg-location', ffmpegPath);
    args.push('--merge-output-format', settings.outputFormat);

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

    args.push('--socket-timeout', settings.socketTimeout.toString());
    args.push('--retries', settings.retries.toString());
    args.push('--fragment-retries', settings.fragmentRetries.toString());
    args.push('--extractor-retries', settings.extractorRetries.toString());

    if (settings.noCheckCertificate) args.push('--no-check-certificate');
    if (settings.ignoreErrors) args.push('--ignore-errors');

    args.push(videoUrl);
    return args;
}

function getVideoInfo(ytdlpPath, videoUrl) {
    return new Promise((resolve) => {
        const infoArgs = ['--dump-json', videoUrl];
        const process = spawn(ytdlpPath, sanitizeArgs(infoArgs));
        let infoJson = '';

        process.stdout.on('data', (data) => {
            infoJson += data.toString();
        });

        process.stderr.on('data', (data) => {
            console.error(`yt-dlp (info) stderr: ${data}`);
        });

        process.on('close', (code) => {
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
            event.sender.send('download-error', 'yt-dlp não encontrado.');
            return null;
        }
    }

    if (!fs.existsSync(ffmpegPath)) {
        ffmpegPath = getFfmpegPath();
        if (!ffmpegPath) {
            event.sender.send('download-error', 'ffmpeg não encontrado.');
            return null;
        }
    }

    return { ytdlpPath, ffmpegPath };
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

ipcMain.on('download-video-with-settings', async (event, videoUrl, settings) => {
    try {
        validateIpcChannel('download-video-with-settings');

        if (!validateVideoUrlOrNotify(event, videoUrl)) return;

        const bin = ensureBinariesReadyOrNotify(event);
        if (!bin) return;

        const { ytdlpPath, ffmpegPath } = bin;

        const videoInfo = await getVideoInfo(ytdlpPath, videoUrl);
        if (!videoInfo) {
            return event.sender.send('download-error', 'Falha ao obter informações do vídeo.');
        }

        const args = buildDownloadArgs(settings, videoUrl, ffmpegPath, videoInfo.acodec);
        runYtdlpProcess(event, ytdlpPath, args, videoUrl);

    } catch (error) {
        console.error('Erro no download:', error);
        event.sender.send('download-error', `Erro no download: ${error.message}`);
    }
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
            message: 'Erro interno ao verificar binários'
        });
    }
});

ipcMain.on('open-downloads-folder', async (event) => {
    try {
        validateIpcChannel('open-downloads-folder');
        const open = (await import('open')).default;
        const downloadsPath = app.getPath('downloads');
        await open(downloadsPath);
    } catch (error) {
        console.error('Erro ao abrir a pasta de downloads:', error);
        event.sender.send('download-error', 'Não foi possível abrir a pasta de downloads.');
    }
});

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
        }
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.loadFile('src/index.html');
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================

app.whenReady().then(async () => {
    try {
        await initializeBinaries();
        logBinariesInfo(); // Log de informações dos binários
        loadDownloadedFiles();
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