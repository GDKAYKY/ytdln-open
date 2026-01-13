/**
 * Download Routes - Define os endpoints REST
 */

const express = require('express');

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
  router.get('/download/status/:taskId', (req, res) => {
    downloadController.getDownloadStatus(req, res);
  });

  /**
   * GET /api/download/:taskId/file
   * Servir arquivo baixado para download via navegador
   * Response: arquivo binário
   * IMPORTANTE: Esta rota deve vir ANTES de /download/:taskId/sse
   */
  router.get('/download/:taskId/file', (req, res) => {
    downloadController.downloadFile(req, res);
  });

  /**
   * GET /api/download/:taskId/sse
   * Server-Sent Events para progresso em tempo real
   * Response: text/event-stream
   */
  router.get('/download/:taskId/sse', (req, res) => {
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
  router.post('/download/:taskId/cancel', (req, res) => {
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
