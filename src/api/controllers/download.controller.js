/**
 * Download Controller - Manipula requisições HTTP
 * Valida entrada, chama serviços, formata respostas
 */

const validator = require('../utils/validators');
const fs = require('fs');
const path = require('path');

class DownloadController {
  /**
   * @param {DownloadService} downloadService
   */
  constructor(downloadService) {
    this.downloadService = downloadService;
  }

  /**
   * POST /api/download
   * Criar novo download
   */
  async createDownload(req, res) {
    try {
      const { url, format, outputPath, audioOnly, subtitles } = req.body;

      // Validar entrada
      const validation = validator.validateDownloadRequest({
        url,
        format,
        outputPath,
        audioOnly,
        subtitles
      });

      if (!validation.valid) {
        return res.status(400).json({
          error: validation.error,
          code: validation.code,
          timestamp: new Date().toISOString()
        });
      }

      // Criar download
      const result = this.downloadService.createDownload(url, {
        format: format || 'best',
        outputPath: outputPath || null,
        audioOnly: audioOnly || false,
        subtitles: subtitles || false
      });

      res.status(200).json({
        taskId: result.taskId,
        status: result.status,
        message: result.message
      });

    } catch (error) {
      console.error('[DownloadController] Erro ao criar download:', error);
      res.status(500).json({
        error: 'Erro ao criar download',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/download/status/:taskId
   * Obter status de um download
   */
  getDownloadStatus(req, res) {
    try {
      const { taskId } = req.params;

      const status = this.downloadService.getTaskStatus(taskId);

      if (!status) {
        return res.status(404).json({
          error: 'Download não encontrado',
          code: 'TASK_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      res.status(200).json(status);

    } catch (error) {
      console.error('[DownloadController] Erro ao obter status:', error);
      res.status(500).json({
        error: 'Erro ao obter status',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/download/:taskId/sse
   * Server-Sent Events para progresso em tempo real
   */
  streamProgress(req, res) {
    try {
      const { taskId } = req.params;

      // Verificar se a tarefa existe
      const status = this.downloadService.getTaskStatus(taskId);
      if (!status) {
        return res.status(404).json({
          error: 'Download não encontrado',
          code: 'TASK_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      // Sempre configurar SSE headers primeiro
      const sseManager = this.downloadService.getSSEManager();
      sseManager.subscribe(taskId, res);

      // Se já está completo, enviar evento de conclusão e fechar
      if (status.status === 'completed') {
        sseManager.sendEvent(taskId, 'complete', status);
        setTimeout(() => {
          sseManager.closeAllSubscribers(taskId);
        }, 1000);
        return;
      }

      // Se já está em erro ou cancelado, enviar evento de erro e fechar
      if (status.status === 'error' || status.status === 'cancelled') {
        sseManager.sendEvent(taskId, 'error', status);
        setTimeout(() => {
          sseManager.closeAllSubscribers(taskId);
        }, 1000);
        return;
      }

      // Enviar status inicial após a inscrição (subscribe já configurou headers)
      // Usar sendEvent para enviar com evento nomeado 'progress'
      sseManager.sendEvent(taskId, 'progress', status);

    } catch (error) {
      console.error('[DownloadController] Erro ao configurar SSE:', error);
      res.status(500).json({
        error: 'Erro ao configurar stream',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/downloads
   * Listar todos os downloads
   */
  getAllDownloads(req, res) {
    try {
      const downloads = this.downloadService.getAllDownloads();

      res.status(200).json({
        count: downloads.length,
        downloads,
        stats: this.downloadService.getStats()
      });

    } catch (error) {
      console.error('[DownloadController] Erro ao listar downloads:', error);
      res.status(500).json({
        error: 'Erro ao listar downloads',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * POST /api/download/:taskId/cancel
   * Cancelar um download
   */
  cancelDownload(req, res) {
    try {
      const { taskId } = req.params;

      const success = this.downloadService.cancelDownload(taskId);

      if (!success) {
        return res.status(404).json({
          error: 'Download não encontrado ou já finalizado',
          code: 'TASK_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      res.status(200).json({
        taskId,
        status: 'cancelled',
        message: 'Download cancelado com sucesso'
      });

    } catch (error) {
      console.error('[DownloadController] Erro ao cancelar download:', error);
      res.status(500).json({
        error: 'Erro ao cancelar download',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/download/stats
   * Obter estatísticas da API
   */
  getStats(req, res) {
    try {
      const stats = this.downloadService.getStats();

      res.status(200).json({
        timestamp: new Date().toISOString(),
        stats
      });

    } catch (error) {
      console.error('[DownloadController] Erro ao obter stats:', error);
      res.status(500).json({
        error: 'Erro ao obter estatísticas',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/download/:taskId/file
   * Servir arquivo baixado para download via navegador
   */
  downloadFile(req, res) {
    try {
      const { taskId } = req.params;

      const status = this.downloadService.getTaskStatus(taskId);

      if (!status) {
        return res.status(404).json({
          error: 'Download não encontrado',
          code: 'TASK_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      if (status.status !== 'completed' || !status.outputPath) {
        return res.status(400).json({
          error: 'Download não está completo ou arquivo não disponível',
          code: 'FILE_NOT_READY',
          timestamp: new Date().toISOString()
        });
      }

      const filePath = status.outputPath;

      // Verificar se arquivo existe
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          error: 'Arquivo não encontrado no sistema de arquivos',
          code: 'FILE_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      // Obter nome do arquivo
      const fileName = path.basename(filePath);
      
      // Definir headers para download
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      
      // Enviar arquivo
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        console.error('[DownloadController] Erro ao ler arquivo:', error);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Erro ao ler arquivo',
            code: 'FILE_READ_ERROR',
            timestamp: new Date().toISOString()
          });
        }
      });

    } catch (error) {
      console.error('[DownloadController] Erro ao servir arquivo:', error);
      res.status(500).json({
        error: 'Erro ao servir arquivo',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/download/:taskId/stream
   * Streaming em tempo real - Serve o arquivo enquanto está sendo baixado
   * 
   * Fluxo:
   * 1. Backend inicia download
   * 2. Chrome se conecta a este endpoint
   * 3. Recebe o arquivo conforme o backend vai baixando
   * 4. Sem duplicação, sem buffering duplo
   */
  streamDownload(req, res) {
    try {
      const { taskId } = req.params;

      const status = this.downloadService.getTaskStatus(taskId);

      if (!status) {
        return res.status(404).json({
          error: 'Download não encontrado',
          code: 'TASK_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      // Obter informações do arquivo
      const streamInfo = this.downloadService.getStreamInfo(taskId);
      
      if (!streamInfo) {
        return res.status(400).json({
          error: 'Arquivo não disponível para streaming',
          code: 'FILE_NOT_AVAILABLE',
          timestamp: new Date().toISOString()
        });
      }

      // Definir headers para download
      res.setHeader('Content-Disposition', `attachment; filename="${streamInfo.fileName}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Se arquivo está completo, enviar Content-Length
      if (streamInfo.isComplete && streamInfo.fileSize > 0) {
        res.setHeader('Content-Length', streamInfo.fileSize);
        console.log(`[DownloadController] Streaming completo: ${streamInfo.fileName} (${streamInfo.fileSize} bytes)`);
      } else {
        // Se ainda está sendo baixado, usar chunked
        res.setHeader('Transfer-Encoding', 'chunked');
        console.log(`[DownloadController] Streaming em progresso: ${streamInfo.fileName} (${streamInfo.progress}%)`);
      }

      // Criar stream de leitura
      const fileStream = this.downloadService.createReadStream(taskId);
      
      if (!fileStream) {
        return res.status(500).json({
          error: 'Erro ao criar stream',
          code: 'STREAM_ERROR',
          timestamp: new Date().toISOString()
        });
      }

      // Pipar arquivo para resposta
      fileStream.pipe(res);

      // Tratar erros do stream
      fileStream.on('error', (error) => {
        console.error(`[DownloadController] Erro no stream ${taskId}:`, error);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Erro ao servir stream',
            code: 'STREAM_ERROR',
            timestamp: new Date().toISOString()
          });
        } else {
          res.destroy();
        }
      });

      // Tratar desconexão do cliente
      res.on('close', () => {
        console.log(`[DownloadController] Cliente desconectou do stream ${taskId}`);
        fileStream.destroy();
      });

      res.on('error', (error) => {
        console.error(`[DownloadController] Erro na resposta ${taskId}:`, error);
        fileStream.destroy();
      });

    } catch (error) {
      console.error('[DownloadController] Erro ao servir stream:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Erro ao servir stream',
          code: 'INTERNAL_ERROR',
          timestamp: new Date().toISOString()
        });
      }
    }
  }
}

module.exports = DownloadController;
