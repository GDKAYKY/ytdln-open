/**
 * EXEMPLO DE INTEGRAÇÃO - Como usar a nova API estruturada
 * 
 * Este arquivo mostra como integrar a nova arquitetura de API REST
 * com o código existente do Electron/YTDLN
 * 
 * Para usar, substitua o código de StreamDownloadAPI no main.js
 */

// ============================================================================
// IMPORTS
// ============================================================================

const express = require('express');
const path = require('path');

// Novos módulos da arquitetura
const DownloadTask = require('./api/models/download.model');
const DownloadQueue = require('./api/services/download-queue');
const SSEManager = require('./api/services/sse-manager');
const DownloadService = require('./api/services/download.service');
const DownloadController = require('./api/controllers/download.controller');
const { createDownloadRouter } = require('./api/routes/download.routes');

// Módulos existentes
const VideoDownloader = require('./video-downloader');
const ProgressParser = require('./progress-parser');


// ============================================================================
// INICIALIZAR API REST COM NOVA ARQUITETURA
// ============================================================================

async function initializeRestAPI(videoDownloader) {
  console.log('🚀 Inicializando REST API com nova arquitetura...');

  // 1. Criar instâncias dos serviços
  const downloadQueue = new DownloadQueue(2); // Max 2 downloads simultâneos
  const sseManager = new SSEManager();
  const downloadService = new DownloadService(videoDownloader, downloadQueue, sseManager);
  const downloadController = new DownloadController(downloadService);

  // 2. Criar Express app
  const app = express();
  app.use(express.json());

  // 3. CORS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // 4. Health Check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'YTDLN REST API v2',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // 5. Registrar rotas de download
  const downloadRouter = createDownloadRouter(downloadController);
  app.use('/api', downloadRouter);

  // 6. Rota raiz (info)
  app.get('/', (req, res) => {
    res.json({
      message: 'YTDLN REST API v2',
      endpoints: {
        health: 'GET /health',
        createDownload: 'POST /api/download',
        getStatus: 'GET /api/download/status/:taskId',
        streamProgress: 'GET /api/download/:taskId/sse',
        listAll: 'GET /api/downloads',
        cancelDownload: 'POST /api/download/:taskId/cancel',
        getStats: 'GET /api/stats'
      }
    });
  });

  // 7. Handler de erro 404
  app.use((req, res) => {
    res.status(404).json({
      error: 'Endpoint não encontrado',
      code: 'NOT_FOUND',
      path: req.path,
      method: req.method
    });
  });

  // 8. Iniciar servidor
  const PORT = 9000;
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, 'localhost', () => {
      console.log(`✓ REST API rodando em http://localhost:${PORT}`);
      console.log(`  - Health: http://localhost:${PORT}/health`);
      console.log(`  - Create Download: POST http://localhost:${PORT}/api/download`);
      console.log(`  - Get Status: GET http://localhost:${PORT}/api/download/status/:taskId`);
      console.log(`  - Stream Progress: GET http://localhost:${PORT}/api/download/:taskId/sse`);
      resolve(server);
    });

    server.on('error', reject);
  });
}


// ============================================================================
// EXEMPLOS DE USO
// ============================================================================

/**
 * Exemplo 1: Cliente JavaScript (Browser)
 * Criar um download via POST
 */
async function exampleCreateDownload() {
  const response = await fetch('http://localhost:9000/api/download', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      format: '720p',
      outputPath: '/downloads',
      audioOnly: false,
      subtitles: true
    })
  });

  const data = await response.json();
  return data.taskId; // ex: "task_1705000000000_abc123"
}


/**
 * Exemplo 2: Monitorar progresso com SSE
 */
function exampleMonitorWithSSE(taskId) {
  const eventSource = new EventSource(`http://localhost:9000/api/download/${taskId}/sse`);

  eventSource.onmessage = (event) => {
    const progress = JSON.parse(event.data);
    console.log(`Progresso: ${progress.progress}% - ${progress.speed}`);

    // Atualizar barra de progresso no DOM
    updateProgressUI(progress);
  };

  eventSource.onerror = (error) => {
    console.error('Erro ao receber progresso:', error);
    eventSource.close();
  };
}


/**
 * Exemplo 3: Polling com intervalo (alternativa ao SSE)
 */
async function exampleMonitorWithPolling(taskId) {
  const checkProgress = async () => {
    const response = await fetch(`http://localhost:9000/api/download/status/${taskId}`);
    const status = await response.json();

    console.log(`Status: ${status.status}, Progresso: ${status.progress}%`);

    if (status.status === 'completed' || status.status === 'error') {
      console.log('Download finalizado!');
      return;
    }

    // Checar novamente em 1 segundo
    setTimeout(checkProgress, 1000);
  };

  checkProgress();
}


/**
 * Exemplo 4: Integração no main.js (Electron)
 */
async function setupElectronWithNewAPI() {
  // ... código Electron existente ...

  // Inicializar VideoDownloader
  const videoDownloader = new VideoDownloader();
  await videoDownloader.init();

  // Inicializar nova API REST
  const server = await initializeRestAPI(videoDownloader);

  // ... resto do código ...

  // Ao fechar aplicação
  app.on('before-quit', () => {
    server.close();
  });
}


// ============================================================================
// EXPORTAR
// ============================================================================

module.exports = {
  initializeRestAPI,
  exampleCreateDownload,
  exampleMonitorWithSSE,
  exampleMonitorWithPolling,
  setupElectronWithNewAPI
};
