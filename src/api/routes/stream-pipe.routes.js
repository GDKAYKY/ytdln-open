/**
 * Stream Pipe Routes - Endpoints para streaming direto
 */

const express = require('express');
const { validateTaskId } = require('../utils/validators');

function validateTaskIdMiddleware(req, res, next) {
  const { taskId } = req.params;
  const validation = validateTaskId(taskId);
  
  if (!validation.valid) {
    return res.status(400).json({
      error: validation.error,
      code: validation.code,
    });
  }
  
  next();
}

function createStreamPipeRouter(streamPipeController) {
  const router = express.Router();

  /**
   * POST /api/stream-pipe
   * Iniciar stream direto
   */
  router.post('/stream-pipe', (req, res) => {
    streamPipeController.createStream(req, res);
  });

  /**
   * GET /api/stream-pipe/:taskId/stream
   * Servir stream do vídeo
   */
  router.get('/stream-pipe/:taskId/stream', validateTaskIdMiddleware, (req, res) => {
    streamPipeController.getStream(req, res);
  });

  /**
   * GET /api/stream-pipe/:taskId/status
   * Obter status do stream
   */
  router.get('/stream-pipe/:taskId/status', validateTaskIdMiddleware, (req, res) => {
    streamPipeController.getStreamStatus(req, res);
  });

  /**
   * POST /api/stream-pipe/:taskId/stop
   * Parar stream
   */
  router.post('/stream-pipe/:taskId/stop', validateTaskIdMiddleware, (req, res) => {
    streamPipeController.stopStream(req, res);
  });

  return router;
}

module.exports = { createStreamPipeRouter };
