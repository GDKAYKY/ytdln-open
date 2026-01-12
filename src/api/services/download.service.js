/**
 * Download Service - Orquestra o processo de download
 * Conecta VideoDownloader, Queue, ProgressParser e SSEManager
 */

const DownloadTask = require('../models/download.model');
const ProgressParser = require('../../progress-parser');

class DownloadService {
  /**
   * @param {VideoDownloader} videoDownloader
   * @param {DownloadQueue} downloadQueue
   * @param {SSEManager} sseManager
   */
  constructor(videoDownloader, downloadQueue, sseManager) {
    this.videoDownloader = videoDownloader;
    this.downloadQueue = downloadQueue;
    this.sseManager = sseManager;

    // Listener para quando uma tarefa é iniciada
    this.downloadQueue.on('task-started', (task) => {
      this.executeDownload(task);
    });
  }

  /**
   * Criar nova tarefa de download e enfileirar
   */
  createDownload(url, options = {}) {
    const task = new DownloadTask(url, options);
    task.startTime = Date.now();

    const taskId = this.downloadQueue.enqueue(task);

    return {
      taskId,
      status: task.status,
      message: 'Download enfileirado'
    };
  }

  /**
   * Executar download (chamado pelo queue)
   */
  async executeDownload(task) {
    console.log(`[DownloadService] Executando download ${task.taskId}`);

    try {
      task.status = 'downloading';
      task.startTime = Date.now();
      task.updateElapsedTime();

      // Enviar status inicial de "downloading" para todos os subscribers
      this.sseManager.sendEvent(task.taskId, 'progress', task.toJSON());

      // Preparar callbacks
      const callbacks = {
        onProgress: (progressInfo) => {
          // Se receber objeto parseado, usar diretamente
          if (progressInfo && typeof progressInfo === 'object' && progressInfo.percent !== undefined) {
            task.updateProgress(progressInfo);
            task.status = 'downloading';
            task.phase = 'download';
            task.updateElapsedTime();

            // Enviar para todos os subscribers via SSE com evento nomeado
            this.sseManager.sendEvent(task.taskId, 'progress', task.toJSON());
          }
          // Se receber string, fazer parse
          else if (typeof progressInfo === 'string') {
            const parsed = ProgressParser.parseProgressLine(progressInfo);
            if (parsed) {
              task.updateProgress(parsed);
              task.status = 'downloading';
              task.phase = 'download';
              task.updateElapsedTime();

              // Enviar para subscribers com evento nomeado
              this.sseManager.sendEvent(task.taskId, 'progress', task.toJSON());
            }

            // Detectar outras fases
            if (progressInfo.includes('[Merger]')) {
              task.status = 'merging';
              task.phase = 'merge';
              this.sseManager.sendEvent(task.taskId, 'progress', task.toJSON());
            }

            if (progressInfo.includes('[Fixup')) {
              task.status = 'processing';
              task.phase = 'postproc';
              this.sseManager.sendEvent(task.taskId, 'progress', task.toJSON());
            }
          }
        },

        onError: (error) => {
          console.error(`[DownloadService] Erro: ${error}`);
          task.markAsError(error);
          this.downloadQueue.markAsError(task.taskId, error);
          this.sseManager.sendEvent(task.taskId, 'error', { error });
        }
      };

      // Chamar o videoDownloader
      // Mapear parâmetros da API REST para o formato esperado pelo VideoDownloader
      const settings = {
        outputFormat: 'mp4',
        quality: task.format === 'audio' ? 'best' : (task.format || 'best'),
        concurrentFragments: 8,
        embedSubs: task.subtitles || false,
        writeInfoJson: false,
        writeThumbnail: true,
        writeDescription: false,
        userAgent: '',
        referer: '',
        socketTimeout: 30,
        retries: 5,
        fragmentRetries: 5,
        extractorRetries: 3,
        noCheckCertificate: true,
        ignoreErrors: true,
        audioFormat: task.audioOnly ? 'mp3' : 'best'
      };

      // Se for apenas áudio, ajustar formato
      if (task.audioOnly || task.format === 'audio') {
        settings.outputFormat = 'mp3';
        settings.quality = 'best';
      }

      const result = await this.videoDownloader.download(
        task.url,
        settings,
        callbacks
      );

      // Sucesso!
      task.progress = 100;
      task.status = 'completed';
      task.phase = null;
      task.outputFile = result.detectedPath;

      // Marcar como completo na fila
      this.downloadQueue.markAsCompleted(task.taskId, result.detectedPath);

      // Enviar último progresso com evento de conclusão
      this.sseManager.sendEvent(task.taskId, 'complete', task.toJSON());

      console.log(`[DownloadService] Download completo: ${task.taskId}`);

      // Fechar SSE após 5 segundos (para cliente receber a última mensagem)
      setTimeout(() => {
        this.sseManager.closeAllSubscribers(task.taskId);
      }, 5000);

    } catch (error) {
      console.error(`[DownloadService] Exceção no download ${task.taskId}:`, error);
      task.markAsError(error.message);
      this.downloadQueue.markAsError(task.taskId, error.message);
      this.sseManager.sendEvent(task.taskId, 'error', { error: error.message });
    }
  }

  /**
   * Obter status de uma tarefa
   */
  getTaskStatus(taskId) {
    return this.downloadQueue.getTaskStatus(taskId);
  }

  /**
   * Listar todos os downloads
   */
  getAllDownloads() {
    return this.downloadQueue.getAllDownloads();
  }

  /**
   * Obter estatísticas
   */
  getStats() {
    return {
      queue: this.downloadQueue.getStats(),
      sse: this.sseManager.getStats()
    };
  }

  /**
   * Cancelar um download
   */
  cancelDownload(taskId) {
    const success = this.downloadQueue.cancel(taskId);
    if (success) {
      this.sseManager.closeAllSubscribers(taskId);
    }
    return success;
  }

  /**
   * Obter instância do SSEManager (para uso no controller)
   */
  getSSEManager() {
    return this.sseManager;
  }
}

module.exports = DownloadService;
