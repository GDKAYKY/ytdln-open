/**
 * Download Queue - Sistema de fila com workers
 * Processa downloads em background sem bloquear o thread principal
 */

const { EventEmitter } = require('events');

class DownloadQueue extends EventEmitter {
  /**
   * @param {number} maxConcurrent - Máximo de downloads simultâneos
   */
  constructor(maxConcurrent = 2) {
    super();
    this.maxConcurrent = maxConcurrent;
    this.queue = []; // Fila de tarefas pendentes
    this.activeDownloads = new Map(); // Downloads em execução {taskId: task}
    this.completedDownloads = new Map(); // Downloads completados {taskId: task}
    this.failedDownloads = new Map(); // Downloads falhados {taskId: task}
  }

  /**
   * Adicionar tarefa à fila
   */
  enqueue(downloadTask) {
    this.queue.push(downloadTask);
    this.emit('task-queued', downloadTask.taskId);
    console.log(`[Queue] Task ${downloadTask.taskId} enfileirada. Fila: ${this.queue.length}`);
    
    // Tentar processar imediatamente
    this.processNext();
    
    return downloadTask.taskId;
  }

  /**
   * Processar próxima tarefa se houver espaço
   */
  processNext() {
    if (this.queue.length === 0) {
      return;
    }
    
    if (this.activeDownloads.size >= this.maxConcurrent) {
      console.log(`[Queue] Limite de downloads simultâneos atingido (${this.activeDownloads.size}/${this.maxConcurrent})`);
      return;
    }

    const task = this.queue.shift();
    this.activeDownloads.set(task.taskId, task);
    
    console.log(`[Queue] Iniciando download ${task.taskId}. Ativos: ${this.activeDownloads.size}, Pendentes: ${this.queue.length}`);
    this.emit('task-started', task);
  }

  /**
   * Marcar tarefa como completada
   */
  markAsCompleted(taskId, outputFile) {
    const task = this.activeDownloads.get(taskId);
    
    if (!task) {
      console.error(`[Queue] Tarefa ${taskId} não encontrada em ativo`);
      return;
    }

    task.markAsCompleted(outputFile);
    this.activeDownloads.delete(taskId);
    this.completedDownloads.set(taskId, task);

    console.log(`[Queue] Download ${taskId} completado. Ativos: ${this.activeDownloads.size}`);
    this.emit('task-completed', task);
    
    // Processar próxima tarefa na fila
    this.processNext();
  }

  /**
   * Marcar tarefa como erro
   */
  markAsError(taskId, errorMessage) {
    const task = this.activeDownloads.get(taskId);
    
    if (!task) {
      console.error(`[Queue] Tarefa ${taskId} não encontrada em ativo`);
      return;
    }

    task.markAsError(errorMessage);
    this.activeDownloads.delete(taskId);
    this.failedDownloads.set(taskId, task);

    console.error(`[Queue] Erro no download ${taskId}: ${errorMessage}`);
    this.emit('task-error', task);
    
    // Processar próxima tarefa na fila
    this.processNext();
  }

  /**
   * Cancelar uma tarefa
   */
  cancel(taskId) {
    // Tentar remover da fila
    const queueIndex = this.queue.findIndex(t => t.taskId === taskId);
    if (queueIndex !== -1) {
      const task = this.queue.splice(queueIndex, 1)[0];
      task.markAsCancelled();
      this.emit('task-cancelled', task);
      return true;
    }

    // Tentar cancelar se estiver ativa
    // Nota: O processo não está armazenado na task, será cancelado via DownloadService
    const activeTask = this.activeDownloads.get(taskId);
    if (activeTask) {
      activeTask.markAsCancelled();
      this.activeDownloads.delete(taskId);
      this.emit('task-cancelled', activeTask);
      
      // Processar próxima
      this.processNext();
      return true;
    }

    return false;
  }

  /**
   * Obter status de uma tarefa
   */
  getTaskStatus(taskId) {
    // Procurar em ativo
    if (this.activeDownloads.has(taskId)) {
      return this.activeDownloads.get(taskId).toJSON();
    }

    // Procurar em completado
    if (this.completedDownloads.has(taskId)) {
      return this.completedDownloads.get(taskId).toJSON();
    }

    // Procurar em falhado
    if (this.failedDownloads.has(taskId)) {
      return this.failedDownloads.get(taskId).toJSON();
    }

    // Procurar na fila (pendente)
    const pendingTask = this.queue.find(t => t.taskId === taskId);
    if (pendingTask) {
      return pendingTask.toJSON();
    }

    return null;
  }

  /**
   * Obter todos os downloads
   */
  getAllDownloads() {
    const all = [];
    
    // Fila (pendentes)
    this.queue.forEach(task => all.push({ ...task.toJSON(), _source: 'queue' }));
    
    // Ativos
    this.activeDownloads.forEach(task => all.push({ ...task.toJSON(), _source: 'active' }));
    
    // Completados
    this.completedDownloads.forEach(task => all.push({ ...task.toJSON(), _source: 'completed' }));
    
    // Falhados
    this.failedDownloads.forEach(task => all.push({ ...task.toJSON(), _source: 'failed' }));
    
    return all;
  }

  /**
   * Obter estatísticas da fila
   */
  getStats() {
    return {
      pending: this.queue.length,
      active: this.activeDownloads.size,
      completed: this.completedDownloads.size,
      failed: this.failedDownloads.size,
      total: this.queue.length + this.activeDownloads.size + this.completedDownloads.size + this.failedDownloads.size
    };
  }

  /**
   * Limpar downloads completados/falhados (mantém histórico recente)
   */
  cleanup(ageMinutes = 60) {
    const now = Date.now();
    const ageMs = ageMinutes * 60 * 1000;

    // Limpar completados
    for (const [taskId, task] of this.completedDownloads.entries()) {
      if (task.endTime && (now - task.endTime) > ageMs) {
        this.completedDownloads.delete(taskId);
      }
    }

    // Limpar falhados
    for (const [taskId, task] of this.failedDownloads.entries()) {
      if (task.endTime && (now - task.endTime) > ageMs) {
        this.failedDownloads.delete(taskId);
      }
    }
  }

  /**
   * Obter tarefa ativa (para o serviço de download)
   */
  getNextActiveTask() {
    if (this.activeDownloads.size === 0) {
      return null;
    }
    return Array.from(this.activeDownloads.values())[0];
  }
}

module.exports = DownloadQueue;
