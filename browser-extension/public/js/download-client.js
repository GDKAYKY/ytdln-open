/**
 * Download Client JavaScript - Cliente para consumir a API REST
 * Use este arquivo na extensão do navegador ou website
 */

class DownloadClient {
  constructor(baseURL = 'http://localhost:9000') {
    this.baseURL = baseURL;
    this.currentTaskId = null;
    this.eventSource = null;
  }

  /**
   * Validar conexão com o servidor
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      if (!response.ok) {
        return { connected: false, error: response.statusText };
      }
      const data = await response.json();
      return { connected: true, data };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  /**
   * Criar novo download
   */
  async createDownload(url, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}/api/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: url,
          format: options.format || 'best',
          outputPath: options.outputPath || null,
          audioOnly: options.audioOnly || false,
          subtitles: options.subtitles || false
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar download');
      }

      const data = await response.json();
      this.currentTaskId = data.taskId;
      return data;
    } catch (error) {
      console.error('Erro ao criar download:', error);
      throw error;
    }
  }

  /**
   * Obter status atual de um download
   */
  async getStatus(taskId) {
    try {
      const response = await fetch(`${this.baseURL}/api/download/status/${taskId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao obter status');
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao obter status:', error);
      throw error;
    }
  }

  /**
   * Monitorar progresso com Server-Sent Events
   * @param {string} taskId - ID da tarefa
   * @param {object} callbacks - { onProgress, onComplete, onError }
   */
  startMonitoringSSE(taskId, callbacks = {}) {
    if (this.eventSource) {
      this.eventSource.close();
    }

    console.log(`[DownloadClient] Conectando SSE para tarefa ${taskId}`);

    this.eventSource = new EventSource(`${this.baseURL}/api/download/${taskId}/sse`);

    // Mensagem padrão de progresso
    this.eventSource.onmessage = (event) => {
      try {
        const progress = JSON.parse(event.data);
        console.log('[SSE] Progresso:', progress);

        if (callbacks.onProgress) {
          callbacks.onProgress(progress);
        }

        // Se completado, fechar
        if (progress.status === 'completed') {
          this.stopMonitoring();
          if (callbacks.onComplete) {
            callbacks.onComplete(progress);
          }
        }
      } catch (error) {
        console.error('[SSE] Erro ao parsear progresso:', error);
      }
    };

    // Evento de erro
    this.eventSource.addEventListener('error', (event) => {
      try {
        const errorData = JSON.parse(event.data);
        console.error('[SSE] Erro:', errorData);

        if (callbacks.onError) {
          callbacks.onError(errorData);
        }
      } catch (e) {
        console.error('[SSE] Erro na conexão:', e);
        if (callbacks.onError) {
          callbacks.onError({ error: 'Conexão perdida' });
        }
      }
    });

    // Evento de abertura
    this.eventSource.onopen = () => {
      console.log('[SSE] Conexão aberta');
    };

    // Evento de erro de conexão
    this.eventSource.onerror = (error) => {
      console.error('[SSE] Erro de conexão:', error);
      this.eventSource.close();

      if (callbacks.onError) {
        callbacks.onError({ error: 'Falha na conexão SSE' });
      }
    };
  }

  /**
   * Monitorar progresso com polling
   * @param {string} taskId
   * @param {object} callbacks
   * @param {number} interval - Intervalo em ms (default 1000)
   */
  startMonitoringPolling(taskId, callbacks = {}, interval = 1000) {
    console.log(`[DownloadClient] Iniciando polling para tarefa ${taskId}`);

    const pollInterval = setInterval(async () => {
      try {
        const status = await this.getStatus(taskId);
        
        if (callbacks.onProgress) {
          callbacks.onProgress(status);
        }

        if (status.status === 'completed') {
          clearInterval(pollInterval);
          if (callbacks.onComplete) {
            callbacks.onComplete(status);
          }
        } else if (status.status === 'error') {
          clearInterval(pollInterval);
          if (callbacks.onError) {
            callbacks.onError(status);
          }
        }
      } catch (error) {
        console.error('[Polling] Erro:', error);
        clearInterval(pollInterval);
        if (callbacks.onError) {
          callbacks.onError({ error: error.message });
        }
      }
    }, interval);

    return pollInterval;
  }

  /**
   * Parar monitoramento SSE
   */
  stopMonitoring() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('[DownloadClient] Monitoramento parado');
    }
  }

  /**
   * Cancelar um download
   */
  async cancelDownload(taskId) {
    try {
      const response = await fetch(`${this.baseURL}/api/download/${taskId}/cancel`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao cancelar');
      }

      this.stopMonitoring();
      return await response.json();
    } catch (error) {
      console.error('Erro ao cancelar download:', error);
      throw error;
    }
  }

  /**
   * Listar todos os downloads
   */
  async getAllDownloads() {
    try {
      const response = await fetch(`${this.baseURL}/api/downloads`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao listar');
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao listar downloads:', error);
      throw error;
    }
  }

  /**
   * Obter estatísticas da API
   */
  async getStats() {
    try {
      const response = await fetch(`${this.baseURL}/api/stats`);

      if (!response.ok) {
        throw new Error('Erro ao obter estatísticas');
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao obter stats:', error);
      throw error;
    }
  }
}


/**
 * EXEMPLOS DE USO
 */

// ============================================================================
// EXEMPLO 1: Uso Básico com SSE
// ============================================================================

async function exemplo1_BasicSSE() {
  const client = new DownloadClient();

  // Verificar conexão
  const health = await client.checkHealth();
  if (!health.connected) {
    console.error('Servidor não está conectado');
    return;
  }

  try {
    // Criar download
    const result = await client.createDownload(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      {
        format: '720p',
        audioOnly: false,
        subtitles: true
      }
    );

    console.log('Download criado:', result.taskId);

    // Monitorar com SSE
    client.startMonitoringSSE(result.taskId, {
      onProgress: (progress) => {
        console.log(`${progress.progress}% - ${progress.speed} - ETA: ${progress.eta}`);
        updateProgressBar(progress.progress);
      },
      onComplete: (final) => {
        console.log('✅ Download completo!', final.outputPath);
        showNotification('Sucesso', 'Download finalizado!');
      },
      onError: (error) => {
        console.error('❌ Erro:', error.error);
        showNotification('Erro', error.error);
      }
    });

  } catch (error) {
    console.error('Erro:', error.message);
  }
}


// ============================================================================
// EXEMPLO 2: Uso com Polling
// ============================================================================

async function exemplo2_Polling() {
  const client = new DownloadClient();

  try {
    const result = await client.createDownload(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    );

    // Monitorar com polling a cada 2 segundos
    client.startMonitoringPolling(result.taskId, {
      onProgress: (status) => {
        console.log(`Status: ${status.status}, Progresso: ${status.progress}%`);
        updateProgressUI(status);
      },
      onComplete: (final) => {
        console.log('✅ Download completo!');
      },
      onError: (error) => {
        console.error('❌ Erro:', error);
      }
    }, 2000); // Check every 2 seconds

  } catch (error) {
    console.error('Erro:', error.message);
  }
}


// ============================================================================
// EXEMPLO 3: Integração com DOM (HTML)
// ============================================================================

function exemplo3_HTMLIntegration() {
  const client = new DownloadClient();

  // Elementos do DOM
  const urlInput = document.getElementById('videoUrl');
  const downloadBtn = document.getElementById('downloadBtn');
  const progressDiv = document.getElementById('progress');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const statusDiv = document.getElementById('status');
  const cancelBtn = document.getElementById('cancelBtn');

  let currentTaskId = null;

  // Evento: Click em Download
  downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();

    if (!url) {
      alert('Por favor, insira uma URL');
      return;
    }

    try {
      downloadBtn.disabled = true;
      statusDiv.textContent = 'Iniciando download...';
      progressDiv.style.display = 'block';

      const result = await client.createDownload(url, {
        format: '720p'
      });

      currentTaskId = result.taskId;
      cancelBtn.disabled = false;

      // Monitorar com SSE
      client.startMonitoringSSE(result.taskId, {
        onProgress: (progress) => {
          progressBar.style.width = progress.progress + '%';
          progressText.textContent = 
            `${progress.progress}% - ${progress.speed || ''} - ETA: ${progress.eta || 'calculando...'}`;
          statusDiv.textContent = `Status: ${progress.status}`;
        },
        onComplete: (final) => {
          progressBar.style.width = '100%';
          progressText.textContent = 'Download completo!';
          statusDiv.textContent = '✅ Concluído com sucesso!';
          downloadBtn.disabled = false;
          cancelBtn.disabled = true;
        },
        onError: (error) => {
          statusDiv.textContent = `❌ Erro: ${error.error}`;
          downloadBtn.disabled = false;
          cancelBtn.disabled = true;
        }
      });

    } catch (error) {
      statusDiv.textContent = `Erro: ${error.message}`;
      downloadBtn.disabled = false;
    }
  });

  // Evento: Click em Cancelar
  cancelBtn.addEventListener('click', async () => {
    if (!currentTaskId) return;

    try {
      await client.cancelDownload(currentTaskId);
      statusDiv.textContent = 'Download cancelado';
      progressDiv.style.display = 'none';
      cancelBtn.disabled = true;
      downloadBtn.disabled = false;
    } catch (error) {
      statusDiv.textContent = `Erro ao cancelar: ${error.message}`;
    }
  });
}


// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

function updateProgressBar(percent) {
  const bar = document.getElementById('progressBar');
  if (bar) {
    bar.style.width = percent + '%';
  }
}

function updateProgressUI(status) {
  const text = document.getElementById('progressText');
  if (text) {
    text.textContent = `${status.progress}% - ${status.speed || ''} - ${status.eta || ''}`;
  }
}

function showNotification(title, message) {
  // Implementar conforme necessário (toast, alert, etc)
  alert(`${title}: ${message}`);
}


// ============================================================================
// EXPORTAR
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DownloadClient;
}
