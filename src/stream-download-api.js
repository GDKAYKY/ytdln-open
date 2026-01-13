/**
 * API HTTP para Browser Extension
 * Fornece endpoints para download com stream de vídeos
 */

const http = require('http');
const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');

class StreamDownloadAPI extends EventEmitter {
  constructor(videoDownloader, port = 9000, onDesktopProgress = null) {
    super();
    this.videoDownloader = videoDownloader;
    this.port = port;
    this.server = null;
    this.downloads = new Map();
    this.downloadCounter = 0;
    this.onDesktopProgress = onDesktopProgress; // Callback para enviar progresso ao desktop
  }

  /**
   * Iniciar servidor HTTP
   */
  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        // Roteador de endpoints
        if (req.url === '/health' && req.method === 'GET') {
          this.handleHealth(res);
        } else if (req.url === '/api/download' && req.method === 'POST') {
          this.handleDownload(req, res);
        } else if (req.url.match(/^\/api\/download\/(.+)\/progress$/) && req.method === 'GET') {
          const downloadId = req.url.match(/^\/api\/download\/(.+)\/progress$/)[1];
          this.handleProgress(downloadId, res);
        } else if (req.url === '/api/video-info' && req.method === 'POST') {
          this.handleVideoInfo(req, res);
        } else if (req.url.match(/^\/api\/downloads\/?$/) && req.method === 'GET') {
          this.handleListDownloads(res);
        } else if (req.url.match(/^\/api\/download\/(.+)\/cancel$/) && req.method === 'POST') {
          const downloadId = req.url.match(/^\/api\/download\/(.+)\/cancel$/)[1];
          this.handleCancelDownload(downloadId, res);
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      });

      this.server.listen(this.port, 'localhost', () => {
        console.log(`✓ Stream Download API rodando em http://localhost:${this.port}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  /**
   * Parar servidor HTTP
   */
  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(resolve);
      } else {
        resolve();
      }
    });
  }

  /**
   * Health check endpoint
   */
  handleHealth(res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'YTDLN Stream Download API',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }));
  }

  /**
   * Iniciar download
   */
  handleDownload(req, res) {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload muito grande' }));
        req.connection.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { url, format = 'best', subtitles = false } = data;

        if (!url) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'URL é obrigatória' }));
          return;
        }

        const downloadId = this.generateDownloadId();
        const downloadData = {
          id: downloadId,
          url,
          format,
          subtitles,
          status: 'starting',
          progress: 0,
          eta: null,
          speed: null,
          downloaded: 0,
          total: 0,
          error: null,
          startTime: Date.now(),
          endTime: null,
          outputFile: null,
          process: null
        };

        this.downloads.set(downloadId, downloadData);

        // Iniciar download em background
        this.startDownloadTask(downloadId, downloadData);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          downloadId,
          message: 'Download iniciado'
        }));
      } catch (error) {
        console.error('Erro ao processar download:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  }

  /**
   * Obter progresso do download
   */
  handleProgress(downloadId, res) {
    const download = this.downloads.get(downloadId);

    if (!download) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Download não encontrado' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: download.status,
      progress: download.progress,
      eta: download.eta,
      speed: download.speed,
      downloaded: download.downloaded,
      total: download.total,
      error: download.error
    }));
  }

  /**
   * Obter informações do vídeo
   */
  async handleVideoInfo(req, res) {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { url } = data;

        if (!url) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'URL é obrigatória' }));
          return;
        }

        // Aqui você pode chamar o videoDownloader para obter informações
        // Por enquanto, retornamos um placeholder
        const info = {
          title: 'Carregando informações...',
          uploader: 'Desconhecido',
          duration: '00:00',
          description: '',
          formats: ['best', 'audio', 'video', '1080p', '720p'],
          thumbnail: null
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(info));
      } catch (error) {
        console.error('Erro ao obter informações:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  }

  /**
   * Listar todos os downloads
   */
  handleListDownloads(res) {
    const downloads = Array.from(this.downloads.values()).map(d => ({
      id: d.id,
      url: d.url,
      status: d.status,
      progress: d.progress,
      startTime: d.startTime,
      endTime: d.endTime
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ downloads }));
  }

  /**
   * Cancelar download
   */
  handleCancelDownload(downloadId, res) {
    const download = this.downloads.get(downloadId);

    if (!download) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Download não encontrado' }));
      return;
    }

    if (download.process) {
      download.process.kill();
    }

    download.status = 'cancelled';
    download.endTime = Date.now();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Download cancelado' }));
  }

  /**
   * Iniciar tarefa de download
   */
  async startDownloadTask(downloadId, downloadData) {
    try {
      const settings = {
        format: downloadData.format,
        downloadSubtitles: downloadData.subtitles,
        audioOnly: downloadData.format === 'audio'
      };

      downloadData.status = 'downloading';

      // Chamar o videoDownloader com callbacks de progresso
      const result = await this.videoDownloader.download(
        downloadData.url,
        settings,
        {
          onProgress: (progressInfo) => {
            // Se progressInfo for um objeto parseado (com percent, eta, speed)
            if (progressInfo && typeof progressInfo === 'object' && progressInfo.percent !== undefined) {
              downloadData.progress = Math.min(100, progressInfo.percent || 0);
              downloadData.eta = progressInfo.eta || null;
              downloadData.speed = progressInfo.speed || null;
              downloadData.total = progressInfo.total || null;
              
              // Converter objeto parseado para string no formato esperado pelo desktop
              // Formato: [download]  45.0% of 10.00MiB at 2.00MiB/s ETA 00:05
              if (this.onDesktopProgress) {
                const totalStr = progressInfo.total || '0 B';
                const speedStr = progressInfo.speed || '0 B/s';
                const etaStr = progressInfo.eta || '00:00';
                const percentStr = progressInfo.percent.toFixed(1);
                const progressString = `[download]  ${percentStr}% of ${totalStr} at ${speedStr} ETA ${etaStr}`;
                this.onDesktopProgress(progressString);
              }
            }
            // Se for uma string, apenas registrar no console (compatibilidade com outros casos)
            else if (typeof progressInfo === 'string') {
              console.log(`[ytdlp] ${progressInfo}`);
              // Também enviar strings de progresso para desktop
              if (this.onDesktopProgress && typeof progressInfo === 'string') {
                this.onDesktopProgress(progressInfo);
              }
            }
          },
          onError: (error) => {
            downloadData.status = 'error';
            downloadData.error = error;
            downloadData.endTime = Date.now();
            
            // Enviar erro para o desktop via IPC
            if (this.onDesktopProgress) {
              this.onDesktopProgress({ type: 'error', error: error.message || error });
            }
          }
        }
      );

      downloadData.status = 'completed';
      downloadData.progress = 100;
      downloadData.outputFile = result.detectedPath;
      downloadData.endTime = Date.now();

      // Enviar sucesso para o desktop via IPC
      if (this.onDesktopProgress) {
        this.onDesktopProgress({ type: 'success', filePath: result.detectedPath });
      }

      console.log(`✓ Download ${downloadId} completado: ${result.detectedPath}`);
    } catch (error) {
      downloadData.status = 'error';
      downloadData.error = error.message;
      downloadData.endTime = Date.now();
      
      // Enviar erro para o desktop via IPC
      if (this.onDesktopProgress) {
        this.onDesktopProgress({ type: 'error', error: error.message });
      }
      
      console.error(`✗ Download ${downloadId} falhou:`, error);
    }
  }

  /**
   * Gerar ID único para download
   */
  generateDownloadId() {
    return `download_${Date.now()}_${++this.downloadCounter}`;
  }
}

module.exports = StreamDownloadAPI;
