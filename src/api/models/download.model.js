/**
 * Download Model - Estrutura de dados para um download
 * Define a forma e validação de dados de download
 */

class DownloadTask {
  /**
   * @param {string} url - URL do vídeo
   * @param {object} options - Opções de download
   */
  constructor(url, options = {}) {
    // Identificadores
    this.taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Entrada
    this.url = url;
    this.format = options.format || 'best';
    this.outputPath = options.outputPath || null;
    this.audioOnly = options.audioOnly || false;
    this.subtitles = options.subtitles || false;
    
    // Estado
    this.status = 'pending'; // pending, downloading, merging, processing, completed, error, cancelled
    this.phase = null; // download, merge, postproc, etc
    
    // Progresso
    this.progress = 0; // 0-100 %
    this.speed = null; // "5.23 MiB/s"
    this.eta = null; // "00:23"
    this.total = null; // "123.45 MiB"
    this.downloaded = null; // "56.12 MiB"
    
    // Timing
    this.startTime = null; // timestamp
    this.endTime = null; // timestamp
    this.elapsedTime = '00:00'; // formatted time
    
    // Resultado
    this.outputFile = null; // Caminho do arquivo final
    this.error = null; // Mensagem de erro
    
    // Internals
    this.process = null; // ChildProcess do ytdlp
    this.progressHistory = []; // Histórico de progresso
  }

  /**
   * Retornar status público (serializável)
   */
  toJSON() {
    return {
      taskId: this.taskId,
      status: this.status,
      phase: this.phase,
      progress: this.progress,
      speed: this.speed,
      eta: this.eta,
      total: this.total,
      downloaded: this.downloaded,
      startTime: this.startTime,
      elapsedTime: this.elapsedTime,
      outputPath: this.outputFile,
      error: this.error,
      url: this.url // para referência
    };
  }

  /**
   * Atualizar progresso
   */
  updateProgress(progressData) {
    if (progressData.percent !== undefined) {
      this.progress = Math.min(100, progressData.percent);
    }
    if (progressData.speed) {
      this.speed = progressData.speed;
    }
    if (progressData.eta) {
      this.eta = progressData.eta;
    }
    if (progressData.total) {
      this.total = progressData.total;
    }
    if (progressData.downloaded) {
      this.downloaded = progressData.downloaded;
    }
    
    // Registrar no histórico
    this.progressHistory.push({
      timestamp: Date.now(),
      ...progressData
    });
    
    // Manter apenas últimas 100 atualizações
    if (this.progressHistory.length > 100) {
      this.progressHistory.shift();
    }
  }

  /**
   * Marcar como completo
   */
  markAsCompleted(outputFile) {
    this.status = 'completed';
    this.progress = 100;
    this.outputFile = outputFile;
    this.endTime = Date.now();
    this.phase = null;
  }

  /**
   * Marcar como erro
   */
  markAsError(errorMessage) {
    this.status = 'error';
    this.error = errorMessage;
    this.endTime = Date.now();
  }

  /**
   * Marcar como cancelado
   */
  markAsCancelled() {
    this.status = 'cancelled';
    this.endTime = Date.now();
  }

  /**
   * Calcular tempo decorrido
   */
  getElapsedTime() {
    if (!this.startTime) return '00:00';
    
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * Atualizar tempo decorrido no objeto
   */
  updateElapsedTime() {
    this.elapsedTime = this.getElapsedTime();
  }
}

module.exports = DownloadTask;
