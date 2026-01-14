/**
 * Download Routes - Define os endpoints REST
 */

const express = require('express');
const { validateTaskId } = require('../utils/validators');

/**
 * Middleware para validar taskId
 */
function validateTaskIdMiddleware(req, res, next) {
  const { taskId } = req.params;
  const validation = validateTaskId(taskId);
  
  if (!validation.valid) {
    return res.status(400).json({
      error: validation.error,
      code: validation.code,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
}

/**
 * Criar router de downloads
 * @param {DownloadController} downloadController
 */
function createDownloadRouter(downloadController) {
  const router = express.Router();

  /**
   * POST /api/download
   * Criar novo download
   * Body: { url, format?, outputPath?, audioOnly?, subtitles? }
   * Response: { taskId, status, message }
   */
  router.post('/download', (req, res) => {
    downloadController.createDownload(req, res);
  });

  /**
   * GET /api/download/status/:taskId
   * Obter status do download
   * Response: { taskId, status, progress, ... }
   */
  router.get('/download/status/:taskId', validateTaskIdMiddleware, (req, res) => {
    downloadController.getDownloadStatus(req, res);
  });

  /**
   * GET /api/download/:taskId/file
   * Servir arquivo baixado para download via navegador
   * Response: arquivo binário
   * IMPORTANTE: Esta rota deve vir ANTES de /download/:taskId/sse
   */
  router.get('/download/:taskId/file', validateTaskIdMiddleware, (req, res) => {
    downloadController.downloadFile(req, res);
  });

  /**
   * GET /api/download/:taskId/stream
   * Streaming em tempo real - Serve o arquivo enquanto está sendo baixado
   * 
   * Fluxo:
   * 1. Backend inicia download
   * 2. Chrome se conecta a este endpoint
   * 3. Recebe o arquivo conforme o backend vai baixando
   * 4. Sem duplicação, sem buffering duplo
   * 
   * Response: arquivo binário (streaming)
   */
  router.get('/download/:taskId/stream', validateTaskIdMiddleware, (req, res) => {
    downloadController.streamDownload(req, res);
  });

  /**
   * GET /api/download/:taskId/sse
   * Server-Sent Events para progresso em tempo real
   * Response: text/event-stream
   */
  router.get('/download/:taskId/sse', validateTaskIdMiddleware, (req, res) => {
    downloadController.streamProgress(req, res);
  });

  /**
   * GET /api/downloads
   * Listar todos os downloads
   * Response: { count, downloads[], stats }
   */
  router.get('/downloads', (req, res) => {
    downloadController.getAllDownloads(req, res);
  });

  /**
   * POST /api/download/:taskId/cancel
   * Cancelar um download
   * Response: { taskId, status, message }
   */
  router.post('/download/:taskId/cancel', validateTaskIdMiddleware, (req, res) => {
    downloadController.cancelDownload(req, res);
  });

  /**
   * GET /api/stats
   * Obter estatísticas da fila
   * Response: { timestamp, stats }
   */
  router.get('/stats', (req, res) => {
    downloadController.getStats(req, res);
  });

  return router;
}

module.exports = { createDownloadRouter };
